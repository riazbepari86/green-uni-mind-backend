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
exports.OAuthCacheService = void 0;
const BaseRedisService_1 = require("./BaseRedisService");
const interfaces_1 = require("./interfaces");
const crypto_1 = __importDefault(require("crypto"));
class OAuthCacheService extends BaseRedisService_1.BaseRedisService {
    constructor(client, monitoring) {
        super(client, monitoring);
    }
    // OAuth State Management
    storeOAuthState(state, data, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.OAUTH_STATE(state);
            return this.executeWithMonitoring('store_oauth_state', () => __awaiter(this, void 0, void 0, function* () {
                const stateData = Object.assign(Object.assign({}, data), { createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(), nonce: crypto_1.default.randomBytes(16).toString('hex') });
                yield this.client.setex(key, ttlSeconds, JSON.stringify(stateData));
            }));
        });
    }
    getOAuthState(state) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.OAUTH_STATE(state);
            return this.executeWithMonitoring('get_oauth_state', () => __awaiter(this, void 0, void 0, function* () {
                const data = yield this.client.get(key);
                return data ? JSON.parse(data) : null;
            }));
        });
    }
    deleteOAuthState(state) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.OAUTH_STATE(state);
            return this.executeWithMonitoring('delete_oauth_state', () => __awaiter(this, void 0, void 0, function* () {
                yield this.client.del(key);
            }));
        });
    }
    // OAuth Token Caching
    cacheOAuthTokens(userId, provider, tokens, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.OAUTH_TOKENS(userId, provider);
            return this.executeWithMonitoring('cache_oauth_tokens', () => __awaiter(this, void 0, void 0, function* () {
                const tokenData = Object.assign(Object.assign({}, tokens), { userId,
                    provider, cachedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(), lastRefreshed: tokens.refresh_token ? new Date().toISOString() : undefined });
                yield this.client.setex(key, ttlSeconds, JSON.stringify(tokenData));
                // Also add to user's provider set for tracking
                const userProvidersKey = `oauth:providers:${userId}`;
                yield this.client.sadd(userProvidersKey, provider);
                yield this.client.expire(userProvidersKey, ttlSeconds + 300); // Slightly longer TTL
            }));
        });
    }
    getOAuthTokens(userId, provider) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.OAUTH_TOKENS(userId, provider);
            return this.executeWithMonitoring('get_oauth_tokens', () => __awaiter(this, void 0, void 0, function* () {
                const data = yield this.client.get(key);
                if (!data)
                    return null;
                const tokenData = JSON.parse(data);
                // Check if tokens are close to expiring and need refresh
                if (tokenData.expires_in && tokenData.cachedAt) {
                    const cachedTime = new Date(tokenData.cachedAt).getTime();
                    const expirationTime = cachedTime + (tokenData.expires_in * 1000);
                    const timeUntilExpiry = expirationTime - Date.now();
                    // Mark as needing refresh if less than 5 minutes remaining
                    if (timeUntilExpiry < 300000) {
                        tokenData.needsRefresh = true;
                    }
                }
                return tokenData;
            }));
        });
    }
    refreshOAuthTokens(userId, provider, newTokens, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.OAUTH_TOKENS(userId, provider);
            return this.executeWithMonitoring('refresh_oauth_tokens', () => __awaiter(this, void 0, void 0, function* () {
                // Get existing token data to preserve metadata
                const existingData = yield this.client.get(key);
                const existing = existingData ? JSON.parse(existingData) : {};
                const tokenData = Object.assign(Object.assign(Object.assign({}, existing), newTokens), { userId,
                    provider, lastRefreshed: new Date().toISOString(), refreshCount: (existing.refreshCount || 0) + 1, expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() });
                yield this.client.setex(key, ttlSeconds, JSON.stringify(tokenData));
            }));
        });
    }
    // User Profile Caching
    cacheUserProfile(userId, provider, profile, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.OAUTH_PROFILE(userId, provider);
            return this.executeWithMonitoring('cache_user_profile', () => __awaiter(this, void 0, void 0, function* () {
                const profileData = Object.assign(Object.assign({}, profile), { userId,
                    provider, cachedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() });
                yield this.client.setex(key, ttlSeconds, JSON.stringify(profileData));
            }));
        });
    }
    getUserProfile(userId, provider) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.OAUTH_PROFILE(userId, provider);
            return this.executeWithMonitoring('get_user_profile', () => __awaiter(this, void 0, void 0, function* () {
                const data = yield this.client.get(key);
                return data ? JSON.parse(data) : null;
            }));
        });
    }
    // Login Attempt Tracking
    trackLoginAttempt(identifier, success, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.LOGIN_ATTEMPTS(identifier);
            return this.executeWithMonitoring('track_login_attempt', () => __awaiter(this, void 0, void 0, function* () {
                const attemptData = {
                    success,
                    timestamp: new Date().toISOString(),
                    ip: (metadata === null || metadata === void 0 ? void 0 : metadata.ip) || 'unknown',
                    userAgent: (metadata === null || metadata === void 0 ? void 0 : metadata.userAgent) || 'unknown',
                    provider: (metadata === null || metadata === void 0 ? void 0 : metadata.provider) || 'local',
                    metadata: metadata || {},
                };
                // Add to attempts list (keep last 50 attempts)
                yield this.client.lpush(key, JSON.stringify(attemptData));
                yield this.client.ltrim(key, 0, 49);
                yield this.client.expire(key, 86400 * 7); // Keep for 7 days
                // Track failed attempts separately for rate limiting
                if (!success) {
                    const failedKey = `${key}:failed`;
                    yield this.client.incr(failedKey);
                    yield this.client.expire(failedKey, 3600); // Reset hourly
                }
            }));
        });
    }
    getLoginAttempts(identifier, windowSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.LOGIN_ATTEMPTS(identifier);
            return this.executeWithMonitoring('get_login_attempts', () => __awaiter(this, void 0, void 0, function* () {
                const attempts = yield this.client.lrange(key, 0, -1);
                const windowStart = Date.now() - (windowSeconds * 1000);
                let count = 0;
                for (const attemptStr of attempts) {
                    try {
                        const attempt = JSON.parse(attemptStr);
                        const attemptTime = new Date(attempt.timestamp).getTime();
                        if (attemptTime >= windowStart && !attempt.success) {
                            count++;
                        }
                    }
                    catch (error) {
                        // Skip invalid entries
                        continue;
                    }
                }
                return count;
            }));
        });
    }
    isAccountLocked(identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.ACCOUNT_LOCK(identifier);
            return this.executeWithMonitoring('is_account_locked', () => __awaiter(this, void 0, void 0, function* () {
                const lockData = yield this.client.get(key);
                if (!lockData)
                    return false;
                try {
                    const lock = JSON.parse(lockData);
                    const lockExpiry = new Date(lock.expiresAt).getTime();
                    return Date.now() < lockExpiry;
                }
                catch (_a) {
                    // Invalid lock data, remove it
                    yield this.client.del(key);
                    return false;
                }
            }));
        });
    }
    lockAccount(identifier, lockDurationSeconds, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.ACCOUNT_LOCK(identifier);
            return this.executeWithMonitoring('lock_account', () => __awaiter(this, void 0, void 0, function* () {
                const lockData = {
                    identifier,
                    reason,
                    lockedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + lockDurationSeconds * 1000).toISOString(),
                    lockDuration: lockDurationSeconds,
                };
                yield this.client.setex(key, lockDurationSeconds, JSON.stringify(lockData));
                // Log the lock event
                const lockEventKey = `lock:events:${identifier}`;
                yield this.client.lpush(lockEventKey, JSON.stringify(lockData));
                yield this.client.ltrim(lockEventKey, 0, 9); // Keep last 10 lock events
                yield this.client.expire(lockEventKey, 86400 * 30); // Keep for 30 days
            }));
        });
    }
    // Advanced OAuth features
    // Get all OAuth providers for a user
    getUserOAuthProviders(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `oauth:providers:${userId}`;
            return this.executeWithMonitoring('get_user_oauth_providers', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.smembers(key);
            }));
        });
    }
    // Remove OAuth provider for user
    removeOAuthProvider(userId, provider) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('remove_oauth_provider', () => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.client.pipeline();
                // Remove tokens
                pipeline.del(interfaces_1.RedisKeys.OAUTH_TOKENS(userId, provider));
                // Remove profile
                pipeline.del(interfaces_1.RedisKeys.OAUTH_PROFILE(userId, provider));
                // Remove from providers set
                pipeline.srem(`oauth:providers:${userId}`, provider);
                yield pipeline.exec();
            }));
        });
    }
    // OAuth session management
    createOAuthSession(sessionId, userId, provider, sessionData, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `oauth:session:${sessionId}`;
            return this.executeWithMonitoring('create_oauth_session', () => __awaiter(this, void 0, void 0, function* () {
                const fullSessionData = Object.assign(Object.assign({ sessionId,
                    userId,
                    provider }, sessionData), { createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() });
                yield this.client.setex(key, ttlSeconds, JSON.stringify(fullSessionData));
                // Add to user's OAuth sessions
                const userSessionsKey = `oauth:sessions:${userId}`;
                yield this.client.sadd(userSessionsKey, sessionId);
                yield this.client.expire(userSessionsKey, ttlSeconds);
            }));
        });
    }
    getOAuthSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `oauth:session:${sessionId}`;
            return this.executeWithMonitoring('get_oauth_session', () => __awaiter(this, void 0, void 0, function* () {
                const data = yield this.client.get(key);
                if (!data)
                    return null;
                const sessionData = JSON.parse(data);
                // Update last accessed time
                sessionData.lastAccessedAt = new Date().toISOString();
                yield this.client.setex(key, yield this.client.ttl(key), JSON.stringify(sessionData));
                return sessionData;
            }));
        });
    }
    destroyOAuthSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `oauth:session:${sessionId}`;
            return this.executeWithMonitoring('destroy_oauth_session', () => __awaiter(this, void 0, void 0, function* () {
                const sessionData = yield this.client.get(key);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    const userSessionsKey = `oauth:sessions:${session.userId}`;
                    const pipeline = this.client.pipeline();
                    pipeline.del(key);
                    pipeline.srem(userSessionsKey, sessionId);
                    yield pipeline.exec();
                }
            }));
        });
    }
    // Rate limiting for OAuth operations
    checkOAuthRateLimit(identifier, operation, maxAttempts, windowSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `oauth:ratelimit:${operation}:${identifier}`;
            return this.executeWithMonitoring('check_oauth_rate_limit', () => __awaiter(this, void 0, void 0, function* () {
                const current = yield this.client.incr(key);
                if (current === 1) {
                    // First request in window, set expiration
                    yield this.client.expire(key, windowSeconds);
                }
                const ttl = yield this.client.ttl(key);
                const resetTime = new Date(Date.now() + (ttl * 1000));
                return {
                    allowed: current <= maxAttempts,
                    remaining: Math.max(0, maxAttempts - current),
                    resetTime,
                };
            }));
        });
    }
    // OAuth analytics and monitoring
    recordOAuthMetric(provider, operation, success, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `oauth:metrics:${provider}:${operation}`;
            return this.executeWithMonitoring('record_oauth_metric', () => __awaiter(this, void 0, void 0, function* () {
                const metricData = {
                    provider,
                    operation,
                    success,
                    timestamp: new Date().toISOString(),
                    metadata: metadata || {},
                };
                // Store in time-series format
                const timeKey = `${key}:${new Date().toISOString().slice(0, 13)}`; // Hour-based buckets
                yield this.client.lpush(timeKey, JSON.stringify(metricData));
                yield this.client.expire(timeKey, 86400 * 7); // Keep for 7 days
                // Update counters
                const counterKey = `${key}:count`;
                const successKey = `${key}:success`;
                yield this.client.incr(counterKey);
                if (success) {
                    yield this.client.incr(successKey);
                }
                // Set expiration on counters
                yield this.client.expire(counterKey, 86400 * 30); // Keep for 30 days
                yield this.client.expire(successKey, 86400 * 30);
            }));
        });
    }
    getOAuthMetrics(provider, operation) {
        return __awaiter(this, void 0, void 0, function* () {
            const baseKey = `oauth:metrics:${provider}:${operation}`;
            return this.executeWithMonitoring('get_oauth_metrics', () => __awaiter(this, void 0, void 0, function* () {
                const [total, successful] = yield Promise.all([
                    this.client.get(`${baseKey}:count`),
                    this.client.get(`${baseKey}:success`)
                ]);
                const totalAttempts = parseInt(total || '0');
                const successfulAttempts = parseInt(successful || '0');
                const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;
                return {
                    totalAttempts,
                    successfulAttempts,
                    successRate,
                };
            }));
        });
    }
    // Cleanup expired OAuth data
    cleanupExpiredOAuthData() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cleanup_expired_oauth_data', () => __awaiter(this, void 0, void 0, function* () {
                // This is a simplified cleanup - in production, you might want to use Redis SCAN
                // to avoid blocking operations on large datasets
                let tokensRemoved = 0;
                let profilesRemoved = 0;
                let sessionsRemoved = 0;
                let statesRemoved = 0;
                // Note: Redis automatically removes expired keys, but this method can be used
                // for manual cleanup or to get statistics
                return { tokensRemoved, profilesRemoved, sessionsRemoved, statesRemoved };
            }));
        });
    }
}
exports.OAuthCacheService = OAuthCacheService;
