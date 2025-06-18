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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const user_model_1 = require("../modules/User/user.model");
const AuthCacheService_1 = require("../services/redis/AuthCacheService");
const RedisServiceManager_1 = require("../services/redis/RedisServiceManager");
const crypto_1 = __importDefault(require("crypto"));
// Initialize auth cache service
const authCache = new AuthCacheService_1.AuthCacheService(RedisServiceManager_1.redisServiceManager.authClient, RedisServiceManager_1.redisServiceManager.monitoring);
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
            // Check if token is blacklisted (fast Redis check)
            const isBlacklisted = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => authCache.isTokenBlacklisted(tokenId), 'auth', () => Promise.resolve(false) // Fallback: assume not blacklisted if Redis fails
            );
            if (isBlacklisted) {
                yield authCache.logSecurityEvent('unknown', 'blacklisted_token_used', {
                    tokenId,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Token has been revoked');
            }
            // Try to get cached token payload first
            let decoded = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => authCache.getTokenPayload(tokenId), 'auth', () => Promise.resolve(null) // Fallback: cache miss
            );
            // If not in cache, verify JWT and cache the result
            if (!decoded) {
                if (!config_1.default.jwt_access_secret) {
                    console.error('JWT access secret is not configured');
                    throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'JWT configuration error');
                }
                // Verify JWT token
                decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
                // Cache the verified token payload
                const tokenTTL = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
                if (tokenTTL > 0) {
                    yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => authCache.cacheToken(tokenId, decoded, tokenTTL), 'auth').catch(error => {
                        console.warn('Failed to cache token:', error);
                        // Don't fail the request if caching fails
                    });
                }
                console.log('Token verified and cached for user:', decoded.email);
            }
            else {
                console.log('Token retrieved from cache for user:', decoded.email);
            }
            const { role, email, iat } = decoded;
            // Try to get user from cache first
            let user = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.get(`user:${email}`), 'cache', () => Promise.resolve(null));
            // If not in cache, get from database and cache
            if (!user) {
                user = yield user_model_1.User.isUserExists(email);
                if (user) {
                    // Cache user data for 15 minutes
                    yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.set(`user:${email}`, user, 900), 'cache').catch(error => {
                        console.warn('Failed to cache user data:', error);
                    });
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
                const tokenTTL = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => authCache.blacklistToken(tokenId, tokenTTL), 'auth').catch(error => {
                    console.warn('Failed to blacklist token:', error);
                });
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'You are not authorized!');
            }
            // Check role permissions
            if (requiredRoles && requiredRoles.length > 0) {
                console.log(`Required roles: ${requiredRoles.join(', ')}, User role: ${role}`);
                if (!requiredRoles.includes(role)) {
                    yield authCache.logSecurityEvent(((_a = user._id) === null || _a === void 0 ? void 0 : _a.toString()) || 'unknown', 'unauthorized_access_attempt', {
                        requiredRoles,
                        userRole: role,
                        endpoint: req.path,
                        ip: req.ip,
                        userAgent: req.get('User-Agent')
                    });
                    console.error(`Role mismatch: User has role "${role}" but needs one of [${requiredRoles.join(', ')}]`);
                    throw new AppError_1.default(http_status_1.default.FORBIDDEN, `Access denied. Required role: ${requiredRoles.join(' or ')}`);
                }
            }
            // Track user activity
            yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => {
                var _a;
                return authCache.trackUserActivity(((_a = user._id) === null || _a === void 0 ? void 0 : _a.toString()) || 'unknown', 'api_access', {
                    endpoint: req.path,
                    method: req.method,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });
            }, 'auth').catch(error => {
                console.warn('Failed to track user activity:', error);
            });
            // Add user info to request
            req.user = Object.assign(Object.assign({}, decoded), { _id: ((_b = user._id) === null || _b === void 0 ? void 0 : _b.toString()) || '' });
            // Log performance metrics
            const duration = Date.now() - startTime;
            console.log(`Auth middleware completed in ${duration}ms for user: ${email}`);
            next();
        }
        catch (err) {
            console.error('JWT verification error:', err);
            // Log security event for failed authentication
            yield authCache.logSecurityEvent('unknown', 'authentication_failed', {
                error: err instanceof Error ? err.message : 'Unknown error',
                tokenId,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            }).catch(logError => {
                console.warn('Failed to log security event:', logError);
            });
            // Handle specific JWT errors
            if (err instanceof Error && err.name === 'TokenExpiredError') {
                console.log('Token expired at:', err.expiredAt);
                // Blacklist expired token to prevent reuse
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => authCache.blacklistToken(tokenId, 3600), 'auth').catch(error => {
                    console.warn('Failed to blacklist expired token:', error);
                });
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
        const tokenId = generateTokenId(token);
        try {
            // Decode token to get expiration
            const decoded = jsonwebtoken_1.default.decode(token);
            const tokenTTL = (decoded === null || decoded === void 0 ? void 0 : decoded.exp) ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
            // Blacklist the token
            yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => authCache.blacklistToken(tokenId, Math.max(tokenTTL, 0)), 'auth');
            // Log security event
            yield authCache.logSecurityEvent(((_a = req.user) === null || _a === void 0 ? void 0 : _a._id) || 'unknown', 'user_logout', {
                tokenId,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            console.log('Token blacklisted successfully for logout');
        }
        catch (error) {
            console.warn('Failed to blacklist token during logout:', error);
            // Don't fail the logout process if blacklisting fails
        }
    }
    next();
}));
// Middleware to destroy all user sessions (useful for "logout from all devices")
exports.logoutAllDevices = (0, catchAsync_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a._id) {
        try {
            yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => authCache.destroyAllUserSessions(req.user._id), 'auth');
            // Log security event
            yield authCache.logSecurityEvent(req.user._id, 'logout_all_devices', {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            console.log('All sessions destroyed for user:', req.user._id);
        }
        catch (error) {
            console.warn('Failed to destroy all sessions:', error);
        }
    }
    next();
}));
// Middleware to check if user has specific permissions (cached)
const requirePermissions = (...permissions) => {
    return (0, catchAsync_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
            throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User not authenticated');
        }
        try {
            // Try to get permissions from cache
            let userPermissions = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => authCache.getUserPermissions(req.user._id), 'auth', () => Promise.resolve(null));
            // If not cached, you would typically fetch from database and cache
            // For now, we'll use a simple role-based permission mapping
            if (!userPermissions) {
                // This is a simplified example - in practice, you'd fetch from your permission system
                const rolePermissions = {
                    admin: ['read', 'write', 'delete', 'manage_users', 'manage_system'],
                    teacher: ['read', 'write', 'manage_courses', 'grade_students'],
                    student: ['read', 'submit_assignments', 'view_grades']
                };
                userPermissions = rolePermissions[req.user.role] || [];
                // Cache permissions for 1 hour
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => authCache.cacheUserPermissions(req.user._id, userPermissions, 3600), 'auth').catch(error => {
                    console.warn('Failed to cache user permissions:', error);
                });
            }
            // Check if user has all required permissions
            const hasAllPermissions = permissions.every(permission => userPermissions.includes(permission));
            if (!hasAllPermissions) {
                yield authCache.logSecurityEvent(req.user._id, 'insufficient_permissions', {
                    requiredPermissions: permissions,
                    userPermissions,
                    endpoint: req.path,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });
                throw new AppError_1.default(http_status_1.default.FORBIDDEN, `Insufficient permissions. Required: ${permissions.join(', ')}`);
            }
            next();
        }
        catch (error) {
            if (error instanceof AppError_1.default) {
                throw error;
            }
            console.error('Permission check error:', error);
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Permission check failed');
        }
    }));
};
exports.requirePermissions = requirePermissions;
exports.default = authWithCache;
