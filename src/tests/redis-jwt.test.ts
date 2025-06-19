import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { jwtService } from '../app/services/auth/JWTService';
import { redisServiceManager } from '../app/services/redis/RedisServiceManager';
import { AuthCacheService } from '../app/services/redis/AuthCacheService';

describe('Redis JWT Integration Tests', () => {
  let authCache: AuthCacheService;
  
  beforeAll(async () => {
    // Initialize auth cache service
    authCache = new AuthCacheService(
      redisServiceManager.authClient,
      redisServiceManager.monitoring
    );
    
    // Wait for Redis connection
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup and disconnect
    await redisServiceManager.shutdown();
  });

  beforeEach(async () => {
    // Clear test data before each test
    try {
      await redisServiceManager.authClient.flushdb();
    } catch (error) {
      console.warn('Failed to flush Redis DB:', error);
    }
  });

  describe('JWT Service', () => {
    const testPayload = {
      email: 'test@example.com',
      role: 'student',
      _id: '507f1f77bcf86cd799439011'
    };

    it('should create token pair with family tracking', async () => {
      const tokenPair = await jwtService.createTokenPair(testPayload);
      
      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(tokenPair).toHaveProperty('tokenFamily');
      expect(tokenPair).toHaveProperty('expiresIn');
      expect(tokenPair).toHaveProperty('refreshExpiresIn');
      
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');
      expect(typeof tokenPair.tokenFamily).toBe('string');
      expect(typeof tokenPair.expiresIn).toBe('number');
      expect(typeof tokenPair.refreshExpiresIn).toBe('number');
    });

    it('should verify token and cache payload', async () => {
      const tokenPair = await jwtService.createTokenPair(testPayload);
      
      // Verify access token
      const decoded = await jwtService.verifyToken(
        tokenPair.accessToken,
        process.env.JWT_ACCESS_SECRET!
      );
      
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
      expect(decoded._id).toBe(testPayload._id);
      expect(decoded).toHaveProperty('tokenId');
      expect(decoded).toHaveProperty('family');
    });

    it('should refresh tokens with family rotation', async () => {
      const originalTokenPair = await jwtService.createTokenPair(testPayload);
      
      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const newTokenPair = await jwtService.refreshTokens(originalTokenPair.refreshToken);
      
      expect(newTokenPair.tokenFamily).toBe(originalTokenPair.tokenFamily);
      expect(newTokenPair.accessToken).not.toBe(originalTokenPair.accessToken);
      expect(newTokenPair.refreshToken).not.toBe(originalTokenPair.refreshToken);
    });

    it('should blacklist tokens', async () => {
      const tokenPair = await jwtService.createTokenPair(testPayload);
      
      // Blacklist access token
      await jwtService.blacklistToken(tokenPair.accessToken);
      
      // Check if token is blacklisted
      const isBlacklisted = await jwtService.isTokenBlacklisted(tokenPair.accessToken);
      expect(isBlacklisted).toBe(true);
    });

    it('should invalidate token family', async () => {
      const tokenPair = await jwtService.createTokenPair(testPayload);
      
      // Invalidate token family
      await jwtService.invalidateTokenFamily(tokenPair.tokenFamily);
      
      // Try to refresh token - should fail
      await expect(
        jwtService.refreshTokens(tokenPair.refreshToken)
      ).rejects.toThrow();
    });

    it('should batch blacklist tokens', async () => {
      const tokenPair1 = await jwtService.createTokenPair(testPayload);
      const tokenPair2 = await jwtService.createTokenPair({
        ...testPayload,
        email: 'test2@example.com'
      });
      
      const tokens = [tokenPair1.accessToken, tokenPair2.accessToken];
      await Promise.all(tokens.map(token => jwtService.blacklistToken(token)));
      
      const [isBlacklisted1, isBlacklisted2] = await Promise.all([
        jwtService.isTokenBlacklisted(tokenPair1.accessToken),
        jwtService.isTokenBlacklisted(tokenPair2.accessToken)
      ]);
      
      expect(isBlacklisted1).toBe(true);
      expect(isBlacklisted2).toBe(true);
    });
  });

  describe('Auth Cache Service', () => {
    const testUserId = '507f1f77bcf86cd799439011';
    const testSessionId = 'session_123';
    const testTokenId = 'token_123';

    it('should cache and retrieve token payload', async () => {
      const payload = {
        email: 'test@example.com',
        role: 'student',
        _id: testUserId
      };
      
      await authCache.cacheToken(testTokenId, payload, 3600);
      const retrieved = await authCache.getTokenPayload(testTokenId);
      
      expect(retrieved).toMatchObject(payload);
      expect(retrieved).toHaveProperty('cachedAt');
      expect(retrieved).toHaveProperty('expiresAt');
    });

    it('should manage sessions', async () => {
      const sessionData = {
        userAgent: 'Test Browser',
        ip: '127.0.0.1',
        loginTime: new Date().toISOString()
      };
      
      // Create session
      await authCache.createSession(testSessionId, testUserId, sessionData, 3600);
      
      // Retrieve session
      const retrieved = await authCache.getSession(testSessionId);
      expect(retrieved).toMatchObject(sessionData);
      expect(retrieved.userId).toBe(testUserId);
      
      // Update session
      const updateData = { lastActivity: new Date().toISOString() };
      await authCache.updateSession(testSessionId, updateData);
      
      const updated = await authCache.getSession(testSessionId);
      expect(updated).toMatchObject(updateData);
      
      // Destroy session
      await authCache.destroySession(testSessionId);
      const destroyed = await authCache.getSession(testSessionId);
      expect(destroyed).toBeNull();
    });

    it('should track user activity', async () => {
      const activity1 = 'login';
      const activity2 = 'api_access';
      
      await authCache.trackUserActivity(testUserId, activity1, { ip: '127.0.0.1' });
      await authCache.trackUserActivity(testUserId, activity2, { endpoint: '/api/test' });
      
      const activities = await authCache.getUserActivity(testUserId, 10);
      
      expect(activities).toHaveLength(2);
      expect(activities[0].activity).toBe(activity2); // Most recent first
      expect(activities[1].activity).toBe(activity1);
    });

    it('should cache user permissions', async () => {
      const permissions = ['read', 'write', 'delete'];
      
      await authCache.cacheUserPermissions(testUserId, permissions, 3600);
      const retrieved = await authCache.getUserPermissions(testUserId);
      
      expect(retrieved).toEqual(permissions);
    });

    it('should log security events', async () => {
      const event1 = 'login_attempt';
      const event2 = 'password_change';
      
      await authCache.logSecurityEvent(testUserId, event1, { 
        success: true, 
        ip: '127.0.0.1' 
      });
      await authCache.logSecurityEvent(testUserId, event2, { 
        success: true, 
        ip: '127.0.0.1' 
      });
      
      const events = await authCache.getSecurityEvents(testUserId, 10);
      
      expect(events).toHaveLength(2);
      expect(events[0].event).toBe(event2); // Most recent first
      expect(events[1].event).toBe(event1);
    });

    it('should handle refresh token families', async () => {
      const tokenFamily = 'family_123';
      const tokenId1 = 'token_1';
      const tokenId2 = 'token_2';
      
      // Store tokens in family
      await authCache.storeRefreshToken(tokenFamily, tokenId1, testUserId, 3600);
      await authCache.storeRefreshToken(tokenFamily, tokenId2, testUserId, 3600);
      
      // Retrieve token info
      const tokenInfo1 = await authCache.getRefreshTokenInfo(tokenId1);
      expect(tokenInfo1.family).toBe(tokenFamily);
      expect(tokenInfo1.userId).toBe(testUserId);
      
      // Invalidate family
      await authCache.invalidateTokenFamily(tokenFamily);
      
      // Tokens should be gone
      const tokenInfo1After = await authCache.getRefreshTokenInfo(tokenId1);
      const tokenInfo2After = await authCache.getRefreshTokenInfo(tokenId2);
      
      expect(tokenInfo1After).toBeNull();
      expect(tokenInfo2After).toBeNull();
    });
  });

  describe('Redis Service Manager', () => {
    it('should perform health check', async () => {
      const health = await redisServiceManager.healthCheck();
      
      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('clients');
      expect(health).toHaveProperty('monitoring');
      expect(health).toHaveProperty('circuitBreakers');
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.overall);
    });

    it('should test connection', async () => {
      const connectionTest = await redisServiceManager.testConnection();
      
      expect(connectionTest).toHaveProperty('success');
      expect(connectionTest).toHaveProperty('latency');
      expect(typeof connectionTest.latency).toBe('number');
    });

    it('should get performance metrics', async () => {
      const metrics = await redisServiceManager.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('overall');
      expect(metrics).toHaveProperty('operations');
      expect(metrics).toHaveProperty('connections');
      expect(metrics).toHaveProperty('currentHealth');
      expect(metrics).toHaveProperty('trends');
    });

    it('should execute with circuit breaker', async () => {
      const testOperation = async () => {
        return 'success';
      };
      
      const result = await redisServiceManager.executeWithCircuitBreaker(
        testOperation,
        'cache'
      );
      
      expect(result).toBe('success');
    });
  });

  describe('Cache Service', () => {
    it('should cache and retrieve values', async () => {
      const key = 'test:key';
      const value = { message: 'Hello, Redis!' };
      
      await redisServiceManager.cache.set(key, value, 60);
      const retrieved = await redisServiceManager.cache.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should handle cache with fallback', async () => {
      const key = 'test:fallback';
      const fallbackValue = { source: 'fallback' };
      
      const result = await redisServiceManager.cache.getWithFallback(
        key,
        async () => fallbackValue,
        60
      );
      
      expect(result).toEqual(fallbackValue);
      
      // Should now be cached
      const cached = await redisServiceManager.cache.get(key);
      expect(cached).toEqual(fallbackValue);
    });

    it('should handle batch operations', async () => {
      const items = [
        { key: 'batch:1', value: 'value1' },
        { key: 'batch:2', value: 'value2' },
        { key: 'batch:3', value: 'value3' }
      ];
      
      await redisServiceManager.cache.batchSet(items, 60);
      
      const keys = items.map(item => item.key);
      const results = await redisServiceManager.cache.batchGet(keys);
      
      items.forEach((item, index) => {
        expect(results.get(item.key)).toBe(item.value);
      });
    });
  });
});
