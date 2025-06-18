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
exports.QueryCacheService = void 0;
const BaseRedisService_1 = require("./BaseRedisService");
const interfaces_1 = require("./interfaces");
const crypto_1 = __importDefault(require("crypto"));
class QueryCacheService extends BaseRedisService_1.BaseRedisService {
    constructor(client, monitoring) {
        super(client, monitoring);
        this.defaultTTL = 3600; // 1 hour
        this.compressionThreshold = 1024; // Compress results larger than 1KB
    }
    // Generate cache key from query and parameters
    generateCacheKey(query, params = {}) {
        const normalizedQuery = query.replace(/\s+/g, ' ').trim();
        const paramsString = JSON.stringify(params, Object.keys(params).sort());
        const hash = crypto_1.default.createHash('sha256').update(normalizedQuery + paramsString).digest('hex');
        return interfaces_1.RedisKeys.QUERY_RESULT(hash);
    }
    // Cache query result
    cacheQuery(query_1, params_1, result_1) {
        return __awaiter(this, arguments, void 0, function* (query, params, result, options = {}) {
            const cacheKey = this.generateCacheKey(query, params);
            const ttl = options.ttl || this.defaultTTL;
            const tags = options.tags || [];
            const version = options.version || '1.0';
            return this.executeWithMonitoring('cache_query', () => __awaiter(this, void 0, void 0, function* () {
                const cachedQuery = {
                    query,
                    params,
                    result,
                    cachedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
                    tags,
                    version,
                    hitCount: 0,
                    lastAccessed: new Date().toISOString(),
                };
                const serializedData = JSON.stringify(cachedQuery);
                // Compress if data is large
                let dataToStore = serializedData;
                if (options.compression && serializedData.length > this.compressionThreshold) {
                    // In a real implementation, you'd use a compression library like zlib
                    // For now, we'll just mark it as compressed
                    cachedQuery.result = { __compressed: true, data: cachedQuery.result };
                    dataToStore = JSON.stringify(cachedQuery);
                }
                const pipeline = this.client.pipeline();
                // Store the cached query
                pipeline.setex(cacheKey, ttl, dataToStore);
                // Add to tag sets for invalidation
                tags.forEach(tag => {
                    const tagKey = `cache:tag:${tag}`;
                    pipeline.sadd(tagKey, cacheKey);
                    pipeline.expire(tagKey, ttl + 300); // Tag expires 5 minutes after content
                });
                // Track cache statistics
                pipeline.incr('cache:stats:queries:stored');
                pipeline.incr(`cache:stats:queries:stored:${new Date().toISOString().slice(0, 10)}`);
                pipeline.expire(`cache:stats:queries:stored:${new Date().toISOString().slice(0, 10)}`, 86400 * 7);
                yield pipeline.exec();
                console.log(`📦 Query cached: ${cacheKey.slice(-8)}... (TTL: ${ttl}s)`);
            }));
        });
    }
    // Get cached query result
    getCachedQuery(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, params = {}) {
            const cacheKey = this.generateCacheKey(query, params);
            return this.executeWithMonitoring('get_cached_query', () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const data = yield this.client.get(cacheKey);
                if (!data) {
                    // Track cache miss
                    yield this.client.incr('cache:stats:queries:misses');
                    return null;
                }
                try {
                    const cachedQuery = JSON.parse(data);
                    // Update hit count and last accessed time
                    cachedQuery.hitCount++;
                    cachedQuery.lastAccessed = new Date().toISOString();
                    // Update the cached data with new stats
                    const ttl = yield this.client.ttl(cacheKey);
                    if (ttl > 0) {
                        yield this.client.setex(cacheKey, ttl, JSON.stringify(cachedQuery));
                    }
                    // Track cache hit
                    yield this.client.incr('cache:stats:queries:hits');
                    console.log(`🎯 Query cache hit: ${cacheKey.slice(-8)}... (hits: ${cachedQuery.hitCount})`);
                    // Handle decompression if needed
                    if ((_a = cachedQuery.result) === null || _a === void 0 ? void 0 : _a.__compressed) {
                        // In a real implementation, you'd decompress here
                        return cachedQuery.result.data;
                    }
                    return cachedQuery.result;
                }
                catch (error) {
                    console.error('Error parsing cached query:', error);
                    // Remove corrupted cache entry
                    yield this.client.del(cacheKey);
                    return null;
                }
            }));
        });
    }
    // Cache with fallback function
    cacheWithFallback(query_1, params_1, fallbackFn_1) {
        return __awaiter(this, arguments, void 0, function* (query, params, fallbackFn, options = {}) {
            return this.executeWithMonitoring('cache_with_fallback', () => __awaiter(this, void 0, void 0, function* () {
                // Try to get from cache first
                const cachedResult = yield this.getCachedQuery(query, params);
                if (cachedResult !== null) {
                    return cachedResult;
                }
                // Cache miss - execute fallback function
                const freshResult = yield fallbackFn();
                // Cache the fresh result
                yield this.cacheQuery(query, params, freshResult, options);
                return freshResult;
            }));
        });
    }
    // Invalidate cache by tags
    invalidateByTags(tags) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('invalidate_by_tags', () => __awaiter(this, void 0, void 0, function* () {
                let totalInvalidated = 0;
                for (const tag of tags) {
                    const tagKey = `cache:tag:${tag}`;
                    const cacheKeys = yield this.client.smembers(tagKey);
                    if (cacheKeys.length > 0) {
                        const pipeline = this.client.pipeline();
                        // Delete all cached queries with this tag
                        cacheKeys.forEach(key => pipeline.del(key));
                        // Delete the tag set
                        pipeline.del(tagKey);
                        yield pipeline.exec();
                        totalInvalidated += cacheKeys.length;
                        console.log(`🗑️ Invalidated ${cacheKeys.length} queries with tag: ${tag}`);
                    }
                }
                // Track invalidation stats
                yield this.client.incrby('cache:stats:queries:invalidated', totalInvalidated);
                return totalInvalidated;
            }));
        });
    }
    // Invalidate cache by pattern
    invalidateByPattern(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('invalidate_by_pattern', () => __awaiter(this, void 0, void 0, function* () {
                const keys = yield this.client.keys(pattern);
                if (keys.length === 0) {
                    return 0;
                }
                yield this.client.del(...keys);
                // Track invalidation stats
                yield this.client.incrby('cache:stats:queries:invalidated', keys.length);
                console.log(`🗑️ Invalidated ${keys.length} queries matching pattern: ${pattern}`);
                return keys.length;
            }));
        });
    }
    // Get cache statistics
    getCacheStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('get_cache_stats', () => __awaiter(this, void 0, void 0, function* () {
                const [hits, misses, stored, invalidated] = yield Promise.all([
                    this.client.get('cache:stats:queries:hits'),
                    this.client.get('cache:stats:queries:misses'),
                    this.client.get('cache:stats:queries:stored'),
                    this.client.get('cache:stats:queries:invalidated'),
                ]);
                const hitsNum = parseInt(hits || '0');
                const missesNum = parseInt(misses || '0');
                const storedNum = parseInt(stored || '0');
                const invalidatedNum = parseInt(invalidated || '0');
                const totalQueries = hitsNum + missesNum;
                const hitRate = totalQueries > 0 ? (hitsNum / totalQueries) * 100 : 0;
                return {
                    hits: hitsNum,
                    misses: missesNum,
                    hitRate,
                    stored: storedNum,
                    invalidated: invalidatedNum,
                    totalQueries,
                };
            }));
        });
    }
    // Get popular queries
    getPopularQueries() {
        return __awaiter(this, arguments, void 0, function* (limit = 10) {
            return this.executeWithMonitoring('get_popular_queries', () => __awaiter(this, void 0, void 0, function* () {
                // This is a simplified implementation
                // In production, you might want to maintain a separate sorted set for popular queries
                const pattern = 'cache:query:*';
                const keys = yield this.client.keys(pattern);
                const queries = [];
                for (const key of keys.slice(0, limit * 2)) { // Get more than needed to filter
                    try {
                        const data = yield this.client.get(key);
                        if (data) {
                            const cachedQuery = JSON.parse(data);
                            queries.push({
                                query: cachedQuery.query,
                                hitCount: cachedQuery.hitCount,
                                lastAccessed: cachedQuery.lastAccessed,
                                tags: cachedQuery.tags,
                            });
                        }
                    }
                    catch (error) {
                        // Skip invalid entries
                        continue;
                    }
                }
                // Sort by hit count and return top queries
                return queries
                    .sort((a, b) => b.hitCount - a.hitCount)
                    .slice(0, limit);
            }));
        });
    }
    // Warm cache with predefined queries
    warmCache(queries) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('warm_cache', () => __awaiter(this, void 0, void 0, function* () {
                let warmedCount = 0;
                for (const { query, params, fetchFn, options } of queries) {
                    try {
                        // Check if already cached
                        const existing = yield this.getCachedQuery(query, params);
                        if (existing === null) {
                            // Not cached, fetch and cache
                            const result = yield fetchFn();
                            yield this.cacheQuery(query, params, result, options);
                            warmedCount++;
                        }
                    }
                    catch (error) {
                        console.error(`Error warming cache for query: ${query}`, error);
                    }
                }
                console.log(`🔥 Cache warmed: ${warmedCount} queries`);
                return warmedCount;
            }));
        });
    }
    // Clean expired entries (manual cleanup)
    cleanExpiredEntries() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('clean_expired_entries', () => __awaiter(this, void 0, void 0, function* () {
                // Redis automatically removes expired keys, but we can clean up orphaned tag references
                const tagPattern = 'cache:tag:*';
                const tagKeys = yield this.client.keys(tagPattern);
                let cleanedCount = 0;
                for (const tagKey of tagKeys) {
                    const cacheKeys = yield this.client.smembers(tagKey);
                    const existingKeys = yield this.existsMultiple(cacheKeys);
                    // Remove references to non-existent cache keys
                    const keysToRemove = cacheKeys.filter((_, index) => !existingKeys[index]);
                    if (keysToRemove.length > 0) {
                        yield this.client.srem(tagKey, ...keysToRemove);
                        cleanedCount += keysToRemove.length;
                    }
                    // Remove empty tag sets
                    const remainingCount = yield this.client.scard(tagKey);
                    if (remainingCount === 0) {
                        yield this.client.del(tagKey);
                    }
                }
                console.log(`🧹 Cleaned ${cleanedCount} orphaned cache references`);
                return cleanedCount;
            }));
        });
    }
    // Reset cache statistics
    resetStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('reset_stats', () => __awaiter(this, void 0, void 0, function* () {
                const statsKeys = [
                    'cache:stats:queries:hits',
                    'cache:stats:queries:misses',
                    'cache:stats:queries:stored',
                    'cache:stats:queries:invalidated',
                ];
                yield this.client.del(...statsKeys);
                console.log('📊 Cache statistics reset');
            }));
        });
    }
    // Get cache size information
    getCacheSize() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('get_cache_size', () => __awaiter(this, void 0, void 0, function* () {
                const pattern = 'cache:query:*';
                const keys = yield this.client.keys(pattern);
                let totalMemory = 0;
                // Sample a subset of keys to estimate memory usage
                const sampleSize = Math.min(100, keys.length);
                const sampleKeys = keys.slice(0, sampleSize);
                for (const key of sampleKeys) {
                    try {
                        const data = yield this.client.get(key);
                        if (data) {
                            totalMemory += Buffer.byteLength(data, 'utf8');
                        }
                    }
                    catch (error) {
                        // Skip invalid entries
                        continue;
                    }
                }
                // Extrapolate total memory usage
                const estimatedTotalMemory = sampleSize > 0
                    ? (totalMemory / sampleSize) * keys.length
                    : 0;
                const averageKeySize = keys.length > 0 ? estimatedTotalMemory / keys.length : 0;
                return {
                    totalKeys: keys.length,
                    totalMemory: Math.round(estimatedTotalMemory),
                    averageKeySize: Math.round(averageKeySize),
                };
            }));
        });
    }
}
exports.QueryCacheService = QueryCacheService;
