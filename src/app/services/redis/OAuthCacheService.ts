import { Redis } from 'ioredis';
import { BaseRedisService } from './BaseRedisService';
import { IOAuthCacheService, IRedisMonitoringService, RedisKeys } from './interfaces';
import crypto from 'crypto';

export class OAuthCacheService extends BaseRedisService implements IOAuthCacheService {
  constructor(
    client: Redis,
    monitoring?: IRedisMonitoringService
  ) {
    super(client, monitoring);
  }

  // OAuth State Management
  async storeOAuthState(state: string, data: any, ttlSeconds: number): Promise<void> {
    const key = RedisKeys.OAUTH_STATE(state);
    return this.executeWithMonitoring('store_oauth_state', async () => {
      const stateData = {
        ...data,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        nonce: crypto.randomBytes(16).toString('hex'), // Additional security
      };
      await this.client.setex(key, ttlSeconds, JSON.stringify(stateData));
    });
  }

  async getOAuthState(state: string): Promise<any | null> {
    const key = RedisKeys.OAUTH_STATE(state);
    return this.executeWithMonitoring('get_oauth_state', async () => {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    });
  }

  async deleteOAuthState(state: string): Promise<void> {
    const key = RedisKeys.OAUTH_STATE(state);
    return this.executeWithMonitoring('delete_oauth_state', async () => {
      await this.client.del(key);
    });
  }

  // OAuth Token Caching
  async cacheOAuthTokens(userId: string, provider: string, tokens: any, ttlSeconds: number): Promise<void> {
    const key = RedisKeys.OAUTH_TOKENS(userId, provider);
    return this.executeWithMonitoring('cache_oauth_tokens', async () => {
      const tokenData = {
        ...tokens,
        userId,
        provider,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        lastRefreshed: tokens.refresh_token ? new Date().toISOString() : undefined,
      };
      await this.client.setex(key, ttlSeconds, JSON.stringify(tokenData));
      
      // Also add to user's provider set for tracking
      const userProvidersKey = `oauth:providers:${userId}`;
      await this.client.sadd(userProvidersKey, provider);
      await this.client.expire(userProvidersKey, ttlSeconds + 300); // Slightly longer TTL
    });
  }

  async getOAuthTokens(userId: string, provider: string): Promise<any | null> {
    const key = RedisKeys.OAUTH_TOKENS(userId, provider);
    return this.executeWithMonitoring('get_oauth_tokens', async () => {
      const data = await this.client.get(key);
      if (!data) return null;
      
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
    });
  }

  async refreshOAuthTokens(userId: string, provider: string, newTokens: any, ttlSeconds: number): Promise<void> {
    const key = RedisKeys.OAUTH_TOKENS(userId, provider);
    return this.executeWithMonitoring('refresh_oauth_tokens', async () => {
      // Get existing token data to preserve metadata
      const existingData = await this.client.get(key);
      const existing = existingData ? JSON.parse(existingData) : {};
      
      const tokenData = {
        ...existing,
        ...newTokens,
        userId,
        provider,
        lastRefreshed: new Date().toISOString(),
        refreshCount: (existing.refreshCount || 0) + 1,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      };
      
      await this.client.setex(key, ttlSeconds, JSON.stringify(tokenData));
    });
  }

  // User Profile Caching
  async cacheUserProfile(userId: string, provider: string, profile: any, ttlSeconds: number): Promise<void> {
    const key = RedisKeys.OAUTH_PROFILE(userId, provider);
    return this.executeWithMonitoring('cache_user_profile', async () => {
      const profileData = {
        ...profile,
        userId,
        provider,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      };
      await this.client.setex(key, ttlSeconds, JSON.stringify(profileData));
    });
  }

  async getUserProfile(userId: string, provider: string): Promise<any | null> {
    const key = RedisKeys.OAUTH_PROFILE(userId, provider);
    return this.executeWithMonitoring('get_user_profile', async () => {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    });
  }

  // Login Attempt Tracking
  async trackLoginAttempt(identifier: string, success: boolean, metadata?: any): Promise<void> {
    const key = RedisKeys.LOGIN_ATTEMPTS(identifier);
    return this.executeWithMonitoring('track_login_attempt', async () => {
      const attemptData = {
        success,
        timestamp: new Date().toISOString(),
        ip: metadata?.ip || 'unknown',
        userAgent: metadata?.userAgent || 'unknown',
        provider: metadata?.provider || 'local',
        metadata: metadata || {},
      };
      
      // Add to attempts list (keep last 50 attempts)
      await this.client.lpush(key, JSON.stringify(attemptData));
      await this.client.ltrim(key, 0, 49);
      await this.client.expire(key, 86400 * 7); // Keep for 7 days
      
      // Track failed attempts separately for rate limiting
      if (!success) {
        const failedKey = `${key}:failed`;
        await this.client.incr(failedKey);
        await this.client.expire(failedKey, 3600); // Reset hourly
      }
    });
  }

  async getLoginAttempts(identifier: string, windowSeconds: number): Promise<number> {
    const key = RedisKeys.LOGIN_ATTEMPTS(identifier);
    return this.executeWithMonitoring('get_login_attempts', async () => {
      const attempts = await this.client.lrange(key, 0, -1);
      const windowStart = Date.now() - (windowSeconds * 1000);
      
      let count = 0;
      for (const attemptStr of attempts) {
        try {
          const attempt = JSON.parse(attemptStr);
          const attemptTime = new Date(attempt.timestamp).getTime();
          if (attemptTime >= windowStart && !attempt.success) {
            count++;
          }
        } catch (error) {
          // Skip invalid entries
          continue;
        }
      }
      
      return count;
    });
  }

  async isAccountLocked(identifier: string): Promise<boolean> {
    const key = RedisKeys.ACCOUNT_LOCK(identifier);
    return this.executeWithMonitoring('is_account_locked', async () => {
      const lockData = await this.client.get(key);
      if (!lockData) return false;
      
      try {
        const lock = JSON.parse(lockData);
        const lockExpiry = new Date(lock.expiresAt).getTime();
        return Date.now() < lockExpiry;
      } catch {
        // Invalid lock data, remove it
        await this.client.del(key);
        return false;
      }
    });
  }

  async lockAccount(identifier: string, lockDurationSeconds: number, reason: string): Promise<void> {
    const key = RedisKeys.ACCOUNT_LOCK(identifier);
    return this.executeWithMonitoring('lock_account', async () => {
      const lockData = {
        identifier,
        reason,
        lockedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + lockDurationSeconds * 1000).toISOString(),
        lockDuration: lockDurationSeconds,
      };
      
      await this.client.setex(key, lockDurationSeconds, JSON.stringify(lockData));
      
      // Log the lock event
      const lockEventKey = `lock:events:${identifier}`;
      await this.client.lpush(lockEventKey, JSON.stringify(lockData));
      await this.client.ltrim(lockEventKey, 0, 9); // Keep last 10 lock events
      await this.client.expire(lockEventKey, 86400 * 30); // Keep for 30 days
    });
  }

  // Advanced OAuth features

  // Get all OAuth providers for a user
  async getUserOAuthProviders(userId: string): Promise<string[]> {
    const key = `oauth:providers:${userId}`;
    return this.executeWithMonitoring('get_user_oauth_providers', async () => {
      return await this.client.smembers(key);
    });
  }

  // Remove OAuth provider for user
  async removeOAuthProvider(userId: string, provider: string): Promise<void> {
    return this.executeWithMonitoring('remove_oauth_provider', async () => {
      const pipeline = this.client.pipeline();
      
      // Remove tokens
      pipeline.del(RedisKeys.OAUTH_TOKENS(userId, provider));
      
      // Remove profile
      pipeline.del(RedisKeys.OAUTH_PROFILE(userId, provider));
      
      // Remove from providers set
      pipeline.srem(`oauth:providers:${userId}`, provider);
      
      await pipeline.exec();
    });
  }

  // OAuth session management
  async createOAuthSession(sessionId: string, userId: string, provider: string, sessionData: any, ttlSeconds: number): Promise<void> {
    const key = `oauth:session:${sessionId}`;
    return this.executeWithMonitoring('create_oauth_session', async () => {
      const fullSessionData = {
        sessionId,
        userId,
        provider,
        ...sessionData,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      };
      
      await this.client.setex(key, ttlSeconds, JSON.stringify(fullSessionData));
      
      // Add to user's OAuth sessions
      const userSessionsKey = `oauth:sessions:${userId}`;
      await this.client.sadd(userSessionsKey, sessionId);
      await this.client.expire(userSessionsKey, ttlSeconds);
    });
  }

  async getOAuthSession(sessionId: string): Promise<any | null> {
    const key = `oauth:session:${sessionId}`;
    return this.executeWithMonitoring('get_oauth_session', async () => {
      const data = await this.client.get(key);
      if (!data) return null;
      
      const sessionData = JSON.parse(data);
      
      // Update last accessed time
      sessionData.lastAccessedAt = new Date().toISOString();
      await this.client.setex(key, await this.client.ttl(key), JSON.stringify(sessionData));
      
      return sessionData;
    });
  }

  async destroyOAuthSession(sessionId: string): Promise<void> {
    const key = `oauth:session:${sessionId}`;
    return this.executeWithMonitoring('destroy_oauth_session', async () => {
      const sessionData = await this.client.get(key);
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        const userSessionsKey = `oauth:sessions:${session.userId}`;
        
        const pipeline = this.client.pipeline();
        pipeline.del(key);
        pipeline.srem(userSessionsKey, sessionId);
        await pipeline.exec();
      }
    });
  }

  // Rate limiting for OAuth operations
  async checkOAuthRateLimit(identifier: string, operation: string, maxAttempts: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
  }> {
    const key = `oauth:ratelimit:${operation}:${identifier}`;
    return this.executeWithMonitoring('check_oauth_rate_limit', async () => {
      const current = await this.client.incr(key);
      
      if (current === 1) {
        // First request in window, set expiration
        await this.client.expire(key, windowSeconds);
      }
      
      const ttl = await this.client.ttl(key);
      const resetTime = new Date(Date.now() + (ttl * 1000));
      
      return {
        allowed: current <= maxAttempts,
        remaining: Math.max(0, maxAttempts - current),
        resetTime,
      };
    });
  }

  // OAuth analytics and monitoring
  async recordOAuthMetric(provider: string, operation: string, success: boolean, metadata?: any): Promise<void> {
    const key = `oauth:metrics:${provider}:${operation}`;
    return this.executeWithMonitoring('record_oauth_metric', async () => {
      const metricData = {
        provider,
        operation,
        success,
        timestamp: new Date().toISOString(),
        metadata: metadata || {},
      };
      
      // Store in time-series format
      const timeKey = `${key}:${new Date().toISOString().slice(0, 13)}`; // Hour-based buckets
      await this.client.lpush(timeKey, JSON.stringify(metricData));
      await this.client.expire(timeKey, 86400 * 7); // Keep for 7 days
      
      // Update counters
      const counterKey = `${key}:count`;
      const successKey = `${key}:success`;
      
      await this.client.incr(counterKey);
      if (success) {
        await this.client.incr(successKey);
      }
      
      // Set expiration on counters
      await this.client.expire(counterKey, 86400 * 30); // Keep for 30 days
      await this.client.expire(successKey, 86400 * 30);
    });
  }

  async getOAuthMetrics(provider: string, operation: string): Promise<{
    totalAttempts: number;
    successfulAttempts: number;
    successRate: number;
  }> {
    const baseKey = `oauth:metrics:${provider}:${operation}`;
    return this.executeWithMonitoring('get_oauth_metrics', async () => {
      const [total, successful] = await Promise.all([
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
    });
  }

  // Cleanup expired OAuth data
  async cleanupExpiredOAuthData(): Promise<{
    tokensRemoved: number;
    profilesRemoved: number;
    sessionsRemoved: number;
    statesRemoved: number;
  }> {
    return this.executeWithMonitoring('cleanup_expired_oauth_data', async () => {
      // This is a simplified cleanup - in production, you might want to use Redis SCAN
      // to avoid blocking operations on large datasets
      
      let tokensRemoved = 0;
      let profilesRemoved = 0;
      let sessionsRemoved = 0;
      let statesRemoved = 0;
      
      // Note: Redis automatically removes expired keys, but this method can be used
      // for manual cleanup or to get statistics
      
      return { tokensRemoved, profilesRemoved, sessionsRemoved, statesRemoved };
    });
  }
}
