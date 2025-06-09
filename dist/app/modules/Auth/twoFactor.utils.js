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
exports.verifyTwoFactorLogin = exports.verifyTwoFactorSetup = exports.setupTwoFactor = exports.generateRecoveryCodes = exports.verifyTOTP = exports.generateTOTPSecret = void 0;
const speakeasy = __importStar(require("speakeasy"));
const qrcode = __importStar(require("qrcode"));
const user_model_1 = require("../User/user.model");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generate a new TOTP secret for a user
 * @returns Object containing secret and otpauth URL
 */
const generateTOTPSecret = (email_1, ...args_1) => __awaiter(void 0, [email_1, ...args_1], void 0, function* (email, issuer = 'GreenUniMind') {
    // Generate a new secret
    const secret = speakeasy.generateSecret({
        length: 20,
        name: `${issuer}:${email}`,
        issuer,
    });
    // Generate QR code
    const qrCodeUrl = yield qrcode.toDataURL(secret.otpauth_url || '');
    return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
        qrCodeUrl,
    };
});
exports.generateTOTPSecret = generateTOTPSecret;
/**
 * Verify a TOTP token against a secret
 * @param token The token to verify
 * @param secret The secret to verify against
 * @returns Boolean indicating if the token is valid
 */
const verifyTOTP = (token, secret) => {
    return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1, // Allow 1 step before and after current time (30 seconds each)
    });
};
exports.verifyTOTP = verifyTOTP;
/**
 * Generate recovery codes for a user
 * @param count Number of recovery codes to generate
 * @returns Array of recovery codes
 */
const generateRecoveryCodes = (count = 10) => {
    const codes = [];
    for (let i = 0; i < count; i++) {
        // Generate a random code in format: XXXX-XXXX-XXXX
        const code = `${crypto_1.default.randomBytes(2).toString('hex').toUpperCase()}-${crypto_1.default.randomBytes(2).toString('hex').toUpperCase()}-${crypto_1.default.randomBytes(2).toString('hex').toUpperCase()}`;
        codes.push(code);
    }
    return codes;
};
exports.generateRecoveryCodes = generateRecoveryCodes;
/**
 * Setup 2FA for a user
 * @param userId User ID
 * @param enable Whether to enable or disable 2FA
 * @returns Object containing 2FA setup information
 */
const setupTwoFactor = (userId, enable) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(userId).select('+twoFactorSecret +twoFactorRecoveryCodes');
    if (!user) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    if (enable) {
        // Generate new secret and recovery codes if enabling 2FA
        const { secret, otpauthUrl, qrCodeUrl } = yield (0, exports.generateTOTPSecret)(user.email);
        const recoveryCodes = (0, exports.generateRecoveryCodes)();
        // Save the secret and recovery codes but don't enable 2FA yet
        // It will be enabled after verification
        user.twoFactorSecret = secret;
        user.twoFactorRecoveryCodes = recoveryCodes;
        yield user.save();
        return {
            secret,
            otpauthUrl,
            qrCodeUrl,
            recoveryCodes,
            enabled: false,
        };
    }
    else {
        // Disable 2FA
        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        user.twoFactorRecoveryCodes = [];
        yield user.save();
        return {
            enabled: false,
        };
    }
});
exports.setupTwoFactor = setupTwoFactor;
/**
 * Verify a user's 2FA token during setup
 * @param userId User ID
 * @param token TOTP token to verify
 * @returns Object indicating success
 */
const verifyTwoFactorSetup = (userId, token) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(userId).select('+twoFactorSecret');
    if (!user || !user.twoFactorSecret) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, '2FA setup not found');
    }
    const isValid = (0, exports.verifyTOTP)(token, user.twoFactorSecret);
    if (!isValid) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid verification code');
    }
    // Enable 2FA after successful verification
    user.twoFactorEnabled = true;
    yield user.save();
    return {
        success: true,
        enabled: true,
    };
});
exports.verifyTwoFactorSetup = verifyTwoFactorSetup;
/**
 * Verify a user's 2FA token during login
 * @param email User email
 * @param token TOTP token to verify
 * @returns Boolean indicating if the token is valid
 */
const verifyTwoFactorLogin = (email, token) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = yield user_model_1.User.findOne({ email }).select('+twoFactorSecret +twoFactorRecoveryCodes');
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Two-factor authentication is not enabled');
    }
    // Check if the token is a recovery code
    if ((_a = user.twoFactorRecoveryCodes) === null || _a === void 0 ? void 0 : _a.includes(token)) {
        // Remove the used recovery code
        user.twoFactorRecoveryCodes = user.twoFactorRecoveryCodes.filter(code => code !== token);
        yield user.save();
        return true;
    }
    // Verify TOTP token
    return (0, exports.verifyTOTP)(token, user.twoFactorSecret);
});
exports.verifyTwoFactorLogin = verifyTwoFactorLogin;
