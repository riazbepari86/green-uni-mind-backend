import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../config/logger';
import { redisOperations } from '../../config/redis';
import EnhancedCacheService from '../cache/EnhancedCacheService';

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  userId?: string;
  userType?: string;
  cacheHit?: boolean;
  dbQueries?: number;
  memoryUsage?: number;
}

interface EndpointStats {
  totalRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  lastUpdated: Date;
}

class PerformanceMonitoringService {
  private readonly METRICS_RETENTION_DAYS = 7;
  private readonly STATS_UPDATE_INTERVAL = 60000; // 1 minute
  private metricsBuffer: PerformanceMetrics[] = [];
  private statsUpdateTimer?: NodeJS.Timeout;

  constructor() {
    this.startStatsUpdater();
  }

  /**
   * Express middleware to track performance metrics
   */
  public trackPerformance() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      // Track database queries (simplified)
      let dbQueries = 0;
      const originalQuery = (req as any).dbQuery;
      (req as any).dbQuery = (...args: any[]) => {
        dbQueries++;
        return originalQuery?.apply(this, args);
      };

      // Override res.end to capture metrics
      const originalEnd = res.end.bind(res);
      res.end = function(chunk?: any, encoding?: any, cb?: () => void): Response {
        const responseTime = Date.now() - startTime;
        const endMemory = process.memoryUsage().heapUsed;
        const memoryUsage = endMemory - startMemory;

        const user = (req as any).user;
        const metrics: PerformanceMetrics = {
          endpoint: req.route?.path || req.path,
          method: req.method,
          responseTime,
          statusCode: res.statusCode,
          timestamp: new Date(),
          userId: user?.userId || user?.teacherId || user?.studentId,
          userType: user?.role,
          cacheHit: (res as any).cacheHit || false,
          dbQueries,
          memoryUsage,
        };

        // Add to buffer for batch processing
        PerformanceMonitoringService.getInstance().addMetric(metrics);

        // Log slow requests
        if (responseTime > 1000) {
          Logger.warn(`🐌 Slow request detected: ${req.method} ${req.path} - ${responseTime}ms`, {
            endpoint: req.path,
            method: req.method,
            responseTime,
            statusCode: res.statusCode,
            userId: metrics.userId,
            dbQueries,
          });
        }

        // Log errors
        if (res.statusCode >= 400) {
          Logger.error(`❌ Request error: ${req.method} ${req.path} - ${res.statusCode}`, {
            endpoint: req.path,
            method: req.method,
            responseTime,
            statusCode: res.statusCode,
            userId: metrics.userId,
          });
        }

        return originalEnd(chunk, encoding, cb);
      };

      next();
    };
  }

  /**
   * Add metric to buffer
   */
  private addMetric(metric: PerformanceMetrics): void {
    this.metricsBuffer.push(metric);

    // Flush buffer if it gets too large
    if (this.metricsBuffer.length >= 100) {
      this.flushMetrics();
    }
  }

  /**
   * Flush metrics buffer to storage
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metrics = [...this.metricsBuffer];
      this.metricsBuffer = [];

      // Store metrics in Redis with TTL
      const pipeline = redisOperations.pipeline();
      const now = Date.now();

      for (const metric of metrics) {
        const key = `metrics:${metric.endpoint}:${now}:${Math.random()}`;
        pipeline.setex(key, this.METRICS_RETENTION_DAYS * 24 * 60 * 60, JSON.stringify(metric));
      }

      await pipeline.exec();

      // Update endpoint statistics
      await this.updateEndpointStats(metrics);

    } catch (error) {
      Logger.error('❌ Failed to flush performance metrics:', error);
    }
  }

  /**
   * Update endpoint statistics
   */
  private async updateEndpointStats(metrics: PerformanceMetrics[]): Promise<void> {
    try {
      const endpointGroups = metrics.reduce((groups, metric) => {
        const key = `${metric.method}:${metric.endpoint}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(metric);
        return groups;
      }, {} as Record<string, PerformanceMetrics[]>);

      for (const [endpointKey, endpointMetrics] of Object.entries(endpointGroups)) {
        const stats = await this.calculateEndpointStats(endpointKey, endpointMetrics);
        await EnhancedCacheService.set(
          `endpoint_stats:${endpointKey}`,
          stats,
          { ttl: 3600, namespace: 'performance' }
        );
      }
    } catch (error) {
      Logger.error('❌ Failed to update endpoint stats:', error);
    }
  }

  /**
   * Calculate statistics for an endpoint
   */
  private async calculateEndpointStats(
    endpointKey: string,
    newMetrics: PerformanceMetrics[]
  ): Promise<EndpointStats> {
    try {
      // Get recent metrics from Redis
      const pattern = `metrics:${endpointKey.split(':')[1]}:*`;
      const keys = await redisOperations.keys(pattern);
      const recentMetrics: PerformanceMetrics[] = [];

      if (keys.length > 0) {
        const values = await redisOperations.mget(keys);
        for (const value of values) {
          if (value) {
            try {
              recentMetrics.push(JSON.parse(value));
            } catch (error) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Combine with new metrics
      const allMetrics = [...recentMetrics, ...newMetrics];
      
      if (allMetrics.length === 0) {
        return {
          totalRequests: 0,
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          errorRate: 0,
          cacheHitRate: 0,
          lastUpdated: new Date(),
        };
      }

      // Calculate statistics
      const responseTimes = allMetrics.map(m => m.responseTime).sort((a, b) => a - b);
      const totalRequests = allMetrics.length;
      const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / totalRequests;
      const p95ResponseTime = responseTimes[Math.floor(totalRequests * 0.95)] || 0;
      const p99ResponseTime = responseTimes[Math.floor(totalRequests * 0.99)] || 0;
      
      const errorCount = allMetrics.filter(m => m.statusCode >= 400).length;
      const errorRate = (errorCount / totalRequests) * 100;
      
      const cacheHits = allMetrics.filter(m => m.cacheHit).length;
      const cacheHitRate = (cacheHits / totalRequests) * 100;

      return {
        totalRequests,
        averageResponseTime: Math.round(averageResponseTime),
        p95ResponseTime,
        p99ResponseTime,
        errorRate: Math.round(errorRate * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        lastUpdated: new Date(),
      };
    } catch (error) {
      Logger.error('❌ Failed to calculate endpoint stats:', error);
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Get performance statistics for an endpoint
   */
  public async getEndpointStats(method: string, endpoint: string): Promise<EndpointStats | null> {
    try {
      const key = `${method}:${endpoint}`;
      return await EnhancedCacheService.get<EndpointStats>(
        `endpoint_stats:${key}`,
        { namespace: 'performance' }
      );
    } catch (error) {
      Logger.error('❌ Failed to get endpoint stats:', error);
      return null;
    }
  }

  /**
   * Get overall system performance metrics
   */
  public async getSystemMetrics(): Promise<{
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
    topSlowEndpoints: Array<{ endpoint: string; averageResponseTime: number }>;
    topErrorEndpoints: Array<{ endpoint: string; errorRate: number }>;
  }> {
    try {
      // Get all endpoint stats
      const pattern = 'performance:endpoint_stats:*';
      const keys = await redisOperations.keys(pattern);
      const allStats: EndpointStats[] = [];

      if (keys.length > 0) {
        const values = await redisOperations.mget(keys);
        for (const value of values) {
          if (value) {
            try {
              allStats.push(JSON.parse(value));
            } catch (error) {
              // Skip invalid JSON
            }
          }
        }
      }

      if (allStats.length === 0) {
        return {
          totalRequests: 0,
          averageResponseTime: 0,
          errorRate: 0,
          cacheHitRate: 0,
          topSlowEndpoints: [],
          topErrorEndpoints: [],
        };
      }

      // Calculate overall metrics
      const totalRequests = allStats.reduce((sum, stat) => sum + stat.totalRequests, 0);
      const weightedResponseTime = allStats.reduce(
        (sum, stat) => sum + (stat.averageResponseTime * stat.totalRequests),
        0
      );
      const averageResponseTime = totalRequests > 0 ? weightedResponseTime / totalRequests : 0;

      const weightedErrorRate = allStats.reduce(
        (sum, stat) => sum + (stat.errorRate * stat.totalRequests),
        0
      );
      const errorRate = totalRequests > 0 ? weightedErrorRate / totalRequests : 0;

      const weightedCacheHitRate = allStats.reduce(
        (sum, stat) => sum + (stat.cacheHitRate * stat.totalRequests),
        0
      );
      const cacheHitRate = totalRequests > 0 ? weightedCacheHitRate / totalRequests : 0;

      // Get top slow endpoints
      const topSlowEndpoints = keys
        .map((key, index) => ({
          endpoint: key.replace('performance:endpoint_stats:', ''),
          averageResponseTime: allStats[index]?.averageResponseTime || 0,
        }))
        .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
        .slice(0, 5);

      // Get top error endpoints
      const topErrorEndpoints = keys
        .map((key, index) => ({
          endpoint: key.replace('performance:endpoint_stats:', ''),
          errorRate: allStats[index]?.errorRate || 0,
        }))
        .filter(item => item.errorRate > 0)
        .sort((a, b) => b.errorRate - a.errorRate)
        .slice(0, 5);

      return {
        totalRequests,
        averageResponseTime: Math.round(averageResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        topSlowEndpoints,
        topErrorEndpoints,
      };
    } catch (error) {
      Logger.error('❌ Failed to get system metrics:', error);
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        topSlowEndpoints: [],
        topErrorEndpoints: [],
      };
    }
  }

  /**
   * Start periodic stats updater
   */
  private startStatsUpdater(): void {
    this.statsUpdateTimer = setInterval(() => {
      this.flushMetrics();
    }, this.STATS_UPDATE_INTERVAL);
  }

  /**
   * Stop stats updater
   */
  public stopStatsUpdater(): void {
    if (this.statsUpdateTimer) {
      clearInterval(this.statsUpdateTimer);
      this.statsUpdateTimer = undefined;
    }
  }

  /**
   * Get performance statistics
   */
  public getStats(): { hits: number; misses: number; sets: number; deletes: number; errors: number; hitRate: number } {
    const total = this.metricsBuffer.length;
    const hitRate = total > 0 ? 100 : 0; // Simplified calculation

    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate
    };
  }

  /**
   * Reset performance statistics
   */
  public resetStats(): void {
    this.metricsBuffer = [];
  }

  /**
   * Singleton instance
   */
  private static instance: PerformanceMonitoringService;

  public static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }
}

export default PerformanceMonitoringService;
