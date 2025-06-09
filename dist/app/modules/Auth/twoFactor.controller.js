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
exports.TwoFactorController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const http_status_1 = __importDefault(require("http-status"));
const twoFactor_service_1 = require("./twoFactor.service");
/**
 * Set up two-factor authentication for a user
 */
const setupTwoFactor = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.params.userId;
    // Ensure the user is only setting up 2FA for themselves
    if (!userId || (req.user && userId !== req.user._id)) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'You can only set up 2FA for your own account',
            data: null,
        });
    }
    const result = yield twoFactor_service_1.TwoFactorService.setupTwoFactor(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Two-factor authentication setup initiated',
        data: result,
    });
}));
/**
 * Verify and enable two-factor authentication for a user
 */
const verifyAndEnableTwoFactor = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token, userId, secret } = req.body;
    // Ensure the user is only enabling 2FA for themselves
    if (!userId || (req.user && userId !== req.user._id)) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'You can only enable 2FA for your own account',
            data: null,
        });
    }
    const result = yield twoFactor_service_1.TwoFactorService.verifyAndEnableTwoFactor(token, userId, secret);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Two-factor authentication enabled successfully',
        data: result,
    });
}));
/**
 * Verify a two-factor authentication token during login
 */
const verifyTwoFactorToken = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token, userId } = req.body;
    const isValid = yield twoFactor_service_1.TwoFactorService.verifyTwoFactorToken(token, userId);
    if (!isValid) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: 'Invalid verification code',
            data: null,
        });
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Two-factor authentication verified successfully',
        data: { verified: true },
    });
}));
/**
 * Disable two-factor authentication for a user
 */
const disableTwoFactor = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, password } = req.body;
    // Ensure the user is only disabling 2FA for themselves
    if (!userId || (req.user && userId !== req.user._id)) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: 'You can only disable 2FA for your own account',
            data: null,
        });
    }
    const result = yield twoFactor_service_1.TwoFactorService.disableTwoFactor(userId, password);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Two-factor authentication disabled successfully',
        data: result,
    });
}));
exports.TwoFactorController = {
    setupTwoFactor,
    verifyAndEnableTwoFactor,
    verifyTwoFactorToken,
    disableTwoFactor,
};
