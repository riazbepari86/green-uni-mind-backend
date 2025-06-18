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
exports.ApiCacheService = void 0;
const BaseRedisService_1 = require("./BaseRedisService");
const interfaces_1 = require("./interfaces");
const crypto_1 = __importDefault(require("crypto"));
class ApiCacheService extends BaseRedisService_1.BaseRedisService {
    constructor(client, monitoring) {
        super(client, monitoring);
        this.defaultTTL = 300; // 5 minutes
    }
    // Generate cache key for API request
    generateCacheKey(req, options = {}) {
        var _a, _b;
        if (options.keyGenerator) {
            return options.keyGenerator(req);
        }
        const method = req.method;
        const path = req.path;
        const query = req.query;
        // Include vary-by headers in key generation
        const varyHeaders = {};
        if (options.varyBy) {
            options.varyBy.forEach(header => {
                const value = req.get(header);
                if (value) {
                    varyHeaders[header.toLowerCase()] = value;
                }
            });
        }
        // Include user context if available
        const userContext = {
            userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id,
            role: (_b = req.user) === null || _b === void 0 ? void 0 : _b.role,
        };
        const keyData = {
            method,
            path,
            query,
            varyHeaders,
            userContext,
        };
        const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
        const hash = crypto_1.default.createHash('sha256').update(keyString).digest('hex');
        return interfaces_1.RedisKeys.API_RESPONSE(path, hash);
    }
    // Generate ETag for response
    generateETag(data) {
        const content = typeof data === 'string' ? data : JSON.stringify(data);
        return crypto_1.default.createHash('md5').update(content).digest('hex');
    }
    // Cache API response
    cacheResponse(req_1, res_1, data_1) {
        return __awaiter(this, arguments, void 0, function* (req, res, data, options = {}) {
            const cacheKey = this.generateCacheKey(req, options);
            const ttl = options.ttl || this.defaultTTL;
            const tags = options.tags || [];
            return this.executeWithMonitoring('cache_api_response', () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const etag = this.generateETag(data);
                const cachedResponse = {
                    statusCode: res.statusCode,
                    headers: {
                        'content-type': res.get('content-type') || 'application/json',
                        'etag': etag,
                    },
                    body: data,
                    cachedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
                    etag,
                    tags,
                    hitCount: 0,
                    lastAccessed: new Date().toISOString(),
                    requestInfo: {
                        method: req.method,
                        url: req.originalUrl,
                        userAgent: req.get('User-Agent'),
                        userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id,
                    },
                };
                const pipeline = this.client.pipeline();
                // Store the cached response
                pipeline.setex(cacheKey, ttl, JSON.stringify(cachedResponse));
                // Add to tag sets for invalidation
                tags.forEach(tag => {
                    const tagKey = `api:cache:tag:${tag}`;
                    pipeline.sadd(tagKey, cacheKey);
                    pipeline.expire(tagKey, ttl + 300);
                });
                // Track cache statistics
                pipeline.incr('api:cache:stats:responses:stored');
                pipeline.incr(`api:cache:stats:responses:stored:${new Date().toISOString().slice(0, 10)}`);
                pipeline.expire(`api:cache:stats:responses:stored:${new Date().toISOString().slice(0, 10)}`, 86400 * 7);
                yield pipeline.exec();
                console.log(`📦 API response cached: ${req.method} ${req.path} (TTL: ${ttl}s)`);
            }));
        });
    }
    // Get cached API response
    getCachedResponse(req_1) {
        return __awaiter(this, arguments, void 0, function* (req, options = {}) {
            const cacheKey = this.generateCacheKey(req, options);
            return this.executeWithMonitoring('get_cached_api_response', () => __awaiter(this, void 0, void 0, function* () {
                const data = yield this.client.get(cacheKey);
                if (!data) {
                    // Track cache miss
                    yield this.client.incr('api:cache:stats:responses:misses');
                    if (options.onMiss) {
                        options.onMiss(req);
                    }
                    return null;
                }
                try {
                    const cachedResponse = JSON.parse(data);
                    // Update hit count and last accessed time
                    cachedResponse.hitCount++;
                    cachedResponse.lastAccessed = new Date().toISOString();
                    // Update the cached data with new stats
                    const ttl = yield this.client.ttl(cacheKey);
                    if (ttl > 0) {
                        yield this.client.setex(cacheKey, ttl, JSON.stringify(cachedResponse));
                    }
                    // Track cache hit
                    yield this.client.incr('api:cache:stats:responses:hits');
                    if (options.onHit) {
                        options.onHit(req, cachedResponse);
                    }
                    console.log(`🎯 API cache hit: ${req.method} ${req.path} (hits: ${cachedResponse.hitCount})`);
                    return cachedResponse;
                }
                catch (error) {
                    console.error('Error parsing cached API response:', error);
                    // Remove corrupted cache entry
                    yield this.client.del(cacheKey);
                    return null;
                }
            }));
        });
    }
    // Middleware for automatic API caching
    cache(options = {}) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Skip caching for certain conditions
                if (options.skipCache && options.skipCache(req)) {
                    return next();
                }
                // Skip caching for non-GET requests by default
                if (req.method !== 'GET') {
                    return next();
                }
                // Check condition if provided
                if (options.condition && !options.condition(req)) {
                    return next();
                }
                // Check for cached response
                const cachedResponse = yield this.getCachedResponse(req, options);
                if (cachedResponse) {
                    // Check if client has the same ETag (304 Not Modified)
                    const clientETag = req.get('If-None-Match');
                    if (clientETag && clientETag === cachedResponse.etag) {
                        return res.status(304).end();
                    }
                    // Set cache headers
                    res.set(cachedResponse.headers);
                    res.set('X-Cache', 'HIT');
                    res.set('X-Cache-Key', this.generateCacheKey(req, options).slice(-16));
                    return res.status(cachedResponse.statusCode).json(cachedResponse.body);
                }
                // Cache miss - intercept response
                const originalJson = res.json;
                const originalSend = res.send;
                const self = this;
                res.json = function (data) {
                    // Cache the response
                    setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            yield self.cacheResponse(req, res, data, options);
                        }
                        catch (error) {
                            console.error('Error caching API response:', error);
                        }
                    }));
                    // Set cache headers
                    res.set('X-Cache', 'MISS');
                    res.set('ETag', self.generateETag(data));
                    return originalJson.call(this, data);
                };
                res.send = function (data) {
                    // For non-JSON responses
                    if (typeof data === 'string' || Buffer.isBuffer(data)) {
                        setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                            try {
                                yield self.cacheResponse(req, res, data, options);
                            }
                            catch (error) {
                                console.error('Error caching API response:', error);
                            }
                        }));
                    }
                    res.set('X-Cache', 'MISS');
                    return originalSend.call(this, data);
                };
                next();
            }
            catch (error) {
                console.error('Error in API cache middleware:', error);
                next();
            }
        });
    }
    // Invalidate cache by tags
    invalidateByTags(tags) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('invalidate_api_cache_by_tags', () => __awaiter(this, void 0, void 0, function* () {
                let totalInvalidated = 0;
                for (const tag of tags) {
                    const tagKey = `api:cache:tag:${tag}`;
                    const cacheKeys = yield this.client.smembers(tagKey);
                    if (cacheKeys.length > 0) {
                        const pipeline = this.client.pipeline();
                        // Delete all cached responses with this tag
                        cacheKeys.forEach(key => pipeline.del(key));
                        // Delete the tag set
                        pipeline.del(tagKey);
                        yield pipeline.exec();
                        totalInvalidated += cacheKeys.length;
                        console.log(`🗑️ Invalidated ${cacheKeys.length} API responses with tag: ${tag}`);
                    }
                }
                // Track invalidation stats
                yield this.client.incrby('api:cache:stats:responses:invalidated', totalInvalidated);
                return totalInvalidated;
            }));
        });
    }
    // Invalidate cache by pattern
    invalidateByPattern(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('invalidate_api_cache_by_pattern', () => __awaiter(this, void 0, void 0, function* () {
                const keys = yield this.client.keys(pattern);
                if (keys.length === 0) {
                    return 0;
                }
                yield this.client.del(...keys);
                // Track invalidation stats
                yield this.client.incrby('api:cache:stats:responses:invalidated', keys.length);
                console.log(`🗑️ Invalidated ${keys.length} API responses matching pattern: ${pattern}`);
                return keys.length;
            }));
        });
    }
    // Get API cache statistics
    getApiCacheStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('get_api_cache_stats', () => __awaiter(this, void 0, void 0, function* () {
                const [hits, misses, stored, invalidated] = yield Promise.all([
                    this.client.get('api:cache:stats:responses:hits'),
                    this.client.get('api:cache:stats:responses:misses'),
                    this.client.get('api:cache:stats:responses:stored'),
                    this.client.get('api:cache:stats:responses:invalidated'),
                ]);
                const hitsNum = parseInt(hits || '0');
                const missesNum = parseInt(misses || '0');
                const storedNum = parseInt(stored || '0');
                const invalidatedNum = parseInt(invalidated || '0');
                const totalRequests = hitsNum + missesNum;
                const hitRate = totalRequests > 0 ? (hitsNum / totalRequests) * 100 : 0;
                return {
                    hits: hitsNum,
                    misses: missesNum,
                    hitRate,
                    stored: storedNum,
                    invalidated: invalidatedNum,
                    totalRequests,
                };
            }));
        });
    }
    // Get popular API endpoints
    getPopularEndpoints() {
        return __awaiter(this, arguments, void 0, function* (limit = 10) {
            return this.executeWithMonitoring('get_popular_api_endpoints', () => __awaiter(this, void 0, void 0, function* () {
                const pattern = 'cache:api:*';
                const keys = yield this.client.keys(pattern);
                const endpoints = [];
                for (const key of keys.slice(0, limit * 2)) {
                    try {
                        const data = yield this.client.get(key);
                        if (data) {
                            const cachedResponse = JSON.parse(data);
                            endpoints.push({
                                endpoint: cachedResponse.requestInfo.url,
                                method: cachedResponse.requestInfo.method,
                                hitCount: cachedResponse.hitCount,
                                lastAccessed: cachedResponse.lastAccessed,
                            });
                        }
                    }
                    catch (error) {
                        continue;
                    }
                }
                return endpoints
                    .sort((a, b) => b.hitCount - a.hitCount)
                    .slice(0, limit);
            }));
        });
    }
    // Warm API cache
    warmApiCache(endpoints) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('warm_api_cache', () => __awaiter(this, void 0, void 0, function* () {
                let warmedCount = 0;
                for (const { method, path, headers, query, fetchFn, options } of endpoints) {
                    try {
                        // Create mock request object
                        const mockReq = {
                            method,
                            path,
                            query: query || {},
                            get: (header) => headers === null || headers === void 0 ? void 0 : headers[header.toLowerCase()],
                            originalUrl: path + (query ? '?' + new URLSearchParams(query).toString() : ''),
                        };
                        // Check if already cached
                        const existing = yield this.getCachedResponse(mockReq, options);
                        if (!existing) {
                            // Not cached, fetch and cache
                            const result = yield fetchFn();
                            // Create mock response object
                            const mockRes = {
                                statusCode: 200,
                                get: () => 'application/json',
                            };
                            yield this.cacheResponse(mockReq, mockRes, result, options);
                            warmedCount++;
                        }
                    }
                    catch (error) {
                        console.error(`Error warming API cache for ${method} ${path}:`, error);
                    }
                }
                console.log(`🔥 API cache warmed: ${warmedCount} endpoints`);
                return warmedCount;
            }));
        });
    }
    // Clear all API cache
    clearApiCache() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('clear_api_cache', () => __awaiter(this, void 0, void 0, function* () {
                const pattern = 'cache:api:*';
                const keys = yield this.client.keys(pattern);
                if (keys.length === 0) {
                    return 0;
                }
                yield this.client.del(...keys);
                console.log(`🗑️ Cleared ${keys.length} API cache entries`);
                return keys.length;
            }));
        });
    }
}
exports.ApiCacheService = ApiCacheService;
