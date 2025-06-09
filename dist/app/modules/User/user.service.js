"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserServices = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const config_1 = __importDefault(require("../../config"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const sendImageToCloudinary_1 = require("../../utils/sendImageToCloudinary");
const auth_utils_1 = require("../Auth/auth.utils");
const user_constant_1 = require("./user.constant");
const user_model_1 = require("./user.model");
const http_status_1 = __importDefault(require("http-status"));
const student_model_1 = require("../Student/student.model");
const teacher_model_1 = require("../Teacher/teacher.model");
const sendEmail_1 = require("../../utils/sendEmail");
const createStudentIntoDB = (file, password, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = {
        role: user_constant_1.USER_ROLE.student,
        password,
        email: payload.email,
    };
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const imagePromise = file
            ? (0, sendImageToCloudinary_1.sendFileToCloudinary)(`${payload === null || payload === void 0 ? void 0 : payload.name}`, file === null || file === void 0 ? void 0 : file.path)
            : Promise.resolve(null);
        // Generate a verification code (6 digits)
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        // Set expiration time (10 minutes from now)
        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + 10);
        // Add verification code to user data
        userData.emailVerificationCode = verificationCode;
        userData.emailVerificationExpiry = expiryDate;
        userData.isVerified = false;
        const userPromise = user_model_1.User.create([userData], { session });
        const [imageUploadResult, newUser] = yield Promise.all([
            imagePromise,
            userPromise,
        ]);
        if (!newUser.length) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to create user');
        }
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
        yield (0, sendEmail_1.sendEmail)(payload.email, emailBody, emailSubject);
        payload.profileImg = (imageUploadResult === null || imageUploadResult === void 0 ? void 0 : imageUploadResult.secure_url) || payload.profileImg;
        payload.user = new mongoose_1.default.Types.ObjectId(newUser[0]._id);
        // Update user's photoUrl with the uploaded image URL
        if (imageUploadResult === null || imageUploadResult === void 0 ? void 0 : imageUploadResult.secure_url) {
            yield user_model_1.User.findByIdAndUpdate(newUser[0]._id, { photoUrl: imageUploadResult.secure_url }, { session });
        }
        const newStudent = yield student_model_1.Student.create([payload], { session });
        if (!newStudent.length) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to create student');
        }
        yield session.commitTransaction();
        yield session.endSession();
        const jwtPayload = { email: payload.email, role: userData.role };
        const accessToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
        const refreshToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
        return { newStudent, accessToken, refreshToken };
    }
    catch (error) {
        yield session.abortTransaction();
        yield session.endSession();
        console.error('Error creating student:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create student');
    }
});
const createTeacherIntoDB = (file, password, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = {
        role: user_constant_1.USER_ROLE.teacher,
        password,
        email: payload.email,
    };
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const imagePromise = file
            ? (0, sendImageToCloudinary_1.sendImageToCloudinary)(`${payload === null || payload === void 0 ? void 0 : payload.name}`, file === null || file === void 0 ? void 0 : file.path)
            : Promise.resolve(null);
        // Generate a verification code (6 digits)
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        // Set expiration time (10 minutes from now)
        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + 10);
        // Add verification code to user data
        userData.emailVerificationCode = verificationCode;
        userData.emailVerificationExpiry = expiryDate;
        userData.isVerified = false;
        const userPromise = user_model_1.User.create([userData], { session });
        const [imageUploadResult, newUser] = yield Promise.all([
            imagePromise,
            userPromise,
        ]);
        if (!newUser.length) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to create user');
        }
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
        yield (0, sendEmail_1.sendEmail)(payload.email, emailBody, emailSubject);
        payload.profileImg = (imageUploadResult === null || imageUploadResult === void 0 ? void 0 : imageUploadResult.secure_url) || payload.profileImg;
        payload.user = new mongoose_1.default.Types.ObjectId(newUser[0]._id);
        // Update user's photoUrl with the uploaded image URL
        if (imageUploadResult === null || imageUploadResult === void 0 ? void 0 : imageUploadResult.secure_url) {
            yield user_model_1.User.findByIdAndUpdate(newUser[0]._id, { photoUrl: imageUploadResult.secure_url }, { session });
        }
        const newTeacher = yield teacher_model_1.Teacher.create([payload], { session });
        if (!newTeacher.length) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to create teacher');
        }
        yield session.commitTransaction();
        yield session.endSession();
        const jwtPayload = { email: payload.email, role: userData.role };
        const accessToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
        const refreshToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
        return { newTeacher, accessToken, refreshToken };
    }
    catch (error) {
        yield session.abortTransaction();
        yield session.endSession();
        console.error('Error creating teacher:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create teacher');
    }
});
const getAllUserFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const adminQuery = new QueryBuilder_1.default(user_model_1.User.find(), query)
        .search(user_constant_1.AdminSearchableFields)
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield adminQuery.modelQuery;
    const meta = yield adminQuery.countTotal();
    return {
        meta,
        result,
    };
});
const getSingleUserFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_model_1.User.findById(id).select('+googleId +facebookId +appleId +connectedAccounts');
    return result;
});
const changeStatus = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_model_1.User.findByIdAndUpdate(id, payload, {
        new: true,
    });
    return result;
});
const getMe = (email, role) => __awaiter(void 0, void 0, void 0, function* () {
    let result = null;
    switch (role) {
        case user_constant_1.USER_ROLE.student:
            result = yield student_model_1.Student.findOne({ email }).populate({
                path: 'user',
                select: '+googleId +facebookId +appleId +connectedAccounts'
            });
            break;
        case user_constant_1.USER_ROLE.teacher:
            result = yield teacher_model_1.Teacher.findOne({ email }).populate({
                path: 'user',
                select: '+googleId +facebookId +appleId +connectedAccounts'
            });
            break;
        default:
            throw new Error('Invalid role');
    }
    return result;
});
const updateUserProfile = (id, payload, role, file) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        let userProfile;
        let Model;
        // Determine the model based on the role
        if (role === user_constant_1.USER_ROLE.student) {
            Model = student_model_1.Student;
        }
        else if (role === user_constant_1.USER_ROLE.teacher) {
            Model = teacher_model_1.Teacher;
        }
        else {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid role');
        }
        // Find the user profile (student or teacher) and populate user data
        userProfile = yield Model.findById(id).session(session).populate('user');
        if (!userProfile) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, `${role} not found`);
        }
        // Update the user profile's name if provided
        if (payload.name) {
            userProfile.name = {
                firstName: payload.name.firstName || userProfile.name.firstName,
                middleName: payload.name.middleName || userProfile.name.middleName,
                lastName: payload.name.lastName || userProfile.name.lastName,
            };
        }
        let imageUploadResult = null;
        // Handle file upload and delete old image if necessary
        if (file) {
            const deleteImagePromise = userProfile.profileImg
                ? (0, sendImageToCloudinary_1.deleteFileFromCloudinary)((0, sendImageToCloudinary_1.extractPublicIdFromUrl)(userProfile.profileImg)) // Type assertion for safety
                : Promise.resolve(null);
            const uploadImagePromise = (0, sendImageToCloudinary_1.sendFileToCloudinary)(file.fileName, file.path);
            // Wait for both promises to resolve
            const [, uploadResult] = yield Promise.all([
                deleteImagePromise,
                uploadImagePromise,
            ]);
            imageUploadResult = uploadResult;
            // Ensure imageUploadResult is not null and assign the image URL with timestamp
            if (imageUploadResult) {
                const timestamp = new Date().getTime(); // Unique timestamp
                userProfile.profileImg = `${imageUploadResult.secure_url}?v=${timestamp}`;
            }
        }
        // Save updated user profile data
        const updatedUserProfile = yield userProfile.save({ session });
        // Update associated user data (photoUrl)
        const user = yield user_model_1.User.findById(userProfile.user).session(session);
        if (!user) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
        }
        yield user_model_1.User.findByIdAndUpdate(user._id, { $set: { photoUrl: userProfile.profileImg || user.photoUrl } }, { new: true, runValidators: true, session });
        // Commit the transaction
        yield session.commitTransaction();
        session.endSession();
        return updatedUserProfile;
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        console.error('Error during transaction:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to update user and ${role}: ${error.message || error}`);
    }
});
exports.UserServices = {
    // registerUserIntoDB,
    createStudentIntoDB,
    createTeacherIntoDB,
    getAllUserFromDB,
    getSingleUserFromDB,
    changeStatus,
    getMe,
    updateUserProfile,
};
