import { Logger } from '../../config/logger';
import { redisOperations } from '../../config/redis';
import mongoose from 'mongoose';
import { AuditLog } from '../../modules/AuditLog/auditLog.model';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  service: 'sse' | 'polling' | 'analytics' | 'messaging' | 'course' | 'payment' | 'auth';
  action: string;
  userId?: string;
  userType?: 'student' | 'teacher' | 'admin';
  resourceId?: string;
  resourceType?: string;
  details: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: 'backend' | 'frontend';
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  duration?: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogQuery {
  service?: string;
  action?: string;
  userId?: string;
  severity?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogStats {
  totalLogs: number;
  logsByService: Record<string, number>;
  logsBySeverity: Record<string, number>;
  errorRate: number;
  averageDuration: number;
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

// MongoDB Schema for audit logs
const auditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  timestamp: { type: Date, required: true, index: true },
  service: { type: String, required: true, index: true },
  action: { type: String, required: true, index: true },
  userId: { type: String, index: true },
  userType: { type: String, enum: ['student', 'teacher', 'admin'] },
  resourceId: { type: String, index: true },
  resourceType: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  severity: { type: String, enum: ['info', 'warning', 'error', 'critical'], required: true, index: true },
  source: { type: String, enum: ['backend', 'frontend'], required: true },
  sessionId: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  correlationId: { type: String, index: true },
  duration: { type: Number },
  success: { type: Boolean, required: true, index: true },
  errorMessage: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: false, // We handle timestamps manually
  collection: 'audit_logs'
});

// Create indexes for better query performance
auditLogSchema.index({ timestamp: -1, service: 1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ success: 1, timestamp: -1 });

// Use a different model name to avoid conflicts with the main AuditLog model
const ServiceAuditLog = (() => {
  try {
    return mongoose.model('ServiceAuditLog');
  } catch (error) {
    return mongoose.model('ServiceAuditLog', auditLogSchema);
  }
})();

class AuditLogService {
  private logQueue: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private stats: AuditLogStats = {
    totalLogs: 0,
    logsByService: {},
    logsBySeverity: {},
    errorRate: 0,
    averageDuration: 0,
    topActions: [],
    topUsers: []
  };

  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds
  private readonly MAX_QUEUE_SIZE = 1000;

  constructor() {
    this.startBatchProcessing();
    Logger.info('📋 Audit Log Service initialized');
  }

  /**
   * Log an audit entry
   */
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date()
    };

    // Add to queue for batch processing
    this.logQueue.push(auditEntry);

    // Update stats
    this.updateStats(auditEntry);

    // Flush immediately for critical entries
    if (entry.severity === 'critical') {
      await this.flushQueue();
    }

    // Prevent queue overflow
    if (this.logQueue.length >= this.MAX_QUEUE_SIZE) {
      await this.flushQueue();
    }
  }

  /**
   * Log SSE connection events
   */
  async logSSEConnection(userId: string, userType: string, action: 'connect' | 'disconnect' | 'error', details: any): Promise<void> {
    await this.log({
      service: 'sse',
      action: `sse_${action}`,
      userId,
      userType: userType as 'student' | 'teacher' | 'admin',
      details,
      severity: action === 'error' ? 'error' : 'info',
      source: 'backend',
      success: action !== 'error'
    });
  }

  /**
   * Log polling events
   */
  async logPollingEvent(userId: string, userType: string, action: 'subscribe' | 'poll' | 'unsubscribe' | 'error', details: any): Promise<void> {
    await this.log({
      service: 'polling',
      action: `polling_${action}`,
      userId,
      userType: userType as 'student' | 'teacher' | 'admin',
      details,
      severity: action === 'error' ? 'error' : 'info',
      source: 'backend',
      success: action !== 'error'
    });
  }

  /**
   * Log analytics events
   */
  async logAnalyticsEvent(teacherId: string, action: string, details: any, success: boolean = true): Promise<void> {
    await this.log({
      service: 'analytics',
      action: `analytics_${action}`,
      userId: teacherId,
      userType: 'teacher',
      details,
      severity: success ? 'info' : 'error',
      source: 'backend',
      success
    });
  }

  /**
   * Log messaging events
   */
  async logMessagingEvent(userId: string, userType: string, action: string, details: any, success: boolean = true): Promise<void> {
    await this.log({
      service: 'messaging',
      action: `messaging_${action}`,
      userId,
      userType: userType as 'student' | 'teacher' | 'admin',
      details,
      severity: success ? 'info' : 'error',
      source: 'backend',
      success
    });
  }

  /**
   * Log course events
   */
  async logCourseEvent(userId: string, userType: string, action: string, courseId: string, details: any, success: boolean = true): Promise<void> {
    await this.log({
      service: 'course',
      action: `course_${action}`,
      userId,
      userType: userType as 'student' | 'teacher' | 'admin',
      resourceId: courseId,
      resourceType: 'course',
      details,
      severity: success ? 'info' : 'error',
      source: 'backend',
      success
    });
  }

  /**
   * Log performance metrics
   */
  async logPerformance(service: string, action: string, duration: number, success: boolean, details: any = {}): Promise<void> {
    await this.log({
      service: service as any,
      action: `performance_${action}`,
      details: {
        ...details,
        duration,
        performanceMetric: true
      },
      severity: success ? 'info' : 'warning',
      source: 'backend',
      duration,
      success
    });
  }

  /**
   * Log security events
   */
  async logSecurityEvent(action: string, userId: string | undefined, details: any, severity: 'warning' | 'error' | 'critical' = 'warning'): Promise<void> {
    await this.log({
      service: 'auth',
      action: `security_${action}`,
      userId,
      details,
      severity,
      source: 'backend',
      success: false // Security events are typically failures
    });
  }

  /**
   * Query audit logs
   */
  async queryLogs(query: AuditLogQuery): Promise<AuditLogEntry[]> {
    try {
      const filter: any = {};

      if (query.service) filter.service = query.service;
      if (query.action) filter.action = query.action;
      if (query.userId) filter.userId = query.userId;
      if (query.severity) filter.severity = query.severity;
      if (query.success !== undefined) filter.success = query.success;
      
      if (query.startDate || query.endDate) {
        filter.timestamp = {};
        if (query.startDate) filter.timestamp.$gte = query.startDate;
        if (query.endDate) filter.timestamp.$lte = query.endDate;
      }

      const logs = await AuditLog
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(query.limit || 100)
        .skip(query.offset || 0)
        .lean();

      return logs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
    } catch (error) {
      Logger.error('Failed to query audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit log statistics
   */
  async getStats(days: number = 7): Promise<AuditLogStats> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const pipeline = [
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalLogs: { $sum: 1 },
            errorCount: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } },
            avgDuration: { $avg: '$duration' },
            serviceStats: {
              $push: {
                service: '$service',
                severity: '$severity',
                action: '$action',
                userId: '$userId'
              }
            }
          }
        }
      ];

      const result = await ServiceAuditLog.aggregate(pipeline);
      
      if (result.length === 0) {
        return this.stats;
      }

      const data = result[0];
      const serviceStats = data.serviceStats || [];

      // Calculate service distribution
      const logsByService: Record<string, number> = {};
      const logsBySeverity: Record<string, number> = {};
      const actionCounts: Record<string, number> = {};
      const userCounts: Record<string, number> = {};

      for (const stat of serviceStats) {
        logsByService[stat.service] = (logsByService[stat.service] || 0) + 1;
        logsBySeverity[stat.severity] = (logsBySeverity[stat.severity] || 0) + 1;
        actionCounts[stat.action] = (actionCounts[stat.action] || 0) + 1;
        if (stat.userId) {
          userCounts[stat.userId] = (userCounts[stat.userId] || 0) + 1;
        }
      }

      // Get top actions and users
      const topActions = Object.entries(actionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      const topUsers = Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count }));

      return {
        totalLogs: data.totalLogs,
        logsByService,
        logsBySeverity,
        errorRate: data.totalLogs > 0 ? (data.errorCount / data.totalLogs) * 100 : 0,
        averageDuration: data.avgDuration || 0,
        topActions,
        topUsers
      };
    } catch (error) {
      Logger.error('Failed to get audit log stats:', error);
      return this.stats;
    }
  }

  /**
   * Export audit logs
   */
  async exportLogs(query: AuditLogQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    const logs = await this.queryLogs({ ...query, limit: 10000 });
    
    if (format === 'csv') {
      return this.convertToCSV(logs);
    } else {
      return JSON.stringify(logs, null, 2);
    }
  }

  /**
   * Private helper methods
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private updateStats(entry: AuditLogEntry): void {
    this.stats.totalLogs++;
    this.stats.logsByService[entry.service] = (this.stats.logsByService[entry.service] || 0) + 1;
    this.stats.logsBySeverity[entry.severity] = (this.stats.logsBySeverity[entry.severity] || 0) + 1;
    
    if (!entry.success) {
      this.stats.errorRate = ((this.stats.errorRate * (this.stats.totalLogs - 1)) + 1) / this.stats.totalLogs;
    }
    
    if (entry.duration) {
      this.stats.averageDuration = ((this.stats.averageDuration * (this.stats.totalLogs - 1)) + entry.duration) / this.stats.totalLogs;
    }
  }

  private startBatchProcessing(): void {
    this.flushInterval = setInterval(() => {
      if (this.logQueue.length > 0) {
        this.flushQueue();
      }
    }, this.FLUSH_INTERVAL);
  }

  private async flushQueue(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const batch = this.logQueue.splice(0, this.BATCH_SIZE);
    
    try {
      await ServiceAuditLog.insertMany(batch, { ordered: false });
      Logger.debug(`📋 Flushed ${batch.length} audit log entries`);
    } catch (error) {
      Logger.error('Failed to flush audit log batch:', error);
      
      // Try to store in Redis as backup
      try {
        // Use direct Redis client since lpush is not in redisOperations
        const redis = (await import('../../config/redis')).default;
        await redis.lpush('audit_log_backup', JSON.stringify(batch));
      } catch (redisError) {
        Logger.error('Failed to backup audit logs to Redis:', redisError);
      }
    }
  }

  private convertToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) return '';

    const headers = Object.keys(logs[0]).join(',');
    const rows = logs.map(log => 
      Object.values(log).map(value => 
        typeof value === 'object' ? JSON.stringify(value) : String(value)
      ).join(',')
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Cleanup old logs
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await ServiceAuditLog.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      Logger.info(`📋 Cleaned up ${result.deletedCount} old audit log entries`);
      return result.deletedCount || 0;
    } catch (error) {
      Logger.error('Failed to cleanup old audit logs:', error);
      return 0;
    }
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Flush remaining logs
    await this.flushQueue();

    Logger.info('📋 Audit Log Service shutdown complete');
  }
}

// Create singleton instance
const auditLogService = new AuditLogService();

export { auditLogService };
export default AuditLogService;
