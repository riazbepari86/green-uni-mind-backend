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
const redis_1 = require("../../config/redis");
const logger_1 = require("../../config/logger");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
class EnhancedRateLimitService {
    constructor() {
        this.DEFAULT_CONFIGS = {
            // Analytics endpoints
            analytics: {
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 30, // 30 requests per minute
                message: 'Too many analytics requests. Please try again later.',
            },
            // Enhanced analytics endpoints (more restrictive)
            enhancedAnalytics: {
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 15, // 15 requests per minute
                message: 'Too many enhanced analytics requests. Please try again later.',
            },
            // Messaging endpoints
            messaging: {
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 50, // 50 requests per minute
                message: 'Too many messaging requests. Please try again later.',
            },
            // Message creation (more restrictive)
            messageCreation: {
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 10, // 10 messages per minute
                message: 'Too many messages sent. Please wait before sending more.',
            },
            // Conversation creation (very restrictive)
            conversationCreation: {
                windowMs: 60 * 60 * 1000, // 1 hour
                maxRequests: 5, // 5 conversations per hour
                message: 'Too many conversation creation attempts. Please wait before trying again.',
            },
            // Activity tracking
            activities: {
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 100, // 100 requests per minute
                message: 'Too many activity requests. Please try again later.',
            },
            // Bulk operations (more restrictive)
            bulkOperations: {
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 5, // 5 bulk operations per minute
                message: 'Too many bulk operations. Please wait before trying again.',
            },
            // Search operations
            search: {
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 20, // 20 searches per minute
                message: 'Too many search requests. Please try again later.',
            },
            // File uploads
            fileUpload: {
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 10, // 10 uploads per minute
                message: 'Too many file upload attempts. Please wait before uploading more files.',
            },
            // General API
            general: {
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 100, // 100 requests per minute
                message: 'Too many requests. Please try again later.',
            },
        };
    }
    /**
     * Create rate limit middleware
     */
    createRateLimit(configName, customConfig) {
        const config = typeof configName === 'string'
            ? Object.assign(Object.assign({}, this.DEFAULT_CONFIGS[configName]), customConfig) : Object.assign(Object.assign({}, configName), customConfig);
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const key = this.generateKey(req, config);
                const rateLimitInfo = yield this.checkRateLimit(key, config);
                // Add rate limit headers
                res.set({
                    'X-RateLimit-Limit': config.maxRequests.toString(),
                    'X-RateLimit-Remaining': Math.max(0, rateLimitInfo.remainingPoints).toString(),
                    'X-RateLimit-Reset': new Date(Date.now() + rateLimitInfo.msBeforeNext).toISOString(),
                    'X-RateLimit-Window': config.windowMs.toString(),
                });
                if (rateLimitInfo.remainingPoints < 0) {
                    // Rate limit exceeded
                    if (config.onLimitReached) {
                        config.onLimitReached(req, res);
                    }
                    logger_1.Logger.warn(`🚫 Rate limit exceeded for key: ${key}`, {
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        endpoint: req.path,
                        method: req.method,
                    });
                    throw new AppError_1.default(http_status_1.default.TOO_MANY_REQUESTS, config.message || 'Too many requests');
                }
                next();
            }
            catch (error) {
                if (error instanceof AppError_1.default) {
                    throw error;
                }
                logger_1.Logger.error('❌ Rate limit middleware error:', error);
                // In case of Redis error, allow the request to proceed
                next();
            }
        });
    }
    /**
     * Check rate limit for a key
     */
    checkRateLimit(key, config) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = Date.now();
                const windowStart = now - config.windowMs;
                // Use Redis sorted set to track requests in time window
                const pipeline = redis_1.redisOperations.pipeline();
                // Remove old entries
                pipeline.zremrangebyscore(key, 0, windowStart);
                // Add current request
                pipeline.zadd(key, now, `${now}-${Math.random()}`);
                // Count requests in current window
                pipeline.zcard(key);
                // Set expiration
                pipeline.expire(key, Math.ceil(config.windowMs / 1000));
                const results = yield pipeline.exec();
                if (!results) {
                    throw new Error('Pipeline execution failed');
                }
                const totalHitsInWindow = results[2][1];
                const remainingPoints = config.maxRequests - totalHitsInWindow;
                const isFirstInWindow = totalHitsInWindow === 1;
                // Calculate time until window resets
                const oldestEntry = yield redis_1.redisOperations.zrange(key, 0, 0, 'WITHSCORES');
                const msBeforeNext = oldestEntry.length > 0
                    ? Math.max(0, config.windowMs - (now - parseInt(oldestEntry[1])))
                    : config.windowMs;
                return {
                    totalHits: totalHitsInWindow,
                    totalHitsInWindow,
                    remainingPoints,
                    msBeforeNext,
                    isFirstInWindow,
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Rate limit check error:', error);
                // Return permissive values on error
                return {
                    totalHits: 0,
                    totalHitsInWindow: 0,
                    remainingPoints: config.maxRequests,
                    msBeforeNext: 0,
                    isFirstInWindow: true,
                };
            }
        });
    }
    /**
     * Reset rate limit for a key
     */
    resetRateLimit(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield redis_1.redisOperations.del(key);
                return result > 0;
            }
            catch (error) {
                logger_1.Logger.error('❌ Rate limit reset error:', error);
                return false;
            }
        });
    }
    /**
     * Get rate limit status for a key
     */
    getRateLimitStatus(key, config) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = Date.now();
                const windowStart = now - config.windowMs;
                // Count requests in current window without modifying
                const totalHitsInWindow = yield redis_1.redisOperations.zcount(key, windowStart, now);
                const remainingPoints = config.maxRequests - totalHitsInWindow;
                // Get oldest entry to calculate reset time
                const oldestEntry = yield redis_1.redisOperations.zrange(key, 0, 0, 'WITHSCORES');
                const msBeforeNext = oldestEntry.length > 0
                    ? Math.max(0, config.windowMs - (now - parseInt(oldestEntry[1])))
                    : config.windowMs;
                return {
                    totalHits: totalHitsInWindow,
                    totalHitsInWindow,
                    remainingPoints,
                    msBeforeNext,
                    isFirstInWindow: totalHitsInWindow === 0,
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Rate limit status error:', error);
                return {
                    totalHits: 0,
                    totalHitsInWindow: 0,
                    remainingPoints: config.maxRequests,
                    msBeforeNext: 0,
                    isFirstInWindow: true,
                };
            }
        });
    }
    /**
     * Create adaptive rate limit that adjusts based on system load
     */
    createAdaptiveRateLimit(baseConfig, loadThresholds) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Get system metrics (simplified)
                const systemLoad = yield this.getSystemLoad();
                // Adjust rate limit based on load
                let adjustedConfig = Object.assign({}, baseConfig);
                if (systemLoad.cpu > loadThresholds.cpu ||
                    systemLoad.memory > loadThresholds.memory ||
                    systemLoad.redis > loadThresholds.redis) {
                    // Reduce rate limit by 50% under high load
                    adjustedConfig.maxRequests = Math.floor(baseConfig.maxRequests * 0.5);
                    logger_1.Logger.warn('⚠️ High system load detected, reducing rate limits', {
                        systemLoad,
                        originalLimit: baseConfig.maxRequests,
                        adjustedLimit: adjustedConfig.maxRequests,
                    });
                }
                // Apply the adjusted rate limit
                const rateLimitMiddleware = this.createRateLimit(adjustedConfig);
                return rateLimitMiddleware(req, res, next);
            }
            catch (error) {
                logger_1.Logger.error('❌ Adaptive rate limit error:', error);
                // Fallback to base config
                const rateLimitMiddleware = this.createRateLimit(baseConfig);
                return rateLimitMiddleware(req, res, next);
            }
        });
    }
    /**
     * Generate cache key for rate limiting
     */
    generateKey(req, config) {
        var _a;
        if (config.keyGenerator) {
            return `ratelimit:${config.keyGenerator(req)}`;
        }
        // Default key generation strategy
        const user = req.user;
        const userId = (user === null || user === void 0 ? void 0 : user.userId) || (user === null || user === void 0 ? void 0 : user.teacherId) || (user === null || user === void 0 ? void 0 : user.studentId);
        const ip = req.ip || req.socket.remoteAddress;
        // Prefer user ID over IP for authenticated requests
        const identifier = userId || ip;
        const endpoint = ((_a = req.route) === null || _a === void 0 ? void 0 : _a.path) || req.path;
        return `ratelimit:${identifier}:${endpoint}`;
    }
    /**
     * Get simplified system load metrics
     */
    getSystemLoad() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Simplified load calculation
                const memoryUsage = process.memoryUsage();
                const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
                // Check Redis performance with a simple ping
                const redisStart = Date.now();
                yield redis_1.redisOperations.ping();
                const redisLatency = Date.now() - redisStart;
                return {
                    cpu: 0, // Would need additional monitoring for actual CPU usage
                    memory: memoryPercent,
                    redis: redisLatency, // Use latency as a proxy for Redis load
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ System load check error:', error);
                return { cpu: 0, memory: 0, redis: 0 };
            }
        });
    }
}
exports.default = new EnhancedRateLimitService();
