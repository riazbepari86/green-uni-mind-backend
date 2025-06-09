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
exports.updateProfileIntoDB = exports.createUserAndProfileIntoDB = void 0;
exports.generateSafeImageName = generateSafeImageName;
const mongoose_1 = __importStar(require("mongoose"));
const sendImageToCloudinary_1 = require("../../utils/sendImageToCloudinary");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const auth_utils_1 = require("../Auth/auth.utils");
const config_1 = __importDefault(require("../../config"));
const user_model_1 = require("../User/user.model");
function generateSafeImageName(name) {
    if (typeof name === 'string')
        return name.replace(/\s+/g, '_');
    if (typeof name === 'object' && name !== null)
        return Object.values(name).join('_').replace(/\s+/g, '_');
    return 'profile';
}
const createUserAndProfileIntoDB = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { file, password, payload, role, Model } = params;
    const userData = {
        role,
        password,
        email: payload.email,
    };
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        if (file === null || file === void 0 ? void 0 : file.path) {
            const rawName = (payload === null || payload === void 0 ? void 0 : payload.name) || 'profile';
            const imageName = `${generateSafeImageName(rawName)}_${Date.now()}`;
            // Handle Cloudinary upload with rejection handling
            const { secure_url } = yield (0, sendImageToCloudinary_1.sendFileToCloudinary)(imageName, file.path).catch((err) => {
                console.error('Error uploading image to Cloudinary:', err);
                throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to upload image');
            });
            payload.profileImg = secure_url;
        }
        const [newUser] = yield user_model_1.User.create([userData], { session });
        if (!newUser) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to create user');
        }
        payload.user = new mongoose_1.default.Types.ObjectId(newUser._id);
        const [newProfile] = yield Model.create([payload], { session });
        if (!newProfile) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, `Failed to create ${role}`);
        }
        yield session.commitTransaction();
        session.endSession();
        const jwtPayload = { email: payload.email, role: userData.role };
        const accessToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
        const refreshToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
        return { newProfile, accessToken, refreshToken };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        console.error('Error creating user and profile:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to create ${role}`);
    }
});
exports.createUserAndProfileIntoDB = createUserAndProfileIntoDB;
const updateProfileIntoDB = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, payload, file, Model } = params;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const profile = yield Model.findById(id).session(session).populate('user');
        if (!profile) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Profile not found');
        }
        if (file === null || file === void 0 ? void 0 : file.path) {
            const publicId = (0, sendImageToCloudinary_1.extractPublicIdFromUrl)(profile.profileImg || '');
            const deleteOldImage = publicId
                ? (0, sendImageToCloudinary_1.deleteFileFromCloudinary)(publicId).catch((err) => {
                    console.error('Error deleting image from Cloudinary:', err);
                    return null; // Or return a default response
                })
                : Promise.resolve();
            const nameForImage = (payload === null || payload === void 0 ? void 0 : payload.firstName) || (profile === null || profile === void 0 ? void 0 : profile.name) || 'profile';
            const imageName = `${generateSafeImageName(nameForImage)}_${Date.now()}`;
            const uploadNewImage = (0, sendImageToCloudinary_1.sendFileToCloudinary)(imageName, file.path).catch((err) => {
                console.error('Error uploading image to Cloudinary:', err);
                throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to upload image');
            });
            const [, { secure_url }] = yield Promise.all([
                deleteOldImage,
                uploadNewImage,
            ]);
            profile.profileImg = secure_url;
        }
        // Update name if provided (optional based on your structure)
        if (payload.name) {
            profile.name = Object.assign(Object.assign({}, (profile.name || {})), payload.name);
        }
        // Update rest of the fields
        Object.assign(profile, payload);
        const updatedProfile = yield profile.save({ session });
        // Update user photoUrl
        if (profile.user) {
            yield user_model_1.User.findByIdAndUpdate(profile.user, { photoUrl: profile.profileImg }, { new: true, runValidators: true, session });
        }
        yield session.commitTransaction();
        session.endSession();
        return updatedProfile;
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        console.error('Error updating profile:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to update profile: ${error.message || error}`);
    }
});
exports.updateProfileIntoDB = updateProfileIntoDB;
