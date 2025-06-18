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
exports.AuthCacheService = void 0;
const BaseRedisService_1 = require("./BaseRedisService");
const interfaces_1 = require("./interfaces");
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
class AuthCacheService extends BaseRedisService_1.BaseRedisService {
    constructor(client, monitoring) {
        super(client, monitoring);
    }
    // JWT Token Management
    cacheToken(tokenId, payload, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.JWT_TOKEN(tokenId);
            return this.executeWithMonitoring('cache_token', () => __awaiter(this, void 0, void 0, function* () {
                const tokenData = Object.assign(Object.assign({}, payload), { cachedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() });
                yield this.client.setex(key, ttlSeconds, JSON.stringify(tokenData));
            }));
        });
    }
    getTokenPayload(tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.JWT_TOKEN(tokenId);
            return this.executeWithMonitoring('get_token_payload', () => __awaiter(this, void 0, void 0, function* () {
                const data = yield this.client.get(key);
                return data ? JSON.parse(data) : null;
            }));
        });
    }
    blacklistToken(tokenId, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.JWT_BLACKLIST(tokenId);
            return this.executeWithMonitoring('blacklist_token', () => __awaiter(this, void 0, void 0, function* () {
                const blacklistData = {
                    blacklistedAt: new Date().toISOString(),
                    reason: 'user_logout',
                    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
                };
                yield this.client.setex(key, ttlSeconds, JSON.stringify(blacklistData));
                // Also remove from active token cache
                const tokenKey = interfaces_1.RedisKeys.JWT_TOKEN(tokenId);
                yield this.client.del(tokenKey);
            }));
        });
    }
    isTokenBlacklisted(tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.JWT_BLACKLIST(tokenId);
            return this.executeWithMonitoring('is_token_blacklisted', () => __awaiter(this, void 0, void 0, function* () {
                const exists = yield this.client.exists(key);
                return exists === 1;
            }));
        });
    }
    // Refresh Token Management with Family Tracking
    storeRefreshToken(tokenFamily, tokenId, userId, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('store_refresh_token', () => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.client.pipeline();
                // Store individual refresh token
                const tokenKey = interfaces_1.RedisKeys.REFRESH_TOKEN(tokenId);
                const tokenData = {
                    tokenId,
                    userId,
                    family: tokenFamily,
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
                };
                pipeline.setex(tokenKey, ttlSeconds, JSON.stringify(tokenData));
                // Add to token family set
                const familyKey = interfaces_1.RedisKeys.TOKEN_FAMILY(tokenFamily);
                pipeline.sadd(familyKey, tokenId);
                pipeline.expire(familyKey, ttlSeconds);
                yield pipeline.exec();
            }));
        });
    }
    getRefreshTokenInfo(tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.REFRESH_TOKEN(tokenId);
            return this.executeWithMonitoring('get_refresh_token_info', () => __awaiter(this, void 0, void 0, function* () {
                const data = yield this.client.get(key);
                return data ? JSON.parse(data) : null;
            }));
        });
    }
    invalidateTokenFamily(tokenFamily) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('invalidate_token_family', () => __awaiter(this, void 0, void 0, function* () {
                const familyKey = interfaces_1.RedisKeys.TOKEN_FAMILY(tokenFamily);
                const tokenIds = yield this.client.smembers(familyKey);
                if (tokenIds.length > 0) {
                    const pipeline = this.client.pipeline();
                    // Delete all tokens in the family
                    tokenIds.forEach(tokenId => {
                        pipeline.del(interfaces_1.RedisKeys.REFRESH_TOKEN(tokenId));
                    });
                    // Delete the family set
                    pipeline.del(familyKey);
                    yield pipeline.exec();
                }
            }));
        });
    }
    // Session Management
    createSession(sessionId, userId, sessionData, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('create_session', () => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.client.pipeline();
                // Store session data
                const sessionKey = interfaces_1.RedisKeys.USER_SESSION(sessionId);
                const fullSessionData = Object.assign(Object.assign({ sessionId,
                    userId }, sessionData), { createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() });
                pipeline.setex(sessionKey, ttlSeconds, JSON.stringify(fullSessionData));
                // Add to user's session set
                const userSessionsKey = interfaces_1.RedisKeys.USER_SESSIONS(userId);
                pipeline.sadd(userSessionsKey, sessionId);
                pipeline.expire(userSessionsKey, ttlSeconds);
                yield pipeline.exec();
            }));
        });
    }
    getSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.USER_SESSION(sessionId);
            return this.executeWithMonitoring('get_session', () => __awaiter(this, void 0, void 0, function* () {
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
    updateSession(sessionId, sessionData, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.USER_SESSION(sessionId);
            return this.executeWithMonitoring('update_session', () => __awaiter(this, void 0, void 0, function* () {
                const existingData = yield this.client.get(key);
                if (!existingData) {
                    throw new Error('Session not found');
                }
                const currentSession = JSON.parse(existingData);
                const updatedSession = Object.assign(Object.assign(Object.assign({}, currentSession), sessionData), { lastAccessedAt: new Date().toISOString() });
                const ttl = ttlSeconds || (yield this.client.ttl(key));
                yield this.client.setex(key, ttl, JSON.stringify(updatedSession));
            }));
        });
    }
    destroySession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('destroy_session', () => __awaiter(this, void 0, void 0, function* () {
                const sessionKey = interfaces_1.RedisKeys.USER_SESSION(sessionId);
                const sessionData = yield this.client.get(sessionKey);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    const userSessionsKey = interfaces_1.RedisKeys.USER_SESSIONS(session.userId);
                    const pipeline = this.client.pipeline();
                    pipeline.del(sessionKey);
                    pipeline.srem(userSessionsKey, sessionId);
                    yield pipeline.exec();
                }
            }));
        });
    }
    destroyAllUserSessions(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('destroy_all_user_sessions', () => __awaiter(this, void 0, void 0, function* () {
                const userSessionsKey = interfaces_1.RedisKeys.USER_SESSIONS(userId);
                const sessionIds = yield this.client.smembers(userSessionsKey);
                if (sessionIds.length > 0) {
                    const pipeline = this.client.pipeline();
                    sessionIds.forEach(sessionId => {
                        pipeline.del(interfaces_1.RedisKeys.USER_SESSION(sessionId));
                    });
                    pipeline.del(userSessionsKey);
                    yield pipeline.exec();
                }
            }));
        });
    }
    // User Activity Tracking
    trackUserActivity(userId, activity, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.USER_ACTIVITY(userId);
            return this.executeWithMonitoring('track_user_activity', () => __awaiter(this, void 0, void 0, function* () {
                const activityData = {
                    activity,
                    timestamp: new Date().toISOString(),
                    metadata: metadata || {}
                };
                // Add to activity list (keep last 100 activities)
                yield this.client.lpush(key, JSON.stringify(activityData));
                yield this.client.ltrim(key, 0, 99); // Keep only last 100 activities
                yield this.client.expire(key, 86400 * 30); // Expire after 30 days
            }));
        });
    }
    getUserActivity(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, limit = 10) {
            const key = interfaces_1.RedisKeys.USER_ACTIVITY(userId);
            return this.executeWithMonitoring('get_user_activity', () => __awaiter(this, void 0, void 0, function* () {
                const activities = yield this.client.lrange(key, 0, limit - 1);
                return activities.map(activity => JSON.parse(activity));
            }));
        });
    }
    // Advanced Authentication Features
    // Generate secure token family ID
    generateTokenFamily() {
        return crypto_1.default.randomBytes(16).toString('hex');
    }
    // Generate secure token ID
    generateTokenId() {
        return (0, uuid_1.v4)();
    }
    // Cache user permissions for faster authorization
    cacheUserPermissions(userId_1, permissions_1) {
        return __awaiter(this, arguments, void 0, function* (userId, permissions, ttlSeconds = 3600) {
            const key = interfaces_1.RedisKeys.USER_PERMISSIONS(userId);
            return this.executeWithMonitoring('cache_user_permissions', () => __awaiter(this, void 0, void 0, function* () {
                const permissionData = {
                    permissions,
                    cachedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
                };
                yield this.client.setex(key, ttlSeconds, JSON.stringify(permissionData));
            }));
        });
    }
    getUserPermissions(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = interfaces_1.RedisKeys.USER_PERMISSIONS(userId);
            return this.executeWithMonitoring('get_user_permissions', () => __awaiter(this, void 0, void 0, function* () {
                const data = yield this.client.get(key);
                if (!data)
                    return null;
                const permissionData = JSON.parse(data);
                return permissionData.permissions;
            }));
        });
    }
    // Batch operations for better performance
    batchBlacklistTokens(tokenIds, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('batch_blacklist_tokens', () => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.client.pipeline();
                const blacklistData = {
                    blacklistedAt: new Date().toISOString(),
                    reason: 'batch_logout',
                    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
                };
                tokenIds.forEach(tokenId => {
                    const blacklistKey = interfaces_1.RedisKeys.JWT_BLACKLIST(tokenId);
                    const tokenKey = interfaces_1.RedisKeys.JWT_TOKEN(tokenId);
                    pipeline.setex(blacklistKey, ttlSeconds, JSON.stringify(blacklistData));
                    pipeline.del(tokenKey);
                });
                yield pipeline.exec();
            }));
        });
    }
    batchCheckBlacklist(tokenIds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('batch_check_blacklist', () => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.client.pipeline();
                tokenIds.forEach(tokenId => {
                    const key = interfaces_1.RedisKeys.JWT_BLACKLIST(tokenId);
                    pipeline.exists(key);
                });
                const results = yield pipeline.exec();
                const blacklistStatus = {};
                tokenIds.forEach((tokenId, index) => {
                    var _a;
                    blacklistStatus[tokenId] = ((_a = results === null || results === void 0 ? void 0 : results[index]) === null || _a === void 0 ? void 0 : _a[1]) === 1;
                });
                return blacklistStatus;
            }));
        });
    }
    // Security features
    logSecurityEvent(userId, event, details) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `security:events:${userId}`;
            return this.executeWithMonitoring('log_security_event', () => __awaiter(this, void 0, void 0, function* () {
                const eventData = {
                    event,
                    details,
                    timestamp: new Date().toISOString(),
                    ip: details.ip || 'unknown',
                    userAgent: details.userAgent || 'unknown'
                };
                yield this.client.lpush(key, JSON.stringify(eventData));
                yield this.client.ltrim(key, 0, 49); // Keep last 50 security events
                yield this.client.expire(key, 86400 * 90); // Expire after 90 days
            }));
        });
    }
    getSecurityEvents(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, limit = 10) {
            const key = `security:events:${userId}`;
            return this.executeWithMonitoring('get_security_events', () => __awaiter(this, void 0, void 0, function* () {
                const events = yield this.client.lrange(key, 0, limit - 1);
                return events.map(event => JSON.parse(event));
            }));
        });
    }
    // Cleanup expired tokens and sessions
    cleanupExpiredData() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cleanup_expired_data', () => __awaiter(this, void 0, void 0, function* () {
                // This is a simplified cleanup - in production, you might want to use Redis SCAN
                // to avoid blocking operations on large datasets
                let tokensRemoved = 0;
                let sessionsRemoved = 0;
                let blacklistRemoved = 0;
                // Note: Redis automatically removes expired keys, but this method can be used
                // for manual cleanup or to get statistics
                return { tokensRemoved, sessionsRemoved, blacklistRemoved };
            }));
        });
    }
}
exports.AuthCacheService = AuthCacheService;
