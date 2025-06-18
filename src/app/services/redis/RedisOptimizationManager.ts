import { redisUsageAuditor } from './RedisUsageAuditor';
import { redisUsageMonitor } from '../monitoring/RedisUsageMonitor';
import { featureToggleService } from './FeatureToggleService';
import { smartCacheService } from '../cache/SmartCacheService';
import { hybridStorageService } from '../storage/HybridStorageService';
import { optimizedAuthCacheService } from '../auth/OptimizedAuthCacheService';
import { batchOperationsService } from './BatchOperationsService';
import { redisOptimizationService } from './RedisOptimizationService';
import { optimizedRedisService } from './OptimizedRedisService';

interface OptimizationReport {
  timestamp: string;
  redisUsage: {
    memoryPercentage: number;
    totalKeys: number;
    connectionCount: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  optimizations: {
    mode: string;
    enabledFeatures: number;
    disabledFeatures: number;
    cacheHitRate: number;
    batchOperationsQueued: number;
  };
  recommendations: string[];
  alerts: {
    active: number;
    critical: number;
    warning: number;
  };
  performance: {
    connectionOptimization: string;
    cachingStrategy: string;
    storageStrategy: string;
  };
}

export class RedisOptimizationManager {
  private static instance: RedisOptimizationManager;
  private isInitialized = false;
  private optimizationInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): RedisOptimizationManager {
    if (!RedisOptimizationManager.instance) {
      RedisOptimizationManager.instance = new RedisOptimizationManager();
    }
    return RedisOptimizationManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🚀 Initializing Redis Optimization Manager...');

    try {
      // Initialize all services
      await this.initializeServices();

      // Start monitoring and optimization
      this.startOptimizationLoop();

      // Perform initial optimization
      await this.performInitialOptimization();

      this.isInitialized = true;
      console.log('✅ Redis Optimization Manager initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Redis Optimization Manager:', error);
      throw error;
    }
  }

  private async initializeServices(): Promise<void> {
    // Services are already initialized via their constructors
    // This method can be used for any additional setup
    console.log('🔧 All optimization services initialized');
  }

  private startOptimizationLoop(): void {
    // Run optimization checks every 2 minutes
    this.optimizationInterval = setInterval(async () => {
      await this.performOptimizationCheck();
    }, 120000);

    console.log('📊 Optimization monitoring loop started');
  }

  private async performInitialOptimization(): Promise<void> {
    console.log('🔧 Performing initial Redis optimization...');

    try {
      // Get current usage
      const healthCheck = await redisUsageAuditor.quickHealthCheck();
      
      // Set initial optimization mode based on current usage
      if (healthCheck.memoryPercentage > 70) {
        featureToggleService.setOptimizationMode('conservative');
        console.log('⚠️ High initial Redis usage - starting in conservative mode');
      } else if (healthCheck.memoryPercentage > 85) {
        featureToggleService.setOptimizationMode('aggressive');
        console.log('🚨 Critical initial Redis usage - starting in aggressive mode');
      } else {
        featureToggleService.setOptimizationMode('normal');
        console.log('✅ Normal initial Redis usage - starting in normal mode');
      }

      // Warm critical caches
      await hybridStorageService.warmCriticalData();

      // Configure batch operations for optimal performance
      batchOperationsService.updateConfig({
        maxBatchSize: healthCheck.memoryPercentage > 70 ? 50 : 100,
        batchTimeout: healthCheck.memoryPercentage > 70 ? 100 : 50,
        enableCompression: true,
        priorityQueues: true
      });

    } catch (error) {
      console.error('❌ Error in initial optimization:', error);
    }
  }

  private async performOptimizationCheck(): Promise<void> {
    try {
      // Get current metrics
      const healthCheck = await redisUsageAuditor.quickHealthCheck();
      const activeAlerts = redisUsageMonitor.getActiveAlerts();
      
      // Auto-optimize based on current state
      await this.autoOptimize(healthCheck, activeAlerts);

      // Log optimization status
      console.log(`📊 Optimization check: ${healthCheck.status} (${healthCheck.memoryPercentage.toFixed(1)}% memory, ${activeAlerts.length} alerts)`);

    } catch (error) {
      console.error('❌ Error in optimization check:', error);
    }
  }

  private async autoOptimize(healthCheck: any, alerts: any[]): Promise<void> {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = alerts.filter(a => a.severity === 'warning').length;

    // Determine optimization strategy
    if (healthCheck.status === 'critical' || criticalAlerts > 0) {
      await this.enableEmergencyOptimization();
    } else if (healthCheck.status === 'warning' || warningAlerts > 2) {
      await this.enableConservativeOptimization();
    } else if (healthCheck.memoryPercentage < 40 && alerts.length === 0) {
      await this.enableNormalOptimization();
    }
  }

  private async enableEmergencyOptimization(): Promise<void> {
    console.log('🚨 Enabling emergency optimization');

    // Set aggressive mode
    featureToggleService.setOptimizationMode('aggressive');

    // Clear non-critical caches
    await smartCacheService.clearL1();
    hybridStorageService.clearMemory();

    // Reduce batch sizes
    batchOperationsService.updateConfig({
      maxBatchSize: 25,
      batchTimeout: 200,
      enableCompression: true
    });

    // Update circuit breaker settings for faster failure
    redisOptimizationService.updateConfig({
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 60000
    });
  }

  private async enableConservativeOptimization(): Promise<void> {
    console.log('⚠️ Enabling conservative optimization');

    // Set conservative mode
    featureToggleService.setOptimizationMode('conservative');

    // Optimize batch operations
    batchOperationsService.updateConfig({
      maxBatchSize: 50,
      batchTimeout: 100,
      enableCompression: true
    });
  }

  private async enableNormalOptimization(): Promise<void> {
    console.log('✅ Enabling normal optimization');

    // Set normal mode
    featureToggleService.setOptimizationMode('normal');

    // Optimize batch operations for performance
    batchOperationsService.updateConfig({
      maxBatchSize: 100,
      batchTimeout: 50,
      enableCompression: false
    });
  }

  // Generate comprehensive optimization report
  async generateOptimizationReport(): Promise<OptimizationReport> {
    try {
      const [
        healthCheck,
        usageMetrics,
        activeAlerts,
        featureReport,
        cacheStats,
        batchStats,
        authStats
      ] = await Promise.all([
        redisUsageAuditor.quickHealthCheck(),
        redisUsageAuditor.auditRedisUsage(),
        redisUsageMonitor.getActiveAlerts(),
        featureToggleService.generateOptimizationReport(),
        smartCacheService.getStats(),
        batchOperationsService.getStats(),
        optimizedAuthCacheService.getStats()
      ]);

      const report: OptimizationReport = {
        timestamp: new Date().toISOString(),
        redisUsage: {
          memoryPercentage: healthCheck.memoryPercentage,
          totalKeys: healthCheck.totalKeys,
          connectionCount: usageMetrics.connectionStats.activeConnections,
          status: healthCheck.status
        },
        optimizations: {
          mode: featureReport.currentMode,
          enabledFeatures: featureReport.enabledFeatures,
          disabledFeatures: featureReport.disabledFeatures,
          cacheHitRate: cacheStats.total.hitRate,
          batchOperationsQueued: batchStats.queueSize
        },
        recommendations: [
          ...usageMetrics.recommendations,
          ...featureReport.recommendations,
          ...(healthCheck.status === 'critical' ? ['🚨 Immediate action required - Redis usage critical'] : []),
          ...(activeAlerts.length > 3 ? ['⚠️ Multiple alerts active - review optimization settings'] : [])
        ],
        alerts: {
          active: activeAlerts.length,
          critical: activeAlerts.filter(a => a.severity === 'critical').length,
          warning: activeAlerts.filter(a => a.severity === 'warning').length
        },
        performance: {
          connectionOptimization: 'Single client with prefixes (2 connections total)',
          cachingStrategy: 'L1 (Memory) + L2 (Redis) hybrid with smart TTL',
          storageStrategy: 'Redis + Memory + MongoDB fallback'
        }
      };

      return report;

    } catch (error) {
      console.error('❌ Error generating optimization report:', error);
      throw error;
    }
  }

  // Manual optimization trigger
  async triggerOptimization(mode: 'normal' | 'conservative' | 'aggressive'): Promise<void> {
    console.log(`🔧 Manually triggering ${mode} optimization`);

    switch (mode) {
      case 'aggressive':
        await this.enableEmergencyOptimization();
        break;
      case 'conservative':
        await this.enableConservativeOptimization();
        break;
      case 'normal':
        await this.enableNormalOptimization();
        break;
    }
  }

  // Get optimization status
  getOptimizationStatus(): {
    initialized: boolean;
    mode: string;
    monitoring: boolean;
    services: {
      redisOptimization: boolean;
      smartCache: boolean;
      hybridStorage: boolean;
      batchOperations: boolean;
      usageMonitoring: boolean;
    };
  } {
    return {
      initialized: this.isInitialized,
      mode: featureToggleService.generateOptimizationReport().currentMode,
      monitoring: !!this.optimizationInterval,
      services: {
        redisOptimization: true,
        smartCache: true,
        hybridStorage: true,
        batchOperations: true,
        usageMonitoring: true
      }
    };
  }

  // Cleanup and shutdown
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Redis Optimization Manager...');

    try {
      // Stop optimization loop
      if (this.optimizationInterval) {
        clearInterval(this.optimizationInterval);
        this.optimizationInterval = null;
      }

      // Cleanup services
      redisUsageMonitor.cleanup();
      batchOperationsService.cleanup();
      await hybridStorageService.clearAll();
      await optimizedRedisService.shutdown();

      this.isInitialized = false;
      console.log('✅ Redis Optimization Manager shutdown complete');

    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }

  // Health check for the optimization manager itself
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    lastOptimization: string;
  }> {
    try {
      const redisHealth = await optimizedRedisService.healthCheck();
      
      return {
        status: redisHealth.status,
        services: {
          redisOptimization: redisHealth.primaryClient,
          smartCache: true,
          hybridStorage: true,
          batchOperations: batchOperationsService.getStats().queueSize < 1000,
          usageMonitoring: redisUsageMonitor.getActiveAlerts().length < 5
        },
        lastOptimization: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        services: {
          redisOptimization: false,
          smartCache: false,
          hybridStorage: false,
          batchOperations: false,
          usageMonitoring: false
        },
        lastOptimization: 'unknown'
      };
    }
  }
}

export const redisOptimizationManager = RedisOptimizationManager.getInstance();
