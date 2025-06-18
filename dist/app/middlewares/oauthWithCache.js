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
exports.validateOAuthSession = exports.handleOAuthCallback = exports.authenticateOAuth = exports.validateOAuthState = exports.generateOAuthState = void 0;
const passport_1 = __importDefault(require("passport"));
const OAuthCacheService_1 = require("../services/redis/OAuthCacheService");
const SessionCacheService_1 = require("../services/redis/SessionCacheService");
const RedisServiceManager_1 = require("../services/redis/RedisServiceManager");
const JWTService_1 = require("../services/auth/JWTService");
const AppError_1 = __importDefault(require("../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const crypto_1 = __importDefault(require("crypto"));
// Initialize services
const oauthCache = new OAuthCacheService_1.OAuthCacheService(RedisServiceManager_1.redisServiceManager.sessionsClient, RedisServiceManager_1.redisServiceManager.monitoring);
const sessionCache = new SessionCacheService_1.SessionCacheService(RedisServiceManager_1.redisServiceManager.sessionsClient, RedisServiceManager_1.redisServiceManager.monitoring);
// Enhanced OAuth state generation with Redis caching
const generateOAuthState = (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const state = crypto_1.default.randomBytes(32).toString('hex');
        const stateData = {
            provider: req.params.provider,
            returnUrl: req.query.returnUrl || '/',
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            createdAt: new Date().toISOString(),
        };
        // Store state in Redis with 10-minute expiration
        yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => oauthCache.storeOAuthState(state, stateData, 600), 'sessions');
        // Store state in session for fallback
        req.session = req.session || {};
        req.session.oauthState = state;
        // Add state to request for use in OAuth URL generation
        req.oauthState = state;
        console.log(`✅ OAuth state generated: ${state} for provider: ${req.params.provider}`);
        next();
    }
    catch (error) {
        console.error('Error generating OAuth state:', error);
        next(new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to initialize OAuth flow'));
    }
});
exports.generateOAuthState = generateOAuthState;
// Enhanced OAuth state validation with Redis lookup
const validateOAuthState = (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { state } = req.query;
        if (!state || typeof state !== 'string') {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid OAuth state parameter');
        }
        // Check rate limiting for OAuth operations
        const rateLimitResult = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => oauthCache.checkOAuthRateLimit(req.ip || 'unknown', 'oauth_callback', 10, 300), // 10 attempts per 5 minutes
        'sessions', () => Promise.resolve({ allowed: true, remaining: 10, resetTime: new Date() }));
        if (!rateLimitResult.allowed) {
            throw new AppError_1.default(http_status_1.default.TOO_MANY_REQUESTS, `OAuth rate limit exceeded. Try again after ${rateLimitResult.resetTime.toISOString()}`);
        }
        // Retrieve and validate state from Redis
        const stateData = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => oauthCache.getOAuthState(state), 'sessions', () => Promise.resolve(null));
        if (!stateData) {
            // Fallback to session-based state validation
            if (((_a = req.session) === null || _a === void 0 ? void 0 : _a.oauthState) !== state) {
                yield oauthCache.recordOAuthMetric(req.params.provider || 'unknown', 'state_validation', false, {
                    reason: 'invalid_state',
                    ip: req.ip,
                });
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid or expired OAuth state');
            }
        }
        else {
            // Validate state data
            if (stateData.ip !== req.ip) {
                yield oauthCache.recordOAuthMetric(req.params.provider || 'unknown', 'state_validation', false, {
                    reason: 'ip_mismatch',
                    originalIp: stateData.ip,
                    currentIp: req.ip,
                });
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'OAuth state validation failed: IP mismatch');
            }
            // Clean up used state
            yield oauthCache.deleteOAuthState(state);
        }
        // Record successful state validation
        yield oauthCache.recordOAuthMetric(req.params.provider || 'unknown', 'state_validation', true);
        console.log(`✅ OAuth state validated: ${state}`);
        next();
    }
    catch (error) {
        if (error instanceof AppError_1.default) {
            next(error);
        }
        else {
            console.error('Error validating OAuth state:', error);
            next(new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'OAuth state validation failed'));
        }
    }
});
exports.validateOAuthState = validateOAuthState;
// Enhanced OAuth authentication with caching
const authenticateOAuth = (provider) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // Check if account is locked
            const isLocked = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => oauthCache.isAccountLocked(req.ip || 'unknown'), 'sessions', () => Promise.resolve(false));
            if (isLocked) {
                throw new AppError_1.default(http_status_1.default.TOO_MANY_REQUESTS, 'Account temporarily locked due to suspicious activity');
            }
            // Use Passport for OAuth authentication
            passport_1.default.authenticate(provider, {
                scope: getOAuthScope(provider),
                state: req.oauthState,
            })(req, res, next);
        }
        catch (error) {
            if (error instanceof AppError_1.default) {
                next(error);
            }
            else {
                console.error(`OAuth authentication error for ${provider}:`, error);
                next(new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'OAuth authentication failed'));
            }
        }
    });
};
exports.authenticateOAuth = authenticateOAuth;
// Enhanced OAuth callback handler with Redis caching
const handleOAuthCallback = (provider) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // Track login attempt
            yield oauthCache.trackLoginAttempt(req.ip || 'unknown', false, {
                provider,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString(),
            });
            passport_1.default.authenticate(provider, { session: false }, (err, user, info) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    if (err) {
                        console.error(`OAuth callback error for ${provider}:`, err);
                        yield oauthCache.recordOAuthMetric(provider, 'callback', false, { error: err.message });
                        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'OAuth authentication failed');
                    }
                    if (!user) {
                        console.log(`OAuth callback failed for ${provider}:`, info);
                        yield oauthCache.recordOAuthMetric(provider, 'callback', false, { reason: (info === null || info === void 0 ? void 0 : info.message) || 'unknown' });
                        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, (info === null || info === void 0 ? void 0 : info.message) || 'OAuth authentication failed');
                    }
                    // Cache OAuth tokens if available
                    if (user.oauthTokens) {
                        yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => oauthCache.cacheOAuthTokens(user._id.toString(), provider, user.oauthTokens, 3600 // 1 hour
                        ), 'sessions').catch(error => {
                            console.warn('Failed to cache OAuth tokens:', error);
                        });
                    }
                    // Cache user profile
                    if (user.profile) {
                        yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => oauthCache.cacheUserProfile(user._id.toString(), provider, user.profile, 3600 // 1 hour
                        ), 'sessions').catch(error => {
                            console.warn('Failed to cache user profile:', error);
                        });
                    }
                    // Create JWT tokens
                    const tokenPair = yield JWTService_1.jwtService.createTokenPair({
                        email: user.email,
                        role: user.role,
                        _id: user._id.toString(),
                    });
                    // Create enhanced session
                    const sessionId = yield sessionCache.createSession({
                        userId: user._id.toString(),
                        userRole: user.role,
                        loginMethod: provider,
                        deviceInfo: {
                            userAgent: req.get('User-Agent') || 'unknown',
                            ip: req.ip || 'unknown',
                            deviceType: parseDeviceType(req.get('User-Agent') || ''),
                        },
                        permissions: getUserPermissions(user.role),
                        metadata: {
                            provider,
                            oauthProfile: user.profile,
                            loginTimestamp: new Date().toISOString(),
                        },
                    }, 86400 * 30); // 30 days
                    // Track successful login
                    yield Promise.all([
                        oauthCache.trackLoginAttempt(req.ip || 'unknown', true, {
                            provider,
                            userId: user._id.toString(),
                            userAgent: req.get('User-Agent'),
                        }),
                        oauthCache.recordOAuthMetric(provider, 'callback', true, {
                            userId: user._id.toString(),
                        }),
                        sessionCache.trackUserActivity({
                            sessionId,
                            userId: user._id.toString(),
                            activity: 'oauth_login',
                            ip: req.ip,
                            userAgent: req.get('User-Agent'),
                            metadata: { provider },
                        }),
                    ]);
                    // Set tokens in response
                    res.cookie('refreshToken', tokenPair.refreshToken, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                    });
                    res.cookie('sessionId', sessionId, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                    });
                    // Add user and tokens to request
                    req.user = {
                        _id: user._id.toString(),
                        email: user.email,
                        role: user.role,
                    };
                    req.accessToken = tokenPair.accessToken;
                    req.sessionId = sessionId;
                    console.log(`✅ OAuth authentication successful for ${provider}: ${user.email}`);
                    next();
                }
                catch (error) {
                    if (error instanceof AppError_1.default) {
                        next(error);
                    }
                    else {
                        console.error('Error in OAuth callback handler:', error);
                        next(new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'OAuth callback processing failed'));
                    }
                }
            }))(req, res, next);
        }
        catch (error) {
            if (error instanceof AppError_1.default) {
                next(error);
            }
            else {
                console.error(`OAuth callback error for ${provider}:`, error);
                next(new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'OAuth callback failed'));
            }
        }
    });
};
exports.handleOAuthCallback = handleOAuthCallback;
// OAuth session validation middleware
const validateOAuthSession = (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const sessionId = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.sessionId;
        if (!sessionId) {
            return next();
        }
        const session = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => sessionCache.getSession(sessionId), 'sessions', () => Promise.resolve(null));
        if (session) {
            // Add session info to request
            req.sessionData = session;
            // Track session activity
            yield sessionCache.trackUserActivity({
                sessionId: session.sessionId,
                userId: session.userId,
                activity: 'api_access',
                endpoint: req.path,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
            }).catch(error => {
                console.warn('Failed to track session activity:', error);
            });
        }
        next();
    }
    catch (error) {
        console.error('Error validating OAuth session:', error);
        next();
    }
});
exports.validateOAuthSession = validateOAuthSession;
// Utility functions
function getOAuthScope(provider) {
    const scopes = {
        google: ['profile', 'email'],
        facebook: ['email', 'public_profile'],
        apple: ['name', 'email'],
    };
    return scopes[provider] || ['profile', 'email'];
}
function parseDeviceType(userAgent) {
    if (/Mobile|Android|iPhone/.test(userAgent))
        return 'mobile';
    if (/iPad|Tablet/.test(userAgent))
        return 'tablet';
    if (/Windows|Mac|Linux/.test(userAgent))
        return 'desktop';
    return 'unknown';
}
function getUserPermissions(role) {
    const permissions = {
        admin: ['read', 'write', 'delete', 'manage_users', 'manage_system'],
        teacher: ['read', 'write', 'manage_courses', 'grade_students'],
        student: ['read', 'submit_assignments', 'view_grades'],
    };
    return permissions[role] || ['read'];
}
