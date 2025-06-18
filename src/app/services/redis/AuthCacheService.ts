import { Redis } from 'ioredis';
import { BaseRedisService } from './BaseRedisService';
import { IAuthCacheService, IRedisMonitoringService, RedisKeys } from './interfaces';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class AuthCacheService extends BaseRedisService implements IAuthCacheService {
  constructor(
    client: Redis,
    monitoring?: IRedisMonitoringService
  ) {
    super(client, monitoring);
  }

  // JWT Token Management
  async cacheToken(tokenId: string, payload: any, ttlSeconds: number): Promise<void> {
    const key = RedisKeys.JWT_TOKEN(tokenId);
    return this.executeWithMonitoring('cache_token', async () => {
      const tokenData = {
        ...payload,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
      };
      await this.client.setex(key, ttlSeconds, JSON.stringify(tokenData));
    });
  }

  async getTokenPayload(tokenId: string): Promise<any | null> {
    const key = RedisKeys.JWT_TOKEN(tokenId);
    return this.executeWithMonitoring('get_token_payload', async () => {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    });
  }

  async blacklistToken(tokenId: string, ttlSeconds: number): Promise<void> {
    const key = RedisKeys.JWT_BLACKLIST(tokenId);
    return this.executeWithMonitoring('blacklist_token', async () => {
      const blacklistData = {
        blacklistedAt: new Date().toISOString(),
        reason: 'user_logout',
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
      };
      await this.client.setex(key, ttlSeconds, JSON.stringify(blacklistData));
      
      // Also remove from active token cache
      const tokenKey = RedisKeys.JWT_TOKEN(tokenId);
      await this.client.del(tokenKey);
    });
  }

  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    const key = RedisKeys.JWT_BLACKLIST(tokenId);
    return this.executeWithMonitoring('is_token_blacklisted', async () => {
      const exists = await this.client.exists(key);
      return exists === 1;
    });
  }

  // Refresh Token Management with Family Tracking
  async storeRefreshToken(
    tokenFamily: string,
    tokenId: string,
    userId: string,
    ttlSeconds: number
  ): Promise<void> {
    return this.executeWithMonitoring('store_refresh_token', async () => {
      const pipeline = this.client.pipeline();
      
      // Store individual refresh token
      const tokenKey = RedisKeys.REFRESH_TOKEN(tokenId);
      const tokenData = {
        tokenId,
        userId,
        family: tokenFamily,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
      };
      pipeline.setex(tokenKey, ttlSeconds, JSON.stringify(tokenData));
      
      // Add to token family set
      const familyKey = RedisKeys.TOKEN_FAMILY(tokenFamily);
      pipeline.sadd(familyKey, tokenId);
      pipeline.expire(familyKey, ttlSeconds);
      
      await pipeline.exec();
    });
  }

  async getRefreshTokenInfo(tokenId: string): Promise<any | null> {
    const key = RedisKeys.REFRESH_TOKEN(tokenId);
    return this.executeWithMonitoring('get_refresh_token_info', async () => {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    });
  }

  async invalidateTokenFamily(tokenFamily: string): Promise<void> {
    return this.executeWithMonitoring('invalidate_token_family', async () => {
      const familyKey = RedisKeys.TOKEN_FAMILY(tokenFamily);
      const tokenIds = await this.client.smembers(familyKey);
      
      if (tokenIds.length > 0) {
        const pipeline = this.client.pipeline();
        
        // Delete all tokens in the family
        tokenIds.forEach(tokenId => {
          pipeline.del(RedisKeys.REFRESH_TOKEN(tokenId));
        });
        
        // Delete the family set
        pipeline.del(familyKey);
        
        await pipeline.exec();
      }
    });
  }

  // Session Management
  async createSession(
    sessionId: string,
    userId: string,
    sessionData: any,
    ttlSeconds: number
  ): Promise<void> {
    return this.executeWithMonitoring('create_session', async () => {
      const pipeline = this.client.pipeline();
      
      // Store session data
      const sessionKey = RedisKeys.USER_SESSION(sessionId);
      const fullSessionData = {
        sessionId,
        userId,
        ...sessionData,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
      };
      pipeline.setex(sessionKey, ttlSeconds, JSON.stringify(fullSessionData));
      
      // Add to user's session set
      const userSessionsKey = RedisKeys.USER_SESSIONS(userId);
      pipeline.sadd(userSessionsKey, sessionId);
      pipeline.expire(userSessionsKey, ttlSeconds);
      
      await pipeline.exec();
    });
  }

  async getSession(sessionId: string): Promise<any | null> {
    const key = RedisKeys.USER_SESSION(sessionId);
    return this.executeWithMonitoring('get_session', async () => {
      const data = await this.client.get(key);
      if (!data) return null;
      
      const sessionData = JSON.parse(data);
      
      // Update last accessed time
      sessionData.lastAccessedAt = new Date().toISOString();
      await this.client.setex(key, await this.client.ttl(key), JSON.stringify(sessionData));
      
      return sessionData;
    });
  }

  async updateSession(sessionId: string, sessionData: any, ttlSeconds?: number): Promise<void> {
    const key = RedisKeys.USER_SESSION(sessionId);
    return this.executeWithMonitoring('update_session', async () => {
      const existingData = await this.client.get(key);
      if (!existingData) {
        throw new Error('Session not found');
      }
      
      const currentSession = JSON.parse(existingData);
      const updatedSession = {
        ...currentSession,
        ...sessionData,
        lastAccessedAt: new Date().toISOString()
      };
      
      const ttl = ttlSeconds || await this.client.ttl(key);
      await this.client.setex(key, ttl, JSON.stringify(updatedSession));
    });
  }

  async destroySession(sessionId: string): Promise<void> {
    return this.executeWithMonitoring('destroy_session', async () => {
      const sessionKey = RedisKeys.USER_SESSION(sessionId);
      const sessionData = await this.client.get(sessionKey);
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        const userSessionsKey = RedisKeys.USER_SESSIONS(session.userId);
        
        const pipeline = this.client.pipeline();
        pipeline.del(sessionKey);
        pipeline.srem(userSessionsKey, sessionId);
        await pipeline.exec();
      }
    });
  }

  async destroyAllUserSessions(userId: string): Promise<void> {
    return this.executeWithMonitoring('destroy_all_user_sessions', async () => {
      const userSessionsKey = RedisKeys.USER_SESSIONS(userId);
      const sessionIds = await this.client.smembers(userSessionsKey);
      
      if (sessionIds.length > 0) {
        const pipeline = this.client.pipeline();
        
        sessionIds.forEach(sessionId => {
          pipeline.del(RedisKeys.USER_SESSION(sessionId));
        });
        pipeline.del(userSessionsKey);
        
        await pipeline.exec();
      }
    });
  }

  // User Activity Tracking
  async trackUserActivity(userId: string, activity: string, metadata?: any): Promise<void> {
    const key = RedisKeys.USER_ACTIVITY(userId);
    return this.executeWithMonitoring('track_user_activity', async () => {
      const activityData = {
        activity,
        timestamp: new Date().toISOString(),
        metadata: metadata || {}
      };
      
      // Add to activity list (keep last 100 activities)
      await this.client.lpush(key, JSON.stringify(activityData));
      await this.client.ltrim(key, 0, 99); // Keep only last 100 activities
      await this.client.expire(key, 86400 * 30); // Expire after 30 days
    });
  }

  async getUserActivity(userId: string, limit: number = 10): Promise<any[]> {
    const key = RedisKeys.USER_ACTIVITY(userId);
    return this.executeWithMonitoring('get_user_activity', async () => {
      const activities = await this.client.lrange(key, 0, limit - 1);
      return activities.map(activity => JSON.parse(activity));
    });
  }

  // Advanced Authentication Features

  // Generate secure token family ID
  generateTokenFamily(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Generate secure token ID
  generateTokenId(): string {
    return uuidv4();
  }

  // Cache user permissions for faster authorization
  async cacheUserPermissions(userId: string, permissions: string[], ttlSeconds: number = 3600): Promise<void> {
    const key = RedisKeys.USER_PERMISSIONS(userId);
    return this.executeWithMonitoring('cache_user_permissions', async () => {
      const permissionData = {
        permissions,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
      };
      await this.client.setex(key, ttlSeconds, JSON.stringify(permissionData));
    });
  }

  async getUserPermissions(userId: string): Promise<string[] | null> {
    const key = RedisKeys.USER_PERMISSIONS(userId);
    return this.executeWithMonitoring('get_user_permissions', async () => {
      const data = await this.client.get(key);
      if (!data) return null;
      
      const permissionData = JSON.parse(data);
      return permissionData.permissions;
    });
  }

  // Batch operations for better performance
  async batchBlacklistTokens(tokenIds: string[], ttlSeconds: number): Promise<void> {
    return this.executeWithMonitoring('batch_blacklist_tokens', async () => {
      const pipeline = this.client.pipeline();
      const blacklistData = {
        blacklistedAt: new Date().toISOString(),
        reason: 'batch_logout',
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
      };
      
      tokenIds.forEach(tokenId => {
        const blacklistKey = RedisKeys.JWT_BLACKLIST(tokenId);
        const tokenKey = RedisKeys.JWT_TOKEN(tokenId);
        
        pipeline.setex(blacklistKey, ttlSeconds, JSON.stringify(blacklistData));
        pipeline.del(tokenKey);
      });
      
      await pipeline.exec();
    });
  }

  async batchCheckBlacklist(tokenIds: string[]): Promise<Record<string, boolean>> {
    return this.executeWithMonitoring('batch_check_blacklist', async () => {
      const pipeline = this.client.pipeline();
      
      tokenIds.forEach(tokenId => {
        const key = RedisKeys.JWT_BLACKLIST(tokenId);
        pipeline.exists(key);
      });
      
      const results = await pipeline.exec();
      const blacklistStatus: Record<string, boolean> = {};
      
      tokenIds.forEach((tokenId, index) => {
        blacklistStatus[tokenId] = results?.[index]?.[1] === 1;
      });
      
      return blacklistStatus;
    });
  }

  // Security features
  async logSecurityEvent(userId: string, event: string, details: any): Promise<void> {
    const key = `security:events:${userId}`;
    return this.executeWithMonitoring('log_security_event', async () => {
      const eventData = {
        event,
        details,
        timestamp: new Date().toISOString(),
        ip: details.ip || 'unknown',
        userAgent: details.userAgent || 'unknown'
      };
      
      await this.client.lpush(key, JSON.stringify(eventData));
      await this.client.ltrim(key, 0, 49); // Keep last 50 security events
      await this.client.expire(key, 86400 * 90); // Expire after 90 days
    });
  }

  async getSecurityEvents(userId: string, limit: number = 10): Promise<any[]> {
    const key = `security:events:${userId}`;
    return this.executeWithMonitoring('get_security_events', async () => {
      const events = await this.client.lrange(key, 0, limit - 1);
      return events.map(event => JSON.parse(event));
    });
  }

  // Cleanup expired tokens and sessions
  async cleanupExpiredData(): Promise<{
    tokensRemoved: number;
    sessionsRemoved: number;
    blacklistRemoved: number;
  }> {
    return this.executeWithMonitoring('cleanup_expired_data', async () => {
      // This is a simplified cleanup - in production, you might want to use Redis SCAN
      // to avoid blocking operations on large datasets
      
      let tokensRemoved = 0;
      let sessionsRemoved = 0;
      let blacklistRemoved = 0;
      
      // Note: Redis automatically removes expired keys, but this method can be used
      // for manual cleanup or to get statistics
      
      return { tokensRemoved, sessionsRemoved, blacklistRemoved };
    });
  }
}
