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
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const JWTService_1 = require("../app/services/auth/JWTService");
const RedisServiceManager_1 = require("../app/services/redis/RedisServiceManager");
const AuthCacheService_1 = require("../app/services/redis/AuthCacheService");
(0, globals_1.describe)('Redis JWT Integration Tests', () => {
    let authCache;
    (0, globals_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        // Initialize auth cache service
        authCache = new AuthCacheService_1.AuthCacheService(RedisServiceManager_1.redisServiceManager.authClient, RedisServiceManager_1.redisServiceManager.monitoring);
        // Wait for Redis connection
        yield new Promise(resolve => setTimeout(resolve, 1000));
    }));
    (0, globals_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        // Cleanup and disconnect
        yield RedisServiceManager_1.redisServiceManager.shutdown();
    }));
    (0, globals_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
        // Clear test data before each test
        try {
            yield RedisServiceManager_1.redisServiceManager.authClient.flushdb();
        }
        catch (error) {
            console.warn('Failed to flush Redis DB:', error);
        }
    }));
    (0, globals_1.describe)('JWT Service', () => {
        const testPayload = {
            email: 'test@example.com',
            role: 'student',
            _id: '507f1f77bcf86cd799439011'
        };
        (0, globals_1.it)('should create token pair with family tracking', () => __awaiter(void 0, void 0, void 0, function* () {
            const tokenPair = yield JWTService_1.jwtService.createTokenPair(testPayload);
            (0, globals_1.expect)(tokenPair).toHaveProperty('accessToken');
            (0, globals_1.expect)(tokenPair).toHaveProperty('refreshToken');
            (0, globals_1.expect)(tokenPair).toHaveProperty('tokenFamily');
            (0, globals_1.expect)(tokenPair).toHaveProperty('expiresIn');
            (0, globals_1.expect)(tokenPair).toHaveProperty('refreshExpiresIn');
            (0, globals_1.expect)(typeof tokenPair.accessToken).toBe('string');
            (0, globals_1.expect)(typeof tokenPair.refreshToken).toBe('string');
            (0, globals_1.expect)(typeof tokenPair.tokenFamily).toBe('string');
            (0, globals_1.expect)(typeof tokenPair.expiresIn).toBe('number');
            (0, globals_1.expect)(typeof tokenPair.refreshExpiresIn).toBe('number');
        }));
        (0, globals_1.it)('should verify token and cache payload', () => __awaiter(void 0, void 0, void 0, function* () {
            const tokenPair = yield JWTService_1.jwtService.createTokenPair(testPayload);
            // Verify access token
            const decoded = yield JWTService_1.jwtService.verifyToken(tokenPair.accessToken, process.env.JWT_ACCESS_SECRET);
            (0, globals_1.expect)(decoded.email).toBe(testPayload.email);
            (0, globals_1.expect)(decoded.role).toBe(testPayload.role);
            (0, globals_1.expect)(decoded._id).toBe(testPayload._id);
            (0, globals_1.expect)(decoded).toHaveProperty('tokenId');
            (0, globals_1.expect)(decoded).toHaveProperty('family');
        }));
        (0, globals_1.it)('should refresh tokens with family rotation', () => __awaiter(void 0, void 0, void 0, function* () {
            const originalTokenPair = yield JWTService_1.jwtService.createTokenPair(testPayload);
            // Wait a moment to ensure different timestamps
            yield new Promise(resolve => setTimeout(resolve, 100));
            const newTokenPair = yield JWTService_1.jwtService.refreshTokens(originalTokenPair.refreshToken);
            (0, globals_1.expect)(newTokenPair.tokenFamily).toBe(originalTokenPair.tokenFamily);
            (0, globals_1.expect)(newTokenPair.accessToken).not.toBe(originalTokenPair.accessToken);
            (0, globals_1.expect)(newTokenPair.refreshToken).not.toBe(originalTokenPair.refreshToken);
        }));
        (0, globals_1.it)('should blacklist tokens', () => __awaiter(void 0, void 0, void 0, function* () {
            const tokenPair = yield JWTService_1.jwtService.createTokenPair(testPayload);
            // Blacklist access token
            yield JWTService_1.jwtService.blacklistToken(tokenPair.accessToken);
            // Check if token is blacklisted
            const isBlacklisted = yield JWTService_1.jwtService.isTokenBlacklisted(tokenPair.accessToken);
            (0, globals_1.expect)(isBlacklisted).toBe(true);
        }));
        (0, globals_1.it)('should invalidate token family', () => __awaiter(void 0, void 0, void 0, function* () {
            const tokenPair = yield JWTService_1.jwtService.createTokenPair(testPayload);
            // Invalidate token family
            yield JWTService_1.jwtService.invalidateTokenFamily(tokenPair.tokenFamily);
            // Try to refresh token - should fail
            yield (0, globals_1.expect)(JWTService_1.jwtService.refreshTokens(tokenPair.refreshToken)).rejects.toThrow();
        }));
        (0, globals_1.it)('should batch blacklist tokens', () => __awaiter(void 0, void 0, void 0, function* () {
            const tokenPair1 = yield JWTService_1.jwtService.createTokenPair(testPayload);
            const tokenPair2 = yield JWTService_1.jwtService.createTokenPair(Object.assign(Object.assign({}, testPayload), { email: 'test2@example.com' }));
            const tokens = [tokenPair1.accessToken, tokenPair2.accessToken];
            yield Promise.all(tokens.map(token => JWTService_1.jwtService.blacklistToken(token)));
            const [isBlacklisted1, isBlacklisted2] = yield Promise.all([
                JWTService_1.jwtService.isTokenBlacklisted(tokenPair1.accessToken),
                JWTService_1.jwtService.isTokenBlacklisted(tokenPair2.accessToken)
            ]);
            (0, globals_1.expect)(isBlacklisted1).toBe(true);
            (0, globals_1.expect)(isBlacklisted2).toBe(true);
        }));
    });
    (0, globals_1.describe)('Auth Cache Service', () => {
        const testUserId = '507f1f77bcf86cd799439011';
        const testSessionId = 'session_123';
        const testTokenId = 'token_123';
        (0, globals_1.it)('should cache and retrieve token payload', () => __awaiter(void 0, void 0, void 0, function* () {
            const payload = {
                email: 'test@example.com',
                role: 'student',
                _id: testUserId
            };
            yield authCache.cacheToken(testTokenId, payload, 3600);
            const retrieved = yield authCache.getTokenPayload(testTokenId);
            (0, globals_1.expect)(retrieved).toMatchObject(payload);
            (0, globals_1.expect)(retrieved).toHaveProperty('cachedAt');
            (0, globals_1.expect)(retrieved).toHaveProperty('expiresAt');
        }));
        (0, globals_1.it)('should manage sessions', () => __awaiter(void 0, void 0, void 0, function* () {
            const sessionData = {
                userAgent: 'Test Browser',
                ip: '127.0.0.1',
                loginTime: new Date().toISOString()
            };
            // Create session
            yield authCache.createSession(testSessionId, testUserId, sessionData, 3600);
            // Retrieve session
            const retrieved = yield authCache.getSession(testSessionId);
            (0, globals_1.expect)(retrieved).toMatchObject(sessionData);
            (0, globals_1.expect)(retrieved.userId).toBe(testUserId);
            // Update session
            const updateData = { lastActivity: new Date().toISOString() };
            yield authCache.updateSession(testSessionId, updateData);
            const updated = yield authCache.getSession(testSessionId);
            (0, globals_1.expect)(updated).toMatchObject(updateData);
            // Destroy session
            yield authCache.destroySession(testSessionId);
            const destroyed = yield authCache.getSession(testSessionId);
            (0, globals_1.expect)(destroyed).toBeNull();
        }));
        (0, globals_1.it)('should track user activity', () => __awaiter(void 0, void 0, void 0, function* () {
            const activity1 = 'login';
            const activity2 = 'api_access';
            yield authCache.trackUserActivity(testUserId, activity1, { ip: '127.0.0.1' });
            yield authCache.trackUserActivity(testUserId, activity2, { endpoint: '/api/test' });
            const activities = yield authCache.getUserActivity(testUserId, 10);
            (0, globals_1.expect)(activities).toHaveLength(2);
            (0, globals_1.expect)(activities[0].activity).toBe(activity2); // Most recent first
            (0, globals_1.expect)(activities[1].activity).toBe(activity1);
        }));
        (0, globals_1.it)('should cache user permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            const permissions = ['read', 'write', 'delete'];
            yield authCache.cacheUserPermissions(testUserId, permissions, 3600);
            const retrieved = yield authCache.getUserPermissions(testUserId);
            (0, globals_1.expect)(retrieved).toEqual(permissions);
        }));
        (0, globals_1.it)('should log security events', () => __awaiter(void 0, void 0, void 0, function* () {
            const event1 = 'login_attempt';
            const event2 = 'password_change';
            yield authCache.logSecurityEvent(testUserId, event1, {
                success: true,
                ip: '127.0.0.1'
            });
            yield authCache.logSecurityEvent(testUserId, event2, {
                success: true,
                ip: '127.0.0.1'
            });
            const events = yield authCache.getSecurityEvents(testUserId, 10);
            (0, globals_1.expect)(events).toHaveLength(2);
            (0, globals_1.expect)(events[0].event).toBe(event2); // Most recent first
            (0, globals_1.expect)(events[1].event).toBe(event1);
        }));
        (0, globals_1.it)('should handle refresh token families', () => __awaiter(void 0, void 0, void 0, function* () {
            const tokenFamily = 'family_123';
            const tokenId1 = 'token_1';
            const tokenId2 = 'token_2';
            // Store tokens in family
            yield authCache.storeRefreshToken(tokenFamily, tokenId1, testUserId, 3600);
            yield authCache.storeRefreshToken(tokenFamily, tokenId2, testUserId, 3600);
            // Retrieve token info
            const tokenInfo1 = yield authCache.getRefreshTokenInfo(tokenId1);
            (0, globals_1.expect)(tokenInfo1.family).toBe(tokenFamily);
            (0, globals_1.expect)(tokenInfo1.userId).toBe(testUserId);
            // Invalidate family
            yield authCache.invalidateTokenFamily(tokenFamily);
            // Tokens should be gone
            const tokenInfo1After = yield authCache.getRefreshTokenInfo(tokenId1);
            const tokenInfo2After = yield authCache.getRefreshTokenInfo(tokenId2);
            (0, globals_1.expect)(tokenInfo1After).toBeNull();
            (0, globals_1.expect)(tokenInfo2After).toBeNull();
        }));
    });
    (0, globals_1.describe)('Redis Service Manager', () => {
        (0, globals_1.it)('should perform health check', () => __awaiter(void 0, void 0, void 0, function* () {
            const health = yield RedisServiceManager_1.redisServiceManager.healthCheck();
            (0, globals_1.expect)(health).toHaveProperty('overall');
            (0, globals_1.expect)(health).toHaveProperty('clients');
            (0, globals_1.expect)(health).toHaveProperty('monitoring');
            (0, globals_1.expect)(health).toHaveProperty('circuitBreakers');
            (0, globals_1.expect)(['healthy', 'degraded', 'unhealthy']).toContain(health.overall);
        }));
        (0, globals_1.it)('should test connection', () => __awaiter(void 0, void 0, void 0, function* () {
            const connectionTest = yield RedisServiceManager_1.redisServiceManager.testConnection();
            (0, globals_1.expect)(connectionTest).toHaveProperty('success');
            (0, globals_1.expect)(connectionTest).toHaveProperty('latency');
            (0, globals_1.expect)(typeof connectionTest.latency).toBe('number');
        }));
        (0, globals_1.it)('should get performance metrics', () => __awaiter(void 0, void 0, void 0, function* () {
            const metrics = yield RedisServiceManager_1.redisServiceManager.getPerformanceMetrics();
            (0, globals_1.expect)(metrics).toHaveProperty('overall');
            (0, globals_1.expect)(metrics).toHaveProperty('operations');
            (0, globals_1.expect)(metrics).toHaveProperty('connections');
            (0, globals_1.expect)(metrics).toHaveProperty('currentHealth');
            (0, globals_1.expect)(metrics).toHaveProperty('trends');
        }));
        (0, globals_1.it)('should execute with circuit breaker', () => __awaiter(void 0, void 0, void 0, function* () {
            const testOperation = () => __awaiter(void 0, void 0, void 0, function* () {
                return 'success';
            });
            const result = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(testOperation, 'cache');
            (0, globals_1.expect)(result).toBe('success');
        }));
    });
    (0, globals_1.describe)('Cache Service', () => {
        (0, globals_1.it)('should cache and retrieve values', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test:key';
            const value = { message: 'Hello, Redis!' };
            yield RedisServiceManager_1.redisServiceManager.cache.set(key, value, 60);
            const retrieved = yield RedisServiceManager_1.redisServiceManager.cache.get(key);
            (0, globals_1.expect)(retrieved).toEqual(value);
        }));
        (0, globals_1.it)('should handle cache with fallback', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test:fallback';
            const fallbackValue = { source: 'fallback' };
            const result = yield RedisServiceManager_1.redisServiceManager.cache.getWithFallback(key, () => __awaiter(void 0, void 0, void 0, function* () { return fallbackValue; }), 60);
            (0, globals_1.expect)(result).toEqual(fallbackValue);
            // Should now be cached
            const cached = yield RedisServiceManager_1.redisServiceManager.cache.get(key);
            (0, globals_1.expect)(cached).toEqual(fallbackValue);
        }));
        (0, globals_1.it)('should handle batch operations', () => __awaiter(void 0, void 0, void 0, function* () {
            const items = [
                { key: 'batch:1', value: 'value1' },
                { key: 'batch:2', value: 'value2' },
                { key: 'batch:3', value: 'value3' }
            ];
            yield RedisServiceManager_1.redisServiceManager.cache.batchSet(items, 60);
            const keys = items.map(item => item.key);
            const results = yield RedisServiceManager_1.redisServiceManager.cache.batchGet(keys);
            items.forEach((item, index) => {
                (0, globals_1.expect)(results.get(item.key)).toBe(item.value);
            });
        }));
    });
});
