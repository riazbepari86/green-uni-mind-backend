import { EventEmitter } from 'events';
import { Logger } from '../../config/logger';
import { redisOperations } from '../../config/redis';

export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: Date;
  responseTime?: number;
  metadata?: Record<string, any>;
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  connections: {
    sse: number;
    polling: number;
    database: number;
  };
  performance: {
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  timestamp: Date;
}

class MonitoringService extends EventEmitter {
  private metrics: Map<string, MetricData[]> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertingInterval: NodeJS.Timeout | null = null;

  private readonly METRIC_RETENTION_TIME = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MONITORING_INTERVAL = 30000; // 30 seconds
  private readonly ALERTING_INTERVAL = 60000; // 1 minute
  private readonly MAX_METRICS_PER_NAME = 1000;

  constructor() {
    super();
    this.startMonitoring();
    this.startAlerting();
    Logger.info('📊 Monitoring Service initialized');
  }

  /**
   * Record a metric
   */
  public recordMetric(metric: Omit<MetricData, 'timestamp'>): void {
    const fullMetric: MetricData = {
      ...metric,
      timestamp: new Date(),
    };

    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricArray = this.metrics.get(metric.name)!;
    metricArray.push(fullMetric);

    // Limit array size
    if (metricArray.length > this.MAX_METRICS_PER_NAME) {
      metricArray.shift();
    }

    this.emit('metric:recorded', fullMetric);
    Logger.debug(`📊 Metric recorded: ${metric.name} = ${metric.value}`);
  }

  /**
   * Record multiple metrics at once
   */
  public recordMetrics(metrics: Array<Omit<MetricData, 'timestamp'>>): void {
    for (const metric of metrics) {
      this.recordMetric(metric);
    }
  }

  /**
   * Increment a counter metric
   */
  public incrementCounter(
    name: string,
    value: number = 1,
    tags: Record<string, string> = {},
  ): void {
    this.recordMetric({
      name,
      value,
      tags,
      type: 'counter',
    });
  }

  /**
   * Set a gauge metric
   */
  public setGauge(
    name: string,
    value: number,
    tags: Record<string, string> = {},
  ): void {
    this.recordMetric({
      name,
      value,
      tags,
      type: 'gauge',
    });
  }

  /**
   * Record a timer metric
   */
  public recordTimer(
    name: string,
    duration: number,
    tags: Record<string, string> = {},
  ): void {
    this.recordMetric({
      name,
      value: duration,
      tags,
      type: 'timer',
    });
  }

  /**
   * Register a health check
   */
  public registerHealthCheck(healthCheck: HealthCheck): void {
    this.healthChecks.set(healthCheck.name, healthCheck);
    this.emit('health:check_registered', healthCheck);

    if (healthCheck.status !== 'healthy') {
      this.createAlert({
        level: healthCheck.status === 'degraded' ? 'warning' : 'error',
        title: `Health Check Failed: ${healthCheck.name}`,
        message: healthCheck.message,
        source: 'health_check',
        metadata: { healthCheck },
      });
    }
  }

  /**
   * Get current health status
   */
  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: HealthCheck[];
  } {
    const checks = Array.from(this.healthChecks.values());
    const unhealthyChecks = checks.filter(
      (check) => check.status === 'unhealthy',
    );
    const degradedChecks = checks.filter(
      (check) => check.status === 'degraded',
    );

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (unhealthyChecks.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedChecks.length > 0) {
      overallStatus = 'degraded';
    }

    return { status: overallStatus, checks };
  }

  /**
   * Create an alert
   */
  public createAlert(
    alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>,
  ): string {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const fullAlert: Alert = {
      ...alert,
      id: alertId,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.set(alertId, fullAlert);
    this.emit('alert:created', fullAlert);

    Logger.warn(`🚨 Alert created: ${alert.title} - ${alert.message}`);

    // Store in Redis for persistence
    this.persistAlert(fullAlert);

    return alertId;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string, resolution?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    if (resolution) {
      alert.metadata.resolution = resolution;
    }

    this.emit('alert:resolved', alert);
    Logger.info(`✅ Alert resolved: ${alert.title}`);

    // Update in Redis
    this.persistAlert(alert);

    return true;
  }

  /**
   * Get system metrics
   */
  public async getSystemMetrics(): Promise<SystemMetrics> {
    const process = await import('process');
    const os = await import('os');

    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage: os.loadavg(),
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      connections: {
        sse: this.getMetricValue('sse_connections_active') || 0,
        polling: this.getMetricValue('polling_subscriptions_active') || 0,
        database: this.getMetricValue('database_connections_active') || 0,
      },
      performance: {
        averageResponseTime: this.getAverageMetricValue('response_time') || 0,
        requestsPerSecond: this.getMetricRate('requests_total') || 0,
        errorRate: this.getMetricRate('errors_total') || 0,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get metrics for a specific name
   */
  public getMetrics(name: string, since?: Date): MetricData[] {
    const metrics = this.metrics.get(name) || [];

    if (since) {
      return metrics.filter((metric) => metric.timestamp >= since);
    }

    return [...metrics];
  }

  /**
   * Get all active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((alert) => !alert.resolved);
  }

  /**
   * Get monitoring statistics
   */
  public getMonitoringStats(): {
    totalMetrics: number;
    activeAlerts: number;
    healthChecks: number;
    unhealthyServices: number;
  } {
    const totalMetrics = Array.from(this.metrics.values()).reduce(
      (sum, metrics) => sum + metrics.length,
      0,
    );

    const activeAlerts = this.getActiveAlerts().length;
    const healthChecks = this.healthChecks.size;
    const unhealthyServices = Array.from(this.healthChecks.values()).filter(
      (check) => check.status === 'unhealthy',
    ).length;

    return {
      totalMetrics,
      activeAlerts,
      healthChecks,
      unhealthyServices,
    };
  }

  /**
   * Private helper methods
   */
  private getMetricValue(name: string): number | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    return metrics[metrics.length - 1].value;
  }

  private getAverageMetricValue(
    name: string,
    timeWindow: number = 300000,
  ): number | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const cutoff = new Date(Date.now() - timeWindow);
    const recentMetrics = metrics.filter(
      (metric) => metric.timestamp >= cutoff,
    );

    if (recentMetrics.length === 0) {
      return null;
    }

    const sum = recentMetrics.reduce(
      (total, metric) => total + metric.value,
      0,
    );
    return sum / recentMetrics.length;
  }

  private getMetricRate(
    name: string,
    timeWindow: number = 60000,
  ): number | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length < 2) {
      return null;
    }

    const cutoff = new Date(Date.now() - timeWindow);
    const recentMetrics = metrics.filter(
      (metric) => metric.timestamp >= cutoff,
    );

    if (recentMetrics.length < 2) {
      return null;
    }

    const firstMetric = recentMetrics[0];
    const lastMetric = recentMetrics[recentMetrics.length - 1];
    const timeDiff =
      lastMetric.timestamp.getTime() - firstMetric.timestamp.getTime();
    const valueDiff = lastMetric.value - firstMetric.value;

    return (valueDiff / timeDiff) * 1000; // Per second
  }

  private async persistAlert(alert: Alert): Promise<void> {
    try {
      await redisOperations.setex(
        `alert:${alert.id}`,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify(alert),
      );
    } catch (error) {
      Logger.error('Failed to persist alert to Redis:', error);
    }
  }

  private startMonitoring(): void {
    // Reduce monitoring frequency to every 30 seconds to reduce Redis load
    const OPTIMIZED_MONITORING_INTERVAL = 30000; // 30 seconds instead of default

    this.monitoringInterval = setInterval(async () => {
      try {
        // Collect system metrics with intelligent sampling
        const systemMetrics = await this.getSystemMetrics();

        // Only record system metrics if they've changed significantly or it's been a while
        const shouldRecordMetrics =
          this.shouldRecordSystemMetrics(systemMetrics);

        if (shouldRecordMetrics) {
          this.setGauge('system_cpu_usage', systemMetrics.cpu.usage);
          this.setGauge('system_memory_usage', systemMetrics.memory.percentage);
          this.setGauge('system_memory_used', systemMetrics.memory.used);
        }

        // Clean up old metrics less frequently
        if (Date.now() % 300000 === 0) {
          // Every 5 minutes
          this.cleanupOldMetrics();
        }

        this.emit('monitoring:cycle_complete', systemMetrics);
      } catch (error) {
        Logger.error('Monitoring cycle failed:', error);
      }
    }, OPTIMIZED_MONITORING_INTERVAL);
  }

  private startAlerting(): void {
    this.alertingInterval = setInterval(() => {
      this.checkAlertConditions();
    }, this.ALERTING_INTERVAL);
  }

  // Track last recorded system metrics for intelligent sampling
  private lastRecordedMetrics: {
    cpu: number;
    memory: number;
    timestamp: number;
  } | null = null;

  /**
   * Determine if system metrics should be recorded based on change threshold and time
   */
  private shouldRecordSystemMetrics(systemMetrics: any): boolean {
    const now = Date.now();
    const FORCE_RECORD_INTERVAL = 120000; // Force record every 2 minutes
    const CHANGE_THRESHOLD = 5; // Record if metrics change by more than 5%

    // Always record if we haven't recorded anything yet
    if (!this.lastRecordedMetrics) {
      this.lastRecordedMetrics = {
        cpu: systemMetrics.cpu.usage,
        memory: systemMetrics.memory.percentage,
        timestamp: now,
      };
      return true;
    }

    // Force record if it's been too long
    if (now - this.lastRecordedMetrics.timestamp > FORCE_RECORD_INTERVAL) {
      this.lastRecordedMetrics = {
        cpu: systemMetrics.cpu.usage,
        memory: systemMetrics.memory.percentage,
        timestamp: now,
      };
      return true;
    }

    // Record if metrics have changed significantly
    const cpuChange = Math.abs(
      systemMetrics.cpu.usage - this.lastRecordedMetrics.cpu,
    );
    const memoryChange = Math.abs(
      systemMetrics.memory.percentage - this.lastRecordedMetrics.memory,
    );

    if (cpuChange > CHANGE_THRESHOLD || memoryChange > CHANGE_THRESHOLD) {
      this.lastRecordedMetrics = {
        cpu: systemMetrics.cpu.usage,
        memory: systemMetrics.memory.percentage,
        timestamp: now,
      };
      return true;
    }

    return false;
  }

  private checkAlertConditions(): void {
    // Check for high error rates
    const errorRate = this.getMetricRate('errors_total');
    if (errorRate && errorRate > 10) {
      // More than 10 errors per second
      this.createAlert({
        level: 'error',
        title: 'High Error Rate',
        message: `Error rate is ${errorRate.toFixed(2)} errors/second`,
        source: 'monitoring',
        metadata: { errorRate },
      });
    }

    // Check for high memory usage
    const memoryUsage = this.getMetricValue('system_memory_usage');
    if (memoryUsage && memoryUsage > 90) {
      this.createAlert({
        level: 'warning',
        title: 'High Memory Usage',
        message: `Memory usage is ${memoryUsage.toFixed(1)}%`,
        source: 'monitoring',
        metadata: { memoryUsage },
      });
    }
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.METRIC_RETENTION_TIME);

    for (const [name, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(
        (metric) => metric.timestamp >= cutoff,
      );
      this.metrics.set(name, filteredMetrics);
    }
  }

  /**
   * Shutdown monitoring service
   */
  public shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.alertingInterval) {
      clearInterval(this.alertingInterval);
    }

    Logger.info('📊 Monitoring Service shutdown complete');
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

export { monitoringService };
export default MonitoringService;
