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
    // create token and sent to the client
    const jwtPayload = {
        email: user.email,
        role: user.role,
        _id: (_a = user._id) === null || _a === void 0 ? void 0 : _a.toString(),
    };
    const accessToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
    const refreshToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
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
        accessToken,
        refreshToken,
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
    var _a;
    try {
        // checking if the given token is valid
        const decoded = (0, auth_utils_1.verifyToken)(token, config_1.default.jwt_refresh_secret);
        const { email, iat } = decoded;
        // checking if the user is exist
        const user = yield user_model_1.User.isUserExists(email);
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
        if ((user === null || user === void 0 ? void 0 : user.passwordChangedAt) &&
            user_model_1.User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat)) {
            throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'You are not authorized !');
        }
        const jwtPayload = {
            email: user.email,
            role: user.role,
            _id: (_a = user._id) === null || _a === void 0 ? void 0 : _a.toString(),
        };
        // Create a new access token
        const accessToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
        // Create a new refresh token as well to extend the session
        const newRefreshToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
        return {
            accessToken,
            refreshToken: newRefreshToken,
        };
    }
    catch (error) {
        console.error('Error in refreshToken service:', error);
        // Rethrow with more specific message if it's a JWT error
        if (error instanceof Error) {
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
const logoutUser = (_refreshToken) => __awaiter(void 0, void 0, void 0, function* () {
    return {
        message: 'User logged out successfully!',
    };
});
const verifyEmail = (code) => __awaiter(void 0, void 0, void 0, function* () {
    // Find user with this verification code
    const user = yield user_model_1.User.findOne({ emailVerificationCode: code });
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Invalid verification code');
    }
    // Check if the verification code has expired
    if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Verification code has expired');
    }
    // Mark user as verified and clear verification code
    user.isVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpiry = undefined;
    yield user.save();
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
    // Check if a verification code was sent recently (30 seconds cooldown)
    const cooldownPeriod = 30 * 1000; // 30 seconds in milliseconds
    if (user.emailVerificationExpiry &&
        new Date().getTime() - new Date(user.emailVerificationExpiry).getTime() + 24 * 60 * 60 * 1000 < cooldownPeriod) {
        const timeLeft = Math.ceil((cooldownPeriod - (new Date().getTime() - new Date(user.emailVerificationExpiry).getTime() + 24 * 60 * 60 * 1000)) / 1000);
        throw new AppError_1.default(http_status_1.default.TOO_MANY_REQUESTS, `Please wait ${timeLeft} seconds before requesting another verification code`);
    }
    // Generate a new verification code (6 digits)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Set expiration time (10 minutes from now)
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 10);
    // Update user with new verification code
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpiry = expiryDate;
    yield user.save();
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
    yield (0, sendEmail_1.sendEmail)(email, emailBody, emailSubject);
    return {
        success: true,
        message: 'Verification email sent successfully',
        expiresIn: 600, // 10 minutes in seconds
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
};
