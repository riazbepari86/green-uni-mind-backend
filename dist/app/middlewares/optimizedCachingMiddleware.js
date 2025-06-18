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
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureToggleService = exports.smartCacheService = exports.featureAwareCacheStats = exports.memoryOnlyCache = exports.selectiveCacheInvalidation = exports.adaptiveCaching = exports.smartCacheWarming = exports.conditionalPerformanceTracking = exports.optimizedCacheApiResponse = void 0;
const FeatureToggleService_1 = require("../services/redis/FeatureToggleService");
Object.defineProperty(exports, "featureToggleService", { enumerable: true, get: function () { return FeatureToggleService_1.featureToggleService; } });
const SmartCacheService_1 = require("../services/cache/SmartCacheService");
Object.defineProperty(exports, "smartCacheService", { enumerable: true, get: function () { return SmartCacheService_1.smartCacheService; } });
const RedisUsageAuditor_1 = require("../services/redis/RedisUsageAuditor");
// Optimized API response caching with feature toggles
const optimizedCacheApiResponse = (options) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        // Check if API response caching is enabled
        if (!FeatureToggleService_1.featureToggleService.isFeatureEnabled('api_response_caching')) {
            console.log('📵 API response caching disabled, skipping cache');
            return next();
        }
        const cacheKey = generateCacheKey(req);
        const priority = options.priority || 'medium';
        const ttl = options.ttl || getSmartTTL(req.path, priority);
        try {
            // Try to get from smart cache (L1 + L2)
            const cachedData = yield SmartCacheService_1.smartCacheService.get(cacheKey, {
                priority,
                l1Only: options.fallbackToMemory && !FeatureToggleService_1.featureToggleService.isFeatureEnabled('api_response_caching')
            });
            if (cachedData) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Cache-Source', 'SMART');
                console.log(`🎯 Smart Cache Hit: ${req.method} ${req.path}`);
                return res.json(cachedData);
            }
            // Cache miss - continue to route handler
            res.setHeader('X-Cache', 'MISS');
            // Intercept response to cache it
            const originalJson = res.json;
            res.json = function (data) {
                // Cache the response if caching is still enabled
                if (FeatureToggleService_1.featureToggleService.isFeatureEnabled('api_response_caching')) {
                    SmartCacheService_1.smartCacheService.set(cacheKey, data, {
                        ttl,
                        priority,
                        compress: shouldCompress(data)
                    }).catch(error => {
                        console.error('Error caching response:', error);
                    });
                }
                return originalJson.call(this, data);
            };
            next();
        }
        catch (error) {
            console.error('Cache middleware error:', error);
            // Continue without caching on error
            next();
        }
    });
};
exports.optimizedCacheApiResponse = optimizedCacheApiResponse;
// Conditional performance tracking
const conditionalPerformanceTracking = () => {
    return (req, res, next) => {
        // Only track performance if monitoring is enabled
        if (!FeatureToggleService_1.featureToggleService.isFeatureEnabled('performance_monitoring')) {
            return next();
        }
        const startTime = Date.now();
        res.on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const duration = Date.now() - startTime;
                const endpoint = `${req.method} ${req.path}`;
                // Only track if API metrics tracking is enabled
                if (FeatureToggleService_1.featureToggleService.isFeatureEnabled('api_metrics_tracking')) {
                    // Use smart caching for metrics to reduce Redis usage
                    const metricsKey = `metrics:api:${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    yield SmartCacheService_1.smartCacheService.set(`${metricsKey}:latest`, {
                        duration,
                        timestamp: Date.now(),
                        status: res.statusCode,
                        cacheStatus: res.get('X-Cache') || 'UNKNOWN'
                    }, {
                        ttl: 3600, // 1 hour
                        priority: 'low',
                        l1Only: true // Keep metrics in memory only
                    });
                }
            }
            catch (error) {
                console.error('Error in performance tracking:', error);
            }
        }));
        next();
    };
};
exports.conditionalPerformanceTracking = conditionalPerformanceTracking;
// Smart cache warming with feature checks
const smartCacheWarming = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!FeatureToggleService_1.featureToggleService.isFeatureEnabled('cache_warming')) {
        console.log('📵 Cache warming disabled');
        return;
    }
    console.log('🔥 Starting smart cache warming...');
    try {
        // Only warm critical endpoints
        const criticalEndpoints = [
            {
                key: 'courses:list',
                data: { courses: [], total: 0 },
                options: { ttl: 1800, priority: 'high' }
            },
            {
                key: 'categories:list',
                data: { categories: [] },
                options: { ttl: 3600, priority: 'medium' }
            }
        ];
        for (const endpoint of criticalEndpoints) {
            yield SmartCacheService_1.smartCacheService.set(endpoint.key, endpoint.data, endpoint.options);
        }
        console.log('✅ Smart cache warming completed');
    }
    catch (error) {
        console.error('❌ Error in smart cache warming:', error);
    }
});
exports.smartCacheWarming = smartCacheWarming;
// Adaptive caching based on Redis usage
const adaptiveCaching = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // Check Redis usage before applying caching
            const healthCheck = yield RedisUsageAuditor_1.redisUsageAuditor.quickHealthCheck();
            // Adjust caching strategy based on Redis health
            if (healthCheck.status === 'critical') {
                // Disable all non-critical caching
                FeatureToggleService_1.featureToggleService.setOptimizationMode('aggressive');
                console.log('🚨 Critical Redis usage - aggressive optimization enabled');
            }
            else if (healthCheck.status === 'warning') {
                // Conservative caching
                FeatureToggleService_1.featureToggleService.setOptimizationMode('conservative');
                console.log('⚠️ High Redis usage - conservative optimization enabled');
            }
            // Add Redis usage info to request context
            req.redisHealth = healthCheck;
            next();
        }
        catch (error) {
            console.error('Error in adaptive caching:', error);
            next();
        }
    });
};
exports.adaptiveCaching = adaptiveCaching;
// Selective cache invalidation
const selectiveCacheInvalidation = (tags, priority = 'medium') => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        // Only invalidate if invalidation tracking is enabled
        if (!FeatureToggleService_1.featureToggleService.isFeatureEnabled('invalidation_tracking')) {
            return next();
        }
        // Store original end function
        const originalEnd = res.end;
        res.end = function (chunk, encoding) {
            // Only invalidate on successful operations
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Invalidate based on priority
                if (priority === 'critical' || FeatureToggleService_1.featureToggleService.isFeatureEnabled('cache_statistics')) {
                    // Perform invalidation asynchronously
                    setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            for (const tag of tags) {
                                // Use pattern-based invalidation for efficiency
                                const pattern = `*${tag}*`;
                                console.log(`🗑️ Invalidating cache pattern: ${pattern}`);
                                // Clear from smart cache
                                // In a real implementation, you'd implement pattern-based clearing
                            }
                        }
                        catch (error) {
                            console.error('Error in cache invalidation:', error);
                        }
                    }));
                }
            }
            return originalEnd.call(this, chunk, encoding);
        };
        next();
    });
};
exports.selectiveCacheInvalidation = selectiveCacheInvalidation;
// Memory-only caching for low priority data
const memoryOnlyCache = (options) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        // Always use memory-only for low priority data
        const cacheKey = generateCacheKey(req);
        // Check condition if provided
        if (options.condition && !options.condition(req)) {
            return next();
        }
        try {
            // Try L1 cache only
            const cachedData = yield SmartCacheService_1.smartCacheService.get(cacheKey, { l1Only: true });
            if (cachedData) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Cache-Source', 'MEMORY');
                return res.json(cachedData);
            }
            // Cache miss - intercept response
            const originalJson = res.json;
            res.json = function (data) {
                // Cache in memory only
                SmartCacheService_1.smartCacheService.set(cacheKey, data, {
                    ttl: options.ttl || 300,
                    priority: 'low',
                    l1Only: true
                }).catch(error => {
                    console.error('Error caching in memory:', error);
                });
                return originalJson.call(this, data);
            };
            next();
        }
        catch (error) {
            console.error('Memory cache error:', error);
            next();
        }
    });
};
exports.memoryOnlyCache = memoryOnlyCache;
// Helper functions
function generateCacheKey(req) {
    const baseKey = `${req.method}:${req.path}`;
    const queryString = Object.keys(req.query).length > 0 ? `:${JSON.stringify(req.query)}` : '';
    const userKey = req.user ? `:user:${req.user._id}` : '';
    return `api:${baseKey}${queryString}${userKey}`;
}
function getSmartTTL(path, priority) {
    // Smart TTL based on path and priority
    if (path.includes('/auth') || path.includes('/login'))
        return 300; // 5 minutes
    if (path.includes('/user') || path.includes('/profile'))
        return 900; // 15 minutes
    if (path.includes('/courses'))
        return 1800; // 30 minutes
    if (path.includes('/categories'))
        return 3600; // 1 hour
    // Priority-based TTL
    switch (priority) {
        case 'critical': return 3600; // 1 hour
        case 'high': return 1800; // 30 minutes
        case 'medium': return 900; // 15 minutes
        case 'low': return 300; // 5 minutes
        default: return 600; // 10 minutes
    }
}
function shouldCompress(data) {
    const serialized = JSON.stringify(data);
    return serialized.length > 1024; // Compress if larger than 1KB
}
// Feature-aware cache statistics
const featureAwareCacheStats = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        // Only collect stats if enabled
        if (!FeatureToggleService_1.featureToggleService.isFeatureEnabled('cache_statistics')) {
            return next();
        }
        const cacheStatus = res.get('X-Cache');
        if (cacheStatus) {
            // Use memory-only storage for stats to reduce Redis usage
            const statsKey = `cache:stats:${cacheStatus.toLowerCase()}`;
            try {
                yield SmartCacheService_1.smartCacheService.set(`${statsKey}:${Date.now()}`, {
                    endpoint: `${req.method} ${req.path}`,
                    timestamp: Date.now(),
                    status: cacheStatus
                }, {
                    ttl: 3600,
                    priority: 'low',
                    l1Only: true
                });
            }
            catch (error) {
                console.error('Error collecting cache stats:', error);
            }
        }
        next();
    });
};
exports.featureAwareCacheStats = featureAwareCacheStats;
