#!/usr/bin/env node

import { Logger } from '../config/logger';
// Database connection will be mocked for validation
import AnalyticsService from '../services/analytics/AnalyticsService';
import ActivityTrackingService from '../services/activity/ActivityTrackingService';
import MessagingService from '../services/messaging/MessagingService';
import EnhancedCacheService from '../services/cache/EnhancedCacheService';
import EnhancedRateLimitService from '../services/rateLimit/EnhancedRateLimitService';
import PerformanceMonitoringService from '../services/monitoring/PerformanceMonitoringService';
import { ActivityType, ActivityPriority } from '../modules/Analytics/analytics.interface';

/**
 * Comprehensive validation of all enhanced features
 */
class EnhancedFeaturesValidator {
  private analyticsService: AnalyticsService;
  private activityTrackingService: ActivityTrackingService;
  private messagingService: MessagingService;
  private performanceService: PerformanceMonitoringService;

  constructor() {
    this.analyticsService = new AnalyticsService();
    this.activityTrackingService = new ActivityTrackingService();
    this.messagingService = new MessagingService();
    this.performanceService = PerformanceMonitoringService.getInstance();
  }

  /**
   * Run all validation tests
   */
  public async validateAll(): Promise<{
    analytics: boolean;
    activityTracking: boolean;
    messaging: boolean;
    caching: boolean;
    rateLimiting: boolean;
    performance: boolean;
    overall: boolean;
  }> {
    const results = {
      analytics: false,
      activityTracking: false,
      messaging: false,
      caching: false,
      rateLimiting: false,
      performance: false,
      overall: false
    };

    try {
      Logger.info('🧪 Starting enhanced features validation...');

      // Database connection mocked for validation

      // Test analytics service
      results.analytics = await this.validateAnalytics();

      // Test activity tracking
      results.activityTracking = await this.validateActivityTracking();

      // Test messaging service
      results.messaging = await this.validateMessaging();

      // Test caching
      results.caching = await this.validateCaching();

      // Test rate limiting
      results.rateLimiting = await this.validateRateLimiting();

      // Test performance monitoring
      results.performance = await this.validatePerformanceMonitoring();

      // Overall result
      results.overall = Object.values(results).every(result => result === true);

      Logger.info('✅ Enhanced features validation completed');
      return results;

    } catch (error) {
      Logger.error('❌ Enhanced features validation failed:', error);
      return results;
    }
  }

  /**
   * Validate analytics service
   */
  private async validateAnalytics(): Promise<boolean> {
    try {
      Logger.info('🔍 Validating analytics service...');

      const testTeacherId = '507f1f77bcf86cd799439011';
      const testCourseId = '507f1f77bcf86cd799439012';

      // Test enrollment statistics
      const enrollmentStats = await this.analyticsService.getEnrollmentStatistics(testTeacherId, 'monthly');
      if (!enrollmentStats || typeof enrollmentStats.totalEnrollments !== 'number') {
        throw new Error('Enrollment statistics validation failed');
      }

      // Test engagement metrics
      const engagementMetrics = await this.analyticsService.getStudentEngagementSummary(testTeacherId);
      if (!engagementMetrics || typeof engagementMetrics.totalActiveStudents !== 'number') {
        throw new Error('Engagement metrics validation failed');
      }

      // Test revenue analytics
      const revenueAnalytics = await this.analyticsService.getRevenueAnalyticsDetailed(testTeacherId, 'monthly');
      if (!revenueAnalytics || typeof revenueAnalytics.totalRevenue !== 'number') {
        throw new Error('Revenue analytics validation failed');
      }

      // Test performance metrics
      const performanceMetrics = await this.analyticsService.getPerformanceMetricsDetailed(testTeacherId, 'monthly');
      if (!performanceMetrics || typeof performanceMetrics.averageRating !== 'number') {
        throw new Error('Performance metrics validation failed');
      }

      Logger.info('✅ Analytics service validation passed');
      return true;
    } catch (error) {
      Logger.error('❌ Analytics service validation failed:', error);
      return false;
    }
  }

  /**
   * Validate activity tracking service
   */
  private async validateActivityTracking(): Promise<boolean> {
    try {
      Logger.info('🔍 Validating activity tracking service...');

      const testTeacherId = '507f1f77bcf86cd799439011';
      const testCourseId = '507f1f77bcf86cd799439012';
      const testStudentId = '507f1f77bcf86cd799439013';

      // Test activity creation
      const activity = await this.activityTrackingService.trackEnrollment(
        testTeacherId,
        testCourseId,
        testStudentId
      );

      if (!activity || activity.type !== ActivityType.ENROLLMENT) {
        throw new Error('Activity creation validation failed');
      }

      // Test activity retrieval with filters
      const activitiesResult = await this.activityTrackingService.getActivitiesWithFilters(testTeacherId, {
        limit: 10,
        offset: 0,
        type: ActivityType.ENROLLMENT
      });

      if (!activitiesResult || !Array.isArray(activitiesResult.activities)) {
        throw new Error('Activity retrieval validation failed');
      }

      // Test activity statistics
      const stats = await this.activityTrackingService.getActivityStatistics(testTeacherId, 'weekly');
      if (!stats || typeof stats.totalActivities !== 'number') {
        throw new Error('Activity statistics validation failed');
      }

      Logger.info('✅ Activity tracking service validation passed');
      return true;
    } catch (error) {
      Logger.error('❌ Activity tracking service validation failed:', error);
      return false;
    }
  }

  /**
   * Validate messaging service
   */
  private async validateMessaging(): Promise<boolean> {
    try {
      Logger.info('🔍 Validating messaging service...');

      const testTeacherId = '507f1f77bcf86cd799439011';
      const testStudentId = '507f1f77bcf86cd799439013';

      // Test messaging statistics
      const messagingStats = await this.messagingService.getMessagingStatistics(testTeacherId, 'weekly');
      if (!messagingStats || typeof messagingStats.totalConversations !== 'number') {
        throw new Error('Messaging statistics validation failed');
      }

      // Test advanced search (mock)
      const searchResults = await this.messagingService.searchMessagesAdvanced(
        'test',
        'teacher',
        {
          query: 'test',
          limit: 10,
          offset: 0
        }
      );

      if (!searchResults || !Array.isArray(searchResults.messages)) {
        throw new Error('Advanced search validation failed');
      }

      Logger.info('✅ Messaging service validation passed');
      return true;
    } catch (error) {
      Logger.error('❌ Messaging service validation failed:', error);
      return false;
    }
  }

  /**
   * Validate caching service
   */
  private async validateCaching(): Promise<boolean> {
    try {
      Logger.info('🔍 Validating caching service...');

      const testKey = 'validation:test';
      const testData = { timestamp: new Date(), value: 'test' };

      // Test set operation
      const setResult = await EnhancedCacheService.set(testKey, testData, { ttl: 60 });
      if (!setResult) {
        throw new Error('Cache set operation failed');
      }

      // Test get operation
      const getData = await EnhancedCacheService.get<typeof testData>(testKey);
      if (!getData || (getData as any).value !== testData.value) {
        throw new Error('Cache get operation failed');
      }

      // Test multiple operations
      const msetResult = await EnhancedCacheService.mset([
        { key: 'test1', value: { data: 1 } },
        { key: 'test2', value: { data: 2 } }
      ]);
      if (!msetResult) {
        throw new Error('Cache mset operation failed');
      }

      const mgetResult = await EnhancedCacheService.mget(['test1', 'test2']);
      if (!mgetResult || mgetResult.length !== 2) {
        throw new Error('Cache mget operation failed');
      }

      // Test cache statistics
      const stats = EnhancedCacheService.getStats();
      if (typeof stats.hitRate !== 'number') {
        throw new Error('Cache statistics validation failed');
      }

      // Cleanup
      await EnhancedCacheService.del(testKey);
      await EnhancedCacheService.del('test1');
      await EnhancedCacheService.del('test2');

      Logger.info('✅ Caching service validation passed');
      return true;
    } catch (error) {
      Logger.error('❌ Caching service validation failed:', error);
      return false;
    }
  }

  /**
   * Validate rate limiting service
   */
  private async validateRateLimiting(): Promise<boolean> {
    try {
      Logger.info('🔍 Validating rate limiting service...');

      const testKey = 'validation:ratelimit:test';
      const config = {
        windowMs: 60000, // 1 minute
        maxRequests: 5,
        message: 'Test rate limit exceeded'
      };

      // Test rate limit check
      const rateLimitInfo = await EnhancedRateLimitService.checkRateLimit(testKey, config);
      if (typeof rateLimitInfo.remainingPoints !== 'number') {
        throw new Error('Rate limit check validation failed');
      }

      // Test rate limit status
      const status = await EnhancedRateLimitService.getRateLimitStatus(testKey, config);
      if (typeof status.totalHitsInWindow !== 'number') {
        throw new Error('Rate limit status validation failed');
      }

      // Test rate limit reset
      const resetResult = await EnhancedRateLimitService.resetRateLimit(testKey);
      if (typeof resetResult !== 'boolean') {
        throw new Error('Rate limit reset validation failed');
      }

      Logger.info('✅ Rate limiting service validation passed');
      return true;
    } catch (error) {
      Logger.error('❌ Rate limiting service validation failed:', error);
      return false;
    }
  }

  /**
   * Validate performance monitoring service
   */
  private async validatePerformanceMonitoring(): Promise<boolean> {
    try {
      Logger.info('🔍 Validating performance monitoring service...');

      // Test performance statistics
      const stats = this.performanceService.getStats();
      if (typeof stats.hitRate !== 'number') {
        throw new Error('Performance stats validation failed');
      }

      // Test system metrics
      const systemMetrics = await this.performanceService.getSystemMetrics();
      if (typeof systemMetrics.totalRequests !== 'number') {
        throw new Error('System metrics validation failed');
      }

      // Test stats reset
      this.performanceService.resetStats();
      const resetStats = this.performanceService.getStats();
      if (resetStats.hits !== 0 || resetStats.misses !== 0) {
        throw new Error('Performance stats reset validation failed');
      }

      Logger.info('✅ Performance monitoring service validation passed');
      return true;
    } catch (error) {
      Logger.error('❌ Performance monitoring service validation failed:', error);
      return false;
    }
  }

  /**
   * Generate validation report
   */
  public generateReport(results: any): void {
    Logger.info('📋 Enhanced Features Validation Report:');
    Logger.info('==========================================');
    
    Object.entries(results).forEach(([feature, passed]) => {
      const status = passed ? '✅ PASSED' : '❌ FAILED';
      Logger.info(`${feature.padEnd(20)}: ${status}`);
    });
    
    Logger.info('==========================================');
    Logger.info(`Overall Status: ${results.overall ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  }
}

// CLI execution
if (require.main === module) {
  const validator = new EnhancedFeaturesValidator();
  
  validator.validateAll()
    .then((results) => {
      validator.generateReport(results);
      process.exit(results.overall ? 0 : 1);
    })
    .catch((error) => {
      Logger.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

export default EnhancedFeaturesValidator;
