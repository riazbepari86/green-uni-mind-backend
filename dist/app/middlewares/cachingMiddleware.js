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
exports.invalidationService = exports.queryCache = exports.apiCache = exports.cacheHealthCheck = exports.cacheMonitoring = exports.warmCriticalCache = exports.smartCacheInvalidation = exports.invalidateCache = exports.cacheSearchResults = exports.cacheDashboardData = exports.cachePublicContent = exports.cacheCourseContent = exports.cacheUserData = exports.cacheApiResponse = void 0;
const ApiCacheService_1 = require("../services/redis/ApiCacheService");
const QueryCacheService_1 = require("../services/redis/QueryCacheService");
const CacheInvalidationService_1 = require("../services/redis/CacheInvalidationService");
const RedisServiceManager_1 = require("../services/redis/RedisServiceManager");
// Initialize cache services
const apiCache = new ApiCacheService_1.ApiCacheService(RedisServiceManager_1.redisServiceManager.cacheClient, RedisServiceManager_1.redisServiceManager.monitoring);
exports.apiCache = apiCache;
const queryCache = new QueryCacheService_1.QueryCacheService(RedisServiceManager_1.redisServiceManager.cacheClient, RedisServiceManager_1.redisServiceManager.monitoring);
exports.queryCache = queryCache;
const invalidationService = new CacheInvalidationService_1.CacheInvalidationService(RedisServiceManager_1.redisServiceManager.cacheClient, RedisServiceManager_1.redisServiceManager.monitoring);
exports.invalidationService = invalidationService;
// API Response Caching Middleware
const cacheApiResponse = (options) => {
    return apiCache.cache({
        ttl: options.ttl || 300, // 5 minutes default
        tags: options.tags || [],
        varyBy: options.varyBy || ['authorization'],
        condition: options.condition,
        keyGenerator: options.keyGenerator,
        onHit: (req, _cachedData) => {
            console.log(`🎯 API Cache Hit: ${req.method} ${req.path}`);
        },
        onMiss: (req) => {
            console.log(`❌ API Cache Miss: ${req.method} ${req.path}`);
        },
    });
};
exports.cacheApiResponse = cacheApiResponse;
// User-specific caching
const cacheUserData = (ttl = 900) => {
    return (0, exports.cacheApiResponse)({
        ttl,
        tags: ['user_data'],
        varyBy: ['authorization'],
        condition: (req) => !!req.user,
        keyGenerator: (req) => { var _a; return `user:${(_a = req.user) === null || _a === void 0 ? void 0 : _a._id}:${req.path}:${JSON.stringify(req.query)}`; },
    });
};
exports.cacheUserData = cacheUserData;
// Course content caching
const cacheCourseContent = (ttl = 1800) => {
    return (0, exports.cacheApiResponse)({
        ttl,
        tags: ['course_content', 'course_list'],
        varyBy: ['authorization'],
        condition: (req) => req.method === 'GET',
    });
};
exports.cacheCourseContent = cacheCourseContent;
// Public content caching (longer TTL)
const cachePublicContent = (ttl = 3600) => {
    return (0, exports.cacheApiResponse)({
        ttl,
        tags: ['public_content'],
        condition: (req) => req.method === 'GET' && !req.user,
    });
};
exports.cachePublicContent = cachePublicContent;
// Dashboard data caching
const cacheDashboardData = (ttl = 600) => {
    return (0, exports.cacheApiResponse)({
        ttl,
        tags: ['dashboard', 'user_dashboard'],
        varyBy: ['authorization'],
        condition: (req) => !!req.user && req.method === 'GET',
        keyGenerator: (req) => { var _a, _b; return `dashboard:${(_a = req.user) === null || _a === void 0 ? void 0 : _a.role}:${(_b = req.user) === null || _b === void 0 ? void 0 : _b._id}:${req.path}`; },
    });
};
exports.cacheDashboardData = cacheDashboardData;
// Search results caching
const cacheSearchResults = (ttl = 1200) => {
    return (0, exports.cacheApiResponse)({
        ttl,
        tags: ['search_results'],
        varyBy: ['authorization'],
        condition: (req) => req.method === 'GET' && !!(req.query.q || req.query.search),
        keyGenerator: (req) => {
            var _a;
            const searchTerm = req.query.q || req.query.search;
            const filters = Object.assign({}, req.query);
            delete filters.q;
            delete filters.search;
            return `search:${searchTerm}:${JSON.stringify(filters)}:${((_a = req.user) === null || _a === void 0 ? void 0 : _a._id) || 'anonymous'}`;
        },
    });
};
exports.cacheSearchResults = cacheSearchResults;
// Cache invalidation middleware for write operations
const invalidateCache = (tags) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        // Store original response methods
        const originalJson = res.json;
        const originalSend = res.send;
        // Override response methods to trigger invalidation on successful writes
        res.json = function (data) {
            const statusCode = res.statusCode;
            // Trigger invalidation for successful write operations
            if (statusCode >= 200 && statusCode < 300 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    try {
                        yield invalidationService.triggerInvalidation(`${req.method.toLowerCase()}_${req.path.split('/')[1]}`, { path: req.path, method: req.method, userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id }, (_b = req.user) === null || _b === void 0 ? void 0 : _b._id, 'api_middleware');
                        // Also invalidate specific tags
                        if (tags.length > 0) {
                            yield Promise.all([
                                apiCache.invalidateByTags(tags),
                                queryCache.invalidateByTags(tags),
                            ]);
                        }
                    }
                    catch (error) {
                        console.error('Error in cache invalidation middleware:', error);
                    }
                }));
            }
            return originalJson.call(this, data);
        };
        res.send = function (data) {
            const statusCode = res.statusCode;
            if (statusCode >= 200 && statusCode < 300 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    try {
                        yield invalidationService.triggerInvalidation(`${req.method.toLowerCase()}_${req.path.split('/')[1]}`, { path: req.path, method: req.method, userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id }, (_b = req.user) === null || _b === void 0 ? void 0 : _b._id, 'api_middleware');
                        if (tags.length > 0) {
                            yield Promise.all([
                                apiCache.invalidateByTags(tags),
                                queryCache.invalidateByTags(tags),
                            ]);
                        }
                    }
                    catch (error) {
                        console.error('Error in cache invalidation middleware:', error);
                    }
                }));
            }
            return originalSend.call(this, data);
        };
        next();
    });
};
exports.invalidateCache = invalidateCache;
// Smart cache invalidation based on route patterns
const smartCacheInvalidation = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        const originalJson = res.json;
        res.json = function (data) {
            const statusCode = res.statusCode;
            if (statusCode >= 200 && statusCode < 300 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        // Extract entity type and ID from path
                        const pathParts = req.path.split('/').filter(Boolean);
                        const entityType = pathParts[1]; // e.g., 'users', 'courses', 'enrollments'
                        const entityId = pathParts[2];
                        if (entityType && entityId) {
                            yield invalidationService.smartInvalidate(entityType.slice(0, -1), // Remove 's' from plural
                            entityId, req.method === 'POST' ? 'create' :
                                req.method === 'DELETE' ? 'delete' : 'update');
                        }
                    }
                    catch (error) {
                        console.error('Error in smart cache invalidation:', error);
                    }
                }));
            }
            return originalJson.call(this, data);
        };
        next();
    });
};
exports.smartCacheInvalidation = smartCacheInvalidation;
// Cache warming middleware for critical endpoints
const warmCriticalCache = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔥 Warming critical cache endpoints...');
    try {
        // Warm popular API endpoints
        yield apiCache.warmApiCache([
            {
                method: 'GET',
                path: '/api/courses',
                fetchFn: () => __awaiter(void 0, void 0, void 0, function* () {
                    // This would typically call your course service
                    return { courses: [], total: 0 };
                }),
                options: { ttl: 1800, tags: ['course_list'] },
            },
            {
                method: 'GET',
                path: '/api/categories',
                fetchFn: () => __awaiter(void 0, void 0, void 0, function* () {
                    return { categories: [] };
                }),
                options: { ttl: 3600, tags: ['categories'] },
            },
        ]);
        console.log('✅ Critical cache warmed successfully');
    }
    catch (error) {
        console.error('❌ Error warming critical cache:', error);
    }
});
exports.warmCriticalCache = warmCriticalCache;
// Cache monitoring middleware
const cacheMonitoring = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        const startTime = Date.now();
        // Add cache info to response headers
        res.on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
            const duration = Date.now() - startTime;
            // Track API performance metrics
            try {
                const cacheStatus = res.get('X-Cache') || 'UNKNOWN';
                const endpoint = `${req.method} ${req.path}`;
                // Store performance metrics in Redis
                const metricsKey = `metrics:api:${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const pipeline = RedisServiceManager_1.redisServiceManager.cacheClient.pipeline();
                pipeline.lpush(`${metricsKey}:response_times`, duration);
                pipeline.ltrim(`${metricsKey}:response_times`, 0, 99); // Keep last 100 measurements
                pipeline.incr(`${metricsKey}:${cacheStatus.toLowerCase()}_count`);
                pipeline.expire(`${metricsKey}:response_times`, 86400); // 24 hours
                pipeline.expire(`${metricsKey}:${cacheStatus.toLowerCase()}_count`, 86400);
                yield pipeline.exec();
            }
            catch (error) {
                console.error('Error tracking cache metrics:', error);
            }
        }));
        next();
    });
};
exports.cacheMonitoring = cacheMonitoring;
// Cache health check middleware
const cacheHealthCheck = (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Quick health check for cache services
        const healthPromises = [
            RedisServiceManager_1.redisServiceManager.healthCheck(),
            apiCache.getApiCacheStats(),
            queryCache.getCacheStats(),
        ];
        const [redisHealth, apiStats, queryStats] = yield Promise.all(healthPromises);
        // Add cache health info to request context
        req.cacheHealth = {
            redis: redisHealth,
            api: apiStats,
            query: queryStats,
            timestamp: new Date().toISOString(),
        };
        next();
    }
    catch (error) {
        console.error('Cache health check failed:', error);
        // Don't fail the request, just log the error
        req.cacheHealth = {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        };
        next();
    }
});
exports.cacheHealthCheck = cacheHealthCheck;
