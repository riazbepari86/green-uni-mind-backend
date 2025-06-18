import { Redis } from 'ioredis';
import { IRedisMonitoringService } from './interfaces';

interface OperationMetric {
  operation: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastExecuted: Date;
}

interface ConnectionMetric {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  reconnections: number;
  lastConnectionTime: Date;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  memoryUsage: number;
  connections: number;
  errors: number;
  uptime: number;
  lastCheck: Date;
}

export class RedisMonitoringService implements IRedisMonitoringService {
  private operationMetrics = new Map<string, OperationMetric>();
  private connectionMetrics: ConnectionMetric = {
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0,
    reconnections: 0,
    lastConnectionTime: new Date()
  };
  private healthHistory: HealthStatus[] = [];
  private maxHistorySize = 100;
  private startTime = new Date();

  constructor(private redis: Redis) {
    this.setupRedisEventListeners();
    this.startPeriodicHealthCheck();
  }

  private setupRedisEventListeners(): void {
    this.redis.on('connect', () => {
      this.connectionMetrics.totalConnections++;
      this.connectionMetrics.activeConnections++;
      this.connectionMetrics.lastConnectionTime = new Date();
    });

    this.redis.on('close', () => {
      this.connectionMetrics.activeConnections = Math.max(0, this.connectionMetrics.activeConnections - 1);
    });

    this.redis.on('error', () => {
      this.connectionMetrics.failedConnections++;
    });

    this.redis.on('reconnecting', () => {
      this.connectionMetrics.reconnections++;
    });
  }

  recordOperation(operation: string, duration: number, success: boolean): void {
    const existing = this.operationMetrics.get(operation);
    
    if (existing) {
      existing.totalCalls++;
      existing.totalDuration += duration;
      existing.averageDuration = existing.totalDuration / existing.totalCalls;
      existing.minDuration = Math.min(existing.minDuration, duration);
      existing.maxDuration = Math.max(existing.maxDuration, duration);
      existing.lastExecuted = new Date();
      
      if (success) {
        existing.successfulCalls++;
      } else {
        existing.failedCalls++;
      }
    } else {
      this.operationMetrics.set(operation, {
        operation,
        totalCalls: 1,
        successfulCalls: success ? 1 : 0,
        failedCalls: success ? 0 : 1,
        totalDuration: duration,
        averageDuration: duration,
        minDuration: duration,
        maxDuration: duration,
        lastExecuted: new Date()
      });
    }
  }

  async getOperationMetrics(operation: string): Promise<OperationMetric | null> {
    return this.operationMetrics.get(operation) || null;
  }

  async getAllOperationMetrics(): Promise<OperationMetric[]> {
    return Array.from(this.operationMetrics.values());
  }

  async getConnectionMetrics(): Promise<ConnectionMetric> {
    return { ...this.connectionMetrics };
  }

  async getMemoryUsage(): Promise<{
    used: number;
    peak: number;
    total: number;
    percentage: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const lines = info.split('\r\n');
      
      let used = 0;
      let peak = 0;
      let total = 0;
      
      for (const line of lines) {
        if (line.startsWith('used_memory:')) {
          used = parseInt(line.split(':')[1]);
        } else if (line.startsWith('used_memory_peak:')) {
          peak = parseInt(line.split(':')[1]);
        } else if (line.startsWith('maxmemory:')) {
          total = parseInt(line.split(':')[1]);
        }
      }
      
      const percentage = total > 0 ? (used / total) * 100 : 0;
      
      return { used, peak, total, percentage };
    } catch (error) {
      console.error('Error getting Redis memory usage:', error);
      return { used: 0, peak: 0, total: 0, percentage: 0 };
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let latency = 0;
    let errors = 0;

    try {
      // Test basic connectivity
      await this.redis.ping();
      latency = Date.now() - startTime;
      
      // Get memory usage
      const memoryInfo = await this.getMemoryUsage();
      
      // Determine health status based on metrics
      if (latency > 1000) { // > 1 second
        status = 'unhealthy';
      } else if (latency > 500 || memoryInfo.percentage > 90) { // > 500ms or > 90% memory
        status = 'degraded';
      }
      
      // Count recent errors
      const recentMetrics = Array.from(this.operationMetrics.values())
        .filter(metric => Date.now() - metric.lastExecuted.getTime() < 60000); // Last minute
      
      errors = recentMetrics.reduce((sum, metric) => sum + metric.failedCalls, 0);
      
      if (errors > 10) { // More than 10 errors in the last minute
        status = status === 'healthy' ? 'degraded' : 'unhealthy';
      }

      const healthStatus: HealthStatus = {
        status,
        latency,
        memoryUsage: memoryInfo.percentage,
        connections: this.connectionMetrics.activeConnections,
        errors,
        uptime: Date.now() - this.startTime.getTime(),
        lastCheck: new Date()
      };

      // Store in history
      this.healthHistory.push(healthStatus);
      if (this.healthHistory.length > this.maxHistorySize) {
        this.healthHistory.shift();
      }

      return healthStatus;
    } catch (error) {
      const healthStatus: HealthStatus = {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        memoryUsage: 0,
        connections: 0,
        errors: errors + 1,
        uptime: Date.now() - this.startTime.getTime(),
        lastCheck: new Date()
      };

      this.healthHistory.push(healthStatus);
      if (this.healthHistory.length > this.maxHistorySize) {
        this.healthHistory.shift();
      }

      return healthStatus;
    }
  }

  private startPeriodicHealthCheck(): void {
    // Run health check every 30 seconds
    setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        console.error('Error during periodic health check:', error);
      }
    }, 30000);
  }

  async getHealthHistory(limit: number = 10): Promise<HealthStatus[]> {
    return this.healthHistory.slice(-limit);
  }

  async getPerformanceReport(): Promise<{
    overall: {
      totalOperations: number;
      successRate: number;
      averageLatency: number;
      uptime: number;
    };
    operations: OperationMetric[];
    connections: ConnectionMetric;
    currentHealth: HealthStatus;
    trends: {
      latencyTrend: 'improving' | 'stable' | 'degrading';
      errorTrend: 'improving' | 'stable' | 'degrading';
      memoryTrend: 'improving' | 'stable' | 'degrading';
    };
  }> {
    const operations = Array.from(this.operationMetrics.values());
    const totalOperations = operations.reduce((sum, op) => sum + op.totalCalls, 0);
    const totalSuccessful = operations.reduce((sum, op) => sum + op.successfulCalls, 0);
    const totalDuration = operations.reduce((sum, op) => sum + op.totalDuration, 0);
    
    const successRate = totalOperations > 0 ? (totalSuccessful / totalOperations) * 100 : 100;
    const averageLatency = totalOperations > 0 ? totalDuration / totalOperations : 0;
    
    const currentHealth = await this.healthCheck();
    
    // Calculate trends based on recent history
    const recentHistory = this.healthHistory.slice(-10);
    const trends = this.calculateTrends(recentHistory);

    return {
      overall: {
        totalOperations,
        successRate,
        averageLatency,
        uptime: Date.now() - this.startTime.getTime()
      },
      operations,
      connections: this.connectionMetrics,
      currentHealth,
      trends
    };
  }

  private calculateTrends(history: HealthStatus[]): {
    latencyTrend: 'improving' | 'stable' | 'degrading';
    errorTrend: 'improving' | 'stable' | 'degrading';
    memoryTrend: 'improving' | 'stable' | 'degrading';
  } {
    if (history.length < 3) {
      return {
        latencyTrend: 'stable',
        errorTrend: 'stable',
        memoryTrend: 'stable'
      };
    }

    const recent = history.slice(-3);
    const older = history.slice(-6, -3);

    const avgRecentLatency = recent.reduce((sum, h) => sum + h.latency, 0) / recent.length;
    const avgOlderLatency = older.length > 0 ? older.reduce((sum, h) => sum + h.latency, 0) / older.length : avgRecentLatency;

    const avgRecentErrors = recent.reduce((sum, h) => sum + h.errors, 0) / recent.length;
    const avgOlderErrors = older.length > 0 ? older.reduce((sum, h) => sum + h.errors, 0) / older.length : avgRecentErrors;

    const avgRecentMemory = recent.reduce((sum, h) => sum + h.memoryUsage, 0) / recent.length;
    const avgOlderMemory = older.length > 0 ? older.reduce((sum, h) => sum + h.memoryUsage, 0) / older.length : avgRecentMemory;

    const latencyTrend = avgRecentLatency < avgOlderLatency * 0.9 ? 'improving' :
                        avgRecentLatency > avgOlderLatency * 1.1 ? 'degrading' : 'stable';

    const errorTrend = avgRecentErrors < avgOlderErrors * 0.9 ? 'improving' :
                      avgRecentErrors > avgOlderErrors * 1.1 ? 'degrading' : 'stable';

    const memoryTrend = avgRecentMemory < avgOlderMemory * 0.95 ? 'improving' :
                       avgRecentMemory > avgOlderMemory * 1.05 ? 'degrading' : 'stable';

    return { latencyTrend, errorTrend, memoryTrend };
  }

  // Reset all metrics (useful for testing or periodic cleanup)
  resetMetrics(): void {
    this.operationMetrics.clear();
    this.connectionMetrics = {
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      reconnections: 0,
      lastConnectionTime: new Date()
    };
    this.healthHistory = [];
    this.startTime = new Date();
  }

  // Export metrics for external monitoring systems
  async exportMetrics(): Promise<{
    timestamp: string;
    operations: Record<string, OperationMetric>;
    connections: ConnectionMetric;
    health: HealthStatus;
    uptime: number;
  }> {
    const operations: Record<string, OperationMetric> = {};
    this.operationMetrics.forEach((metric, key) => {
      operations[key] = metric;
    });

    const health = await this.healthCheck();

    return {
      timestamp: new Date().toISOString(),
      operations,
      connections: this.connectionMetrics,
      health,
      uptime: Date.now() - this.startTime.getTime()
    };
  }
}
