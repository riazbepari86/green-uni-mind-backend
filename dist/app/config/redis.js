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
exports.testRedisConnection = exports.otpOperations = exports.newRedisSessions = exports.newRedisJobs = exports.newRedisCache = exports.newRedisAuth = exports.newRedis = exports.cacheService = exports.redisMonitoring = exports.redisServiceManager = exports.redisSessions = exports.redisJobs = exports.redisCache = exports.redisAuth = exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const index_1 = __importDefault(require("./index"));
// Redis connection configuration with optimized settings
const redisConfig = {
    host: index_1.default.redis.host,
    port: index_1.default.redis.port,
    password: index_1.default.redis.password,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    // TLS configuration for Upstash Redis
    tls: index_1.default.redis.host.includes('upstash.io') ? {} : undefined,
    // Connection pool settings for better performance
    family: 4, // Use IPv4
    keepAlive: 0, // 0 disables TCP keep-alive, or set to a number in ms (e.g., 10000)
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    // Optimized for high-performance scenarios
    retryDelayOnClusterDown: 300,
};
// Create primary Redis client instance
const redis = new ioredis_1.default(redisConfig);
exports.redis = redis;
// Create separate Redis clients for different use cases
const redisAuth = new ioredis_1.default(redisConfig); // For authentication operations
exports.redisAuth = redisAuth;
const redisCache = new ioredis_1.default(redisConfig); // For caching operations
exports.redisCache = redisCache;
const redisJobs = new ioredis_1.default(redisConfig); // For job queue operations
exports.redisJobs = redisJobs;
const redisSessions = new ioredis_1.default(redisConfig); // For session management
exports.redisSessions = redisSessions;
// Handle Redis connection events for primary client
redis.on('connect', () => {
    console.log('✅ Redis primary client connected successfully');
});
redis.on('ready', () => {
    console.log('✅ Redis primary client is ready to accept commands');
});
redis.on('error', (error) => {
    console.error('❌ Redis primary client connection error:', error);
});
redis.on('close', () => {
    console.log('⚠️ Redis primary client connection closed');
});
redis.on('reconnecting', () => {
    console.log('🔄 Redis primary client reconnecting...');
});
// Setup connection event handlers for specialized clients
const setupClientEvents = (client, name) => {
    client.on('connect', () => console.log(`✅ Redis ${name} client connected`));
    client.on('error', (error) => console.error(`❌ Redis ${name} client error:`, error));
    client.on('close', () => console.log(`⚠️ Redis ${name} client connection closed`));
    client.on('reconnecting', () => console.log(`🔄 Redis ${name} client reconnecting...`));
};
setupClientEvents(redisAuth, 'auth');
setupClientEvents(redisCache, 'cache');
setupClientEvents(redisJobs, 'jobs');
setupClientEvents(redisSessions, 'sessions');
// Import and use the new Redis Service Manager
const RedisServiceManager_1 = require("../services/redis/RedisServiceManager");
Object.defineProperty(exports, "redisServiceManager", { enumerable: true, get: function () { return RedisServiceManager_1.redisServiceManager; } });
Object.defineProperty(exports, "newRedis", { enumerable: true, get: function () { return RedisServiceManager_1.redis; } });
Object.defineProperty(exports, "newRedisAuth", { enumerable: true, get: function () { return RedisServiceManager_1.redisAuth; } });
Object.defineProperty(exports, "newRedisCache", { enumerable: true, get: function () { return RedisServiceManager_1.redisCache; } });
Object.defineProperty(exports, "newRedisJobs", { enumerable: true, get: function () { return RedisServiceManager_1.redisJobs; } });
Object.defineProperty(exports, "newRedisSessions", { enumerable: true, get: function () { return RedisServiceManager_1.redisSessions; } });
Object.defineProperty(exports, "redisMonitoring", { enumerable: true, get: function () { return RedisServiceManager_1.redisMonitoring; } });
Object.defineProperty(exports, "cacheService", { enumerable: true, get: function () { return RedisServiceManager_1.cacheService; } });
// OTP-related Redis operations
exports.otpOperations = {
    // Store OTP with TTL (5 minutes = 300 seconds)
    setOTP(email_1, otp_1) {
        return __awaiter(this, arguments, void 0, function* (email, otp, ttlSeconds = 300) {
            const key = `otp:${email}`;
            yield redis.setex(key, ttlSeconds, otp);
            console.log(`✅ OTP stored for ${email} with TTL ${ttlSeconds}s`);
        });
    },
    // Get OTP for email
    getOTP(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `otp:${email}`;
            const otp = yield redis.get(key);
            return otp;
        });
    },
    // Delete OTP after successful verification
    deleteOTP(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `otp:${email}`;
            yield redis.del(key);
            console.log(`✅ OTP deleted for ${email}`);
        });
    },
    // Check if OTP exists and get TTL
    getOTPTTL(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `otp:${email}`;
            return yield redis.ttl(key);
        });
    },
    // Professional-grade rate limiting for OTP requests
    checkOTPRateLimit(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const attemptsKey = `otp_attempts:${email}`;
            const lockKey = `otp_lock:${email}`;
            const maxAttempts = 3;
            const windowSeconds = 1800; // 30 minutes
            const lockDuration = 1800; // 30 minutes
            const extendedLockDuration = 3600; // 1 hour
            try {
                // Check if account is currently locked
                const lockData = yield redis.get(lockKey);
                if (lockData) {
                    const lock = JSON.parse(lockData);
                    const ttl = yield redis.ttl(lockKey);
                    // If locked account receives more requests, extend lock to 1 hour
                    if (lock.attempts >= maxAttempts) {
                        yield redis.setex(lockKey, extendedLockDuration, JSON.stringify(Object.assign(Object.assign({}, lock), { attempts: lock.attempts + 1, extendedLock: true, lastAttempt: Date.now() })));
                        console.warn(`🚨 Suspicious activity detected for ${email}: Extended lock applied`);
                        return {
                            allowed: false,
                            remaining: 0,
                            resetTime: Date.now() + (extendedLockDuration * 1000),
                            isLocked: true,
                            lockReason: 'Too many requests detected. Account locked for 1 hour due to suspicious activity.',
                            lockDuration: extendedLockDuration
                        };
                    }
                    return {
                        allowed: false,
                        remaining: 0,
                        resetTime: Date.now() + (ttl * 1000),
                        isLocked: true,
                        lockReason: 'Account temporarily locked due to too many OTP requests. Please try again in 30 minutes.',
                        lockDuration: ttl
                    };
                }
                // Check current attempts
                const current = yield redis.get(attemptsKey);
                const attempts = current ? parseInt(current) : 0;
                if (attempts >= maxAttempts) {
                    // Lock the account
                    const lockInfo = {
                        attempts: attempts + 1,
                        lockedAt: Date.now(),
                        reason: 'rate_limit_exceeded'
                    };
                    yield redis.setex(lockKey, lockDuration, JSON.stringify(lockInfo));
                    yield redis.del(attemptsKey); // Clean up attempts counter
                    console.warn(`🔒 Account locked for ${email}: Rate limit exceeded (${attempts + 1} attempts)`);
                    return {
                        allowed: false,
                        remaining: 0,
                        resetTime: Date.now() + (lockDuration * 1000),
                        isLocked: true,
                        lockReason: 'Account temporarily locked due to too many OTP requests. Please try again in 30 minutes.',
                        lockDuration: lockDuration
                    };
                }
                // Increment attempts
                if (current) {
                    yield redis.incr(attemptsKey);
                }
                else {
                    yield redis.setex(attemptsKey, windowSeconds, '1');
                }
                const ttl = yield redis.ttl(attemptsKey);
                const newAttempts = attempts + 1;
                console.log(`📊 OTP rate limit check for ${email}: ${newAttempts}/${maxAttempts} attempts`);
                return {
                    allowed: true,
                    remaining: maxAttempts - newAttempts,
                    resetTime: Date.now() + (ttl * 1000),
                    isLocked: false
                };
            }
            catch (error) {
                console.error('❌ Redis rate limiting error:', error);
                // Graceful degradation - allow request if Redis fails
                return {
                    allowed: true,
                    remaining: 2,
                    resetTime: Date.now() + (windowSeconds * 1000),
                    isLocked: false
                };
            }
        });
    },
    // Resend cooldown management (1-minute cooldown between resend requests)
    checkResendCooldown(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const cooldownKey = `otp_resend_cooldown:${email}`;
            const cooldownSeconds = 60; // 1 minute
            try {
                const exists = yield redis.exists(cooldownKey);
                if (exists) {
                    const ttl = yield redis.ttl(cooldownKey);
                    console.log(`⏰ Resend cooldown active for ${email}: ${ttl} seconds remaining`);
                    return {
                        allowed: false,
                        remainingTime: ttl
                    };
                }
                // Set cooldown
                yield redis.setex(cooldownKey, cooldownSeconds, '1');
                console.log(`✅ Resend cooldown set for ${email}: ${cooldownSeconds} seconds`);
                return {
                    allowed: true,
                    remainingTime: 0
                };
            }
            catch (error) {
                console.error('❌ Redis resend cooldown error:', error);
                // Graceful degradation - allow resend if Redis fails
                return {
                    allowed: true,
                    remainingTime: 0
                };
            }
        });
    },
    // Get comprehensive rate limiting status
    getRateLimitStatus(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const attemptsKey = `otp_attempts:${email}`;
            const lockKey = `otp_lock:${email}`;
            const cooldownKey = `otp_resend_cooldown:${email}`;
            const maxAttempts = 3;
            try {
                const [attempts, lockData, cooldownTTL] = yield Promise.all([
                    redis.get(attemptsKey),
                    redis.get(lockKey),
                    redis.ttl(cooldownKey)
                ]);
                const currentAttempts = attempts ? parseInt(attempts) : 0;
                const isLocked = !!lockData;
                let lockInfo = null;
                let lockTimeRemaining = 0;
                if (isLocked) {
                    lockInfo = JSON.parse(lockData);
                    lockTimeRemaining = yield redis.ttl(lockKey);
                }
                return {
                    attempts: currentAttempts,
                    remaining: Math.max(0, maxAttempts - currentAttempts),
                    isLocked,
                    lockReason: (lockInfo === null || lockInfo === void 0 ? void 0 : lockInfo.extendedLock)
                        ? 'Too many requests detected. Account locked for 1 hour due to suspicious activity.'
                        : isLocked
                            ? 'Account temporarily locked due to too many OTP requests. Please try again in 30 minutes.'
                            : undefined,
                    lockTimeRemaining: lockTimeRemaining > 0 ? lockTimeRemaining : undefined,
                    resendCooldownRemaining: cooldownTTL > 0 ? cooldownTTL : undefined,
                    canResend: !isLocked && cooldownTTL <= 0
                };
            }
            catch (error) {
                console.error('❌ Redis rate limit status error:', error);
                return {
                    attempts: 0,
                    remaining: maxAttempts,
                    isLocked: false,
                    canResend: true
                };
            }
        });
    },
    // Utility functions for testing and debugging
    clearOTP(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `otp:${email}`;
            yield redis.del(key);
            console.log(`✅ OTP cleared for ${email}`);
        });
    },
    clearRateLimit(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const attemptsKey = `otp_attempts:${email}`;
            const lockKey = `otp_lock:${email}`;
            const cooldownKey = `otp_resend_cooldown:${email}`;
            yield Promise.all([
                redis.del(attemptsKey),
                redis.del(lockKey),
                redis.del(cooldownKey)
            ]);
            console.log(`✅ Rate limit data cleared for ${email}`);
        });
    },
    // Clear all OTP-related data for an email (useful for testing)
    clearAllOTPData(email) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all([
                this.clearOTP(email),
                this.clearRateLimit(email)
            ]);
            console.log(`✅ All OTP data cleared for ${email}`);
        });
    },
    // Reset rate limiting for an email (admin function)
    resetRateLimit(email) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.clearRateLimit(email);
            console.log(`🔓 Rate limit reset for ${email}`);
        });
    }
};
// Test Redis connection (enhanced with service manager)
const testRedisConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // For Upstash, use a simpler connection test
        if ((_a = process.env.REDIS_URL) === null || _a === void 0 ? void 0 : _a.includes('upstash')) {
            console.log('🔍 Testing Upstash Redis connection...');
            // Simple ping test with timeout
            const pingPromise = redis.ping();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000));
            yield Promise.race([pingPromise, timeoutPromise]);
            console.log('✅ Upstash Redis connection test successful');
            return true;
        }
        // Test legacy connection for other Redis providers
        yield redis.ping();
        console.log('✅ Legacy Redis connection test successful');
        // Test new service manager
        const healthCheck = yield RedisServiceManager_1.redisServiceManager.healthCheck();
        console.log('✅ Redis Service Manager health check:', healthCheck.overall);
        // Test cache service
        yield RedisServiceManager_1.cacheService.set('test:connection', 'success', 10);
        const testValue = yield RedisServiceManager_1.cacheService.get('test:connection');
        yield RedisServiceManager_1.cacheService.del('test:connection');
        if (testValue === 'success') {
            console.log('✅ Cache service test successful');
        }
        return healthCheck.overall !== 'unhealthy';
    }
    catch (error) {
        console.error('❌ Redis connection test failed:', error);
        return false;
    }
});
exports.testRedisConnection = testRedisConnection;
exports.default = redis;
