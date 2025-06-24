#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../config/logger");
// Database connection will be mocked for validation
const AnalyticsService_1 = __importDefault(require("../services/analytics/AnalyticsService"));
const ActivityTrackingService_1 = __importDefault(require("../services/activity/ActivityTrackingService"));
const MessagingService_1 = __importDefault(require("../services/messaging/MessagingService"));
const EnhancedCacheService_1 = __importDefault(require("../services/cache/EnhancedCacheService"));
const EnhancedRateLimitService_1 = __importDefault(require("../services/rateLimit/EnhancedRateLimitService"));
const PerformanceMonitoringService_1 = __importDefault(require("../services/monitoring/PerformanceMonitoringService"));
const analytics_interface_1 = require("../modules/Analytics/analytics.interface");
/**
 * Comprehensive validation of all enhanced features
 */
class EnhancedFeaturesValidator {
    constructor() {
        this.analyticsService = new AnalyticsService_1.default();
        this.activityTrackingService = new ActivityTrackingService_1.default();
        this.messagingService = new MessagingService_1.default();
        this.performanceService = PerformanceMonitoringService_1.default.getInstance();
    }
    /**
     * Run all validation tests
     */
    validateAll() {
        return __awaiter(this, void 0, void 0, function* () {
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
                logger_1.Logger.info('🧪 Starting enhanced features validation...');
                // Database connection mocked for validation
                // Test analytics service
                results.analytics = yield this.validateAnalytics();
                // Test activity tracking
                results.activityTracking = yield this.validateActivityTracking();
                // Test messaging service
                results.messaging = yield this.validateMessaging();
                // Test caching
                results.caching = yield this.validateCaching();
                // Test rate limiting
                results.rateLimiting = yield this.validateRateLimiting();
                // Test performance monitoring
                results.performance = yield this.validatePerformanceMonitoring();
                // Overall result
                results.overall = Object.values(results).every(result => result === true);
                logger_1.Logger.info('✅ Enhanced features validation completed');
                return results;
            }
            catch (error) {
                logger_1.Logger.error('❌ Enhanced features validation failed:', error);
                return results;
            }
        });
    }
    /**
     * Validate analytics service
     */
    validateAnalytics() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🔍 Validating analytics service...');
                const testTeacherId = '507f1f77bcf86cd799439011';
                const testCourseId = '507f1f77bcf86cd799439012';
                // Test enrollment statistics
                const enrollmentStats = yield this.analyticsService.getEnrollmentStatistics(testTeacherId, 'monthly');
                if (!enrollmentStats || typeof enrollmentStats.totalEnrollments !== 'number') {
                    throw new Error('Enrollment statistics validation failed');
                }
                // Test engagement metrics
                const engagementMetrics = yield this.analyticsService.getStudentEngagementSummary(testTeacherId);
                if (!engagementMetrics || typeof engagementMetrics.totalActiveStudents !== 'number') {
                    throw new Error('Engagement metrics validation failed');
                }
                // Test revenue analytics
                const revenueAnalytics = yield this.analyticsService.getRevenueAnalyticsDetailed(testTeacherId, 'monthly');
                if (!revenueAnalytics || typeof revenueAnalytics.totalRevenue !== 'number') {
                    throw new Error('Revenue analytics validation failed');
                }
                // Test performance metrics
                const performanceMetrics = yield this.analyticsService.getPerformanceMetricsDetailed(testTeacherId, 'monthly');
                if (!performanceMetrics || typeof performanceMetrics.averageRating !== 'number') {
                    throw new Error('Performance metrics validation failed');
                }
                logger_1.Logger.info('✅ Analytics service validation passed');
                return true;
            }
            catch (error) {
                logger_1.Logger.error('❌ Analytics service validation failed:', error);
                return false;
            }
        });
    }
    /**
     * Validate activity tracking service
     */
    validateActivityTracking() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🔍 Validating activity tracking service...');
                const testTeacherId = '507f1f77bcf86cd799439011';
                const testCourseId = '507f1f77bcf86cd799439012';
                const testStudentId = '507f1f77bcf86cd799439013';
                // Test activity creation
                const activity = yield this.activityTrackingService.trackEnrollment(testTeacherId, testCourseId, testStudentId);
                if (!activity || activity.type !== analytics_interface_1.ActivityType.ENROLLMENT) {
                    throw new Error('Activity creation validation failed');
                }
                // Test activity retrieval with filters
                const activitiesResult = yield this.activityTrackingService.getActivitiesWithFilters(testTeacherId, {
                    limit: 10,
                    offset: 0,
                    type: analytics_interface_1.ActivityType.ENROLLMENT
                });
                if (!activitiesResult || !Array.isArray(activitiesResult.activities)) {
                    throw new Error('Activity retrieval validation failed');
                }
                // Test activity statistics
                const stats = yield this.activityTrackingService.getActivityStatistics(testTeacherId, 'weekly');
                if (!stats || typeof stats.totalActivities !== 'number') {
                    throw new Error('Activity statistics validation failed');
                }
                logger_1.Logger.info('✅ Activity tracking service validation passed');
                return true;
            }
            catch (error) {
                logger_1.Logger.error('❌ Activity tracking service validation failed:', error);
                return false;
            }
        });
    }
    /**
     * Validate messaging service
     */
    validateMessaging() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🔍 Validating messaging service...');
                const testTeacherId = '507f1f77bcf86cd799439011';
                const testStudentId = '507f1f77bcf86cd799439013';
                // Test messaging statistics
                const messagingStats = yield this.messagingService.getMessagingStatistics(testTeacherId, 'weekly');
                if (!messagingStats || typeof messagingStats.totalConversations !== 'number') {
                    throw new Error('Messaging statistics validation failed');
                }
                // Test advanced search (mock)
                const searchResults = yield this.messagingService.searchMessagesAdvanced('test', 'teacher', {
                    query: 'test',
                    limit: 10,
                    offset: 0
                });
                if (!searchResults || !Array.isArray(searchResults.messages)) {
                    throw new Error('Advanced search validation failed');
                }
                logger_1.Logger.info('✅ Messaging service validation passed');
                return true;
            }
            catch (error) {
                logger_1.Logger.error('❌ Messaging service validation failed:', error);
                return false;
            }
        });
    }
    /**
     * Validate caching service
     */
    validateCaching() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🔍 Validating caching service...');
                const testKey = 'validation:test';
                const testData = { timestamp: new Date(), value: 'test' };
                // Test set operation
                const setResult = yield EnhancedCacheService_1.default.set(testKey, testData, { ttl: 60 });
                if (!setResult) {
                    throw new Error('Cache set operation failed');
                }
                // Test get operation
                const getData = yield EnhancedCacheService_1.default.get(testKey);
                if (!getData || getData.value !== testData.value) {
                    throw new Error('Cache get operation failed');
                }
                // Test multiple operations
                const msetResult = yield EnhancedCacheService_1.default.mset([
                    { key: 'test1', value: { data: 1 } },
                    { key: 'test2', value: { data: 2 } }
                ]);
                if (!msetResult) {
                    throw new Error('Cache mset operation failed');
                }
                const mgetResult = yield EnhancedCacheService_1.default.mget(['test1', 'test2']);
                if (!mgetResult || mgetResult.length !== 2) {
                    throw new Error('Cache mget operation failed');
                }
                // Test cache statistics
                const stats = EnhancedCacheService_1.default.getStats();
                if (typeof stats.hitRate !== 'number') {
                    throw new Error('Cache statistics validation failed');
                }
                // Cleanup
                yield EnhancedCacheService_1.default.del(testKey);
                yield EnhancedCacheService_1.default.del('test1');
                yield EnhancedCacheService_1.default.del('test2');
                logger_1.Logger.info('✅ Caching service validation passed');
                return true;
            }
            catch (error) {
                logger_1.Logger.error('❌ Caching service validation failed:', error);
                return false;
            }
        });
    }
    /**
     * Validate rate limiting service
     */
    validateRateLimiting() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🔍 Validating rate limiting service...');
                const testKey = 'validation:ratelimit:test';
                const config = {
                    windowMs: 60000, // 1 minute
                    maxRequests: 5,
                    message: 'Test rate limit exceeded'
                };
                // Test rate limit check
                const rateLimitInfo = yield EnhancedRateLimitService_1.default.checkRateLimit(testKey, config);
                if (typeof rateLimitInfo.remainingPoints !== 'number') {
                    throw new Error('Rate limit check validation failed');
                }
                // Test rate limit status
                const status = yield EnhancedRateLimitService_1.default.getRateLimitStatus(testKey, config);
                if (typeof status.totalHitsInWindow !== 'number') {
                    throw new Error('Rate limit status validation failed');
                }
                // Test rate limit reset
                const resetResult = yield EnhancedRateLimitService_1.default.resetRateLimit(testKey);
                if (typeof resetResult !== 'boolean') {
                    throw new Error('Rate limit reset validation failed');
                }
                logger_1.Logger.info('✅ Rate limiting service validation passed');
                return true;
            }
            catch (error) {
                logger_1.Logger.error('❌ Rate limiting service validation failed:', error);
                return false;
            }
        });
    }
    /**
     * Validate performance monitoring service
     */
    validatePerformanceMonitoring() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🔍 Validating performance monitoring service...');
                // Test performance statistics
                const stats = this.performanceService.getStats();
                if (typeof stats.hitRate !== 'number') {
                    throw new Error('Performance stats validation failed');
                }
                // Test system metrics
                const systemMetrics = yield this.performanceService.getSystemMetrics();
                if (typeof systemMetrics.totalRequests !== 'number') {
                    throw new Error('System metrics validation failed');
                }
                // Test stats reset
                this.performanceService.resetStats();
                const resetStats = this.performanceService.getStats();
                if (resetStats.hits !== 0 || resetStats.misses !== 0) {
                    throw new Error('Performance stats reset validation failed');
                }
                logger_1.Logger.info('✅ Performance monitoring service validation passed');
                return true;
            }
            catch (error) {
                logger_1.Logger.error('❌ Performance monitoring service validation failed:', error);
                return false;
            }
        });
    }
    /**
     * Generate validation report
     */
    generateReport(results) {
        logger_1.Logger.info('📋 Enhanced Features Validation Report:');
        logger_1.Logger.info('==========================================');
        Object.entries(results).forEach(([feature, passed]) => {
            const status = passed ? '✅ PASSED' : '❌ FAILED';
            logger_1.Logger.info(`${feature.padEnd(20)}: ${status}`);
        });
        logger_1.Logger.info('==========================================');
        logger_1.Logger.info(`Overall Status: ${results.overall ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
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
        logger_1.Logger.error('❌ Validation failed:', error);
        process.exit(1);
    });
}
exports.default = EnhancedFeaturesValidator;
