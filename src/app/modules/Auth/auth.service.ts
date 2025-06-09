import bcrypt from 'bcrypt';
import AppError from '../../errors/AppError';
import { User } from '../User/user.model';
import { ILoginUser } from './auth.interface';
import httpStatus from 'http-status';
import { createToken, emailTemplate, verifyToken } from './auth.utils';
import config from '../../config';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { sendEmail } from '../../utils/sendEmail';
import { StringValue } from './auth.constant';
import { Student } from '../Student/student.model';
import { Teacher } from '../Teacher/teacher.model';

const loginUser = async (payload: ILoginUser) => {
  const user = await User.isUserExists(payload.email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user is not found !');
  }

  // checking if the user is already deleted

  const isDeleted = user?.isDeleted;

  if (isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted !');
  }

  // checking if the user is blocked

  const userStatus = user?.status;

  if (userStatus === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked ! !');
  }

  //checking if the password is correct

  if (!(await User.isPasswordMatched(payload?.password, user?.password))) {
    throw new AppError(httpStatus.FORBIDDEN, 'Password do not matched');
  }

  // create token and sent to the client
  const jwtPayload = {
    email: user.email,
    role: user.role,
    _id: user._id?.toString(),
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as StringValue,
  );

  const refreshToken = createToken(
    jwtPayload,
    config.jwt_refresh_secret as string,
    config.jwt_refresh_expires_in as StringValue,
  );

  let roleDetails = null;

  switch (user.role) {
    case 'student':
      roleDetails = await Student.findOne({
        user: user._id,
      }).lean();
      if (!roleDetails) {
        throw new AppError(httpStatus.NOT_FOUND, 'Student profile not found!');
      }
      break;
    case 'teacher':
      roleDetails = await Teacher.findOne({
        user: user._id,
      }).lean();
      if (!roleDetails) {
        throw new AppError(httpStatus.NOT_FOUND, 'Student profile not found!');
      }
      break;
    default:
      throw new AppError(httpStatus.FORBIDDEN, 'Invalid role!');
  }

  const { email: _email, ...safeRoleDetails } = roleDetails;

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
      ...safeRoleDetails,
    },
  };
};

const changePassword = async (
  userData: JwtPayload,
  payload: { oldPassword: string; newPassword: string },
) => {
  // checking if the user is exist
  const user = await User.isUserExists(userData.email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user is not found !');
  }

  // checking if the user is already deleted

  const isDeleted = user?.isDeleted;

  if (isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted !');
  }

  // checking if the user is blocked

  const userStatus = user?.status;

  if (userStatus === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked ! !');
  }

  //checking if the password is correct

  if (!(await User.isPasswordMatched(payload.oldPassword, user?.password)))
    throw new AppError(httpStatus.FORBIDDEN, 'Password do not matched');

  //hash new password
  const newHashedPassword = await bcrypt.hash(
    payload.newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await User.findOneAndUpdate(
    {
      email: userData.email,
      role: userData.role,
    },
    {
      password: newHashedPassword,
      passwordChangedAt: new Date(),
    },
  );

  return null;
};

const refreshToken = async (token: string) => {
  try {
    // checking if the given token is valid
    const decoded = verifyToken(token, config.jwt_refresh_secret as string);

    const { email, iat } = decoded;

    // checking if the user is exist
    const user = await User.isUserExists(email);

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'This user is not found !');
    }

    // checking if the user is already deleted
    const isDeleted = user?.isDeleted;

    if (isDeleted) {
      throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted !');
    }

    // checking if the user is blocked
    const userStatus = user?.status;

    if (userStatus === 'blocked') {
      throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked ! !');
    }

    if (
      user?.passwordChangedAt &&
      User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat as number)
    ) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized !');
    }

    const jwtPayload = {
      email: user.email,
      role: user.role,
      _id: user._id?.toString(),
    };

    // Create a new access token
    const accessToken = createToken(
      jwtPayload,
      config.jwt_access_secret as string,
      config.jwt_access_expires_in as StringValue,
    );

    // Create a new refresh token as well to extend the session
    const newRefreshToken = createToken(
      jwtPayload,
      config.jwt_refresh_secret as string,
      config.jwt_refresh_expires_in as StringValue,
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    console.error('Error in refreshToken service:', error);

    // Rethrow with more specific message if it's a JWT error
    if (error instanceof Error) {
      if (error.name === 'JsonWebTokenError') {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid refresh token');
      }
      if (error.name === 'TokenExpiredError') {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token has expired, please login again');
      }
    }

    // Rethrow the original error if it's already an AppError
    throw error;
  }
};

const forgetPassword = async (email: string) => {
  // checking if the user is exist
  const user = await User.isUserExists(email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user is not found !');
  }

  const isDeleted = user?.isDeleted;

  if (isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted !');
  }

  // checking if the user is blocked
  const userStatus = user?.status;

  if (userStatus === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked ! !');
  }

  const jwtPayload = {
    email: user.email,
    role: user.role,
    _id: user._id?.toString(),
  };

  const resetToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    '10m',
  );

  const resetPasswordLink = `${config.reset_pass_ui_link}?email=${user?.email}&token=${resetToken}`;

  sendEmail(user?.email, emailTemplate(resetPasswordLink));
};

const resetPassword = async (
  payload: { email: string; newPassword: string },
  token: string,
) => {
  // checking if the user is exist
  const user = await User.isUserExists(payload.email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'This user is not found !');
  }

  // checking if the user is already deleted
  const isDeleted = user?.isDeleted;

  if (isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted !');
  }

  // checking if the user is blocked
  const userStatus = user?.status;

  if (userStatus === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked ! !');
  }

  // checking if the given token is valid
  const decoded = jwt.verify(
    token,
    config.jwt_access_secret as string,
  ) as JwtPayload;

  if (payload.email !== decoded?.email) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'You are not authorized to reset password',
    );
  }

  //hash new password
  const newHashedPassword = await bcrypt.hash(
    payload.newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await User.findOneAndUpdate(
    {
      email: decoded.email,
      role: decoded.role,
    },
    {
      password: newHashedPassword,
      needsPasswordChange: false,
      passwordChangedAt: new Date(),
    },
  );
};

const logoutUser = async (_refreshToken?: string) => {
  return {
    message: 'User logged out successfully!',
  };
};

const verifyEmail = async (code: string) => {
  // Find user with this verification code
  const user = await User.findOne({ emailVerificationCode: code });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'Invalid verification code');
  }

  // Check if the verification code has expired
  if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Verification code has expired');
  }

  // Mark user as verified and clear verification code
  user.isVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpiry = undefined;

  await user.save();

  return {
    success: true,
    message: 'Email verified successfully',
    user: {
      _id: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    },
  };
};



const resendVerificationEmail = async (email: string) => {
  // Find user by email
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Check if user is already verified
  if (user.isVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Email is already verified');
  }

  // Check if a verification code was sent recently (30 seconds cooldown)
  const cooldownPeriod = 30 * 1000; // 30 seconds in milliseconds
  if (
    user.emailVerificationExpiry &&
    new Date().getTime() - new Date(user.emailVerificationExpiry).getTime() + 24 * 60 * 60 * 1000 < cooldownPeriod
  ) {
    const timeLeft = Math.ceil(
      (cooldownPeriod - (new Date().getTime() - new Date(user.emailVerificationExpiry).getTime() + 24 * 60 * 60 * 1000)) / 1000
    );
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      `Please wait ${timeLeft} seconds before requesting another verification code`
    );
  }

  // Generate a new verification code (6 digits)
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Set expiration time (10 minutes from now)
  const expiryDate = new Date();
  expiryDate.setMinutes(expiryDate.getMinutes() + 10);

  // Update user with new verification code
  user.emailVerificationCode = verificationCode;
  user.emailVerificationExpiry = expiryDate;

  await user.save();

  // Send verification email with modern template
  const emailSubject = 'Your Verification Code for GreenUniMind';
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
          <h1 style="color: #4CAF50; margin: 0;">GreenUniMind</h1>
        </div>
        <div class="content">
          <h2>Verify Your Email Address</h2>
          <p>Thank you for registering with GreenUniMind. Please use the following code to verify your email address:</p>
          <div class="code">${verificationCode}</div>
          <p class="note">This code will <span class="expires">expire in 10 minutes</span>.</p>
          <p>If you did not request this verification, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} GreenUniMind. All rights reserved.</p>
          <p>This is an automated email, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail(email, emailBody, emailSubject);

  return {
    success: true,
    message: 'Verification email sent successfully',
    expiresIn: 600, // 10 minutes in seconds
  };
};

export const AuthServices = {
  loginUser,
  changePassword,
  refreshToken,
  forgetPassword,
  resetPassword,
  logoutUser,
  verifyEmail,
  resendVerificationEmail,
};
