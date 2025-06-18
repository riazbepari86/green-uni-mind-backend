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
exports.smartCacheService = exports.SmartCacheService = void 0;
const RedisServiceManager_1 = require("../redis/RedisServiceManager");
class SmartCacheService {
    constructor() {
        this.compressionThreshold = 1024; // 1KB
        this.maxL1Size = 1000; // Maximum items in L1 cache
        this.maxL1Memory = 50 * 1024 * 1024; // 50MB max for L1 cache
        this.redis = RedisServiceManager_1.redisServiceManager.cacheClient;
        // Initialize L1 cache with simple Map for now
        this.l1Cache = new Map();
        this.stats = {
            l1: { hits: 0, misses: 0, size: 0, maxSize: this.maxL1Size, hitRate: 0 },
            l2: { hits: 0, misses: 0, hitRate: 0 },
            total: { hits: 0, misses: 0, hitRate: 0 }
        };
        // Update stats periodically
        setInterval(() => this.updateStats(), 60000); // Every minute
    }
    get(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, options = {}) {
            const startTime = Date.now();
            try {
                // Try L1 cache first (unless l2Only is specified)
                if (!options.l2Only) {
                    const l1Result = this.getFromL1(key);
                    if (l1Result !== null) {
                        this.stats.l1.hits++;
                        this.stats.total.hits++;
                        console.log(`🎯 L1 Cache Hit: ${key} (${Date.now() - startTime}ms)`);
                        return l1Result;
                    }
                    this.stats.l1.misses++;
                }
                // Try L2 cache (Redis) if not l1Only
                if (!options.l1Only) {
                    const l2Result = yield this.getFromL2(key);
                    if (l2Result !== null) {
                        this.stats.l2.hits++;
                        this.stats.total.hits++;
                        // Promote to L1 cache if it's high priority
                        if (this.shouldPromoteToL1(options.priority)) {
                            this.setToL1(key, l2Result, options.ttl || 900); // 15 minutes default
                        }
                        console.log(`🎯 L2 Cache Hit: ${key} (${Date.now() - startTime}ms)`);
                        return l2Result;
                    }
                    this.stats.l2.misses++;
                }
                this.stats.total.misses++;
                console.log(`❌ Cache Miss: ${key} (${Date.now() - startTime}ms)`);
                return null;
            }
            catch (error) {
                console.error(`Cache get error for key ${key}:`, error);
                return null;
            }
        });
    }
    set(key_1, value_1) {
        return __awaiter(this, arguments, void 0, function* (key, value, options = {}) {
            const ttl = options.ttl || this.getSmartTTL(key, options.priority);
            const serializedValue = JSON.stringify(value);
            const size = Buffer.byteLength(serializedValue, 'utf8');
            try {
                // Determine caching strategy based on options and value characteristics
                const strategy = this.determineCachingStrategy(key, size, options);
                if (strategy.useL1) {
                    this.setToL1(key, value, ttl, size);
                }
                if (strategy.useL2) {
                    yield this.setToL2(key, value, ttl, options.compress);
                }
                console.log(`📦 Cached: ${key} (L1: ${strategy.useL1}, L2: ${strategy.useL2}, TTL: ${ttl}s, Size: ${size}B)`);
            }
            catch (error) {
                console.error(`Cache set error for key ${key}:`, error);
            }
        });
    }
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Remove from both caches
                this.l1Cache.delete(key);
                yield this.redis.del(key);
                console.log(`🗑️ Cache deleted: ${key}`);
            }
            catch (error) {
                console.error(`Cache delete error for key ${key}:`, error);
            }
        });
    }
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.l1Cache.has(key) || (yield this.redis.exists(key)) === 1;
            }
            catch (error) {
                console.error(`Cache exists error for key ${key}:`, error);
                return false;
            }
        });
    }
    getFromL1(key) {
        const entry = this.l1Cache.get(key);
        if (!entry)
            return null;
        // Check if expired
        if (Date.now() > entry.timestamp + entry.ttl * 1000) {
            this.l1Cache.delete(key);
            return null;
        }
        entry.hits++;
        return entry.value;
    }
    getFromL2(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.redis.get(key);
                if (!data)
                    return null;
                const parsed = JSON.parse(data);
                // Handle compressed data
                if (parsed.__compressed) {
                    // In a real implementation, you'd decompress here
                    return parsed.data;
                }
                return parsed;
            }
            catch (error) {
                console.error(`L2 cache get error for key ${key}:`, error);
                return null;
            }
        });
    }
    setToL1(key, value, ttl, size) {
        const entry = {
            value,
            timestamp: Date.now(),
            ttl,
            hits: 0,
            size: size || Buffer.byteLength(JSON.stringify(value), 'utf8')
        };
        this.l1Cache.set(key, entry);
    }
    setToL2(key, value, ttl, compress) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let dataToStore = value;
                // Compress large values
                if (compress || (JSON.stringify(value).length > this.compressionThreshold)) {
                    // In a real implementation, you'd use actual compression
                    dataToStore = { __compressed: true, data: value };
                }
                yield this.redis.setex(key, ttl, JSON.stringify(dataToStore));
            }
            catch (error) {
                console.error(`L2 cache set error for key ${key}:`, error);
            }
        });
    }
    determineCachingStrategy(key, size, options) {
        // Force L1 or L2 only if specified
        if (options.l1Only)
            return { useL1: true, useL2: false };
        if (options.l2Only)
            return { useL1: false, useL2: true };
        // Critical data goes to both caches
        if (options.priority === 'critical') {
            return { useL1: true, useL2: true };
        }
        // Large values (>100KB) go to L2 only to save L1 memory
        if (size > 100 * 1024) {
            return { useL1: false, useL2: true };
        }
        // High priority or small values go to L1
        if (options.priority === 'high' || size < 10 * 1024) {
            return { useL1: true, useL2: true };
        }
        // Medium priority goes to L2 only
        if (options.priority === 'medium') {
            return { useL1: false, useL2: true };
        }
        // Low priority might not be cached at all if memory is tight
        if (options.priority === 'low' && this.isMemoryTight()) {
            return { useL1: false, useL2: false };
        }
        // Default: use both caches
        return { useL1: true, useL2: true };
    }
    shouldPromoteToL1(priority) {
        return priority === 'critical' || priority === 'high';
    }
    getSmartTTL(key, priority) {
        // Smart TTL based on key pattern and priority
        if (key.includes('jwt') || key.includes('session'))
            return 3600; // 1 hour
        if (key.includes('otp'))
            return 300; // 5 minutes
        if (key.includes('user'))
            return 900; // 15 minutes
        if (key.includes('cache:query'))
            return 1800; // 30 minutes
        if (key.includes('api:cache'))
            return 600; // 10 minutes
        // Priority-based TTL
        switch (priority) {
            case 'critical': return 3600; // 1 hour
            case 'high': return 1800; // 30 minutes
            case 'medium': return 900; // 15 minutes
            case 'low': return 300; // 5 minutes
            default: return 600; // 10 minutes
        }
    }
    isMemoryTight() {
        return this.l1Cache.size > this.maxL1Size * 0.8; // 80% of max items
    }
    updateStats() {
        this.stats.l1.size = this.l1Cache.size;
        this.stats.l1.hitRate = this.stats.l1.hits / (this.stats.l1.hits + this.stats.l1.misses) * 100;
        this.stats.l2.hitRate = this.stats.l2.hits / (this.stats.l2.hits + this.stats.l2.misses) * 100;
        this.stats.total.hitRate = this.stats.total.hits / (this.stats.total.hits + this.stats.total.misses) * 100;
    }
    getStats() {
        this.updateStats();
        return Object.assign({}, this.stats);
    }
    // Clear L1 cache
    clearL1() {
        this.l1Cache.clear();
        console.log('🧹 L1 cache cleared');
    }
    // Clear L2 cache (Redis)
    clearL2() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.flushdb();
                console.log('🧹 L2 cache cleared');
            }
            catch (error) {
                console.error('Error clearing L2 cache:', error);
            }
        });
    }
    // Clear both caches
    clearAll() {
        return __awaiter(this, void 0, void 0, function* () {
            this.clearL1();
            yield this.clearL2();
            console.log('🧹 All caches cleared');
        });
    }
}
exports.SmartCacheService = SmartCacheService;
exports.smartCacheService = new SmartCacheService();
