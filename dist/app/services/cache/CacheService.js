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
exports.messagingCacheService = exports.analyticsCacheService = exports.MessagingCacheService = exports.AnalyticsCacheService = exports.cacheService = void 0;
const redis_1 = require("../../config/redis");
const logger_1 = require("../../config/logger");
/**
 * Comprehensive caching service with Redis backend
 */
class CacheService {
    constructor() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0,
        };
        this.DEFAULT_TTL = 3600; // 1 hour
        this.MAX_KEY_LENGTH = 250;
    }
    /**
     * Get value from cache
     */
    get(key, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = this.buildKey(key, options === null || options === void 0 ? void 0 : options.prefix);
                const value = yield redis_1.redisOperations.get(cacheKey);
                if (value === null) {
                    this.stats.misses++;
                    return null;
                }
                this.stats.hits++;
                try {
                    return JSON.parse(value);
                }
                catch (_a) {
                    // If parsing fails, return as string
                    return value;
                }
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache get error:', { key, error });
                return null;
            }
        });
    }
    /**
     * Set value in cache
     */
    set(key, value, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = this.buildKey(key, options === null || options === void 0 ? void 0 : options.prefix);
                const ttl = (options === null || options === void 0 ? void 0 : options.ttl) || this.DEFAULT_TTL;
                let serializedValue;
                if (typeof value === 'string') {
                    serializedValue = value;
                }
                else {
                    serializedValue = JSON.stringify(value);
                }
                // Check if value is too large (Redis limit is 512MB, but we'll be conservative)
                if (serializedValue.length > 10 * 1024 * 1024) { // 10MB
                    logger_1.Logger.warn('⚠️ Cache value too large, skipping cache:', { key, size: serializedValue.length });
                    return false;
                }
                yield redis_1.redisOperations.setex(cacheKey, ttl, serializedValue);
                // Store tags for invalidation
                if ((options === null || options === void 0 ? void 0 : options.tags) && options.tags.length > 0) {
                    yield this.addToTags(cacheKey, options.tags);
                }
                this.stats.sets++;
                return true;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache set error:', { key, error });
                return false;
            }
        });
    }
    /**
     * Delete value from cache
     */
    del(key, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = this.buildKey(key, options === null || options === void 0 ? void 0 : options.prefix);
                const result = yield redis_1.redisOperations.del(cacheKey);
                this.stats.deletes++;
                return result > 0;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache delete error:', { key, error });
                return false;
            }
        });
    }
    /**
     * Check if key exists in cache
     */
    exists(key, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = this.buildKey(key, options === null || options === void 0 ? void 0 : options.prefix);
                const result = yield redis_1.redisOperations.exists(cacheKey);
                return result === 1;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache exists error:', { key, error });
                return false;
            }
        });
    }
    /**
     * Get or set pattern - get from cache, if not exists, execute function and cache result
     */
    getOrSet(key, fetchFunction, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try to get from cache first
                const cached = yield this.get(key, options);
                if (cached !== null) {
                    return cached;
                }
                // If not in cache, execute function
                const result = yield fetchFunction();
                // Cache the result
                yield this.set(key, result, options);
                return result;
            }
            catch (error) {
                logger_1.Logger.error('❌ Cache getOrSet error:', { key, error });
                // If cache fails, still return the function result
                return yield fetchFunction();
            }
        });
    }
    /**
     * Increment a numeric value in cache
     */
    increment(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, amount = 1, options) {
            try {
                const cacheKey = this.buildKey(key, options === null || options === void 0 ? void 0 : options.prefix);
                if (amount === 1) {
                    const result = yield redis_1.redisOperations.incr(cacheKey);
                    // Set expiration if it's a new key
                    if (result === 1) {
                        const ttl = (options === null || options === void 0 ? void 0 : options.ttl) || this.DEFAULT_TTL;
                        yield redis_1.redisOperations.expire(cacheKey, ttl);
                    }
                    return result;
                }
                else {
                    // Use raw redis client for incrby
                    const result = yield redis_1.redis.incrby(cacheKey, amount);
                    // Set expiration if it's a new key
                    if (result === amount) {
                        const ttl = (options === null || options === void 0 ? void 0 : options.ttl) || this.DEFAULT_TTL;
                        yield redis_1.redisOperations.expire(cacheKey, ttl);
                    }
                    return result;
                }
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache increment error:', { key, error });
                return 0;
            }
        });
    }
    /**
     * Set expiration for a key
     */
    expire(key, ttl, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = this.buildKey(key, options === null || options === void 0 ? void 0 : options.prefix);
                const result = yield redis_1.redisOperations.expire(cacheKey, ttl);
                return result === 1;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache expire error:', { key, error });
                return false;
            }
        });
    }
    /**
     * Get multiple keys at once
     */
    mget(keys, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKeys = keys.map(key => this.buildKey(key, options === null || options === void 0 ? void 0 : options.prefix));
                const values = yield redis_1.redisOperations.mget(cacheKeys);
                return values.map(value => {
                    if (value === null) {
                        this.stats.misses++;
                        return null;
                    }
                    this.stats.hits++;
                    try {
                        return JSON.parse(value);
                    }
                    catch (_a) {
                        return value;
                    }
                });
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache mget error:', { keys, error });
                return keys.map(() => null);
            }
        });
    }
    /**
     * Invalidate cache by tags
     */
    invalidateByTags(tags) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let deletedCount = 0;
                for (const tag of tags) {
                    const tagKey = `tag:${tag}`;
                    const keys = yield redis_1.redisOperations.smembers(tagKey);
                    if (keys.length > 0) {
                        const deleted = yield redis_1.redisOperations.del(...keys);
                        deletedCount += deleted;
                        // Remove the tag set itself
                        yield redis_1.redisOperations.del(tagKey);
                    }
                }
                logger_1.Logger.info(`🗑️ Invalidated ${deletedCount} cache entries by tags:`, tags);
                return deletedCount;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache invalidate by tags error:', { tags, error });
                return 0;
            }
        });
    }
    /**
     * Clear all cache (use with caution)
     */
    clear() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield redis_1.redis.flushdb();
                logger_1.Logger.warn('🧹 All cache cleared');
                return true;
            }
            catch (error) {
                this.stats.errors++;
                logger_1.Logger.error('❌ Cache clear error:', error);
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
            errors: 0,
        };
    }
    /**
     * Build cache key with optional prefix
     */
    buildKey(key, prefix) {
        const fullKey = prefix ? `${prefix}:${key}` : key;
        // Ensure key doesn't exceed Redis key length limit
        if (fullKey.length > this.MAX_KEY_LENGTH) {
            // Use hash of the key if it's too long
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256').update(fullKey).digest('hex').substring(0, 32);
            return prefix ? `${prefix}:${hash}` : hash;
        }
        return fullKey;
    }
    /**
     * Add cache key to tag sets for invalidation
     */
    addToTags(cacheKey, tags) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                for (const tag of tags) {
                    const tagKey = `tag:${tag}`;
                    yield redis_1.redisOperations.sadd(tagKey, cacheKey);
                    // Set expiration for tag sets (longer than cache entries)
                    yield redis_1.redisOperations.expire(tagKey, this.DEFAULT_TTL * 2);
                }
            }
            catch (error) {
                logger_1.Logger.error('❌ Error adding cache key to tags:', { cacheKey, tags, error });
            }
        });
    }
}
// Singleton instance
exports.cacheService = new CacheService();
// Specific cache services for different domains
class AnalyticsCacheService {
    constructor() {
        this.cache = exports.cacheService;
        this.PREFIX = 'analytics';
        this.TTL = {
            realtime: 300, // 5 minutes
            hourly: 3600, // 1 hour
            daily: 86400, // 24 hours
        };
    }
    getTeacherAnalytics(teacherId, period) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `teacher:${teacherId}:${period}`;
            return this.cache.get(key, { prefix: this.PREFIX, ttl: this.TTL.hourly });
        });
    }
    setTeacherAnalytics(teacherId, period, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `teacher:${teacherId}:${period}`;
            return this.cache.set(key, data, {
                prefix: this.PREFIX,
                ttl: this.TTL.hourly,
                tags: [`teacher:${teacherId}`, 'analytics'],
            });
        });
    }
    invalidateTeacher(teacherId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.cache.invalidateByTags([`teacher:${teacherId}`]);
        });
    }
}
exports.AnalyticsCacheService = AnalyticsCacheService;
class MessagingCacheService {
    constructor() {
        this.cache = exports.cacheService;
        this.PREFIX = 'messaging';
        this.TTL = {
            conversations: 1800, // 30 minutes
            messages: 900, // 15 minutes
            unreadCounts: 300, // 5 minutes
        };
    }
    getConversations(userId, userType) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `conversations:${userType}:${userId}`;
            return this.cache.get(key, { prefix: this.PREFIX, ttl: this.TTL.conversations });
        });
    }
    setConversations(userId, userType, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `conversations:${userType}:${userId}`;
            return this.cache.set(key, data, {
                prefix: this.PREFIX,
                ttl: this.TTL.conversations,
                tags: [`user:${userId}`, 'conversations'],
            });
        });
    }
    invalidateUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.cache.invalidateByTags([`user:${userId}`]);
        });
    }
}
exports.MessagingCacheService = MessagingCacheService;
exports.analyticsCacheService = new AnalyticsCacheService();
exports.messagingCacheService = new MessagingCacheService();
exports.default = exports.cacheService;
