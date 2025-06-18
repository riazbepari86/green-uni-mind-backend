import { featureToggleService } from './FeatureToggleService';
import { batchOperationsService } from './BatchOperationsService';
import { redisOptimizationService } from './RedisOptimizationService';

/**
 * Conservative Redis configuration to minimize usage and stay within free tier limits
 */
export class RedisConservativeConfig {
  static initialize(): void {
    console.log('🔧 Applying conservative Redis configuration...');

    // Set conservative optimization mode by default
    featureToggleService.setOptimizationMode('conservative');

    // Configure batch operations for minimal Redis usage
    batchOperationsService.updateConfig({
      maxBatchSize: 20, // Small batches
      batchTimeout: 300, // Longer timeout to batch more operations
      enableCompression: true,
      priorityQueues: true
    });

    // Configure Redis optimization for conservative usage
    redisOptimizationService.updateConfig({
      circuitBreakerThreshold: 3, // Fail fast
      circuitBreakerTimeout: 60000, // 1 minute timeout
      batchSize: 20, // Small batch size
      batchTimeout: 300, // Longer timeout
      enableCompression: true,
      compressionThreshold: 256 // Compress smaller values
    });

    // Disable non-essential features
    const nonEssentialFeatures = [
      'performance_monitoring',
      'api_metrics_tracking',
      'cache_statistics',
      'popular_content_tracking',
      'detailed_logging',
      'cache_warming',
      'invalidation_tracking',
      'connection_metrics'
    ];

    nonEssentialFeatures.forEach(feature => {
      featureToggleService.setFeatureEnabled(feature, false);
    });

    // Disable Redis usage monitoring to reduce Redis operations
    try {
      const { redisUsageMonitor } = require('../monitoring/RedisUsageMonitor');
      redisUsageMonitor.stopMonitoring();
      console.log('📵 Redis usage monitoring disabled to reduce Redis operations');
    } catch (error) {
      // Ignore if monitoring service not available
    }

    console.log('✅ Conservative Redis configuration applied');
    console.log('📊 Only critical features enabled: auth_caching, otp_storage, session_management');
    console.log('📦 Batch size reduced to 20, timeout increased to 300ms');
    console.log('🗜️ Compression enabled for values > 256 bytes');
    console.log('📵 Redis monitoring disabled to minimize operations');
  }

  static getRecommendations(): string[] {
    return [
      '🔧 Conservative mode enabled - only critical features active',
      '📦 Small batch sizes (20) to minimize Redis operations',
      '🗜️ Aggressive compression for values > 256 bytes',
      '⏱️ Longer batch timeouts (300ms) to group more operations',
      '🚫 Non-essential monitoring and tracking disabled',
      '💾 Prefer memory caching over Redis when possible',
      '🎯 Focus on auth, OTP, and session data only'
    ];
  }

  static getStatus(): {
    mode: string;
    enabledFeatures: string[];
    disabledFeatures: string[];
    batchConfig: any;
  } {
    const featureStates = featureToggleService.getFeatureStates();
    const enabledFeatures = Object.entries(featureStates)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);
    
    const disabledFeatures = Object.entries(featureStates)
      .filter(([, enabled]) => !enabled)
      .map(([name]) => name);

    return {
      mode: featureToggleService.generateOptimizationReport().currentMode,
      enabledFeatures,
      disabledFeatures,
      batchConfig: batchOperationsService.getConfig()
    };
  }
}

export const redisConservativeConfig = RedisConservativeConfig;
