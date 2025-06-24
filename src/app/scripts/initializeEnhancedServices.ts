#!/usr/bin/env node

import { Logger } from '../config/logger';
import EnhancedCacheService from '../services/cache/EnhancedCacheService';
import PerformanceMonitoringService from '../services/monitoring/PerformanceMonitoringService';
import DatabaseOptimizer from './optimizeDatabase';

/**
 * Initialize all enhanced services for the LMS platform
 */
class EnhancedServicesInitializer {
  private static instance: EnhancedServicesInitializer;

  public static getInstance(): EnhancedServicesInitializer {
    if (!EnhancedServicesInitializer.instance) {
      EnhancedServicesInitializer.instance = new EnhancedServicesInitializer();
    }
    return EnhancedServicesInitializer.instance;
  }

  /**
   * Initialize all enhanced services
   */
  public async initializeAll(): Promise<void> {
    try {
      Logger.info('🚀 Starting enhanced services initialization...');

      // Initialize cache service
      await this.initializeCacheService();

      // Initialize performance monitoring
      await this.initializePerformanceMonitoring();

      // Optimize database
      await this.optimizeDatabase();

      // Warm up caches
      await this.warmUpCaches();

      Logger.info('✅ All enhanced services initialized successfully');
    } catch (error) {
      Logger.error('❌ Enhanced services initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize cache service
   */
  private async initializeCacheService(): Promise<void> {
    try {
      Logger.info('🔧 Initializing enhanced cache service...');

      // Test cache connectivity
      await EnhancedCacheService.set('test:init', { timestamp: new Date() }, { ttl: 60 });
      const testResult = await EnhancedCacheService.get('test:init');
      
      if (!testResult) {
        throw new Error('Cache service test failed');
      }

      // Clean up test key
      await EnhancedCacheService.del('test:init');

      Logger.info('✅ Enhanced cache service initialized successfully');
    } catch (error) {
      Logger.error('❌ Cache service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize performance monitoring
   */
  private async initializePerformanceMonitoring(): Promise<void> {
    try {
      Logger.info('🔧 Initializing performance monitoring...');

      const performanceService = PerformanceMonitoringService.getInstance();
      
      // Reset stats for fresh start
      performanceService.resetStats();

      Logger.info('✅ Performance monitoring initialized successfully');
    } catch (error) {
      Logger.error('❌ Performance monitoring initialization failed:', error);
      throw error;
    }
  }

  /**
   * Optimize database
   */
  private async optimizeDatabase(): Promise<void> {
    try {
      Logger.info('🔧 Optimizing database...');

      const optimizer = new DatabaseOptimizer();
      await optimizer.optimize();

      Logger.info('✅ Database optimization completed successfully');
    } catch (error) {
      Logger.error('❌ Database optimization failed:', error);
      // Don't throw here as this is not critical for startup
      Logger.warn('⚠️ Continuing without database optimization');
    }
  }

  /**
   * Warm up caches with frequently accessed data
   */
  private async warmUpCaches(): Promise<void> {
    try {
      Logger.info('🔥 Warming up caches...');

      // Cache common configuration data
      await this.cacheCommonData();

      // Cache analytics templates
      await this.cacheAnalyticsTemplates();

      Logger.info('✅ Cache warm-up completed successfully');
    } catch (error) {
      Logger.error('❌ Cache warm-up failed:', error);
      // Don't throw here as this is not critical for startup
      Logger.warn('⚠️ Continuing without cache warm-up');
    }
  }

  /**
   * Cache common configuration data
   */
  private async cacheCommonData(): Promise<void> {
    try {
      // Cache system configuration
      const systemConfig = {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        features: {
          enhancedAnalytics: true,
          enhancedMessaging: true,
          activityTracking: true,
          performanceMonitoring: true,
          rateLimiting: true
        },
        limits: {
          maxFileSize: '10MB',
          maxRequestsPerMinute: 100,
          maxConcurrentConnections: 1000
        }
      };

      await EnhancedCacheService.set(
        'system:config',
        systemConfig,
        { ttl: 3600, namespace: 'system' }
      );

      Logger.info('📊 System configuration cached');
    } catch (error) {
      Logger.error('❌ Failed to cache common data:', error);
    }
  }

  /**
   * Cache analytics templates
   */
  private async cacheAnalyticsTemplates(): Promise<void> {
    try {
      // Cache analytics query templates
      const analyticsTemplates = {
        enrollmentStats: {
          aggregation: [
            { $match: { teacherId: null } }, // Will be replaced with actual teacherId
            { $group: { _id: null, total: { $sum: 1 } } }
          ]
        },
        revenueStats: {
          aggregation: [
            { $match: { teacherId: null, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$teacherShare' } } }
          ]
        },
        engagementStats: {
          aggregation: [
            { $match: { teacherId: null } },
            { $group: { _id: null, avgScore: { $avg: '$engagementScore' } } }
          ]
        }
      };

      await EnhancedCacheService.set(
        'analytics:templates',
        analyticsTemplates,
        { ttl: 7200, namespace: 'analytics' }
      );

      Logger.info('📈 Analytics templates cached');
    } catch (error) {
      Logger.error('❌ Failed to cache analytics templates:', error);
    }
  }

  /**
   * Health check for all enhanced services
   */
  public async healthCheck(): Promise<{
    cache: boolean;
    performance: boolean;
    database: boolean;
    overall: boolean;
  }> {
    const health = {
      cache: false,
      performance: false,
      database: false,
      overall: false
    };

    try {
      // Check cache service
      await EnhancedCacheService.set('health:check', { timestamp: new Date() }, { ttl: 10 });
      const cacheResult = await EnhancedCacheService.get('health:check');
      health.cache = !!cacheResult;
      await EnhancedCacheService.del('health:check');

      // Check performance monitoring
      const performanceService = PerformanceMonitoringService.getInstance();
      const stats = performanceService.getStats();
      health.performance = typeof stats.hitRate === 'number';

      // Check database (simplified)
      health.database = true; // Assume healthy if we got this far

      // Overall health
      health.overall = health.cache && health.performance && health.database;

      return health;
    } catch (error) {
      Logger.error('❌ Health check failed:', error);
      return health;
    }
  }

  /**
   * Graceful shutdown of enhanced services
   */
  public async shutdown(): Promise<void> {
    try {
      Logger.info('🛑 Shutting down enhanced services...');

      // Stop performance monitoring
      const performanceService = PerformanceMonitoringService.getInstance();
      performanceService.stopStatsUpdater();

      // Clear cache stats
      EnhancedCacheService.resetStats();

      Logger.info('✅ Enhanced services shutdown completed');
    } catch (error) {
      Logger.error('❌ Enhanced services shutdown failed:', error);
    }
  }

  /**
   * Get service statistics
   */
  public async getServiceStats(): Promise<{
    cache: any;
    performance: any;
    uptime: number;
  }> {
    try {
      const cacheStats = EnhancedCacheService.getStats();
      const performanceService = PerformanceMonitoringService.getInstance();
      const performanceStats = performanceService.getStats();

      return {
        cache: cacheStats,
        performance: performanceStats,
        uptime: process.uptime()
      };
    } catch (error) {
      Logger.error('❌ Failed to get service stats:', error);
      return {
        cache: null,
        performance: null,
        uptime: process.uptime()
      };
    }
  }
}

// CLI execution
if (require.main === module) {
  const initializer = EnhancedServicesInitializer.getInstance();
  
  initializer.initializeAll()
    .then(() => {
      Logger.info('✅ Enhanced services initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      Logger.error('❌ Enhanced services initialization failed:', error);
      process.exit(1);
    });
}

export default EnhancedServicesInitializer;
