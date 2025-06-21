"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthServices = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const user_model_1 = require("../User/user.model");
const http_status_1 = __importDefault(require("http-status"));
const auth_utils_1 = require("./auth.utils");
const config_1 = __importDefault(require("../../config"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const sendEmail_1 = require("../../utils/sendEmail");
const student_model_1 = require("../Student/student.model");
const teacher_model_1 = require("../Teacher/teacher.model");
const redis_1 = require("../../config/redis");
const JWTService_1 = require("../../services/auth/JWTService");
const AuthCacheHelper_1 = require("../../services/auth/AuthCacheHelper");
const loginUser = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = yield user_model_1.User.isUserExists(payload.email);
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'This user is not found !');
    }
    // checking if the user is already deleted
    const isDeleted = user === null || user === void 0 ? void 0 : user.isDeleted;
    if (isDeleted) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'This user is deleted !');
    }
    // checking if the user is blocked
    const userStatus = user === null || user === void 0 ? void 0 : user.status;
    if (userStatus === 'blocked') {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked ! !');
    }
    //checking if the password is correct
    if (!(yield user_model_1.User.isPasswordMatched(payload === null || payload === void 0 ? void 0 : payload.password, user === null || user === void 0 ? void 0 : user.password))) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Password do not matched');
    }
    // Check if user email is verified
    if (!user.isVerified) {
        // Generate and send new OTP for unverified user
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        yield redis_1.otpOperations.setOTP(user.email, verificationCode, 300);
        // Calculate exact expiration time for login OTP
        const loginExpirationTime = new Date(Date.now() + 300000); // 5 minutes from now
        const loginExpirationTimeString = loginExpirationTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'UTC'
        });
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
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p class="note" style="margin: 0; color: #856404;">
                ⏰ <strong>Important:</strong> This code will <span class="expires">expire at ${loginExpirationTimeString} UTC</span> (in 5 minutes).
              </p>
              <p style="margin: 5px 0 0 0; font-size: 12px; color: #6c757d;">
                Please verify your email before this time to complete your login.
              </p>
            </div>
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
        yield (0, sendEmail_1.sendEmail)(user.email, emailBody, emailSubject);
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Email not verified. A new verification code has been sent to your email.', {
            requiresVerification: true,
            email: user.email,
            otpExpiresAt: loginExpirationTime.toISOString(),
            cooldownSeconds: 60 // 1 minute cooldown for resend
        });
    }
    // create token pair using enhanced JWT service
    const jwtPayload = {
        email: user.email,
        role: user.role,
        _id: (_a = user._id) === null || _a === void 0 ? void 0 : _a.toString(),
    };
    // Use the new JWT service for token creation with Redis caching
    const tokenPair = yield JWTService_1.jwtService.createTokenPair(jwtPayload);
    // Cache user data for faster subsequent requests
    yield AuthCacheHelper_1.AuthCacheHelper.cacheUserData(user.email, user, 900);
    let roleDetails = null;
    switch (user.role) {
        case 'student':
            roleDetails = yield student_model_1.Student.findOne({
                user: user._id,
            }).lean();
            if (!roleDetails) {
                throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student profile not found!');
            }
            break;
        case 'teacher':
            roleDetails = yield teacher_model_1.Teacher.findOne({
                user: user._id,
            }).lean();
            if (!roleDetails) {
                throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student profile not found!');
            }
            break;
        default:
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Invalid role!');
    }
    const { email: _email } = roleDetails, safeRoleDetails = __rest(roleDetails, ["email"]);
    return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenFamily: tokenPair.tokenFamily,
        expiresIn: tokenPair.expiresIn,
        user: Object.assign({ id: user._id, email: user.email, role: user.role, status: user.status }, safeRoleDetails),
    };
});
const changePassword = (userData, payload) => __awaiter(void 0, void 0, void 0, function* () {
    // checking if the user is exist
    const user = yield user_model_1.User.isUserExists(userData.email);
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'This user is not found !');
    }
    // checking if the user is already deleted
    const isDeleted = user === null || user === void 0 ? void 0 : user.isDeleted;
    if (isDeleted) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'This user is deleted !');
    }
    // checking if the user is blocked
    const userStatus = user === null || user === void 0 ? void 0 : user.status;
    if (userStatus === 'blocked') {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked ! !');
    }
    //checking if the password is correct
    if (!(yield user_model_1.User.isPasswordMatched(payload.oldPassword, user === null || user === void 0 ? void 0 : user.password)))
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Password do not matched');
    //hash new password
    const newHashedPassword = yield bcrypt_1.default.hash(payload.newPassword, Number(config_1.default.bcrypt_salt_rounds));
    yield user_model_1.User.findOneAndUpdate({
        email: userData.email,
        role: userData.role,
    }, {
        password: newHashedPassword,
        passwordChangedAt: new Date(),
    });
    return null;
});
const refreshToken = (token) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Use the enhanced JWT service for token refresh with family tracking
        const newTokenPair = yield JWTService_1.jwtService.refreshTokens(token);
        return {
            accessToken: newTokenPair.accessToken,
            refreshToken: newTokenPair.refreshToken,
            tokenFamily: newTokenPair.tokenFamily,
            expiresIn: newTokenPair.expiresIn,
        };
    }
    catch (error) {
        console.error('Error in refreshToken service:', error);
        // Rethrow with more specific message if it's a JWT error
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('expired')) {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Refresh token has expired or is invalid, please login again');
            }
            if (error.message.includes('compromised')) {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Security violation detected, please login again');
            }
            if (error.name === 'JsonWebTokenError') {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Invalid refresh token');
            }
            if (error.name === 'TokenExpiredError') {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Refresh token has expired, please login again');
            }
        }
        // Rethrow the original error if it's already an AppError
        throw error;
    }
});
const forgetPassword = (email) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // checking if the user is exist
    const user = yield user_model_1.User.isUserExists(email);
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'This user is not found !');
    }
    const isDeleted = user === null || user === void 0 ? void 0 : user.isDeleted;
    if (isDeleted) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'This user is deleted !');
    }
    // checking if the user is blocked
    const userStatus = user === null || user === void 0 ? void 0 : user.status;
    if (userStatus === 'blocked') {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked ! !');
    }
    const jwtPayload = {
        email: user.email,
        role: user.role,
        _id: (_a = user._id) === null || _a === void 0 ? void 0 : _a.toString(),
    };
    const resetToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_access_secret, '10m');
    const resetPasswordLink = `${config_1.default.reset_pass_ui_link}?email=${user === null || user === void 0 ? void 0 : user.email}&token=${resetToken}`;
    (0, sendEmail_1.sendEmail)(user === null || user === void 0 ? void 0 : user.email, (0, auth_utils_1.emailTemplate)(resetPasswordLink));
});
const resetPassword = (payload, token) => __awaiter(void 0, void 0, void 0, function* () {
    // checking if the user is exist
    const user = yield user_model_1.User.isUserExists(payload.email);
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'This user is not found !');
    }
    // checking if the user is already deleted
    const isDeleted = user === null || user === void 0 ? void 0 : user.isDeleted;
    if (isDeleted) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'This user is deleted !');
    }
    // checking if the user is blocked
    const userStatus = user === null || user === void 0 ? void 0 : user.status;
    if (userStatus === 'blocked') {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked ! !');
    }
    // checking if the given token is valid
    const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
    if (payload.email !== (decoded === null || decoded === void 0 ? void 0 : decoded.email)) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'You are not authorized to reset password');
    }
    //hash new password
    const newHashedPassword = yield bcrypt_1.default.hash(payload.newPassword, Number(config_1.default.bcrypt_salt_rounds));
    yield user_model_1.User.findOneAndUpdate({
        email: decoded.email,
        role: decoded.role,
    }, {
        password: newHashedPassword,
        needsPasswordChange: false,
        passwordChangedAt: new Date(),
    });
});
const logoutUser = (accessToken, refreshToken) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Blacklist both access and refresh tokens if provided
        const tokensToBlacklist = [];
        if (accessToken)
            tokensToBlacklist.push(accessToken);
        if (refreshToken)
            tokensToBlacklist.push(refreshToken);
        if (tokensToBlacklist.length > 0) {
            yield JWTService_1.jwtService.batchBlacklistTokens(tokensToBlacklist);
        }
        return {
            message: 'User logged out successfully!',
        };
    }
    catch (error) {
        console.warn('Error during logout token blacklisting:', error);
        // Don't fail logout if blacklisting fails
        return {
            message: 'User logged out successfully!',
        };
    }
});
const verifyEmail = (email, code) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Get OTP from Redis
    const storedOTP = yield redis_1.otpOperations.getOTP(email);
    if (!storedOTP) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'OTP has expired or does not exist. Please request a new one.');
    }
    if (storedOTP !== code) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid OTP code. Please check and try again.');
    }
    // Find user by email
    const user = yield user_model_1.User.findOne({ email });
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    if (user.isVerified) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Email is already verified');
    }
    // Mark user as verified
    user.isVerified = true;
    yield user.save();
    // Delete OTP from Redis after successful verification
    yield redis_1.otpOperations.deleteOTP(email);
    // Generate tokens after successful verification using enhanced JWT service
    const jwtPayload = {
        email: user.email,
        role: user.role,
        _id: (_a = user._id) === null || _a === void 0 ? void 0 : _a.toString(),
    };
    const tokenPair = yield JWTService_1.jwtService.createTokenPair(jwtPayload);
    // Cache user data for faster subsequent requests
    yield AuthCacheHelper_1.AuthCacheHelper.cacheUserData(user.email, user, 900);
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
});
const resendVerificationEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    // Find user by email
    const user = yield user_model_1.User.findOne({ email });
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    // Check if user is already verified
    if (user.isVerified) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Email is already verified');
    }
    // Check resend cooldown (1-minute between resends)
    const cooldownCheck = yield redis_1.otpOperations.checkResendCooldown(email);
    if (!cooldownCheck.allowed) {
        throw new AppError_1.default(http_status_1.default.TOO_MANY_REQUESTS, `Please wait ${cooldownCheck.remainingTime} seconds before requesting a new code.`, {
            isResendCooldown: true,
            remainingTime: cooldownCheck.remainingTime
        });
    }
    // Check professional-grade rate limiting for OTP requests
    const rateLimit = yield redis_1.otpOperations.checkOTPRateLimit(email);
    if (!rateLimit.allowed) {
        const timeRemaining = Math.ceil((rateLimit.resetTime - Date.now()) / 60000);
        if (rateLimit.isLocked) {
            throw new AppError_1.default(http_status_1.default.TOO_MANY_REQUESTS, rateLimit.lockReason || 'Account temporarily locked due to too many requests.', {
                isLocked: true,
                lockDuration: rateLimit.lockDuration,
                resetTime: rateLimit.resetTime,
                timeRemaining
            });
        }
        throw new AppError_1.default(http_status_1.default.TOO_MANY_REQUESTS, `Too many OTP requests. You have ${rateLimit.remaining} attempts remaining. Please try again after ${timeRemaining} minutes.`, {
            remaining: rateLimit.remaining,
            resetTime: rateLimit.resetTime,
            timeRemaining
        });
    }
    // Generate a new verification code (6 digits)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Store OTP in Redis with 5-minute expiration
    yield redis_1.otpOperations.setOTP(email, verificationCode, 300);
    // Calculate exact expiration time
    const expirationTime = new Date(Date.now() + 300000); // 5 minutes from now
    const expirationTimeString = expirationTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
    });
    // Send verification email with enhanced template
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
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p class="note" style="margin: 0; color: #856404;">
              ⏰ <strong>Important:</strong> This code will <span class="expires">expire at ${expirationTimeString} UTC</span> (in 5 minutes).
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #6c757d;">
              Please verify your email before this time to complete your registration.
            </p>
          </div>
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
    yield (0, sendEmail_1.sendEmail)(email, emailBody, emailSubject);
    return {
        success: true,
        message: 'Verification email sent successfully',
        expiresIn: 300, // 5 minutes in seconds
        expiresAt: expirationTime.toISOString(),
        cooldownSeconds: 60 // 1 minute cooldown for resend
    };
});
const getRateLimitStatus = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const status = yield redis_1.otpOperations.getRateLimitStatus(email);
    return {
        success: true,
        data: status
    };
});
exports.AuthServices = {
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
