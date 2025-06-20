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
exports.CacheService = void 0;
const BaseRedisService_1 = require("./BaseRedisService");
const interfaces_1 = require("./interfaces");
class CacheService extends BaseRedisService_1.BaseRedisService {
    constructor(client, monitoring, defaultTTL = 3600, _strategy = interfaces_1.CacheStrategy.CACHE_ASIDE) {
        super(client, monitoring);
        this.defaultTTL = 3600; // 1 hour default TTL
        this.defaultTTL = defaultTTL;
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_get', () => __awaiter(this, void 0, void 0, function* () {
                const value = yield this.client.get(key);
                return this.deserializeValue(value);
            }));
        });
    }
    set(key, value, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const ttl = ttlSeconds || this.defaultTTL;
            return this.executeWithMonitoring('cache_set', () => __awaiter(this, void 0, void 0, function* () {
                const serializedValue = this.serializeValue(value);
                yield this.client.setex(key, ttl, serializedValue);
            }));
        });
    }
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_del', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.del(key);
            }));
        });
    }
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_exists', () => __awaiter(this, void 0, void 0, function* () {
                const result = yield this.client.exists(key);
                return result === 1;
            }));
        });
    }
    expire(key, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.setExpiration(key, ttlSeconds);
        });
    }
    ttl(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getTTL(key);
        });
    }
    mget(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getMultipleKeys(keys);
        });
    }
    mset(keyValuePairs, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.setMultipleKeys(keyValuePairs, ttlSeconds || this.defaultTTL);
        });
    }
    invalidatePattern(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.deletePattern(pattern);
        });
    }
    getWithFallback(key, fallbackFn, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_get_with_fallback', () => __awaiter(this, void 0, void 0, function* () {
                // Try to get from cache first
                const cachedValue = yield this.get(key);
                if (cachedValue !== null) {
                    return cachedValue;
                }
                // Cache miss - execute fallback function
                const freshValue = yield fallbackFn();
                // Cache the fresh value
                yield this.set(key, freshValue, ttlSeconds);
                return freshValue;
            }));
        });
    }
    // Advanced caching methods
    getOrSetWithLock(key_1, fallbackFn_1, ttlSeconds_1) {
        return __awaiter(this, arguments, void 0, function* (key, fallbackFn, ttlSeconds, lockTtlSeconds = 30) {
            const lockKey = `lock:${key}`;
            return this.executeWithMonitoring('cache_get_or_set_with_lock', () => __awaiter(this, void 0, void 0, function* () {
                // Try to get from cache first
                const cachedValue = yield this.get(key);
                if (cachedValue !== null) {
                    return cachedValue;
                }
                // Try to acquire lock
                const lockAcquired = yield this.client.set(lockKey, '1', 'EX', lockTtlSeconds, 'NX');
                if (lockAcquired === 'OK') {
                    try {
                        // Double-check cache after acquiring lock
                        const doubleCheckValue = yield this.get(key);
                        if (doubleCheckValue !== null) {
                            return doubleCheckValue;
                        }
                        // Execute fallback and cache result
                        const freshValue = yield fallbackFn();
                        yield this.set(key, freshValue, ttlSeconds);
                        return freshValue;
                    }
                    finally {
                        // Release lock
                        yield this.client.del(lockKey);
                    }
                }
                else {
                    // Lock not acquired, wait and retry
                    yield new Promise(resolve => setTimeout(resolve, 100));
                    return this.getOrSetWithLock(key, fallbackFn, ttlSeconds, lockTtlSeconds);
                }
            }));
        });
    }
    setWithTags(key, value, tags, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const ttl = ttlSeconds || this.defaultTTL;
            return this.executeWithMonitoring('cache_set_with_tags', () => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.client.pipeline();
                // Set the main value
                const serializedValue = this.serializeValue(value);
                pipeline.setex(key, ttl, serializedValue);
                // Add key to each tag set
                tags.forEach(tag => {
                    const tagKey = `tag:${tag}`;
                    pipeline.sadd(tagKey, key);
                    pipeline.expire(tagKey, ttl + 300); // Tag expires 5 minutes after content
                });
                yield pipeline.exec();
            }));
        });
    }
    invalidateByTag(tag) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_invalidate_by_tag', () => __awaiter(this, void 0, void 0, function* () {
                const tagKey = `tag:${tag}`;
                const keys = yield this.client.smembers(tagKey);
                if (keys.length === 0) {
                    return 0;
                }
                const pipeline = this.client.pipeline();
                keys.forEach(key => pipeline.del(key));
                pipeline.del(tagKey); // Remove the tag set itself
                const results = yield pipeline.exec();
                return (results === null || results === void 0 ? void 0 : results.length) || 0;
            }));
        });
    }
    incrementCounter(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, increment = 1, ttlSeconds) {
            return this.executeWithMonitoring('cache_increment', () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const pipeline = this.client.pipeline();
                pipeline.incrby(key, increment);
                if (ttlSeconds) {
                    pipeline.expire(key, ttlSeconds);
                }
                const results = yield pipeline.exec();
                return ((_a = results === null || results === void 0 ? void 0 : results[0]) === null || _a === void 0 ? void 0 : _a[1]) || 0;
            }));
        });
    }
    decrementCounter(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, decrement = 1) {
            return this.executeWithMonitoring('cache_decrement', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.decrby(key, decrement);
            }));
        });
    }
    addToSet(key, membersOrFirst, ttlSecondsOrSecond, ...restMembers) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_add_to_set', () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const pipeline = this.client.pipeline();
                // Handle both signatures
                let members;
                let ttlSeconds;
                if (Array.isArray(membersOrFirst)) {
                    // Called with array: addToSet(key, members[], ttl?)
                    members = membersOrFirst;
                    ttlSeconds = ttlSecondsOrSecond;
                }
                else {
                    // Called with rest params: addToSet(key, ...members)
                    members = [membersOrFirst, ...(typeof ttlSecondsOrSecond === 'string' ? [ttlSecondsOrSecond] : []), ...restMembers];
                    ttlSeconds = undefined;
                }
                pipeline.sadd(key, ...members);
                if (ttlSeconds) {
                    pipeline.expire(key, ttlSeconds);
                }
                const results = yield pipeline.exec();
                return ((_a = results === null || results === void 0 ? void 0 : results[0]) === null || _a === void 0 ? void 0 : _a[1]) || 0;
            }));
        });
    }
    removeFromSet(key, membersOrFirst, ...restMembers) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_remove_from_set', () => __awaiter(this, void 0, void 0, function* () {
                // Handle both signatures
                let members;
                if (Array.isArray(membersOrFirst)) {
                    // Called with array: removeFromSet(key, members[])
                    members = membersOrFirst;
                }
                else {
                    // Called with rest params: removeFromSet(key, ...members)
                    members = [membersOrFirst, ...restMembers];
                }
                return yield this.client.srem(key, ...members);
            }));
        });
    }
    getSetMembers(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_get_set_members', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.smembers(key);
            }));
        });
    }
    isSetMember(key, member) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_is_set_member', () => __awaiter(this, void 0, void 0, function* () {
                const result = yield this.client.sismember(key, member);
                return result === 1;
            }));
        });
    }
    setHash(key, hash, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_set_hash', () => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.client.pipeline();
                // Convert values to strings
                const stringHash = {};
                for (const [field, value] of Object.entries(hash)) {
                    stringHash[field] = this.serializeValue(value);
                }
                pipeline.hmset(key, stringHash);
                if (ttlSeconds) {
                    pipeline.expire(key, ttlSeconds);
                }
                yield pipeline.exec();
            }));
        });
    }
    getHash(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_get_hash', () => __awaiter(this, void 0, void 0, function* () {
                const hash = yield this.client.hgetall(key);
                if (Object.keys(hash).length === 0) {
                    return null;
                }
                const result = {};
                for (const [field, value] of Object.entries(hash)) {
                    const deserializedValue = this.deserializeValue(value);
                    if (deserializedValue !== null) {
                        result[field] = deserializedValue;
                    }
                }
                return result;
            }));
        });
    }
    getHashField(key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_get_hash_field', () => __awaiter(this, void 0, void 0, function* () {
                const value = yield this.client.hget(key, field);
                return this.deserializeValue(value);
            }));
        });
    }
    setHashField(key, field, value, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_set_hash_field', () => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.client.pipeline();
                pipeline.hset(key, field, this.serializeValue(value));
                if (ttlSeconds) {
                    pipeline.expire(key, ttlSeconds);
                }
                yield pipeline.exec();
            }));
        });
    }
    deleteHashField(key, fieldsOrFirst, ...restFields) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_delete_hash_field', () => __awaiter(this, void 0, void 0, function* () {
                // Handle both signatures
                let fields;
                if (Array.isArray(fieldsOrFirst)) {
                    // Called with array: deleteHashField(key, fields[])
                    fields = fieldsOrFirst;
                }
                else {
                    // Called with rest params: deleteHashField(key, ...fields)
                    fields = [fieldsOrFirst, ...restFields];
                }
                return yield this.client.hdel(key, ...fields);
            }));
        });
    }
    // Cache statistics and monitoring
    getCacheStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_get_stats', () => __awaiter(this, void 0, void 0, function* () {
                const info = yield this.client.info('stats');
                // const keyspaceInfo = await this.client.info('keyspace'); // TODO: Use for key count
                // Parse Redis info output
                const stats = {
                    hits: 0,
                    misses: 0,
                    hitRate: 0,
                    keyCount: 0,
                    memoryUsage: 0
                };
                // Extract stats from Redis info (simplified parsing)
                const lines = info.split('\r\n');
                for (const line of lines) {
                    if (line.startsWith('keyspace_hits:')) {
                        stats.hits = parseInt(line.split(':')[1]);
                    }
                    else if (line.startsWith('keyspace_misses:')) {
                        stats.misses = parseInt(line.split(':')[1]);
                    }
                }
                stats.hitRate = stats.hits + stats.misses > 0
                    ? stats.hits / (stats.hits + stats.misses)
                    : 0;
                return stats;
            }));
        });
    }
    // Batch operations for better performance
    batchGet(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_batch_get', () => __awaiter(this, void 0, void 0, function* () {
                const values = yield this.mget(keys);
                const result = new Map();
                keys.forEach((key, index) => {
                    result.set(key, values[index]);
                });
                return result;
            }));
        });
    }
    batchSet(items, defaultTtl) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('cache_batch_set', () => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.client.pipeline();
                items.forEach(({ key, value, ttl }) => {
                    const serializedValue = this.serializeValue(value);
                    const finalTtl = ttl || defaultTtl || this.defaultTTL;
                    pipeline.setex(key, finalTtl, serializedValue);
                });
                yield pipeline.exec();
            }));
        });
    }
    batchDelete(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keys.length === 0) {
                return 0;
            }
            return this.executeWithMonitoring('cache_batch_delete', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.del(...keys);
            }));
        });
    }
}
exports.CacheService = CacheService;
