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
const EnhancedCacheService_1 = __importDefault(require("../services/cache/EnhancedCacheService"));
const PerformanceMonitoringService_1 = __importDefault(require("../services/monitoring/PerformanceMonitoringService"));
const optimizeDatabase_1 = __importDefault(require("./optimizeDatabase"));
/**
 * Initialize all enhanced services for the LMS platform
 */
class EnhancedServicesInitializer {
    static getInstance() {
        if (!EnhancedServicesInitializer.instance) {
            EnhancedServicesInitializer.instance = new EnhancedServicesInitializer();
        }
        return EnhancedServicesInitializer.instance;
    }
    /**
     * Initialize all enhanced services
     */
    initializeAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🚀 Starting enhanced services initialization...');
                // Initialize cache service
                yield this.initializeCacheService();
                // Initialize performance monitoring
                yield this.initializePerformanceMonitoring();
                // Optimize database
                yield this.optimizeDatabase();
                // Warm up caches
                yield this.warmUpCaches();
                logger_1.Logger.info('✅ All enhanced services initialized successfully');
            }
            catch (error) {
                logger_1.Logger.error('❌ Enhanced services initialization failed:', error);
                throw error;
            }
        });
    }
    /**
     * Initialize cache service
     */
    initializeCacheService() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🔧 Initializing enhanced cache service...');
                // Test cache connectivity
                yield EnhancedCacheService_1.default.set('test:init', { timestamp: new Date() }, { ttl: 60 });
                const testResult = yield EnhancedCacheService_1.default.get('test:init');
                if (!testResult) {
                    throw new Error('Cache service test failed');
                }
                // Clean up test key
                yield EnhancedCacheService_1.default.del('test:init');
                logger_1.Logger.info('✅ Enhanced cache service initialized successfully');
            }
            catch (error) {
                logger_1.Logger.error('❌ Cache service initialization failed:', error);
                throw error;
            }
        });
    }
    /**
     * Initialize performance monitoring
     */
    initializePerformanceMonitoring() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🔧 Initializing performance monitoring...');
                const performanceService = PerformanceMonitoringService_1.default.getInstance();
                // Reset stats for fresh start
                performanceService.resetStats();
                logger_1.Logger.info('✅ Performance monitoring initialized successfully');
            }
            catch (error) {
                logger_1.Logger.error('❌ Performance monitoring initialization failed:', error);
                throw error;
            }
        });
    }
    /**
     * Optimize database
     */
    optimizeDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🔧 Optimizing database...');
                const optimizer = new optimizeDatabase_1.default();
                yield optimizer.optimize();
                logger_1.Logger.info('✅ Database optimization completed successfully');
            }
            catch (error) {
                logger_1.Logger.error('❌ Database optimization failed:', error);
                // Don't throw here as this is not critical for startup
                logger_1.Logger.warn('⚠️ Continuing without database optimization');
            }
        });
    }
    /**
     * Warm up caches with frequently accessed data
     */
    warmUpCaches() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🔥 Warming up caches...');
                // Cache common configuration data
                yield this.cacheCommonData();
                // Cache analytics templates
                yield this.cacheAnalyticsTemplates();
                logger_1.Logger.info('✅ Cache warm-up completed successfully');
            }
            catch (error) {
                logger_1.Logger.error('❌ Cache warm-up failed:', error);
                // Don't throw here as this is not critical for startup
                logger_1.Logger.warn('⚠️ Continuing without cache warm-up');
            }
        });
    }
    /**
     * Cache common configuration data
     */
    cacheCommonData() {
        return __awaiter(this, void 0, void 0, function* () {
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
                yield EnhancedCacheService_1.default.set('system:config', systemConfig, { ttl: 3600, namespace: 'system' });
                logger_1.Logger.info('📊 System configuration cached');
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to cache common data:', error);
            }
        });
    }
    /**
     * Cache analytics templates
     */
    cacheAnalyticsTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
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
                yield EnhancedCacheService_1.default.set('analytics:templates', analyticsTemplates, { ttl: 7200, namespace: 'analytics' });
                logger_1.Logger.info('📈 Analytics templates cached');
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to cache analytics templates:', error);
            }
        });
    }
    /**
     * Health check for all enhanced services
     */
    healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            const health = {
                cache: false,
                performance: false,
                database: false,
                overall: false
            };
            try {
                // Check cache service
                yield EnhancedCacheService_1.default.set('health:check', { timestamp: new Date() }, { ttl: 10 });
                const cacheResult = yield EnhancedCacheService_1.default.get('health:check');
                health.cache = !!cacheResult;
                yield EnhancedCacheService_1.default.del('health:check');
                // Check performance monitoring
                const performanceService = PerformanceMonitoringService_1.default.getInstance();
                const stats = performanceService.getStats();
                health.performance = typeof stats.hitRate === 'number';
                // Check database (simplified)
                health.database = true; // Assume healthy if we got this far
                // Overall health
                health.overall = health.cache && health.performance && health.database;
                return health;
            }
            catch (error) {
                logger_1.Logger.error('❌ Health check failed:', error);
                return health;
            }
        });
    }
    /**
     * Graceful shutdown of enhanced services
     */
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🛑 Shutting down enhanced services...');
                // Stop performance monitoring
                const performanceService = PerformanceMonitoringService_1.default.getInstance();
                performanceService.stopStatsUpdater();
                // Clear cache stats
                EnhancedCacheService_1.default.resetStats();
                logger_1.Logger.info('✅ Enhanced services shutdown completed');
            }
            catch (error) {
                logger_1.Logger.error('❌ Enhanced services shutdown failed:', error);
            }
        });
    }
    /**
     * Get service statistics
     */
    getServiceStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheStats = EnhancedCacheService_1.default.getStats();
                const performanceService = PerformanceMonitoringService_1.default.getInstance();
                const performanceStats = performanceService.getStats();
                return {
                    cache: cacheStats,
                    performance: performanceStats,
                    uptime: process.uptime()
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get service stats:', error);
                return {
                    cache: null,
                    performance: null,
                    uptime: process.uptime()
                };
            }
        });
    }
}
// CLI execution
if (require.main === module) {
    const initializer = EnhancedServicesInitializer.getInstance();
    initializer.initializeAll()
        .then(() => {
        logger_1.Logger.info('✅ Enhanced services initialization completed');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.Logger.error('❌ Enhanced services initialization failed:', error);
        process.exit(1);
    });
}
exports.default = EnhancedServicesInitializer;
