import { redisUsageAuditor } from '../redis/RedisUsageAuditor';
import { featureToggleService } from '../redis/FeatureToggleService';
import { hybridStorageService } from '../storage/HybridStorageService';
import { smartCacheService } from '../cache/SmartCacheService';

interface UsageAlert {
  id: string;
  type: 'memory' | 'connections' | 'operations' | 'keys';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  acknowledged: boolean;
  autoResolved: boolean;
}

interface UsageThresholds {
  memory: {
    warning: number; // 60%
    critical: number; // 80%
  };
  keys: {
    warning: number; // 8000 keys
    critical: number; // 12000 keys
  };
  connections: {
    warning: number; // 8 connections
    critical: number; // 10 connections
  };
  operationsPerMinute: {
    warning: number; // 1000 ops/min
    critical: number; // 2000 ops/min
  };
}

export class RedisUsageMonitor {
  private alerts: Map<string, UsageAlert> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private lastOperationCount = 0;
  private operationHistory: number[] = [];

  private thresholds: UsageThresholds = {
    memory: {
      warning: 60, // 60% of free tier limit
      critical: 80  // 80% of free tier limit
    },
    keys: {
      warning: 8000,   // 8K keys
      critical: 12000  // 12K keys
    },
    connections: {
      warning: 8,  // 8 connections
      critical: 10 // 10 connections (close to typical limits)
    },
    operationsPerMinute: {
      warning: 1000,  // 1K ops/min
      critical: 2000  // 2K ops/min
    }
  };

  constructor() {
    // DISABLED: Excessive Redis monitoring causing 121K+ ops/min
    console.log('📵 RedisUsageMonitor disabled to prevent excessive Redis operations');

    // Don't start monitoring automatically
    // this.startMonitoring();

    // Listen to feature toggle changes
    featureToggleService.onFeatureChange('performance_monitoring', (enabled) => {
      if (enabled) {
        console.log('⚠️ Performance monitoring requested but disabled to prevent Redis overload');
        // this.startMonitoring();
      } else {
        this.stopMonitoring();
      }
    });
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;

    console.log('📊 Starting Redis usage monitoring...');
    this.isMonitoring = true;

    // Monitor every 2 minutes to reduce Redis operations
    this.monitoringInterval = setInterval(async () => {
      await this.checkUsage();
    }, 120000); // 2 minutes instead of 30 seconds

    // Initial check after 10 seconds to let Redis connections stabilize
    setTimeout(() => {
      this.checkUsage();
    }, 10000);
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    console.log('📊 Stopping Redis usage monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private async checkUsage(): Promise<void> {
    try {
      // Get current usage metrics
      const healthCheck = await redisUsageAuditor.quickHealthCheck();
      const auditMetrics = await redisUsageAuditor.auditRedisUsage();

      // Check memory usage
      this.checkMemoryUsage(auditMetrics.memoryUsage.percentage);

      // Check key count
      this.checkKeyCount(auditMetrics.totalKeys);

      // Check connection count
      this.checkConnectionCount(auditMetrics.connectionStats.activeConnections);

      // Check operation rate
      this.checkOperationRate(auditMetrics.operationCounts.total_commands_processed || 0);

      // Auto-resolve alerts if conditions improve
      this.autoResolveAlerts(auditMetrics);

      // Trigger automatic optimizations if needed
      await this.triggerAutoOptimizations(healthCheck, auditMetrics);

    } catch (error) {
      console.error('Error in Redis usage monitoring:', error);
      
      // Create alert for monitoring failure
      this.createAlert({
        type: 'operations',
        severity: 'warning',
        message: 'Redis monitoring failed - connection issues possible',
        threshold: 0,
        currentValue: 0
      });
    }
  }

  private checkMemoryUsage(percentage: number): void {
    const alertId = 'memory-usage';
    
    if (percentage >= this.thresholds.memory.critical) {
      this.createAlert({
        type: 'memory',
        severity: 'critical',
        message: `Critical Redis memory usage: ${percentage.toFixed(1)}%`,
        threshold: this.thresholds.memory.critical,
        currentValue: percentage
      }, alertId);
    } else if (percentage >= this.thresholds.memory.warning) {
      this.createAlert({
        type: 'memory',
        severity: 'warning',
        message: `High Redis memory usage: ${percentage.toFixed(1)}%`,
        threshold: this.thresholds.memory.warning,
        currentValue: percentage
      }, alertId);
    } else {
      this.resolveAlert(alertId);
    }
  }

  private checkKeyCount(keyCount: number): void {
    const alertId = 'key-count';
    
    if (keyCount >= this.thresholds.keys.critical) {
      this.createAlert({
        type: 'keys',
        severity: 'critical',
        message: `Critical Redis key count: ${keyCount.toLocaleString()}`,
        threshold: this.thresholds.keys.critical,
        currentValue: keyCount
      }, alertId);
    } else if (keyCount >= this.thresholds.keys.warning) {
      this.createAlert({
        type: 'keys',
        severity: 'warning',
        message: `High Redis key count: ${keyCount.toLocaleString()}`,
        threshold: this.thresholds.keys.warning,
        currentValue: keyCount
      }, alertId);
    } else {
      this.resolveAlert(alertId);
    }
  }

  private checkConnectionCount(connectionCount: number): void {
    const alertId = 'connection-count';
    
    if (connectionCount >= this.thresholds.connections.critical) {
      this.createAlert({
        type: 'connections',
        severity: 'critical',
        message: `Critical Redis connection count: ${connectionCount}`,
        threshold: this.thresholds.connections.critical,
        currentValue: connectionCount
      }, alertId);
    } else if (connectionCount >= this.thresholds.connections.warning) {
      this.createAlert({
        type: 'connections',
        severity: 'warning',
        message: `High Redis connection count: ${connectionCount}`,
        threshold: this.thresholds.connections.warning,
        currentValue: connectionCount
      }, alertId);
    } else {
      this.resolveAlert(alertId);
    }
  }

  private checkOperationRate(totalOperations: number): void {
    const alertId = 'operation-rate';
    
    // Calculate operations per minute
    const currentOps = totalOperations - this.lastOperationCount;
    this.operationHistory.push(currentOps);
    
    // Keep only last 2 minutes of data (4 samples at 30s intervals)
    if (this.operationHistory.length > 4) {
      this.operationHistory.shift();
    }
    
    // Calculate average operations per minute
    const avgOpsPerMinute = this.operationHistory.length > 0 
      ? (this.operationHistory.reduce((a, b) => a + b, 0) / this.operationHistory.length) * 2 // *2 for per minute
      : 0;
    
    this.lastOperationCount = totalOperations;
    
    if (avgOpsPerMinute >= this.thresholds.operationsPerMinute.critical) {
      this.createAlert({
        type: 'operations',
        severity: 'critical',
        message: `Critical Redis operation rate: ${avgOpsPerMinute.toFixed(0)} ops/min`,
        threshold: this.thresholds.operationsPerMinute.critical,
        currentValue: avgOpsPerMinute
      }, alertId);
    } else if (avgOpsPerMinute >= this.thresholds.operationsPerMinute.warning) {
      this.createAlert({
        type: 'operations',
        severity: 'warning',
        message: `High Redis operation rate: ${avgOpsPerMinute.toFixed(0)} ops/min`,
        threshold: this.thresholds.operationsPerMinute.warning,
        currentValue: avgOpsPerMinute
      }, alertId);
    } else {
      this.resolveAlert(alertId);
    }
  }

  private createAlert(alertData: Omit<UsageAlert, 'id' | 'timestamp' | 'acknowledged' | 'autoResolved'>, customId?: string): void {
    const alertId = customId || `${alertData.type}-${Date.now()}`;
    
    // Don't create duplicate alerts
    if (this.alerts.has(alertId)) {
      const existing = this.alerts.get(alertId)!;
      existing.currentValue = alertData.currentValue;
      existing.timestamp = new Date();
      return;
    }

    const alert: UsageAlert = {
      id: alertId,
      ...alertData,
      timestamp: new Date(),
      acknowledged: false,
      autoResolved: false
    };

    this.alerts.set(alertId, alert);
    console.log(`🚨 Redis Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);

    // Don't store alerts in Redis to reduce usage - keep in memory only
    // hybridStorageService.set(
    //   `alert:${alertId}`,
    //   alert,
    //   { ttl: 86400, priority: 'high' } // 24 hours
    // ).catch(error => {
    //   console.error('Error storing alert:', error);
    // });
  }

  private resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.autoResolved) {
      alert.autoResolved = true;
      alert.timestamp = new Date();
      console.log(`✅ Redis Alert Resolved: ${alert.message}`);
      
      // Remove from active alerts after a delay
      setTimeout(() => {
        this.alerts.delete(alertId);
      }, 60000); // Remove after 1 minute
    }
  }

  private autoResolveAlerts(metrics: any): void {
    // Auto-resolve alerts when conditions improve
    for (const [alertId, alert] of this.alerts) {
      if (alert.autoResolved) continue;

      switch (alert.type) {
        case 'memory':
          if (metrics.memoryUsage.percentage < this.thresholds.memory.warning) {
            this.resolveAlert(alertId);
          }
          break;
        case 'keys':
          if (metrics.totalKeys < this.thresholds.keys.warning) {
            this.resolveAlert(alertId);
          }
          break;
        case 'connections':
          if (metrics.connectionStats.activeConnections < this.thresholds.connections.warning) {
            this.resolveAlert(alertId);
          }
          break;
      }
    }
  }

  private async triggerAutoOptimizations(healthCheck: any, metrics: any): Promise<void> {
    // Trigger automatic optimizations based on usage
    if (healthCheck.status === 'critical') {
      console.log('🚨 Triggering emergency optimizations');
      
      // Enable aggressive mode
      featureToggleService.setOptimizationMode('aggressive');
      
      // Clear non-critical caches
      await smartCacheService.clearL1();
      
      // Clear memory cache
      hybridStorageService.clearMemory();
      
    } else if (healthCheck.status === 'warning') {
      console.log('⚠️ Triggering conservative optimizations');
      
      // Enable conservative mode
      featureToggleService.setOptimizationMode('conservative');
    }
  }

  // Public methods
  getActiveAlerts(): UsageAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.autoResolved);
  }

  getResolvedAlerts(): UsageAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.autoResolved);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`✅ Alert acknowledged: ${alertId}`);
      return true;
    }
    return false;
  }

  updateThresholds(newThresholds: Partial<UsageThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('🔧 Redis usage thresholds updated:', newThresholds);
  }

  getThresholds(): UsageThresholds {
    return { ...this.thresholds };
  }

  async generateUsageReport(): Promise<{
    currentUsage: any;
    alerts: {
      active: number;
      resolved: number;
      critical: number;
      warning: number;
    };
    recommendations: string[];
    optimizationStatus: string;
  }> {
    const currentUsage = await redisUsageAuditor.auditRedisUsage();
    const activeAlerts = this.getActiveAlerts();
    const resolvedAlerts = this.getResolvedAlerts();

    const alertCounts = {
      active: activeAlerts.length,
      resolved: resolvedAlerts.length,
      critical: activeAlerts.filter(a => a.severity === 'critical').length,
      warning: activeAlerts.filter(a => a.severity === 'warning').length
    };

    const recommendations = [
      ...currentUsage.recommendations,
      ...(alertCounts.critical > 0 ? ['🚨 Critical alerts detected - immediate action required'] : []),
      ...(alertCounts.warning > 2 ? ['⚠️ Multiple warnings - consider optimization'] : [])
    ];

    return {
      currentUsage,
      alerts: alertCounts,
      recommendations,
      optimizationStatus: featureToggleService.generateOptimizationReport().currentMode
    };
  }

  // Cleanup method
  cleanup(): void {
    this.stopMonitoring();
    this.alerts.clear();
    console.log('🧹 Redis usage monitor cleaned up');
  }
}

export const redisUsageMonitor = new RedisUsageMonitor();
