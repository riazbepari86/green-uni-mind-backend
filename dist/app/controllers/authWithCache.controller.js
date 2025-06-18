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
exports.AuthWithCacheControllers = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../utils/sendResponse"));
const auth_service_1 = require("../modules/Auth/auth.service");
const config_1 = __importDefault(require("../config"));
const JWTService_1 = require("../services/auth/JWTService");
const RedisServiceManager_1 = require("../services/redis/RedisServiceManager");
// Enhanced login with Redis caching
const loginUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield auth_service_1.AuthServices.loginUser(req.body);
    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
        secure: config_1.default.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: config_1.default.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'User is logged in successfully!',
        data: {
            user: result.user,
            accessToken: result.accessToken,
            tokenFamily: result.tokenFamily,
            expiresIn: result.expiresIn,
        },
    });
}));
// Enhanced refresh token with family tracking
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
        // Set new refresh token in cookie
        if (result.refreshToken) {
            res.cookie('refreshToken', result.refreshToken, {
                secure: config_1.default.NODE_ENV === 'production',
                httpOnly: true,
                sameSite: config_1.default.NODE_ENV === 'production' ? 'none' : 'lax',
                domain: req.get('origin') ? new URL(req.get('origin') || '').hostname : undefined,
                maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
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
        // Clear refresh token cookie on error
        res.clearCookie('refreshToken', {
            secure: config_1.default.NODE_ENV === 'production',
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
// Enhanced logout with token blacklisting
const logoutUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const accessToken = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
    const refreshToken = ((_b = req.cookies) === null || _b === void 0 ? void 0 : _b.refreshToken) || ((_c = req.body) === null || _c === void 0 ? void 0 : _c.refreshToken);
    // Logout user and blacklist tokens
    yield auth_service_1.AuthServices.logoutUser(accessToken, refreshToken);
    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
        secure: config_1.default.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: config_1.default.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'User logged out successfully!',
        data: null,
    });
}));
// Logout from all devices
const logoutAllDevices = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    if (userId) {
        try {
            // Destroy all user sessions
            yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => __awaiter(void 0, void 0, void 0, function* () {
                const authCache = new (yield Promise.resolve().then(() => __importStar(require('../services/redis/AuthCacheService')))).AuthCacheService(RedisServiceManager_1.redisServiceManager.authClient, RedisServiceManager_1.redisServiceManager.monitoring);
                yield authCache.destroyAllUserSessions(userId);
            }), 'auth');
        }
        catch (error) {
            console.warn('Failed to destroy all sessions:', error);
        }
    }
    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
        secure: config_1.default.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: config_1.default.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Logged out from all devices successfully!',
        data: null,
    });
}));
// Get user activity
const getUserActivity = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const limit = parseInt(req.query.limit) || 10;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: 'User not authenticated',
            data: null,
        });
    }
    try {
        const authCache = new (yield Promise.resolve().then(() => __importStar(require('../services/redis/AuthCacheService')))).AuthCacheService(RedisServiceManager_1.redisServiceManager.authClient, RedisServiceManager_1.redisServiceManager.monitoring);
        const activities = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => authCache.getUserActivity(userId, limit), 'auth', () => Promise.resolve([]));
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'User activity retrieved successfully!',
            data: activities,
        });
    }
    catch (error) {
        console.error('Error getting user activity:', error);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.INTERNAL_SERVER_ERROR,
            success: false,
            message: 'Failed to retrieve user activity',
            data: null,
        });
    }
}));
// Get security events
const getSecurityEvents = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const limit = parseInt(req.query.limit) || 10;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: 'User not authenticated',
            data: null,
        });
    }
    try {
        const authCache = new (yield Promise.resolve().then(() => __importStar(require('../services/redis/AuthCacheService')))).AuthCacheService(RedisServiceManager_1.redisServiceManager.authClient, RedisServiceManager_1.redisServiceManager.monitoring);
        const events = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => authCache.getSecurityEvents(userId, limit), 'auth', () => Promise.resolve([]));
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Security events retrieved successfully!',
            data: events,
        });
    }
    catch (error) {
        console.error('Error getting security events:', error);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.INTERNAL_SERVER_ERROR,
            success: false,
            message: 'Failed to retrieve security events',
            data: null,
        });
    }
}));
// Check token status
const checkTokenStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
    if (!token) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Token is required',
            data: null,
        });
    }
    try {
        const [isBlacklisted, tokenInfo] = yield Promise.all([
            JWTService_1.jwtService.isTokenBlacklisted(token),
            JWTService_1.jwtService.getTokenInfo(token)
        ]);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Token status retrieved successfully!',
            data: {
                isValid: !isBlacklisted && tokenInfo !== null,
                isBlacklisted,
                tokenInfo: isBlacklisted ? null : tokenInfo,
            },
        });
    }
    catch (error) {
        console.error('Error checking token status:', error);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.INTERNAL_SERVER_ERROR,
            success: false,
            message: 'Failed to check token status',
            data: null,
        });
    }
}));
// Get authentication statistics (admin only)
const getAuthStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [jwtStats, healthCheck, performanceMetrics] = yield Promise.all([
            JWTService_1.jwtService.getJWTStats(),
            RedisServiceManager_1.redisServiceManager.healthCheck(),
            RedisServiceManager_1.redisServiceManager.getPerformanceMetrics()
        ]);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Authentication statistics retrieved successfully!',
            data: {
                jwt: jwtStats,
                redis: {
                    health: healthCheck,
                    performance: performanceMetrics
                }
            },
        });
    }
    catch (error) {
        console.error('Error getting auth stats:', error);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.INTERNAL_SERVER_ERROR,
            success: false,
            message: 'Failed to retrieve authentication statistics',
            data: null,
        });
    }
}));
exports.AuthWithCacheControllers = {
    loginUser,
    refreshToken,
    logoutUser,
    logoutAllDevices,
    getUserActivity,
    getSecurityEvents,
    checkTokenStatus,
    getAuthStats,
};
