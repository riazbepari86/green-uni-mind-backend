import { Redis } from 'ioredis';
import { redisServiceManager } from '../redis/RedisServiceManager';
import { ApiCacheService } from '../redis/ApiCacheService';
import { QueryCacheService } from '../redis/QueryCacheService';
import { CacheInvalidationService } from '../redis/CacheInvalidationService';
import { jobQueueManager } from '../jobs/JobQueueManager';

export interface PerformanceMetrics {
  timestamp: string;
  redis: {
    health: any;
    memory: {
      used: number;
      peak: number;
      total: number;
      percentage: number;
    };
    connections: {
      active: number;
      total: number;
      failed: number;
    };
    operations: {
      totalCommands: number;
      commandsPerSecond: number;
      averageLatency: number;
    };
  };
  cache: {
    api: {
      hits: number;
      misses: number;
      hitRate: number;
      totalRequests: number;
      averageResponseTime: number;
    };
    query: {
      hits: number;
      misses: number;
      hitRate: number;
      totalQueries: number;
      popularQueries: Array<{
        query: string;
        hitCount: number;
      }>;
    };
    invalidation: {
      totalInvalidations: number;
      totalEntriesInvalidated: number;
      topRules: Array<{
        name: string;
        count: number;
        invalidated: number;
      }>;
    };
  };
  jobs: {
    queues: Record<string, {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    }>;
    workers: Record<string, {
      isRunning: boolean;
      processed: number;
      failed: number;
    }>;
    performance: {
      averageProcessingTime: number;
      throughputPerMinute: number;
      errorRate: number;
    };
  };
  auth: {
    activeSessions: number;
    totalLogins: number;
    failedLogins: number;
    blacklistedTokens: number;
    averageSessionDuration: number;
  };
  system: {
    uptime: number;
    nodeVersion: string;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export interface AlertRule {
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number; // Minutes between alerts
  condition?: (metrics: PerformanceMetrics) => boolean; // Optional condition to check before alerting
}

export interface Alert {
  id: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

export class PerformanceDashboard {
  private redis: Redis;
  private apiCache: ApiCacheService;
  private queryCache: QueryCacheService;
  private invalidationService: CacheInvalidationService;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 1440; // 24 hours of minute-by-minute data

  constructor() {
    this.redis = redisServiceManager.primaryClient;
    this.apiCache = new ApiCacheService(redisServiceManager.cacheClient, redisServiceManager.monitoring);
    this.queryCache = new QueryCacheService(redisServiceManager.cacheClient, redisServiceManager.monitoring);
    this.invalidationService = new CacheInvalidationService(redisServiceManager.cacheClient, redisServiceManager.monitoring);

    // DISABLED: Excessive Redis operations causing 121K+ ops/min
    console.log('📵 PerformanceDashboard disabled to prevent Redis overload');

    // Don't setup alert rules or start metrics collection
    // this.setupDefaultAlertRules();
    // this.startMetricsCollection();
  }

  private setupDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        name: 'High Redis Memory Usage',
        metric: 'redis.memory.percentage',
        threshold: 90,
        operator: 'gte',
        severity: 'high',
        enabled: true,
        cooldown: 15,
      },
      {
        name: 'Low Cache Hit Rate',
        metric: 'cache.api.hitRate',
        threshold: 50,
        operator: 'lt',
        severity: 'medium',
        enabled: true,
        cooldown: 30,
        // Only alert if we have meaningful traffic (at least 10 requests)
        condition: (metrics: PerformanceMetrics) => {
          const totalRequests = metrics.cache?.api?.totalRequests || 0;
          return totalRequests >= 10;
        },
      },
      {
        name: 'High Job Queue Failures',
        metric: 'jobs.performance.errorRate',
        threshold: 10,
        operator: 'gte',
        severity: 'high',
        enabled: true,
        cooldown: 10,
      },
      {
        name: 'Redis Connection Issues',
        metric: 'redis.connections.failed',
        threshold: 5,
        operator: 'gte',
        severity: 'critical',
        enabled: true,
        cooldown: 5,
      },
      {
        name: 'High Authentication Failures',
        metric: 'auth.failedLogins',
        threshold: 100,
        operator: 'gte',
        severity: 'medium',
        enabled: true,
        cooldown: 20,
      },
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.name, rule);
    });
  }

  private startMetricsCollection(): void {
    // DISABLED: Excessive Redis operations and storage consumption
    console.log('📵 Performance metrics collection disabled to prevent Redis overload');

    // Optional: Very basic metrics collection every 30 minutes (instead of every minute)
    // and store in memory only (not Redis)
    setInterval(async () => {
      try {
        // Only collect basic system metrics, no Redis operations
        const basicMetrics = {
          timestamp: new Date().toISOString(),
          system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
          }
        };

        // Store only in memory, not Redis
        this.metricsHistory.push(basicMetrics as any);

        // Keep only the last 10 entries (much smaller)
        if (this.metricsHistory.length > 10) {
          this.metricsHistory = this.metricsHistory.slice(-10);
        }

        console.log('📊 Basic system metrics collected (memory only)');

      } catch (error) {
        console.error('Error collecting basic metrics:', error);
      }
    }, 1800000); // Every 30 minutes instead of 1 minute

    console.log('📊 Minimal performance monitoring started (30min intervals, memory only)');
  }

  async collectMetrics(): Promise<PerformanceMetrics> {
    const timestamp = new Date().toISOString();

    // Collect Redis metrics
    const redisHealth = await redisServiceManager.healthCheck();
    const redisMemory = await redisServiceManager.monitoring.getMemoryUsage();
    const redisPerformance = await redisServiceManager.getPerformanceMetrics();

    // Collect cache metrics
    const apiCacheStats = await this.apiCache.getApiCacheStats();
    const queryCacheStats = await this.queryCache.getCacheStats();
    const invalidationMetrics = await this.invalidationService.getInvalidationMetrics();

    // Collect job metrics
    const jobStats = await jobQueueManager.getQueueStats();
    const jobHealth = await jobQueueManager.getHealthStatus();

    // Collect auth metrics
    const authMetrics = await this.collectAuthMetrics();

    // Collect system metrics
    const systemMetrics = this.collectSystemMetrics();

    return {
      timestamp,
      redis: {
        health: redisHealth,
        memory: redisMemory,
        connections: {
          active: (typeof redisHealth === 'object' && redisHealth !== null && (redisHealth as any).clients?.primary?.connections) || 0,
          total: (typeof redisHealth === 'object' && redisHealth !== null && (redisHealth as any).clients?.primary?.totalConnections) || 0,
          failed: (typeof redisHealth === 'object' && redisHealth !== null && (redisHealth as any).clients?.primary?.failedConnections) || 0,
        },
        operations: {
          totalCommands: redisPerformance.overall?.totalOperations || 0,
          commandsPerSecond: await this.calculateCommandsPerSecond(),
          averageLatency: redisPerformance.overall?.averageLatency || 0,
        },
      },
      cache: {
        api: {
          ...apiCacheStats,
          averageResponseTime: await this.calculateAverageResponseTime(),
        },
        query: {
          ...queryCacheStats,
          popularQueries: await this.queryCache.getPopularQueries(5),
        },
        invalidation: {
          ...invalidationMetrics,
          topRules: Object.entries(invalidationMetrics.ruleMetrics)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 5)
            .map(([name, metrics]) => ({ name, ...metrics })),
        },
      },
      jobs: {
        queues: jobStats,
        workers: jobHealth.workers,
        performance: {
          averageProcessingTime: await this.calculateJobProcessingTime(),
          throughputPerMinute: await this.calculateJobThroughput(),
          errorRate: await this.calculateJobErrorRate(),
        },
      },
      auth: authMetrics,
      system: systemMetrics,
    };
  }

  private async collectAuthMetrics(): Promise<any> {
    try {
      // Get auth-related metrics from Redis
      const [activeSessions, totalLogins, failedLogins, blacklistedTokens] = await Promise.all([
        this.redis.get('auth:stats:active_sessions'),
        this.redis.get('auth:stats:total_logins'),
        this.redis.get('auth:stats:failed_logins'),
        this.redis.get('auth:stats:blacklisted_tokens'),
      ]);

      return {
        activeSessions: parseInt(activeSessions || '0'),
        totalLogins: parseInt(totalLogins || '0'),
        failedLogins: parseInt(failedLogins || '0'),
        blacklistedTokens: parseInt(blacklistedTokens || '0'),
        averageSessionDuration: await this.calculateAverageSessionDuration(),
      };
    } catch (error) {
      console.error('Error collecting auth metrics:', error);
      return {
        activeSessions: 0,
        totalLogins: 0,
        failedLogins: 0,
        blacklistedTokens: 0,
        averageSessionDuration: 0,
      };
    }
  }

  private collectSystemMetrics(): any {
    return {
      uptime: process.uptime(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };
  }

  private async calculateCommandsPerSecond(): Promise<number> {
    // This would require tracking commands over time
    // For now, return a placeholder
    return 0;
  }

  private async calculateAverageResponseTime(): Promise<number> {
    try {
      const keys = await this.redis.keys('metrics:api:*:response_times');
      if (keys.length === 0) return 0;

      let totalTime = 0;
      let totalRequests = 0;

      for (const key of keys.slice(0, 10)) { // Sample first 10 endpoints
        const times = await this.redis.lrange(key, 0, -1);
        const numericTimes = times.map(t => parseInt(t)).filter(t => !isNaN(t));
        
        if (numericTimes.length > 0) {
          totalTime += numericTimes.reduce((sum, time) => sum + time, 0);
          totalRequests += numericTimes.length;
        }
      }

      return totalRequests > 0 ? totalTime / totalRequests : 0;
    } catch (error) {
      console.error('Error calculating average response time:', error);
      return 0;
    }
  }

  private async calculateJobProcessingTime(): Promise<number> {
    // This would require job metrics from BullMQ
    // For now, return a placeholder
    return 0;
  }

  private async calculateJobThroughput(): Promise<number> {
    // This would require job completion tracking
    // For now, return a placeholder
    return 0;
  }

  private async calculateJobErrorRate(): Promise<number> {
    // This would require job failure tracking
    // For now, return a placeholder
    return 0;
  }

  private async calculateAverageSessionDuration(): Promise<number> {
    // This would require session duration tracking
    // For now, return a placeholder
    return 0;
  }

  private async storeMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const key = `metrics:performance:${metrics.timestamp.slice(0, 16)}`; // Minute precision
      await this.redis.setex(key, 86400 * 7, JSON.stringify(metrics)); // Keep for 7 days
    } catch (error) {
      console.error('Error storing metrics:', error);
    }
  }

  private async checkAlertRules(metrics: PerformanceMetrics): Promise<void> {
    for (const [ruleName, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        // Check optional condition first
        if (rule.condition && !rule.condition(metrics)) {
          continue; // Skip this rule if condition is not met
        }

        const value = this.getMetricValue(metrics, rule.metric);
        const shouldAlert = this.evaluateCondition(value, rule.threshold, rule.operator);

        if (shouldAlert) {
          await this.triggerAlert(rule, value);
        } else {
          // Check if we should resolve an existing alert
          const existingAlert = this.activeAlerts.get(ruleName);
          if (existingAlert && !existingAlert.resolvedAt) {
            await this.resolveAlert(ruleName);
          }
        }
      } catch (error) {
        console.error(`Error checking alert rule ${ruleName}:`, error);
      }
    }
  }

  private getMetricValue(metrics: PerformanceMetrics, metricPath: string): number {
    const parts = metricPath.split('.');
    let value: any = metrics;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return typeof value === 'number' ? value : 0;
  }

  private evaluateCondition(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    const existingAlert = this.activeAlerts.get(rule.name);
    
    // Check cooldown period
    if (existingAlert && !existingAlert.resolvedAt) {
      const timeSinceAlert = Date.now() - new Date(existingAlert.timestamp).getTime();
      if (timeSinceAlert < rule.cooldown * 60 * 1000) {
        return; // Still in cooldown
      }
    }

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      rule: rule.name,
      severity: rule.severity,
      message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`,
      value,
      threshold: rule.threshold,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    this.activeAlerts.set(rule.name, alert);
    
    // Store alert in Redis
    await this.redis.lpush('alerts:active', JSON.stringify(alert));
    await this.redis.ltrim('alerts:active', 0, 99); // Keep last 100 alerts
    
    console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
    
    // Here you could integrate with external alerting systems
    // await this.sendToSlack(alert);
    // await this.sendEmail(alert);
  }

  private async resolveAlert(ruleName: string): Promise<void> {
    const alert = this.activeAlerts.get(ruleName);
    if (alert) {
      alert.resolvedAt = new Date().toISOString();
      
      // Store resolved alert
      await this.redis.lpush('alerts:resolved', JSON.stringify(alert));
      await this.redis.ltrim('alerts:resolved', 0, 99);
      
      console.log(`✅ RESOLVED: ${alert.message}`);
    }
  }

  // Public API methods
  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    return await this.collectMetrics();
  }

  async getMetricsHistory(hours: number = 24): Promise<PerformanceMetrics[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => new Date(m.timestamp) >= cutoff);
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.activeAlerts.values()).filter(a => !a.resolvedAt);
  }

  async getResolvedAlerts(limit: number = 50): Promise<Alert[]> {
    try {
      const alerts = await this.redis.lrange('alerts:resolved', 0, limit - 1);
      return alerts.map(a => JSON.parse(a));
    } catch (error) {
      console.error('Error getting resolved alerts:', error);
      return [];
    }
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    for (const alert of this.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.acknowledged = true;
        break;
      }
    }
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.name, rule);
  }

  removeAlertRule(name: string): void {
    this.alertRules.delete(name);
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  async getPerformanceSummary(): Promise<{
    overall: 'excellent' | 'good' | 'fair' | 'poor';
    scores: {
      redis: number;
      cache: number;
      jobs: number;
      auth: number;
    };
    recommendations: string[];
  }> {
    const metrics = await this.getCurrentMetrics();
    
    // Calculate performance scores (0-100)
    const redisScore = this.calculateRedisScore(metrics.redis);
    const cacheScore = this.calculateCacheScore(metrics.cache);
    const jobsScore = this.calculateJobsScore(metrics.jobs);
    const authScore = this.calculateAuthScore(metrics.auth);
    
    const overallScore = (redisScore + cacheScore + jobsScore + authScore) / 4;
    
    let overall: 'excellent' | 'good' | 'fair' | 'poor';
    if (overallScore >= 90) overall = 'excellent';
    else if (overallScore >= 75) overall = 'good';
    else if (overallScore >= 60) overall = 'fair';
    else overall = 'poor';
    
    const recommendations = this.generateRecommendations(metrics);
    
    return {
      overall,
      scores: {
        redis: redisScore,
        cache: cacheScore,
        jobs: jobsScore,
        auth: authScore,
      },
      recommendations,
    };
  }

  private calculateRedisScore(redis: any): number {
    let score = 100;
    
    // Deduct points for high memory usage
    if (redis.memory.percentage > 90) score -= 30;
    else if (redis.memory.percentage > 80) score -= 15;
    else if (redis.memory.percentage > 70) score -= 5;
    
    // Deduct points for connection issues
    if (redis.connections.failed > 0) score -= 20;
    
    // Deduct points for high latency
    if (redis.operations.averageLatency > 100) score -= 15;
    else if (redis.operations.averageLatency > 50) score -= 5;
    
    return Math.max(0, score);
  }

  private calculateCacheScore(cache: any): number {
    let score = 100;
    
    // Deduct points for low hit rates
    if (cache.api.hitRate < 50) score -= 30;
    else if (cache.api.hitRate < 70) score -= 15;
    else if (cache.api.hitRate < 85) score -= 5;
    
    if (cache.query.hitRate < 60) score -= 20;
    else if (cache.query.hitRate < 80) score -= 10;
    
    return Math.max(0, score);
  }

  private calculateJobsScore(jobs: any): number {
    let score = 100;
    
    // Deduct points for high error rates
    if (jobs.performance.errorRate > 10) score -= 40;
    else if (jobs.performance.errorRate > 5) score -= 20;
    else if (jobs.performance.errorRate > 1) score -= 10;
    
    // Deduct points for queue backlogs
    const totalWaiting = Object.values(jobs.queues).reduce((sum: number, queue: any) => sum + queue.waiting, 0);
    if (totalWaiting > 100) score -= 20;
    else if (totalWaiting > 50) score -= 10;
    
    return Math.max(0, score);
  }

  private calculateAuthScore(auth: any): number {
    let score = 100;
    
    // Deduct points for high failure rates
    const failureRate = auth.totalLogins > 0 ? (auth.failedLogins / auth.totalLogins) * 100 : 0;
    if (failureRate > 20) score -= 30;
    else if (failureRate > 10) score -= 15;
    else if (failureRate > 5) score -= 5;
    
    return Math.max(0, score);
  }

  private generateRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.redis.memory.percentage > 80) {
      recommendations.push('Consider increasing Redis memory or implementing more aggressive cache eviction policies');
    }
    
    if (metrics.cache.api.hitRate < 70) {
      recommendations.push('Review API caching strategies and consider increasing cache TTL for stable endpoints');
    }
    
    if (metrics.jobs.performance.errorRate > 5) {
      recommendations.push('Investigate job failures and consider implementing better error handling and retry mechanisms');
    }
    
    if (metrics.auth.failedLogins > metrics.auth.totalLogins * 0.1) {
      recommendations.push('High authentication failure rate detected - consider implementing additional security measures');
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const performanceDashboard = new PerformanceDashboard();
