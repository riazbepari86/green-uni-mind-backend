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
const redis_1 = require("../../config/redis");
const logger_1 = require("../../config/logger");
class EnhancedCacheService {
    constructor() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };
        this.DEFAULT_TTL = {
            analytics: 3600, // 1 hour
            activities: 300, // 5 minutes
            messaging: 1800, // 30 minutes
            enrollment: 7200, // 2 hours
            performance: 14400, // 4 hours
            realtime: 60, // 1 minute
        };
        this.CACHE_PREFIXES = {
            analytics: 'analytics:',
            activities: 'activities:',
            messaging: 'messaging:',
            enrollment: 'enrollment:',
            performance: 'performance:',
            user: 'user:',
            course: 'course:',
            session: 'session:',
        };
    }
    /**
     * Enhanced get with automatic decompression and stats tracking
     */
    get(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, options = {}) {
            try {
                const fullKey = this.buildKey(key, options.namespace);
                const cached = yield redis_1.redisOperations.get(fullKey);
                if (cached === null) {
                    this.stats.misses++;
                    return null;
                }
                this.stats.hits++;
                let data = cached;
                if (options.compress) {
                    data = this.decompress(cached);
                }
                return JSON.parse(data);
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache get error:', error);
                return null;
            }
        });
    }
    /**
     * Enhanced set with automatic compression and tagging
     */
    set(key_1, value_1) {
        return __awaiter(this, arguments, void 0, function* (key, value, options = {}) {
            try {
                const fullKey = this.buildKey(key, options.namespace);
                let data = JSON.stringify(value);
                if (options.compress) {
                    data = this.compress(data);
                }
                const ttl = options.ttl || this.DEFAULT_TTL.analytics;
                yield redis_1.redisOperations.setex(fullKey, ttl, data);
                // Handle tags for cache invalidation
                if (options.tags && options.tags.length > 0) {
                    yield this.addToTags(fullKey, options.tags, ttl);
                }
                // Store version for cache busting
                if (options.version) {
                    yield redis_1.redisOperations.setex(`${fullKey}:version`, ttl, options.version);
                }
                this.stats.sets++;
                return true;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache set error:', error);
                return false;
            }
        });
    }
    /**
     * Get multiple keys at once
     */
    mget(keys_1) {
        return __awaiter(this, arguments, void 0, function* (keys, options = {}) {
            try {
                const fullKeys = keys.map(key => this.buildKey(key, options.namespace));
                const results = yield redis_1.redisOperations.mget(fullKeys);
                return results.map((result, index) => {
                    if (result === null) {
                        this.stats.misses++;
                        return null;
                    }
                    this.stats.hits++;
                    try {
                        let data = result;
                        if (options.compress) {
                            data = this.decompress(result);
                        }
                        return JSON.parse(data);
                    }
                    catch (error) {
                        logger_1.Logger.error(`❌ Failed to parse cached data for key ${keys[index]}:`, error);
                        return null;
                    }
                });
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache mget error:', error);
                return keys.map(() => null);
            }
        });
    }
    /**
     * Set multiple keys at once
     */
    mset(keyValuePairs_1) {
        return __awaiter(this, arguments, void 0, function* (keyValuePairs, globalOptions = {}) {
            try {
                const pipeline = redis_1.redisOperations.pipeline();
                for (const { key, value, options = {} } of keyValuePairs) {
                    const mergedOptions = Object.assign(Object.assign({}, globalOptions), options);
                    const fullKey = this.buildKey(key, mergedOptions.namespace);
                    let data = JSON.stringify(value);
                    if (mergedOptions.compress) {
                        data = this.compress(data);
                    }
                    const ttl = mergedOptions.ttl || this.DEFAULT_TTL.analytics;
                    pipeline.setex(fullKey, ttl, data);
                    // Handle tags
                    if (mergedOptions.tags && mergedOptions.tags.length > 0) {
                        for (const tag of mergedOptions.tags) {
                            pipeline.sadd(`tag:${tag}`, fullKey);
                            pipeline.expire(`tag:${tag}`, ttl);
                        }
                    }
                }
                yield pipeline.exec();
                this.stats.sets += keyValuePairs.length;
                return true;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache mset error:', error);
                return false;
            }
        });
    }
    /**
     * Delete by key
     */
    del(key, namespace) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullKey = this.buildKey(key, namespace);
                const result = yield redis_1.redisOperations.del(fullKey);
                this.stats.deletes++;
                return result > 0;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache delete error:', error);
                return false;
            }
        });
    }
    /**
     * Delete by pattern
     */
    delPattern(pattern, namespace) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullPattern = this.buildKey(pattern, namespace);
                const keys = yield redis_1.redisOperations.keys(fullPattern);
                if (keys.length === 0) {
                    return 0;
                }
                const result = yield redis_1.redisOperations.del(...keys);
                this.stats.deletes += result;
                return result;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache delete pattern error:', error);
                return 0;
            }
        });
    }
    /**
     * Delete by tags
     */
    delByTags(tags) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let totalDeleted = 0;
                for (const tag of tags) {
                    const keys = yield redis_1.redisOperations.smembers(`tag:${tag}`);
                    if (keys.length > 0) {
                        const deleted = yield redis_1.redisOperations.del(...keys);
                        totalDeleted += deleted;
                        yield redis_1.redisOperations.del(`tag:${tag}`);
                    }
                }
                this.stats.deletes += totalDeleted;
                return totalDeleted;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache delete by tags error:', error);
                return 0;
            }
        });
    }
    /**
     * Check if key exists
     */
    exists(key, namespace) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullKey = this.buildKey(key, namespace);
                const result = yield redis_1.redisOperations.exists(fullKey);
                return result === 1;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache exists error:', error);
                return false;
            }
        });
    }
    /**
     * Get TTL for a key
     */
    ttl(key, namespace) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullKey = this.buildKey(key, namespace);
                return yield redis_1.redisOperations.ttl(fullKey);
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache TTL error:', error);
                return -1;
            }
        });
    }
    /**
     * Extend TTL for a key
     */
    expire(key, ttl, namespace) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fullKey = this.buildKey(key, namespace);
                const result = yield redis_1.redisOperations.expire(fullKey, ttl);
                return result === 1;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache expire error:', error);
                return false;
            }
        });
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
        return Object.assign(Object.assign({}, this.stats), { hitRate: Math.round(hitRate * 100) / 100 });
    }
    /**
     * Reset cache statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };
    }
    /**
     * Warm up cache with frequently accessed data
     */
    warmUp(teacherId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info(`🔥 Warming up cache for teacher: ${teacherId}`);
                // Pre-load analytics data
                const analyticsKeys = [
                    `analytics:enrollment:${teacherId}:monthly`,
                    `analytics:revenue:${teacherId}:monthly`,
                    `analytics:performance:${teacherId}:monthly`,
                    `analytics:engagement:${teacherId}:monthly`
                ];
                // Check which keys are missing
                const existingKeys = yield Promise.all(analyticsKeys.map(key => this.exists(key)));
                const missingKeys = analyticsKeys.filter((_, index) => !existingKeys[index]);
                if (missingKeys.length > 0) {
                    logger_1.Logger.info(`📊 Pre-loading ${missingKeys.length} analytics cache entries`);
                    // Note: Actual data loading would be done by the respective services
                }
                logger_1.Logger.info(`✅ Cache warm-up completed for teacher: ${teacherId}`);
            }
            catch (error) {
                logger_1.Logger.error('❌ Cache warm-up error:', error);
            }
        });
    }
    /**
     * Build full cache key with namespace
     */
    buildKey(key, namespace) {
        if (namespace) {
            return `${this.CACHE_PREFIXES[namespace] || namespace}${key}`;
        }
        return key;
    }
    /**
     * Add key to tags for invalidation
     */
    addToTags(key, tags, ttl) {
        return __awaiter(this, void 0, void 0, function* () {
            const pipeline = redis_1.redisOperations.pipeline();
            for (const tag of tags) {
                pipeline.sadd(`tag:${tag}`, key);
                pipeline.expire(`tag:${tag}`, ttl);
            }
            yield pipeline.exec();
        });
    }
    /**
     * Compress data (placeholder - implement actual compression if needed)
     */
    compress(data) {
        // For now, just return the data as-is
        // In production, you might want to use zlib or similar
        return data;
    }
    /**
     * Decompress data (placeholder - implement actual decompression if needed)
     */
    decompress(data) {
        // For now, just return the data as-is
        // In production, you might want to use zlib or similar
        return data;
    }
}
exports.default = new EnhancedCacheService();
