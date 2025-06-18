import mongoose, { startSession } from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import config from '../../config';
import AppError from '../../errors/AppError';
import {
  deleteFileFromCloudinary,
  extractPublicIdFromUrl,
  sendFileToCloudinary,
  sendImageToCloudinary,
} from '../../utils/sendImageToCloudinary';
import { StringValue } from '../Auth/auth.constant';
import { createToken } from '../Auth/auth.utils';
import { IStudent } from '../Student/student.interface';
import { AdminSearchableFields, USER_ROLE } from './user.constant';
import { IUser } from './user.interface';
import { User } from './user.model';
import httpStatus from 'http-status';
import { Student } from '../Student/student.model';
import { ITeacher } from '../Teacher/teacher.interface';
import { Teacher } from '../Teacher/teacher.model';
import { sendEmail } from '../../utils/sendEmail';
import { otpOperations } from '../../config/redis';

interface CloudinaryResponse {
  secure_url: string;
}

const createStudentIntoDB = async (
  file: any,
  password: string,
  payload: IStudent,
) => {
  const userData: Partial<IUser> = {
    role: USER_ROLE.student,
    password,
    email: payload.email,
  };

  const session = await startSession();
  session.startTransaction();

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: payload.email });
    if (existingUser) {
      if (existingUser.isVerified) {
        throw new AppError(
          httpStatus.CONFLICT,
          'User already exists with this email address. Please login instead.'
        );
      } else {
        // User exists but is not verified - resend OTP
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        await otpOperations.setOTP(payload.email, verificationCode, 300);

        // Send verification email
        const emailSubject = 'Verify Your Email - Green Uni Mind';
        const emailBody = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="X-UA-Compatible" content="IE=edge" />
            <title>Email Verification</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.5;
                color: #333;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #ffffff;
              }
              .header {
                text-align: center;
                padding: 20px 0;
                border-bottom: 1px solid #eaeaea;
              }
              .content {
                padding: 30px 20px;
                text-align: center;
              }
              .code {
                background-color: #f5f5f5;
                padding: 15px;
                text-align: center;
                font-size: 32px;
                letter-spacing: 8px;
                font-weight: bold;
                margin: 20px 0;
                border-radius: 6px;
                color: #333;
              }
              .footer {
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #eaeaea;
                color: #888;
                font-size: 12px;
              }
              .note {
                font-size: 14px;
                color: #666;
                margin-top: 20px;
              }
              .expires {
                color: #e53e3e;
                font-weight: 500;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="color: #10b981; margin: 0;">Green Uni Mind</h1>
              </div>
              <div class="content">
                <h2>Verify Your Email Address</h2>
                <p>You already have an account with this email. Please verify your email address to complete the registration:</p>
                <div class="code">${verificationCode}</div>
                <p class="note">This code will <span class="expires">expire in 5 minutes</span>.</p>
                <p>If you did not request this verification, please ignore this email.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Green Uni Mind. All rights reserved.</p>
                <p>This is an automated email, please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await sendEmail(payload.email, emailBody, emailSubject);

        throw new AppError(
          httpStatus.CONFLICT,
          'An account with this email already exists but is not verified. A new verification code has been sent to your email.',
          {
            requiresVerification: true,
            email: payload.email,
            otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
          }
        );
      }
    }

    // Check professional-grade rate limiting for OTP requests
    const rateLimit = await otpOperations.checkOTPRateLimit(payload.email);
    if (!rateLimit.allowed) {
      const timeRemaining = Math.ceil((rateLimit.resetTime - Date.now()) / 60000);

      if (rateLimit.isLocked) {
        throw new AppError(
          httpStatus.TOO_MANY_REQUESTS,
          rateLimit.lockReason || 'Account temporarily locked due to too many requests.',
          {
            isLocked: true,
            lockDuration: rateLimit.lockDuration,
            resetTime: rateLimit.resetTime,
            timeRemaining
          }
        );
      }

      throw new AppError(
        httpStatus.TOO_MANY_REQUESTS,
        `Too many OTP requests. You have ${rateLimit.remaining} attempts remaining. Please try again after ${timeRemaining} minutes.`,
        {
          remaining: rateLimit.remaining,
          resetTime: rateLimit.resetTime,
          timeRemaining
        }
      );
    }

    const imagePromise = file
      ? sendFileToCloudinary(`${payload?.name}`, file?.path)
      : Promise.resolve(null);

    // Generate a verification code (6 digits)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with 5-minute expiration
    await otpOperations.setOTP(payload.email, verificationCode, 300);

    // Don't store verification code in user data anymore - use Redis only
    userData.isVerified = false;

    const userPromise = User.create([userData], { session });

    const [imageUploadResult, newUser] = await Promise.all([
      imagePromise,
      userPromise,
    ]);

    if (!newUser.length) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create user');
    }

    // Send verification email with modern template
    const emailSubject = 'Verify Your Email - Green Uni Mind';
    const emailBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <title>Email Verification</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.5;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 1px solid #eaeaea;
          }
          .content {
            padding: 30px 20px;
            text-align: center;
          }
          .code {
            background-color: #f5f5f5;
            padding: 15px;
            text-align: center;
            font-size: 32px;
            letter-spacing: 8px;
            font-weight: bold;
            margin: 20px 0;
            border-radius: 6px;
            color: #333;
          }
          .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #eaeaea;
            color: #888;
            font-size: 12px;
          }
          .note {
            font-size: 14px;
            color: #666;
            margin-top: 20px;
          }
          .expires {
            color: #e53e3e;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: #10b981; margin: 0;">Green Uni Mind</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for registering with Green Uni Mind. Please use the following code to verify your email address:</p>
            <div class="code">${verificationCode}</div>
            <p class="note">This code will <span class="expires">expire in 5 minutes</span>.</p>
            <p>If you did not request this verification, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Green Uni Mind. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(payload.email, emailBody, emailSubject);

    payload.profileImg = imageUploadResult?.secure_url || payload.profileImg;
    payload.user = new mongoose.Types.ObjectId(newUser[0]._id);

    // Update user's photoUrl with the uploaded image URL
    if (imageUploadResult?.secure_url) {
      await User.findByIdAndUpdate(
        newUser[0]._id,
        { photoUrl: imageUploadResult.secure_url },
        { session }
      );
    }

    const newStudent = await Student.create([payload], { session });

    if (!newStudent.length) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create student');
    }

    await session.commitTransaction();
    await session.endSession();

    // Don't generate tokens until email is verified
    return {
      newStudent,
      message: 'Student created successfully. Please check your email for verification code.',
      isVerified: false
    };
  } catch (error: any) {
    await session.abortTransaction();
    await session.endSession();
    console.error('Error creating student:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create student',
    );
  }
};

const createTeacherIntoDB = async (
  file: any,
  password: string,
  payload: ITeacher,
) => {
  const userData: Partial<IUser> = {
    role: USER_ROLE.teacher,
    password,
    email: payload.email,
  };

  const session = await startSession();
  session.startTransaction();

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: payload.email });
    if (existingUser) {
      if (existingUser.isVerified) {
        throw new AppError(
          httpStatus.CONFLICT,
          'User already exists with this email address. Please login instead.'
        );
      } else {
        // User exists but is not verified - resend OTP
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        await otpOperations.setOTP(payload.email, verificationCode, 300);

        // Send verification email
        const emailSubject = 'Verify Your Email - Green Uni Mind';
        const emailBody = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="X-UA-Compatible" content="IE=edge" />
            <title>Email Verification</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.5;
                color: #333;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #ffffff;
              }
              .header {
                text-align: center;
                padding: 20px 0;
                border-bottom: 1px solid #eaeaea;
              }
              .content {
                padding: 30px 20px;
                text-align: center;
              }
              .code {
                background-color: #f5f5f5;
                padding: 15px;
                text-align: center;
                font-size: 32px;
                letter-spacing: 8px;
                font-weight: bold;
                margin: 20px 0;
                border-radius: 6px;
                color: #333;
              }
              .footer {
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #eaeaea;
                color: #888;
                font-size: 12px;
              }
              .note {
                font-size: 14px;
                color: #666;
                margin-top: 20px;
              }
              .expires {
                color: #e53e3e;
                font-weight: 500;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="color: #10b981; margin: 0;">Green Uni Mind</h1>
              </div>
              <div class="content">
                <h2>Verify Your Email Address</h2>
                <p>You already have an account with this email. Please verify your email address to complete the registration:</p>
                <div class="code">${verificationCode}</div>
                <p class="note">This code will <span class="expires">expire in 5 minutes</span>.</p>
                <p>If you did not request this verification, please ignore this email.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Green Uni Mind. All rights reserved.</p>
                <p>This is an automated email, please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await sendEmail(payload.email, emailBody, emailSubject);

        throw new AppError(
          httpStatus.CONFLICT,
          'An account with this email already exists but is not verified. A new verification code has been sent to your email.',
          {
            requiresVerification: true,
            email: payload.email,
            otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
          }
        );
      }
    }

    // Check professional-grade rate limiting for OTP requests
    const rateLimit = await otpOperations.checkOTPRateLimit(payload.email);
    if (!rateLimit.allowed) {
      const timeRemaining = Math.ceil((rateLimit.resetTime - Date.now()) / 60000);

      if (rateLimit.isLocked) {
        throw new AppError(
          httpStatus.TOO_MANY_REQUESTS,
          rateLimit.lockReason || 'Account temporarily locked due to too many requests.',
          {
            isLocked: true,
            lockDuration: rateLimit.lockDuration,
            resetTime: rateLimit.resetTime,
            timeRemaining
          }
        );
      }

      throw new AppError(
        httpStatus.TOO_MANY_REQUESTS,
        `Too many OTP requests. You have ${rateLimit.remaining} attempts remaining. Please try again after ${timeRemaining} minutes.`,
        {
          remaining: rateLimit.remaining,
          resetTime: rateLimit.resetTime,
          timeRemaining
        }
      );
    }

    const imagePromise = file
      ? sendImageToCloudinary(`${payload?.name}`, file?.path)
      : Promise.resolve(null);

    // Generate a verification code (6 digits)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with 5-minute expiration
    await otpOperations.setOTP(payload.email, verificationCode, 300);

    // Don't store verification code in user data anymore - use Redis only
    userData.isVerified = false;

    const userPromise = User.create([userData], { session });

    const [imageUploadResult, newUser] = await Promise.all([
      imagePromise,
      userPromise,
    ]);

    if (!newUser.length) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create user');
    }

    // Send verification email with modern template
    const emailSubject = 'Verify Your Email - Green Uni Mind';
    const emailBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <title>Email Verification</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.5;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 1px solid #eaeaea;
          }
          .content {
            padding: 30px 20px;
            text-align: center;
          }
          .code {
            background-color: #f5f5f5;
            padding: 15px;
            text-align: center;
            font-size: 32px;
            letter-spacing: 8px;
            font-weight: bold;
            margin: 20px 0;
            border-radius: 6px;
            color: #333;
          }
          .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #eaeaea;
            color: #888;
            font-size: 12px;
          }
          .note {
            font-size: 14px;
            color: #666;
            margin-top: 20px;
          }
          .expires {
            color: #e53e3e;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: #10b981; margin: 0;">Green Uni Mind</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for registering with Green Uni Mind. Please use the following code to verify your email address:</p>
            <div class="code">${verificationCode}</div>
            <p class="note">This code will <span class="expires">expire in 5 minutes</span>.</p>
            <p>If you did not request this verification, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Green Uni Mind. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(payload.email, emailBody, emailSubject);

    payload.profileImg = imageUploadResult?.secure_url || payload.profileImg;
    payload.user = new mongoose.Types.ObjectId(newUser[0]._id);

    // Update user's photoUrl with the uploaded image URL
    if (imageUploadResult?.secure_url) {
      await User.findByIdAndUpdate(
        newUser[0]._id,
        { photoUrl: imageUploadResult.secure_url },
        { session }
      );
    }

    const newTeacher = await Teacher.create([payload], { session });

    if (!newTeacher.length) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create teacher');
    }

    await session.commitTransaction();
    await session.endSession();

    // Don't generate tokens until email is verified
    return {
      newTeacher,
      message: 'Teacher created successfully. Please check your email for verification code.',
      isVerified: false
    };
  } catch (error: any) {
    await session.abortTransaction();
    await session.endSession();
    console.error('Error creating teacher:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create teacher',
    );
  }
};

const getAllUserFromDB = async (query: Record<string, unknown>) => {
  const adminQuery = new QueryBuilder(User.find(), query)
    .search(AdminSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await adminQuery.modelQuery;
  const meta = await adminQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getSingleUserFromDB = async (id: string) => {
  const result = await User.findById(id).select('+googleId +facebookId +appleId +connectedAccounts');

  return result;
};

const changeStatus = async (
  id: string,
  payload: {
    status: string;
  },
) => {
  const result = await User.findByIdAndUpdate(id, payload, {
    new: true,
  });

  return result;
};

const getMe = async (email: string, role: string) => {
  let result = null;

  switch (role) {
    case USER_ROLE.student:
      result = await Student.findOne({ email }).populate({
        path: 'user',
        select: '+googleId +facebookId +appleId +connectedAccounts'
      });
      break;

    case USER_ROLE.teacher:
      result = await Teacher.findOne({ email }).populate({
        path: 'user',
        select: '+googleId +facebookId +appleId +connectedAccounts'
      });
      break;

    default:
      throw new Error('Invalid role');
  }

  return result;
};

const updateUserProfile = async (
  id: string,
  payload: Partial<IStudent | ITeacher>,
  role: string,
  file?: any,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let userProfile;
    let Model: any;

    // Determine the model based on the role
    if (role === USER_ROLE.student) {
      Model = Student;
    } else if (role === USER_ROLE.teacher) {
      Model = Teacher;
    } else {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid role');
    }

    // Find the user profile (student or teacher) and populate user data
    userProfile = await Model.findById(id).session(session).populate('user');
    if (!userProfile) {
      throw new AppError(httpStatus.NOT_FOUND, `${role} not found`);
    }

    // Update the user profile's name if provided
    if (payload.name) {
      userProfile.name = {
        firstName: payload.name.firstName || userProfile.name.firstName,
        middleName: payload.name.middleName || userProfile.name.middleName,
        lastName: payload.name.lastName || userProfile.name.lastName,
      };
    }

    let imageUploadResult: CloudinaryResponse | null = null;

    // Handle file upload and delete old image if necessary
    if (file) {
      const deleteImagePromise = userProfile.profileImg
        ? deleteFileFromCloudinary(
            extractPublicIdFromUrl(userProfile.profileImg) as string,
          ) // Type assertion for safety
        : Promise.resolve(null);

      const uploadImagePromise = sendFileToCloudinary(file.fileName, file.path);

      // Wait for both promises to resolve
      const [, uploadResult] = await Promise.all([
        deleteImagePromise,
        uploadImagePromise,
      ]);

      imageUploadResult = uploadResult as CloudinaryResponse | null;

      // Ensure imageUploadResult is not null and assign the image URL with timestamp
      if (imageUploadResult) {
        const timestamp = new Date().getTime(); // Unique timestamp
        userProfile.profileImg = `${imageUploadResult.secure_url}?v=${timestamp}`;
      }
    }

    // Save updated user profile data
    const updatedUserProfile = await userProfile.save({ session });

    // Update associated user data (photoUrl)
    const user = await User.findById(userProfile.user).session(session);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    await User.findByIdAndUpdate(
      user._id,
      { $set: { photoUrl: userProfile.profileImg || user.photoUrl } },
      { new: true, runValidators: true, session },
    );

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return updatedUserProfile;
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error during transaction:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to update user and ${role}: ${error.message || error}`,
    );
  }
};

export const UserServices = {
  // registerUserIntoDB,
  createStudentIntoDB,
  createTeacherIntoDB,
  getAllUserFromDB,
  getSingleUserFromDB,
  changeStatus,
  getMe,
  updateUserProfile,
};
