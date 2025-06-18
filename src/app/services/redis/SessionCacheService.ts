import { Redis } from 'ioredis';
import { BaseRedisService } from './BaseRedisService';
import { IRedisMonitoringService, RedisKeys } from './interfaces';
import crypto from 'crypto';

export interface SessionData {
  sessionId: string;
  userId: string;
  userRole: string;
  deviceInfo?: {
    userAgent: string;
    ip: string;
    deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
    browser?: string;
    os?: string;
  };
  loginMethod: 'local' | 'google' | 'apple' | 'facebook';
  permissions?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
}

export interface UserActivityData {
  sessionId: string;
  userId: string;
  activity: string;
  endpoint?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class SessionCacheService extends BaseRedisService {
  constructor(
    client: Redis,
    monitoring?: IRedisMonitoringService
  ) {
    super(client, monitoring);
  }

  // Enhanced session management
  async createSession(sessionData: Omit<SessionData, 'sessionId' | 'createdAt' | 'lastAccessedAt' | 'expiresAt'>, ttlSeconds: number): Promise<string> {
    return this.executeWithMonitoring('create_session', async () => {
      const sessionId = this.generateSessionId();
      const now = new Date().toISOString();
      
      const fullSessionData: SessionData = {
        ...sessionData,
        sessionId,
        createdAt: now,
        lastAccessedAt: now,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      };

      const sessionKey = RedisKeys.USER_SESSION(sessionId);
      const userSessionsKey = RedisKeys.USER_SESSIONS(sessionData.userId);

      const pipeline = this.client.pipeline();
      
      // Store session data
      pipeline.setex(sessionKey, ttlSeconds, JSON.stringify(fullSessionData));
      
      // Add to user's session set
      pipeline.sadd(userSessionsKey, sessionId);
      pipeline.expire(userSessionsKey, ttlSeconds);
      
      // Track session creation
      pipeline.incr(`sessions:created:${new Date().toISOString().slice(0, 10)}`); // Daily counter
      pipeline.expire(`sessions:created:${new Date().toISOString().slice(0, 10)}`, 86400 * 7);
      
      await pipeline.exec();
      
      console.log(`✅ Session created: ${sessionId} for user ${sessionData.userId}`);
      return sessionId;
    });
  }

  async getSession(sessionId: string, updateLastAccessed: boolean = true): Promise<SessionData | null> {
    return this.executeWithMonitoring('get_session', async () => {
      const sessionKey = RedisKeys.USER_SESSION(sessionId);
      const data = await this.client.get(sessionKey);
      
      if (!data) return null;
      
      const sessionData: SessionData = JSON.parse(data);
      
      // Update last accessed time if requested
      if (updateLastAccessed) {
        sessionData.lastAccessedAt = new Date().toISOString();
        const ttl = await this.client.ttl(sessionKey);
        if (ttl > 0) {
          await this.client.setex(sessionKey, ttl, JSON.stringify(sessionData));
        }
      }
      
      return sessionData;
    });
  }

  async updateSession(sessionId: string, updates: Partial<SessionData>, extendTtl?: number): Promise<void> {
    return this.executeWithMonitoring('update_session', async () => {
      const sessionKey = RedisKeys.USER_SESSION(sessionId);
      const existingData = await this.client.get(sessionKey);
      
      if (!existingData) {
        throw new Error('Session not found');
      }
      
      const currentSession: SessionData = JSON.parse(existingData);
      const updatedSession: SessionData = {
        ...currentSession,
        ...updates,
        lastAccessedAt: new Date().toISOString(),
      };
      
      // If extending TTL, update expiration time
      if (extendTtl) {
        updatedSession.expiresAt = new Date(Date.now() + extendTtl * 1000).toISOString();
      }
      
      const ttl = extendTtl || await this.client.ttl(sessionKey);
      await this.client.setex(sessionKey, ttl, JSON.stringify(updatedSession));
    });
  }

  async destroySession(sessionId: string): Promise<void> {
    return this.executeWithMonitoring('destroy_session', async () => {
      const sessionKey = RedisKeys.USER_SESSION(sessionId);
      const sessionData = await this.client.get(sessionKey);
      
      if (sessionData) {
        const session: SessionData = JSON.parse(sessionData);
        const userSessionsKey = RedisKeys.USER_SESSIONS(session.userId);
        
        const pipeline = this.client.pipeline();
        pipeline.del(sessionKey);
        pipeline.srem(userSessionsKey, sessionId);
        
        // Track session destruction
        pipeline.incr(`sessions:destroyed:${new Date().toISOString().slice(0, 10)}`);
        pipeline.expire(`sessions:destroyed:${new Date().toISOString().slice(0, 10)}`, 86400 * 7);
        
        await pipeline.exec();
        
        console.log(`🗑️ Session destroyed: ${sessionId} for user ${session.userId}`);
      }
    });
  }

  async destroyAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    return this.executeWithMonitoring('destroy_all_user_sessions', async () => {
      const userSessionsKey = RedisKeys.USER_SESSIONS(userId);
      const sessionIds = await this.client.smembers(userSessionsKey);
      
      if (sessionIds.length === 0) {
        return 0;
      }
      
      const pipeline = this.client.pipeline();
      let destroyedCount = 0;
      
      for (const sessionId of sessionIds) {
        if (exceptSessionId && sessionId === exceptSessionId) {
          continue; // Skip the current session if specified
        }
        
        pipeline.del(RedisKeys.USER_SESSION(sessionId));
        pipeline.srem(userSessionsKey, sessionId);
        destroyedCount++;
      }
      
      if (destroyedCount > 0) {
        await pipeline.exec();
        console.log(`🗑️ Destroyed ${destroyedCount} sessions for user ${userId}`);
      }
      
      return destroyedCount;
    });
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    return this.executeWithMonitoring('get_user_sessions', async () => {
      const userSessionsKey = RedisKeys.USER_SESSIONS(userId);
      const sessionIds = await this.client.smembers(userSessionsKey);
      
      if (sessionIds.length === 0) {
        return [];
      }
      
      const pipeline = this.client.pipeline();
      sessionIds.forEach(sessionId => {
        pipeline.get(RedisKeys.USER_SESSION(sessionId));
      });
      
      const results = await pipeline.exec();
      const sessions: SessionData[] = [];
      
      results?.forEach((result, index) => {
        if (result[1]) {
          try {
            const sessionData: SessionData = JSON.parse(result[1] as string);
            sessions.push(sessionData);
          } catch (error) {
            console.warn(`Failed to parse session data for ${sessionIds[index]}:`, error);
          }
        }
      });
      
      return sessions.sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime());
    });
  }

  // User activity tracking
  async trackUserActivity(activityData: Omit<UserActivityData, 'timestamp'>): Promise<void> {
    return this.executeWithMonitoring('track_user_activity', async () => {
      const fullActivityData: UserActivityData = {
        ...activityData,
        timestamp: new Date().toISOString(),
      };
      
      const activityKey = RedisKeys.USER_ACTIVITY(activityData.userId);
      
      // Add to activity list (keep last 100 activities)
      await this.client.lpush(activityKey, JSON.stringify(fullActivityData));
      await this.client.ltrim(activityKey, 0, 99);
      await this.client.expire(activityKey, 86400 * 30); // Keep for 30 days
      
      // Track activity metrics
      const activityMetricKey = `activity:${activityData.activity}:${new Date().toISOString().slice(0, 10)}`;
      await this.client.incr(activityMetricKey);
      await this.client.expire(activityMetricKey, 86400 * 7); // Keep for 7 days
    });
  }

  async getUserActivity(userId: string, limit: number = 20): Promise<UserActivityData[]> {
    return this.executeWithMonitoring('get_user_activity', async () => {
      const activityKey = RedisKeys.USER_ACTIVITY(userId);
      const activities = await this.client.lrange(activityKey, 0, limit - 1);
      
      return activities.map(activity => {
        try {
          return JSON.parse(activity) as UserActivityData;
        } catch (error) {
          console.warn('Failed to parse activity data:', error);
          return null;
        }
      }).filter(Boolean) as UserActivityData[];
    });
  }

  // Session analytics
  async getSessionStats(): Promise<{
    activeSessions: number;
    totalSessionsToday: number;
    totalSessionsDestroyed: number;
    averageSessionDuration: number;
    sessionsByLoginMethod: Record<string, number>;
    sessionsByDeviceType: Record<string, number>;
  }> {
    return this.executeWithMonitoring('get_session_stats', async () => {
      const today = new Date().toISOString().slice(0, 10);
      
      const [
        createdToday,
        destroyedToday,
      ] = await Promise.all([
        this.client.get(`sessions:created:${today}`),
        this.client.get(`sessions:destroyed:${today}`),
      ]);
      
      // Get active sessions count (this is an approximation)
      const activeSessions = await this.getActiveSessionsCount();
      
      return {
        activeSessions,
        totalSessionsToday: parseInt(createdToday || '0'),
        totalSessionsDestroyed: parseInt(destroyedToday || '0'),
        averageSessionDuration: 0, // Would need more complex tracking
        sessionsByLoginMethod: {}, // Would need more complex tracking
        sessionsByDeviceType: {}, // Would need more complex tracking
      };
    });
  }

  private async getActiveSessionsCount(): Promise<number> {
    // This is a simplified count - in production you might want to use a more efficient method
    const pattern = 'session:*';
    const keys = await this.client.keys(pattern);
    return keys.length;
  }

  // Session security features
  async detectSuspiciousActivity(userId: string): Promise<{
    suspiciousLogins: boolean;
    multipleLocations: boolean;
    unusualDevices: boolean;
    details: any[];
  }> {
    return this.executeWithMonitoring('detect_suspicious_activity', async () => {
      const sessions = await this.getUserSessions(userId);
      const activities = await this.getUserActivity(userId, 50);
      
      const details: any[] = [];
      let suspiciousLogins = false;
      let multipleLocations = false;
      let unusualDevices = false;
      
      // Check for multiple concurrent sessions from different IPs
      const uniqueIPs = new Set(sessions.map(s => s.deviceInfo?.ip).filter(Boolean));
      if (uniqueIPs.size > 3) {
        multipleLocations = true;
        details.push({
          type: 'multiple_locations',
          count: uniqueIPs.size,
          ips: Array.from(uniqueIPs),
        });
      }
      
      // Check for unusual device types
      const deviceTypes = sessions.map(s => s.deviceInfo?.deviceType).filter(Boolean);
      const uniqueDeviceTypes = new Set(deviceTypes);
      if (uniqueDeviceTypes.size > 2) {
        unusualDevices = true;
        details.push({
          type: 'unusual_devices',
          deviceTypes: Array.from(uniqueDeviceTypes),
        });
      }
      
      // Check for rapid login attempts
      const recentLogins = activities.filter(a => 
        a.activity === 'login' && 
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
    });
  }

  // Session cleanup
  async cleanupExpiredSessions(): Promise<number> {
    return this.executeWithMonitoring('cleanup_expired_sessions', async () => {
      // This would typically be handled by Redis TTL, but we can implement manual cleanup
      // for sessions that might have been orphaned
      
      let cleanedCount = 0;
      
      // In a real implementation, you'd use SCAN to iterate through session keys
      // and check their expiration times
      
      return cleanedCount;
    });
  }

  // Utility methods
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private parseUserAgent(userAgent: string): {
    deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
    browser?: string;
    os?: string;
  } {
    // Simplified user agent parsing
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
    const isTablet = /iPad|Tablet/.test(userAgent);
    
    let deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown' = 'unknown';
    if (isTablet) deviceType = 'tablet';
    else if (isMobile) deviceType = 'mobile';
    else deviceType = 'desktop';
    
    return { deviceType };
  }

  // Session extension for "remember me" functionality
  async extendSession(sessionId: string, additionalSeconds: number): Promise<void> {
    return this.executeWithMonitoring('extend_session', async () => {
      const sessionKey = RedisKeys.USER_SESSION(sessionId);
      const currentTtl = await this.client.ttl(sessionKey);
      
      if (currentTtl > 0) {
        const newTtl = currentTtl + additionalSeconds;
        await this.client.expire(sessionKey, newTtl);
        
        // Update session data with new expiration
        const sessionData = await this.client.get(sessionKey);
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);
          session.expiresAt = new Date(Date.now() + newTtl * 1000).toISOString();
          await this.client.setex(sessionKey, newTtl, JSON.stringify(session));
        }
      }
    });
  }
}
