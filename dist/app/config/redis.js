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
exports.ensureConnection = exports.safeRedisOperation = exports.redisOperations = exports.redis = exports.testRedisConnection = exports.otpOperations = void 0;
exports.isRedisHealthy = isRedisHealthy;
const ioredis_1 = __importDefault(require("ioredis"));
const index_1 = __importDefault(require("./index"));
// Redis connection configuration for Upstash
const redisConfig = {
    host: index_1.default.redis.host || 'localhost',
    port: index_1.default.redis.port || 6379,
    password: index_1.default.redis.password || '',
    family: 4,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxLoadingTimeout: 1000,
    lazyConnect: true, // Don't connect immediately
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    tls: index_1.default.redis.host && index_1.default.redis.host.includes('upstash.io') ? {} : undefined,
};
// Create a single Redis client instance
const redis = new ioredis_1.default(redisConfig);
exports.redis = redis;
// Connection state tracking
let isConnected = false;
let isConnecting = false;
// Setup connection event handlers
redis.on('connect', () => {
    console.log('✅ Redis client connected successfully');
    isConnecting = false;
});
redis.on('ready', () => {
    console.log('✅ Redis client is ready to accept commands');
    isConnected = true;
});
redis.on('error', (error) => {
    console.error('❌ Redis client connection error:', error);
    isConnected = false;
});
redis.on('close', () => {
    console.log('⚠️ Redis client connection closed');
    isConnected = false;
});
redis.on('reconnecting', (delay) => {
    console.log(`🔄 Redis client reconnecting in ${delay}ms...`);
    isConnecting = true;
});
// Health check function
function isRedisHealthy() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield safeRedisOperation(() => redis.ping(), null, 'health-check');
            return result === 'PONG';
        }
        catch (error) {
            console.error('Redis health check failed:', error);
            return false;
        }
    });
}
// Helper function to ensure connection
const ensureConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    if (isConnected)
        return;
    if (isConnecting) {
        // Wait for connection to complete
        yield new Promise((resolve) => {
            const checkConnection = () => {
                if (isConnected || !isConnecting) {
                    resolve(void 0);
                }
                else {
                    setTimeout(checkConnection, 100);
                }
            };
            checkConnection();
        });
        return;
    }
    try {
        isConnecting = true;
        yield redis.connect();
    }
    catch (error) {
        console.error('Failed to connect to Redis:', error);
        isConnecting = false;
        throw error;
    }
});
exports.ensureConnection = ensureConnection;
// Wrapper function for Redis operations with error handling
const safeRedisOperation = (operation, fallback, operationName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield ensureConnection();
        return yield operation();
    }
    catch (error) {
        console.warn(`Redis operation failed${operationName ? ` (${operationName})` : ''}:`, error);
        return fallback;
    }
});
exports.safeRedisOperation = safeRedisOperation;
// OTP-related Redis operations with error handling
exports.otpOperations = {
    storeOTP(email_1, otp_1) {
        return __awaiter(this, arguments, void 0, function* (email, otp, ttlSeconds = 300) {
            const key = `otp:${email}`;
            yield safeRedisOperation(() => redis.setex(key, ttlSeconds, otp), undefined, 'storeOTP');
            console.log(`✅ OTP stored for ${email} with TTL ${ttlSeconds}s`);
        });
    },
    getOTP(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `otp:${email}`;
            return (yield safeRedisOperation(() => redis.get(key), null, 'getOTP')) || null;
        });
    },
    deleteOTP(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `otp:${email}`;
            yield safeRedisOperation(() => redis.del(key), undefined, 'deleteOTP');
            console.log(`✅ OTP deleted for ${email}`);
        });
    },
    getOTPTTL(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `otp:${email}`;
            return (yield safeRedisOperation(() => redis.ttl(key), -1, 'getOTPTTL')) || -1;
        });
    },
    // Alias for compatibility
    setOTP: function (email_1, otp_1) {
        return __awaiter(this, arguments, void 0, function* (email, otp, ttlSeconds = 300) {
            return this.storeOTP(email, otp, ttlSeconds);
        });
    },
    checkResendCooldown(email_1) {
        return __awaiter(this, arguments, void 0, function* (email, cooldownSeconds = 60) {
            const cooldownKey = `otp:cooldown:${email}`;
            const exists = yield safeRedisOperation(() => redis.exists(cooldownKey), 0, 'checkResendCooldown-exists');
            if (exists) {
                const ttl = yield safeRedisOperation(() => redis.ttl(cooldownKey), 0, 'checkResendCooldown-ttl');
                return {
                    allowed: false,
                    remainingTime: ttl || 0
                };
            }
            yield safeRedisOperation(() => redis.setex(cooldownKey, cooldownSeconds, '1'), undefined, 'checkResendCooldown-set');
            return {
                allowed: true,
                remainingTime: 0
            };
        });
    },
    checkOTPRateLimit(email_1) {
        return __awaiter(this, arguments, void 0, function* (email, maxAttempts = 5, windowSeconds = 3600) {
            const attemptsKey = `otp:attempts:${email}`;
            const lockKey = `otp:lock:${email}`;
            // Check if locked
            const lockData = yield safeRedisOperation(() => redis.get(lockKey), null, 'checkOTPRateLimit-lockData');
            if (lockData) {
                try {
                    const lock = JSON.parse(lockData);
                    const ttl = yield safeRedisOperation(() => redis.ttl(lockKey), 0, 'checkOTPRateLimit-lockTTL');
                    if (lock.attempts >= maxAttempts) {
                        return {
                            allowed: false,
                            remaining: 0,
                            resetTime: Date.now() + ((ttl || 0) * 1000),
                            isLocked: true,
                            lockDuration: ttl || 0,
                            lockReason: lock.reason || 'Too many OTP requests'
                        };
                    }
                }
                catch (parseError) {
                    console.warn('Failed to parse lock data:', parseError);
                }
            }
            const current = yield safeRedisOperation(() => redis.get(attemptsKey), null, 'checkOTPRateLimit-current');
            const attempts = current ? parseInt(current) : 0;
            if (attempts >= maxAttempts) {
                const lockDuration = 1800; // 30 minutes
                const lockInfo = {
                    attempts: attempts + 1,
                    lockedAt: new Date().toISOString(),
                    reason: 'Exceeded maximum OTP requests'
                };
                yield safeRedisOperation(() => redis.setex(lockKey, lockDuration, JSON.stringify(lockInfo)), undefined, 'checkOTPRateLimit-setLock');
                yield safeRedisOperation(() => redis.del(attemptsKey), undefined, 'checkOTPRateLimit-delAttempts');
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime: Date.now() + (lockDuration * 1000),
                    isLocked: true,
                    lockDuration,
                    lockReason: lockInfo.reason
                };
            }
            if (current) {
                yield safeRedisOperation(() => redis.incr(attemptsKey), undefined, 'checkOTPRateLimit-incr');
            }
            else {
                yield safeRedisOperation(() => redis.setex(attemptsKey, windowSeconds, '1'), undefined, 'checkOTPRateLimit-setex');
            }
            const ttl = yield safeRedisOperation(() => redis.ttl(attemptsKey), windowSeconds, 'checkOTPRateLimit-ttl');
            const newAttempts = attempts + 1;
            return {
                allowed: true,
                remaining: maxAttempts - newAttempts,
                resetTime: Date.now() + ((ttl || windowSeconds) * 1000),
                isLocked: false
            };
        });
    },
    getRateLimitStatus(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const attemptsKey = `otp:attempts:${email}`;
            const lockKey = `otp:lock:${email}`;
            const cooldownKey = `otp:cooldown:${email}`;
            const [attempts, lockData, cooldownTTL] = yield Promise.all([
                safeRedisOperation(() => redis.get(attemptsKey), null, 'getRateLimitStatus-attempts'),
                safeRedisOperation(() => redis.get(lockKey), null, 'getRateLimitStatus-lockData'),
                safeRedisOperation(() => redis.ttl(cooldownKey), -1, 'getRateLimitStatus-cooldownTTL')
            ]);
            const currentAttempts = attempts ? parseInt(attempts) : 0;
            let lockInfo = null;
            let lockTimeRemaining = 0;
            if (lockData) {
                try {
                    lockInfo = JSON.parse(lockData);
                    lockTimeRemaining = (yield safeRedisOperation(() => redis.ttl(lockKey), 0, 'getRateLimitStatus-lockTTL')) || 0;
                }
                catch (parseError) {
                    console.warn('Failed to parse lock data in getRateLimitStatus:', parseError);
                }
            }
            return {
                attempts: currentAttempts,
                remaining: Math.max(5 - currentAttempts, 0),
                isLocked: !!lockInfo,
                lockTimeRemaining: Math.max(lockTimeRemaining, 0),
                cooldownTimeRemaining: Math.max(cooldownTTL || -1, 0)
            };
        });
    }
};
// Test Redis connection
const testRedisConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield ensureConnection();
        yield redis.ping();
        console.log('✅ Redis connection test successful');
        return true;
    }
    catch (error) {
        console.error('❌ Redis connection test failed:', error);
        return false;
    }
});
exports.testRedisConnection = testRedisConnection;
// Enhanced Redis operations with error handling
const redisOperations = {
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield safeRedisOperation(() => redis.get(key), null, `get:${key}`);
            return result || null;
        });
    },
    set(key, value, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (ttlSeconds) {
                yield safeRedisOperation(() => redis.setex(key, ttlSeconds, value), undefined, `setex:${key}`);
            }
            else {
                yield safeRedisOperation(() => redis.set(key, value), undefined, `set:${key}`);
            }
        });
    },
    setex(key, ttlSeconds, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield safeRedisOperation(() => redis.setex(key, ttlSeconds, value), undefined, `setex:${key}`);
        });
    },
    del(...keys) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.del(...keys), 0, `del:${keys.join(',')}`)) || 0;
        });
    },
    keys(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.keys(pattern), [], `keys:${pattern}`)) || [];
        });
    },
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.exists(key), 0, `exists:${key}`)) || 0;
        });
    },
    ttl(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.ttl(key), -1, `ttl:${key}`)) || -1;
        });
    },
    incr(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.incr(key), 0, `incr:${key}`)) || 0;
        });
    },
    sadd(key, member) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.sadd(key, member), 0, `sadd:${key}`)) || 0;
        });
    },
    smembers(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.smembers(key), [], `smembers:${key}`)) || [];
        });
    },
    expire(key, seconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.expire(key, seconds), 0, `expire:${key}`)) || 0;
        });
    },
    ping() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.ping(), 'PONG', 'ping')) || 'PONG';
        });
    },
    mget(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.mget(...keys), keys.map(() => null), `mget:${keys.join(',')}`)) || keys.map(() => null);
        });
    },
    zadd(key, score, member) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.zadd(key, score, member), 0, `zadd:${key}`)) || 0;
        });
    },
    zremrangebyscore(key, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.zremrangebyscore(key, min, max), 0, `zremrangebyscore:${key}`)) || 0;
        });
    },
    zcard(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.zcard(key), 0, `zcard:${key}`)) || 0;
        });
    },
    zrange(key, start, stop, withScores) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => withScores ? redis.zrange(key, start, stop, withScores) : redis.zrange(key, start, stop), [], `zrange:${key}`)) || [];
        });
    },
    zcount(key, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield safeRedisOperation(() => redis.zcount(key, min, max), 0, `zcount:${key}`)) || 0;
        });
    },
    // Pipeline operations
    pipeline() {
        return redis.pipeline();
    }
};
exports.redisOperations = redisOperations;
// Export the main Redis client and operations
exports.default = redis;
