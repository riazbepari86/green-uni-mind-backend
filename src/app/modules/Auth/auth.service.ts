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
import { otpOperations } from '../../config/redis';
import { jwtService } from '../../services/auth/JWTService';
import { redisServiceManager } from '../../services/redis/RedisServiceManager';

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

  // Check if user email is verified
  if (!user.isVerified) {
    // Generate and send new OTP for unverified user
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await otpOperations.setOTP(user.email, verificationCode, 300);

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
            <p>Please verify your email address to complete the login process:</p>
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

    await sendEmail(user.email, emailBody, emailSubject);

    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Email not verified. A new verification code has been sent to your email.',
      {
        requiresVerification: true,
        email: user.email,
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      }
    );
  }

  // create token pair using enhanced JWT service
  const jwtPayload = {
    email: user.email,
    role: user.role,
    _id: user._id?.toString(),
  };

  // Use the new JWT service for token creation with Redis caching
  const tokenPair = await jwtService.createTokenPair(jwtPayload);

  // Cache user data for faster subsequent requests
  await redisServiceManager.executeWithCircuitBreaker(
    () => redisServiceManager.cache.set(`user:${user.email}`, user, 900), // 15 minutes
    'cache'
  ).catch(error => {
    console.warn('Failed to cache user data during login:', error);
  });

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
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    tokenFamily: tokenPair.tokenFamily,
    expiresIn: tokenPair.expiresIn,
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
    // Use the enhanced JWT service for token refresh with family tracking
    const newTokenPair = await jwtService.refreshTokens(token);

    return {
      accessToken: newTokenPair.accessToken,
      refreshToken: newTokenPair.refreshToken,
      tokenFamily: newTokenPair.tokenFamily,
      expiresIn: newTokenPair.expiresIn,
    };
  } catch (error) {
    console.error('Error in refreshToken service:', error);

    // Rethrow with more specific message if it's a JWT error
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('expired')) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token has expired or is invalid, please login again');
      }
      if (error.message.includes('compromised')) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Security violation detected, please login again');
      }
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

const logoutUser = async (accessToken?: string, refreshToken?: string) => {
  try {
    // Blacklist both access and refresh tokens if provided
    const tokensToBlacklist = [];
    if (accessToken) tokensToBlacklist.push(accessToken);
    if (refreshToken) tokensToBlacklist.push(refreshToken);

    if (tokensToBlacklist.length > 0) {
      await jwtService.batchBlacklistTokens(tokensToBlacklist);
    }

    return {
      message: 'User logged out successfully!',
    };
  } catch (error) {
    console.warn('Error during logout token blacklisting:', error);
    // Don't fail logout if blacklisting fails
    return {
      message: 'User logged out successfully!',
    };
  }
};

const verifyEmail = async (email: string, code: string) => {
  // Get OTP from Redis
  const storedOTP = await otpOperations.getOTP(email);

  if (!storedOTP) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'OTP has expired or does not exist. Please request a new one.',
    );
  }

  if (storedOTP !== code) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid OTP code. Please check and try again.',
    );
  }

  // Find user by email
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.isVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Email is already verified');
  }

  // Mark user as verified
  user.isVerified = true;
  await user.save();

  // Delete OTP from Redis after successful verification
  await otpOperations.deleteOTP(email);

  // Generate tokens after successful verification using enhanced JWT service
  const jwtPayload = {
    email: user.email,
    role: user.role,
    _id: user._id?.toString(),
  };

  const tokenPair = await jwtService.createTokenPair(jwtPayload);

  // Cache user data for faster subsequent requests
  await redisServiceManager.executeWithCircuitBreaker(
    () => redisServiceManager.cache.set(`user:${user.email}`, user, 900), // 15 minutes
    'cache'
  ).catch(error => {
    console.warn('Failed to cache user data during email verification:', error);
  });

  return {
    success: true,
    message: 'Email verified successfully',
    user: {
      _id: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    },
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    tokenFamily: tokenPair.tokenFamily,
    expiresIn: tokenPair.expiresIn,
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

  // Check resend cooldown (1-minute between resends)
  const cooldownCheck = await otpOperations.checkResendCooldown(email);
  if (!cooldownCheck.allowed) {
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      `Please wait ${cooldownCheck.remainingTime} seconds before requesting a new code.`,
      {
        isResendCooldown: true,
        remainingTime: cooldownCheck.remainingTime
      }
    );
  }

  // Check professional-grade rate limiting for OTP requests
  const rateLimit = await otpOperations.checkOTPRateLimit(email);
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

  // Generate a new verification code (6 digits)
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP in Redis with 5-minute expiration
  await otpOperations.setOTP(email, verificationCode, 300);

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

  await sendEmail(email, emailBody, emailSubject);

  return {
    success: true,
    message: 'Verification email sent successfully',
    expiresIn: 300, // 5 minutes in seconds
  };
};

const getRateLimitStatus = async (email: string) => {
  const status = await otpOperations.getRateLimitStatus(email);

  return {
    success: true,
    data: status
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
  getRateLimitStatus,
};
