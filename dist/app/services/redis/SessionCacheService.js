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
exports.SessionCacheService = void 0;
const BaseRedisService_1 = require("./BaseRedisService");
const interfaces_1 = require("./interfaces");
const crypto_1 = __importDefault(require("crypto"));
class SessionCacheService extends BaseRedisService_1.BaseRedisService {
    constructor(client, monitoring) {
        super(client, monitoring);
    }
    // Enhanced session management
    createSession(sessionData, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('create_session', () => __awaiter(this, void 0, void 0, function* () {
                const sessionId = this.generateSessionId();
                const now = new Date().toISOString();
                const fullSessionData = Object.assign(Object.assign({}, sessionData), { sessionId, createdAt: now, lastAccessedAt: now, expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() });
                const sessionKey = interfaces_1.RedisKeys.USER_SESSION(sessionId);
                const userSessionsKey = interfaces_1.RedisKeys.USER_SESSIONS(sessionData.userId);
                const pipeline = this.client.pipeline();
                // Store session data
                pipeline.setex(sessionKey, ttlSeconds, JSON.stringify(fullSessionData));
                // Add to user's session set
                pipeline.sadd(userSessionsKey, sessionId);
                pipeline.expire(userSessionsKey, ttlSeconds);
                // Track session creation
                pipeline.incr(`sessions:created:${new Date().toISOString().slice(0, 10)}`); // Daily counter
                pipeline.expire(`sessions:created:${new Date().toISOString().slice(0, 10)}`, 86400 * 7);
                yield pipeline.exec();
                console.log(`✅ Session created: ${sessionId} for user ${sessionData.userId}`);
                return sessionId;
            }));
        });
    }
    getSession(sessionId_1) {
        return __awaiter(this, arguments, void 0, function* (sessionId, updateLastAccessed = true) {
            return this.executeWithMonitoring('get_session', () => __awaiter(this, void 0, void 0, function* () {
                const sessionKey = interfaces_1.RedisKeys.USER_SESSION(sessionId);
                const data = yield this.client.get(sessionKey);
                if (!data)
                    return null;
                const sessionData = JSON.parse(data);
                // Update last accessed time if requested
                if (updateLastAccessed) {
                    sessionData.lastAccessedAt = new Date().toISOString();
                    const ttl = yield this.client.ttl(sessionKey);
                    if (ttl > 0) {
                        yield this.client.setex(sessionKey, ttl, JSON.stringify(sessionData));
                    }
                }
                return sessionData;
            }));
        });
    }
    updateSession(sessionId, updates, extendTtl) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('update_session', () => __awaiter(this, void 0, void 0, function* () {
                const sessionKey = interfaces_1.RedisKeys.USER_SESSION(sessionId);
                const existingData = yield this.client.get(sessionKey);
                if (!existingData) {
                    throw new Error('Session not found');
                }
                const currentSession = JSON.parse(existingData);
                const updatedSession = Object.assign(Object.assign(Object.assign({}, currentSession), updates), { lastAccessedAt: new Date().toISOString() });
                // If extending TTL, update expiration time
                if (extendTtl) {
                    updatedSession.expiresAt = new Date(Date.now() + extendTtl * 1000).toISOString();
                }
                const ttl = extendTtl || (yield this.client.ttl(sessionKey));
                yield this.client.setex(sessionKey, ttl, JSON.stringify(updatedSession));
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
                    // Track session destruction
                    pipeline.incr(`sessions:destroyed:${new Date().toISOString().slice(0, 10)}`);
                    pipeline.expire(`sessions:destroyed:${new Date().toISOString().slice(0, 10)}`, 86400 * 7);
                    yield pipeline.exec();
                    console.log(`🗑️ Session destroyed: ${sessionId} for user ${session.userId}`);
                }
            }));
        });
    }
    destroyAllUserSessions(userId, exceptSessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('destroy_all_user_sessions', () => __awaiter(this, void 0, void 0, function* () {
                const userSessionsKey = interfaces_1.RedisKeys.USER_SESSIONS(userId);
                const sessionIds = yield this.client.smembers(userSessionsKey);
                if (sessionIds.length === 0) {
                    return 0;
                }
                const pipeline = this.client.pipeline();
                let destroyedCount = 0;
                for (const sessionId of sessionIds) {
                    if (exceptSessionId && sessionId === exceptSessionId) {
                        continue; // Skip the current session if specified
                    }
                    pipeline.del(interfaces_1.RedisKeys.USER_SESSION(sessionId));
                    pipeline.srem(userSessionsKey, sessionId);
                    destroyedCount++;
                }
                if (destroyedCount > 0) {
                    yield pipeline.exec();
                    console.log(`🗑️ Destroyed ${destroyedCount} sessions for user ${userId}`);
                }
                return destroyedCount;
            }));
        });
    }
    getUserSessions(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('get_user_sessions', () => __awaiter(this, void 0, void 0, function* () {
                const userSessionsKey = interfaces_1.RedisKeys.USER_SESSIONS(userId);
                const sessionIds = yield this.client.smembers(userSessionsKey);
                if (sessionIds.length === 0) {
                    return [];
                }
                const pipeline = this.client.pipeline();
                sessionIds.forEach(sessionId => {
                    pipeline.get(interfaces_1.RedisKeys.USER_SESSION(sessionId));
                });
                const results = yield pipeline.exec();
                const sessions = [];
                results === null || results === void 0 ? void 0 : results.forEach((result, index) => {
                    if (result[1]) {
                        try {
                            const sessionData = JSON.parse(result[1]);
                            sessions.push(sessionData);
                        }
                        catch (error) {
                            console.warn(`Failed to parse session data for ${sessionIds[index]}:`, error);
                        }
                    }
                });
                return sessions.sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime());
            }));
        });
    }
    // User activity tracking
    trackUserActivity(activityData) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('track_user_activity', () => __awaiter(this, void 0, void 0, function* () {
                const fullActivityData = Object.assign(Object.assign({}, activityData), { timestamp: new Date().toISOString() });
                const activityKey = interfaces_1.RedisKeys.USER_ACTIVITY(activityData.userId);
                // Add to activity list (keep last 100 activities)
                yield this.client.lpush(activityKey, JSON.stringify(fullActivityData));
                yield this.client.ltrim(activityKey, 0, 99);
                yield this.client.expire(activityKey, 86400 * 30); // Keep for 30 days
                // Track activity metrics
                const activityMetricKey = `activity:${activityData.activity}:${new Date().toISOString().slice(0, 10)}`;
                yield this.client.incr(activityMetricKey);
                yield this.client.expire(activityMetricKey, 86400 * 7); // Keep for 7 days
            }));
        });
    }
    getUserActivity(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, limit = 20) {
            return this.executeWithMonitoring('get_user_activity', () => __awaiter(this, void 0, void 0, function* () {
                const activityKey = interfaces_1.RedisKeys.USER_ACTIVITY(userId);
                const activities = yield this.client.lrange(activityKey, 0, limit - 1);
                return activities.map(activity => {
                    try {
                        return JSON.parse(activity);
                    }
                    catch (error) {
                        console.warn('Failed to parse activity data:', error);
                        return null;
                    }
                }).filter(Boolean);
            }));
        });
    }
    // Session analytics
    getSessionStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('get_session_stats', () => __awaiter(this, void 0, void 0, function* () {
                const today = new Date().toISOString().slice(0, 10);
                const [createdToday, destroyedToday,] = yield Promise.all([
                    this.client.get(`sessions:created:${today}`),
                    this.client.get(`sessions:destroyed:${today}`),
                ]);
                // Get active sessions count (this is an approximation)
                const activeSessions = yield this.getActiveSessionsCount();
                return {
                    activeSessions,
                    totalSessionsToday: parseInt(createdToday || '0'),
                    totalSessionsDestroyed: parseInt(destroyedToday || '0'),
                    averageSessionDuration: 0, // Would need more complex tracking
                    sessionsByLoginMethod: {}, // Would need more complex tracking
                    sessionsByDeviceType: {}, // Would need more complex tracking
                };
            }));
        });
    }
    getActiveSessionsCount() {
        return __awaiter(this, void 0, void 0, function* () {
            // This is a simplified count - in production you might want to use a more efficient method
            const pattern = 'session:*';
            const keys = yield this.client.keys(pattern);
            return keys.length;
        });
    }
    // Session security features
    detectSuspiciousActivity(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('detect_suspicious_activity', () => __awaiter(this, void 0, void 0, function* () {
                const sessions = yield this.getUserSessions(userId);
                const activities = yield this.getUserActivity(userId, 50);
                const details = [];
                let suspiciousLogins = false;
                let multipleLocations = false;
                let unusualDevices = false;
                // Check for multiple concurrent sessions from different IPs
                const uniqueIPs = new Set(sessions.map(s => { var _a; return (_a = s.deviceInfo) === null || _a === void 0 ? void 0 : _a.ip; }).filter(Boolean));
                if (uniqueIPs.size > 3) {
                    multipleLocations = true;
                    details.push({
                        type: 'multiple_locations',
                        count: uniqueIPs.size,
                        ips: Array.from(uniqueIPs),
                    });
                }
                // Check for unusual device types
                const deviceTypes = sessions.map(s => { var _a; return (_a = s.deviceInfo) === null || _a === void 0 ? void 0 : _a.deviceType; }).filter(Boolean);
                const uniqueDeviceTypes = new Set(deviceTypes);
                if (uniqueDeviceTypes.size > 2) {
                    unusualDevices = true;
                    details.push({
                        type: 'unusual_devices',
                        deviceTypes: Array.from(uniqueDeviceTypes),
                    });
                }
                // Check for rapid login attempts
                const recentLogins = activities.filter(a => a.activity === 'login' &&
                    Date.now() - new Date(a.timestamp).getTime() < 3600000 // Last hour
                );
                if (recentLogins.length > 5) {
                    suspiciousLogins = true;
                    details.push({
                        type: 'rapid_logins',
                        count: recentLogins.length,
                        timeframe: '1 hour',
                    });
                }
                return {
                    suspiciousLogins,
                    multipleLocations,
                    unusualDevices,
                    details,
                };
            }));
        });
    }
    // Session cleanup
    cleanupExpiredSessions() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cleanup_expired_sessions', () => __awaiter(this, void 0, void 0, function* () {
                // This would typically be handled by Redis TTL, but we can implement manual cleanup
                // for sessions that might have been orphaned
                let cleanedCount = 0;
                // In a real implementation, you'd use SCAN to iterate through session keys
                // and check their expiration times
                return cleanedCount;
            }));
        });
    }
    // Utility methods
    generateSessionId() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    parseUserAgent(userAgent) {
        // Simplified user agent parsing
        const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
        const isTablet = /iPad|Tablet/.test(userAgent);
        let deviceType = 'unknown';
        if (isTablet)
            deviceType = 'tablet';
        else if (isMobile)
            deviceType = 'mobile';
        else
            deviceType = 'desktop';
        return { deviceType };
    }
    // Session extension for "remember me" functionality
    extendSession(sessionId, additionalSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('extend_session', () => __awaiter(this, void 0, void 0, function* () {
                const sessionKey = interfaces_1.RedisKeys.USER_SESSION(sessionId);
                const currentTtl = yield this.client.ttl(sessionKey);
                if (currentTtl > 0) {
                    const newTtl = currentTtl + additionalSeconds;
                    yield this.client.expire(sessionKey, newTtl);
                    // Update session data with new expiration
                    const sessionData = yield this.client.get(sessionKey);
                    if (sessionData) {
                        const session = JSON.parse(sessionData);
                        session.expiresAt = new Date(Date.now() + newTtl * 1000).toISOString();
                        yield this.client.setex(sessionKey, newTtl, JSON.stringify(session));
                    }
                }
            }));
        });
    }
}
exports.SessionCacheService = SessionCacheService;
