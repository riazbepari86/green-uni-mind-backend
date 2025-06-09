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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwoFactorService = void 0;
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const user_model_1 = require("../User/user.model");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const bcrypt_1 = __importDefault(require("bcrypt"));
/**
 * Generate a new TOTP secret for a user
 * @param userId The user ID
 * @returns The secret and QR code URL
 */
const setupTwoFactor = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    // Find the user
    const user = yield user_model_1.User.findById(userId);
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    try {
        // Generate a new secret
        const secret = speakeasy_1.default.generateSecret({
            name: `GreenUniMind:${user.email}`,
            issuer: 'GreenUniMind',
            length: 20
        });
        // Generate QR code
        const qrCodeUrl = yield qrcode_1.default.toDataURL(secret.otpauth_url || '');
        // Store the secret temporarily in the user document
        // This will be confirmed and enabled when the user verifies the code
        user.twoFactorSecret = secret.base32;
        yield user.save();
        return {
            secret: secret.base32,
            otpAuthUrl: secret.otpauth_url || '',
            qrCodeUrl,
        };
    }
    catch (error) {
        console.error('Error setting up 2FA:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to setup two-factor authentication');
    }
});
/**
 * Verify a TOTP token and enable 2FA for a user
 * @param token The TOTP token
 * @param userId The user ID
 * @param secret The TOTP secret
 * @returns Success message
 */
const verifyAndEnableTwoFactor = (token, userId, secret) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find the user
        const user = yield user_model_1.User.findById(userId);
        if (!user) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
        }
        // Check if the secret matches what's stored in the user document
        if (user.twoFactorSecret !== secret) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid secret. Please restart the setup process.');
        }
        // Verify the token
        const verified = speakeasy_1.default.totp.verify({
            secret,
            encoding: 'base32',
            token,
            window: 2, // Allow 2 steps before and after for clock drift (more forgiving)
        });
        if (!verified) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid verification code. Please try again.');
        }
        // Enable 2FA
        user.twoFactorEnabled = true;
        // Generate backup codes
        const backupCodes = Array(8)
            .fill(0)
            .map(() => Math.random().toString(36).substring(2, 8).toUpperCase());
        user.twoFactorBackupCodes = backupCodes;
        yield user.save();
        return {
            success: true,
            message: 'Two-factor authentication enabled successfully',
        };
    }
    catch (error) {
        if (error instanceof AppError_1.default) {
            throw error;
        }
        console.error('Error verifying 2FA setup:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to verify two-factor authentication');
    }
});
/**
 * Verify a TOTP token during login
 * @param token The TOTP token
 * @param userId The user ID
 * @returns Whether the token is valid
 */
const verifyTwoFactorToken = (token, userId) => __awaiter(void 0, void 0, void 0, function* () {
    // Find the user with 2FA secret
    const user = yield user_model_1.User.findById(userId).select('+twoFactorSecret');
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Two-factor authentication is not enabled for this user');
    }
    // Verify the token
    const verified = speakeasy_1.default.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 1, // Allow 1 step before and after for clock drift
    });
    return verified;
});
/**
 * Disable 2FA for a user
 * @param userId The user ID
 * @param password The user's password for verification
 * @returns Success message
 */
const disableTwoFactor = (userId, password) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find the user with password
        const user = yield user_model_1.User.findById(userId).select('+password');
        if (!user) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
        }
        // Check if 2FA is enabled
        if (!user.twoFactorEnabled) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Two-factor authentication is not enabled for this user');
        }
        // Verify password
        const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Invalid password. Please enter your correct password to disable 2FA.');
        }
        // Disable 2FA
        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        user.twoFactorBackupCodes = undefined;
        yield user.save();
        return {
            success: true,
            message: 'Two-factor authentication disabled successfully',
        };
    }
    catch (error) {
        if (error instanceof AppError_1.default) {
            throw error;
        }
        console.error('Error disabling 2FA:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to disable two-factor authentication');
    }
});
exports.TwoFactorService = {
    setupTwoFactor,
    verifyAndEnableTwoFactor,
    verifyTwoFactorToken,
    disableTwoFactor,
};
