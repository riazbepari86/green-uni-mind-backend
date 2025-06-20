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
exports.AuthControllers = void 0;
const config_1 = __importDefault(require("../../config"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const auth_service_1 = require("./auth.service");
const http_status_1 = __importDefault(require("http-status"));
const loginUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield auth_service_1.AuthServices.loginUser(req.body);
    const { refreshToken, accessToken, user } = result;
    const origin = req.get('origin');
    let domain;
    if (origin && config_1.default.NODE_ENV === 'production') {
        try {
            domain = new URL(origin || '').hostname;
            if (!domain.includes('localhost')) {
                const parts = domain.split('.');
                if (parts.length > 2) {
                    domain = parts.slice(-2).join('.');
                }
            }
        }
        catch (error) {
            console.error('Error parsing origin for cookie domain:', error);
        }
    }
    // Enhanced cookie security configuration
    const cookieOptions = {
        httpOnly: true, // Prevent XSS attacks
        secure: config_1.default.NODE_ENV === 'production', // HTTPS only in production
        sameSite: config_1.default.NODE_ENV === 'production' ? 'strict' : 'lax', // CSRF protection
        domain: domain || undefined,
        maxAge: config_1.default.NODE_ENV === 'production' ?
            1000 * 60 * 60 * 24 : // 1 day in production
            1000 * 60 * 60 * 24 * 7, // 7 days in development
        path: '/', // Restrict to root path
    };
    // Sign the refresh token for additional security
    const signedRefreshToken = config_1.default.NODE_ENV === 'production' ?
        `${refreshToken}.${Buffer.from(refreshToken).toString('base64')}` :
        refreshToken;
    res.cookie('refreshToken', signedRefreshToken, cookieOptions);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'User is logged in successfully!',
        data: {
            accessToken,
            refreshToken,
            user,
        },
    });
}));
const changePassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const passwordData = __rest(req.body, []);
    const result = yield auth_service_1.AuthServices.changePassword(req.user, passwordData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Password is updated successfully!',
        data: result,
    });
}));
const refreshToken = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const tokenFromCookie = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken;
    const tokenFromBody = (_b = req.body) === null || _b === void 0 ? void 0 : _b.refreshToken;
    const tokenFromHeader = req.headers['x-refresh-token'];
    const authHeader = (_c = req.headers) === null || _c === void 0 ? void 0 : _c.authorization;
    let tokenFromBearer;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        tokenFromBearer = authHeader.split(' ')[1];
    }
    const refreshToken = tokenFromCookie || tokenFromBody || tokenFromHeader || tokenFromBearer;
    if (!refreshToken) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: 'Refresh token is required!',
            data: null,
        });
    }
    try {
        const cleanToken = refreshToken.trim();
        if (!cleanToken || cleanToken.length < 10) {
            throw new Error('Invalid refresh token format');
        }
        const result = yield auth_service_1.AuthServices.refreshToken(cleanToken);
        if (result.refreshToken) {
            res.cookie('refreshToken', result.refreshToken, {
                secure: true,
                httpOnly: true,
                sameSite: config_1.default.NODE_ENV === 'production' ? 'none' : 'lax',
                domain: req.get('origin') ? new URL(req.get('origin') || '').hostname : undefined,
                maxAge: 1000 * 60 * 60 * 24 * 30,
            });
        }
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Access token is retrieved successfully!',
            data: result,
        });
    }
    catch (error) {
        console.error('Error refreshing token:', error);
        res.clearCookie('refreshToken', {
            secure: true,
            httpOnly: true,
            sameSite: config_1.default.NODE_ENV === 'production' ? 'none' : 'lax',
        });
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: error instanceof Error ? error.message : 'Invalid refresh token',
            data: null,
        });
    }
}));
const forgetPassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const email = req.body.email;
    const result = yield auth_service_1.AuthServices.forgetPassword(email);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Password reset link is sent to your email!',
        data: result,
    });
}));
const resetPassword = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const token = req.headers.authorization;
    const result = yield auth_service_1.AuthServices.resetPassword(req.body, token);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Password reset successfully!',
        data: result,
    });
}));
const logoutUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refreshToken } = req.cookies;
    yield auth_service_1.AuthServices.logoutUser(refreshToken);
    const origin = req.get('origin');
    let domain;
    if (origin && config_1.default.NODE_ENV === 'production') {
        try {
            domain = new URL(origin || '').hostname;
            if (!domain.includes('localhost')) {
                const parts = domain.split('.');
                if (parts.length > 2) {
                    domain = parts.slice(-2).join('.');
                }
            }
        }
        catch (error) {
            console.error('Error parsing origin for cookie domain:', error);
        }
    }
    console.log(`Clearing refresh token cookie with domain: ${domain || 'not set'}, sameSite: ${config_1.default.NODE_ENV === 'production' ? 'none' : 'lax'}`);
    res.clearCookie('refreshToken', {
        secure: true,
        httpOnly: true,
        sameSite: config_1.default.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: domain || undefined,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'User is logged out successfully!',
        data: null,
    });
}));
const verifyEmail = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, code } = req.body;
    const result = yield auth_service_1.AuthServices.verifyEmail(email, code);
    // Enhanced cookie security configuration for email verification
    const cookieOptions = {
        httpOnly: true, // Prevent XSS attacks
        secure: config_1.default.NODE_ENV === 'production', // HTTPS only in production
        sameSite: config_1.default.NODE_ENV === 'production' ? 'strict' : 'lax', // CSRF protection
        maxAge: config_1.default.NODE_ENV === 'production' ?
            1000 * 60 * 60 * 24 : // 1 day in production
            1000 * 60 * 60 * 24 * 7, // 7 days in development
        path: '/', // Restrict to root path
    };
    // Sign the refresh token for additional security
    const signedRefreshToken = config_1.default.NODE_ENV === 'production' ?
        `${result.refreshToken}.${Buffer.from(result.refreshToken).toString('base64')}` :
        result.refreshToken;
    // Set refresh token as secure cookie
    res.cookie('refreshToken', signedRefreshToken, cookieOptions);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.message,
        data: {
            user: result.user,
            accessToken: result.accessToken,
        },
    });
}));
const resendVerificationEmail = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    const result = yield auth_service_1.AuthServices.resendVerificationEmail(email);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Verification email sent successfully!',
        data: result,
    });
}));
const getRateLimitStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.query;
    if (!email || typeof email !== 'string') {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Email is required');
    }
    const result = yield auth_service_1.AuthServices.getRateLimitStatus(email);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Rate limit status retrieved successfully',
        data: result.data,
    });
}));
exports.AuthControllers = {
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
