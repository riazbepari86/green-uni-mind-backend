import { Logger } from '../../config/logger';
import { redisOperations } from '../../config/redis';

export interface AuthAuditEvent {
  eventId: string;
  eventType: 'auth_success' | 'auth_failure' | 'token_refresh' | 'token_expired' | 'rate_limit' | 'suspicious_activity';
  userId?: string;
  email?: string;
  clientId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  details: {
    method: 'sse' | 'api' | 'oauth';
    endpoint?: string;
    errorType?: string;
    errorMessage?: string;
    retryAttempt?: number;
    tokenRefreshed?: boolean;
    rateLimitExceeded?: boolean;
    suspiciousReason?: string;
  };
  metadata?: Record<string, any>;
}

export interface SecurityMetrics {
  totalAuthAttempts: number;
  successfulAuths: number;
  failedAuths: number;
  tokenRefreshes: number;
  rateLimitViolations: number;
  suspiciousActivities: number;
  uniqueIPs: number;
  uniqueUsers: number;
}

export class AuthAuditService {
  private readonly AUDIT_KEY_PREFIX = 'audit:auth:';
  private readonly METRICS_KEY = 'metrics:auth';
  private readonly RETENTION_DAYS = 30;
  private readonly MAX_EVENTS_PER_DAY = 10000;

  /**
   * Log authentication event with comprehensive details
   */
  async logAuthEvent(event: Omit<AuthAuditEvent, 'eventId' | 'timestamp'>): Promise<void> {
    const auditEvent: AuthAuditEvent = {
      ...event,
      eventId: this.generateEventId(),
      timestamp: new Date()
    };

    try {
      // Store event in Redis with TTL
      const eventKey = `${this.AUDIT_KEY_PREFIX}${this.getDateKey()}:${auditEvent.eventId}`;
      const ttl = this.RETENTION_DAYS * 24 * 60 * 60; // seconds

      await redisOperations.setex(eventKey, ttl, JSON.stringify(auditEvent));

      // Update metrics
      await this.updateMetrics(auditEvent);

      // Log to application logger for immediate visibility
      this.logToAppLogger(auditEvent);

      // Check for suspicious patterns
      await this.checkSuspiciousActivity(auditEvent);

    } catch (error) {
      Logger.error('Failed to log auth audit event:', error);
      // Fallback to application logger only
      this.logToAppLogger(auditEvent);
    }
  }

  /**
   * Log successful authentication
   */
  async logAuthSuccess(
    userId: string,
    email: string,
    method: 'sse' | 'api' | 'oauth',
    clientInfo: { ip?: string; userAgent?: string; endpoint?: string }
  ): Promise<void> {
    await this.logAuthEvent({
      eventType: 'auth_success',
      userId,
      email,
      clientId: this.generateClientId(clientInfo.ip, clientInfo.userAgent),
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        method,
        endpoint: clientInfo.endpoint
      }
    });
  }

  /**
   * Log authentication failure
   */
  async logAuthFailure(
    email: string | undefined,
    method: 'sse' | 'api' | 'oauth',
    errorType: string,
    errorMessage: string,
    clientInfo: { ip?: string; userAgent?: string; endpoint?: string },
    retryAttempt?: number
  ): Promise<void> {
    await this.logAuthEvent({
      eventType: 'auth_failure',
      email,
      clientId: this.generateClientId(clientInfo.ip, clientInfo.userAgent),
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        method,
        endpoint: clientInfo.endpoint,
        errorType,
        errorMessage,
        retryAttempt
      }
    });
  }

  /**
   * Log token refresh event
   */
  async logTokenRefresh(
    userId: string,
    email: string,
    method: 'sse' | 'api' | 'oauth',
    clientInfo: { ip?: string; userAgent?: string; endpoint?: string }
  ): Promise<void> {
    await this.logAuthEvent({
      eventType: 'token_refresh',
      userId,
      email,
      clientId: this.generateClientId(clientInfo.ip, clientInfo.userAgent),
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        method,
        endpoint: clientInfo.endpoint,
        tokenRefreshed: true
      }
    });
  }

  /**
   * Log rate limit violation
   */
  async logRateLimit(
    clientInfo: { ip?: string; userAgent?: string; endpoint?: string },
    method: 'sse' | 'api' | 'oauth'
  ): Promise<void> {
    await this.logAuthEvent({
      eventType: 'rate_limit',
      clientId: this.generateClientId(clientInfo.ip, clientInfo.userAgent),
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: {
        method,
        endpoint: clientInfo.endpoint,
        rateLimitExceeded: true
      }
    });
  }

  /**
   * Get authentication metrics for a specific date range
   */
  async getMetrics(days: number = 7): Promise<SecurityMetrics> {
    try {
      const metricsKey = `${this.METRICS_KEY}:${this.getDateKey()}`;
      const metricsData = await redisOperations.get(metricsKey);
      
      if (metricsData) {
        return JSON.parse(metricsData);
      }

      // Return default metrics if none found
      return {
        totalAuthAttempts: 0,
        successfulAuths: 0,
        failedAuths: 0,
        tokenRefreshes: 0,
        rateLimitViolations: 0,
        suspiciousActivities: 0,
        uniqueIPs: 0,
        uniqueUsers: 0
      };
    } catch (error) {
      Logger.error('Failed to get auth metrics:', error);
      throw error;
    }
  }

  /**
   * Get recent authentication events
   */
  async getRecentEvents(limit: number = 100): Promise<AuthAuditEvent[]> {
    try {
      const pattern = `${this.AUDIT_KEY_PREFIX}${this.getDateKey()}:*`;
      const keys = await redisOperations.keys(pattern);
      
      // Get the most recent events
      const recentKeys = keys.slice(-limit);
      const events: AuthAuditEvent[] = [];

      for (const key of recentKeys) {
        const eventData = await redisOperations.get(key);
        if (eventData) {
          events.push(JSON.parse(eventData));
        }
      }

      return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      Logger.error('Failed to get recent auth events:', error);
      return [];
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate client ID from IP and user agent
   */
  private generateClientId(ip?: string, userAgent?: string): string {
    const ipPart = ip?.replace(/\./g, '_') || 'unknown';
    const uaPart = userAgent?.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';
    return `${ipPart}_${uaPart}`;
  }

  /**
   * Get date key for organizing events
   */
  private getDateKey(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Update authentication metrics
   */
  private async updateMetrics(event: AuthAuditEvent): Promise<void> {
    try {
      const metricsKey = `${this.METRICS_KEY}:${this.getDateKey()}`;
      const currentMetrics = await this.getMetrics();

      const updatedMetrics: SecurityMetrics = {
        ...currentMetrics,
        totalAuthAttempts: currentMetrics.totalAuthAttempts + 1
      };

      switch (event.eventType) {
        case 'auth_success':
          updatedMetrics.successfulAuths++;
          break;
        case 'auth_failure':
          updatedMetrics.failedAuths++;
          break;
        case 'token_refresh':
          updatedMetrics.tokenRefreshes++;
          break;
        case 'rate_limit':
          updatedMetrics.rateLimitViolations++;
          break;
        case 'suspicious_activity':
          updatedMetrics.suspiciousActivities++;
          break;
      }

      const ttl = this.RETENTION_DAYS * 24 * 60 * 60;
      await redisOperations.setex(metricsKey, ttl, JSON.stringify(updatedMetrics));
    } catch (error) {
      Logger.error('Failed to update auth metrics:', error);
    }
  }

  /**
   * Log to application logger for immediate visibility
   */
  private logToAppLogger(event: AuthAuditEvent): void {
    const logData = {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      email: event.email,
      ip: event.ipAddress,
      method: event.details.method,
      endpoint: event.details.endpoint
    };

    switch (event.eventType) {
      case 'auth_success':
        Logger.info('🔐 Authentication successful', logData);
        break;
      case 'auth_failure':
        Logger.warn('🚫 Authentication failed', { ...logData, error: event.details.errorMessage });
        break;
      case 'token_refresh':
        Logger.info('🔄 Token refreshed', logData);
        break;
      case 'rate_limit':
        Logger.warn('⚠️ Rate limit exceeded', logData);
        break;
      case 'suspicious_activity':
        Logger.error('🚨 Suspicious activity detected', { ...logData, reason: event.details.suspiciousReason });
        break;
      default:
        Logger.info('🔍 Auth event', logData);
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  private async checkSuspiciousActivity(event: AuthAuditEvent): Promise<void> {
    // This is a placeholder for more sophisticated suspicious activity detection
    // In a real implementation, you might check for:
    // - Multiple failed attempts from same IP
    // - Unusual geographic patterns
    // - Rapid succession of requests
    // - Known malicious user agents
    
    if (event.eventType === 'auth_failure' && event.details.retryAttempt && event.details.retryAttempt > 5) {
      await this.logAuthEvent({
        eventType: 'suspicious_activity',
        clientId: event.clientId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        details: {
          method: event.details.method,
          suspiciousReason: 'Multiple consecutive authentication failures',
          retryAttempt: event.details.retryAttempt
        }
      });
    }
  }
}

// Export singleton instance
export const authAuditService = new AuthAuditService();
