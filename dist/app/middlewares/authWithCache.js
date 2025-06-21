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
exports.requirePermissions = exports.logoutAllDevices = exports.logout = void 0;
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../config"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const user_model_1 = require("../modules/User/user.model");
const JWTService_1 = require("../services/auth/JWTService");
const redis_1 = require("../config/redis");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../config/logger");
const console_replacement_1 = require("../utils/console-replacement");
// Import centralized types
require("../types/express");
// Express Request type extension is now handled in types/express.d.ts
// Helper function to generate token ID from JWT
function generateTokenId(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex').substring(0, 16);
}
// Helper function to extract token from request
function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    return null;
}
// Enhanced authentication middleware with Redis caching
const authWithCache = (...requiredRoles) => {
    return (0, catchAsync_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const startTime = Date.now();
        // Extract token from Authorization header
        const token = extractToken(req);
        if (!token) {
            throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'You are not authorized!');
        }
        // Generate token ID for caching
        const tokenId = generateTokenId(token);
        req.tokenId = tokenId;
        try {
            // Check if token is blacklisted using JWT service
            const isBlacklisted = yield JWTService_1.jwtService.isTokenBlacklisted(token);
            if (isBlacklisted) {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Token has been revoked');
            }
            // Verify JWT token using JWT service
            if (!config_1.default.jwt_access_secret) {
                logger_1.Logger.error('JWT access secret is not configured');
                throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'JWT configuration error');
            }
            const decoded = yield JWTService_1.jwtService.verifyToken(token, config_1.default.jwt_access_secret);
            const { role, email, iat } = decoded;
            // Try to get user from Redis cache first
            let user = null;
            const cachedUser = yield redis_1.redisOperations.get(`user:${email}`);
            if (cachedUser) {
                try {
                    user = JSON.parse(cachedUser);
                }
                catch (parseError) {
                    console.warn('Failed to parse cached user data:', parseError);
                }
            }
            // If not in cache, get from database and cache
            if (!user) {
                user = yield user_model_1.User.isUserExists(email);
                if (user) {
                    // Cache user data for 15 minutes
                    yield redis_1.redisOperations.setex(`user:${email}`, 900, JSON.stringify(user));
                }
            }
            if (!user) {
                throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'This user is not found!');
            }
            // Check if user is deleted or blocked
            if (user.isDeleted) {
                throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'This user is deleted!');
            }
            if (user.status === 'blocked') {
                throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked!');
            }
            // Check if JWT was issued before password change
            if (user.passwordChangedAt &&
                user_model_1.User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat)) {
                // Blacklist the token since password was changed
                yield JWTService_1.jwtService.blacklistToken(token);
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'You are not authorized!');
            }
            // Check role permissions
            if (requiredRoles && requiredRoles.length > 0) {
                console_replacement_1.conditionalLog.dev(`Required roles: ${requiredRoles.join(', ')}, User role: ${role}`);
                if (!requiredRoles.includes(role)) {
                    console_replacement_1.specializedLog.auth.security('role_mismatch', {
                        userRole: role,
                        requiredRoles,
                        endpoint: req.path,
                        userId: (_a = user._id) === null || _a === void 0 ? void 0 : _a.toString()
                    });
                    throw new AppError_1.default(http_status_1.default.FORBIDDEN, `Access denied. Required role: ${requiredRoles.join(' or ')}`);
                }
            }
            // Track user activity in Redis
            const activityKey = `activity:${user._id}`;
            const activity = {
                endpoint: req.path,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            };
            // Use pipeline for atomic operations
            const pipeline = redis_1.redisOperations.pipeline();
            pipeline.lpush(activityKey, JSON.stringify(activity));
            pipeline.ltrim(activityKey, 0, 99); // Keep last 100 activities
            pipeline.expire(activityKey, 86400); // Expire after 24 hours
            yield pipeline.exec();
            // Add user info to request
            req.user = Object.assign(Object.assign({}, decoded), { _id: ((_b = user._id) === null || _b === void 0 ? void 0 : _b.toString()) || '' });
            // Log performance metrics
            const duration = Date.now() - startTime;
            console_replacement_1.conditionalLog.perf('auth_middleware', startTime, { email, duration });
            next();
        }
        catch (err) {
            logger_1.Logger.error('JWT verification error', { error: err });
            // Handle specific JWT errors
            if (err instanceof Error && err.name === 'TokenExpiredError') {
                console_replacement_1.conditionalLog.dev('Token expired at:', err.expiredAt);
                // Blacklist expired token to prevent reuse
                yield JWTService_1.jwtService.blacklistToken(token);
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Token expired: Please refresh your authentication');
            }
            if (err instanceof Error) {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, `Unauthorized: ${err.message}`);
            }
            throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Unauthorized');
        }
    }));
};
// Logout middleware that blacklists the current token
exports.logout = (0, catchAsync_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const token = extractToken(req);
    if (token) {
        try {
            // Blacklist the token
            yield JWTService_1.jwtService.blacklistToken(token);
            console_replacement_1.specializedLog.auth.success(((_a = req.user) === null || _a === void 0 ? void 0 : _a._id) || 'unknown', 'user_logout_token_blacklisted');
        }
        catch (error) {
            logger_1.Logger.warn('Failed to blacklist token during logout', { error });
            // Don't fail the logout process if blacklisting fails
        }
    }
    next();
}));
// Middleware to destroy all user sessions
exports.logoutAllDevices = (0, catchAsync_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a._id) {
        try {
            // Clear user cache
            yield redis_1.redisOperations.del(`user:${req.user.email}`);
            // Clear user activity
            yield redis_1.redisOperations.del(`activity:${req.user._id}`);
            console_replacement_1.specializedLog.auth.success(req.user._id, 'logout_all_devices_completed');
        }
        catch (error) {
            logger_1.Logger.warn('Failed to destroy all sessions', { error, userId: req.user._id });
        }
    }
    next();
}));
// Middleware to check if user has specific permissions
const requirePermissions = (...permissions) => {
    return (0, catchAsync_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User not authenticated');
        }
        try {
            // Try to get permissions from Redis cache
            let userPermissions = null;
            const cachedPermissions = yield redis_1.redisOperations.get(`permissions:${req.user._id}`);
            if (cachedPermissions) {
                try {
                    userPermissions = JSON.parse(cachedPermissions);
                }
                catch (parseError) {
                    console.warn('Failed to parse cached permissions:', parseError);
                }
            }
            // If not cached, use role-based permission mapping
            if (!userPermissions) {
                const rolePermissions = {
                    admin: ['read', 'write', 'delete', 'manage_users', 'manage_system'],
                    teacher: ['read', 'write', 'manage_courses', 'grade_students'],
                    student: ['read', 'submit_assignments', 'view_grades']
                };
                userPermissions = rolePermissions[req.user.role] || [];
                // Cache permissions for 1 hour
                yield redis_1.redisOperations.setex(`permissions:${req.user._id}`, 3600, JSON.stringify(userPermissions));
            }
            // Check if user has all required permissions
            const hasAllPermissions = permissions.every(permission => userPermissions.includes(permission));
            if (!hasAllPermissions) {
                throw new AppError_1.default(http_status_1.default.FORBIDDEN, `Insufficient permissions. Required: ${permissions.join(', ')}`);
            }
            next();
        }
        catch (error) {
            if (error instanceof AppError_1.default) {
                throw error;
            }
            logger_1.Logger.error('Permission check error', { error, userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b._id });
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Permission check failed');
        }
    }));
};
exports.requirePermissions = requirePermissions;
exports.default = authWithCache;
