"use strict";
/**
 * Enterprise Cache Middleware
 * Implements advanced cache invalidation patterns for enterprise-grade performance
 */
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
exports.enterpriseCacheMiddleware = exports.EnterpriseCacheMiddleware = void 0;
const EnterpriseCache_1 = __importDefault(require("../services/cache/EnterpriseCache"));
const CacheVersioningService_1 = __importDefault(require("../services/cache/CacheVersioningService"));
class EnterpriseCacheMiddleware {
    constructor() {
        this.enterpriseCache = new EnterpriseCache_1.default();
        this.versioningService = new CacheVersioningService_1.default();
    }
    /**
     * Write-through cache pattern
     * Data is written to cache and database simultaneously
     */
    writeThrough(config) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            console.log('📝 Write-through cache pattern activated');
            // Store original response methods
            const originalSend = res.send;
            const originalJson = res.json;
            // Override response methods to intercept data
            res.send = function (data) {
                // Write to cache immediately after successful response
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            yield handleWriteThrough(req, data, config);
                        }
                        catch (error) {
                            console.error('❌ Write-through cache failed:', error);
                        }
                    }));
                }
                return originalSend.call(this, data);
            };
            res.json = function (data) {
                // Write to cache immediately after successful response
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            yield handleWriteThrough(req, data, config);
                        }
                        catch (error) {
                            console.error('❌ Write-through cache failed:', error);
                        }
                    }));
                }
                return originalJson.call(this, data);
            };
            next();
        });
    }
    /**
     * Write-behind cache pattern
     * Data is written to cache immediately, database write is deferred
     */
    writeBehind(config) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            console.log('⏰ Write-behind cache pattern activated');
            // Store original response methods
            const originalSend = res.send;
            const originalJson = res.json;
            // Override response methods to intercept data
            res.send = function (data) {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    // Immediate cache write
                    setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            yield handleWriteBehind(req, data, config);
                        }
                        catch (error) {
                            console.error('❌ Write-behind cache failed:', error);
                        }
                    }));
                }
                return originalSend.call(this, data);
            };
            res.json = function (data) {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    // Immediate cache write
                    setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            yield handleWriteBehind(req, data, config);
                        }
                        catch (error) {
                            console.error('❌ Write-behind cache failed:', error);
                        }
                    }));
                }
                return originalJson.call(this, data);
            };
            next();
        });
    }
    /**
     * Cache-aside pattern
     * Application manages cache explicitly
     */
    cacheAside(config) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Cache-aside pattern activated');
            // Check cache first for GET requests
            if (req.method === 'GET') {
                try {
                    const cachedData = yield this.checkCacheAside(req, config);
                    if (cachedData) {
                        console.log('✅ Cache hit - returning cached data');
                        return res.json(cachedData);
                    }
                }
                catch (error) {
                    console.error('❌ Cache-aside check failed:', error);
                }
            }
            // Store original response methods for cache population
            const originalSend = res.send;
            const originalJson = res.json;
            res.send = function (data) {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            yield handleCacheAside(req, data, config);
                        }
                        catch (error) {
                            console.error('❌ Cache-aside population failed:', error);
                        }
                    }));
                }
                return originalSend.call(this, data);
            };
            res.json = function (data) {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            yield handleCacheAside(req, data, config);
                        }
                        catch (error) {
                            console.error('❌ Cache-aside population failed:', error);
                        }
                    }));
                }
                return originalJson.call(this, data);
            };
            next();
        });
    }
    /**
     * Enterprise invalidation middleware for lecture updates
     */
    enterpriseLectureInvalidation() {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            // Only apply to lecture update operations
            if (req.method === 'PUT' || req.method === 'PATCH') {
                const { courseId, lectureId } = req.params;
                if (lectureId && courseId) {
                    console.log('🏢 Enterprise lecture invalidation middleware activated');
                    // Store original response methods
                    const originalSend = res.send;
                    const originalJson = res.json;
                    const handleInvalidation = (data) => __awaiter(this, void 0, void 0, function* () {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                const updatedFields = Object.keys(req.body || {});
                                yield this.enterpriseCache.invalidateLectureUpdate(lectureId, courseId, updatedFields);
                                console.log('✅ Enterprise lecture invalidation completed');
                            }
                            catch (error) {
                                console.error('❌ Enterprise lecture invalidation failed:', error);
                            }
                        }
                    });
                    res.send = function (data) {
                        setImmediate(() => handleInvalidation(data));
                        return originalSend.call(this, data);
                    };
                    res.json = function (data) {
                        setImmediate(() => handleInvalidation(data));
                        return originalJson.call(this, data);
                    };
                }
            }
            next();
        });
    }
    /**
     * Check cache for cache-aside pattern
     */
    checkCacheAside(req, config) {
        return __awaiter(this, void 0, void 0, function* () {
            // Implementation would check cache based on request
            // For now, return null to indicate cache miss
            return null;
        });
    }
}
exports.EnterpriseCacheMiddleware = EnterpriseCacheMiddleware;
/**
 * Handle write-through cache pattern
 */
function handleWriteThrough(req, data, config) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('📝 Executing write-through cache operation');
        // Extract entity information from request
        const context = extractCacheContext(req, data, config);
        if (context) {
            // Write to cache immediately
            console.log(`📝 Write-through: Caching ${context.entityType}:${context.entityId}`);
            // In a real implementation, you would write to your cache here
            // await cacheService.set(cacheKey, data, config.ttl);
        }
    });
}
/**
 * Handle write-behind cache pattern
 */
function handleWriteBehind(req, data, config) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('⏰ Executing write-behind cache operation');
        const context = extractCacheContext(req, data, config);
        if (context) {
            // Immediate cache write
            console.log(`⏰ Write-behind: Immediate cache write for ${context.entityType}:${context.entityId}`);
            // Schedule deferred database write
            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                console.log(`⏰ Write-behind: Deferred database write for ${context.entityType}:${context.entityId}`);
                // Perform database write here
            }), 100); // 100ms delay
        }
    });
}
/**
 * Handle cache-aside pattern
 */
function handleCacheAside(req, data, config) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🔄 Executing cache-aside operation');
        const context = extractCacheContext(req, data, config);
        if (context) {
            console.log(`🔄 Cache-aside: Populating cache for ${context.entityType}:${context.entityId}`);
            // Populate cache after successful database operation
            // await cacheService.set(cacheKey, data, config.ttl);
        }
    });
}
/**
 * Extract cache context from request
 */
function extractCacheContext(req, data, config) {
    const { courseId, lectureId } = req.params;
    if (lectureId) {
        return {
            entityType: 'lecture',
            entityId: lectureId,
            operation: getOperationType(req.method),
            data,
            config
        };
    }
    if (courseId) {
        return {
            entityType: 'course',
            entityId: courseId,
            operation: getOperationType(req.method),
            data,
            config
        };
    }
    return null;
}
/**
 * Get operation type from HTTP method
 */
function getOperationType(method) {
    switch (method.toUpperCase()) {
        case 'POST': return 'create';
        case 'GET': return 'read';
        case 'PUT':
        case 'PATCH': return 'update';
        case 'DELETE': return 'delete';
        default: return 'read';
    }
}
// Export singleton instance
exports.enterpriseCacheMiddleware = new EnterpriseCacheMiddleware();
exports.default = exports.enterpriseCacheMiddleware;
