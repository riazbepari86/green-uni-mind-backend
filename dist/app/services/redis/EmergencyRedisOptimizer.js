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
exports.EmergencyRedisOptimizer = void 0;
const redis_1 = require("../../config/redis");
/**
 * Emergency Redis Optimizer
 * Implements immediate memory cleanup and TTL enforcement
 */
class EmergencyRedisOptimizer {
    constructor() {
        this.isRunning = false;
    }
    static getInstance() {
        if (!EmergencyRedisOptimizer.instance) {
            EmergencyRedisOptimizer.instance = new EmergencyRedisOptimizer();
        }
        return EmergencyRedisOptimizer.instance;
    }
    /**
     * Execute emergency Redis optimization
     */
    executeEmergencyOptimization() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning) {
                throw new Error('Emergency optimization already running');
            }
            this.isRunning = true;
            console.log('🚨 STARTING EMERGENCY REDIS OPTIMIZATION...');
            try {
                // Get memory usage before
                const memoryBefore = yield this.getMemoryUsage();
                console.log(`📊 Memory usage before: ${memoryBefore.toFixed(2)}%`);
                let totalKeysDeleted = 0;
                let totalTtlsSet = 0;
                // 1. Delete old metrics keys (older than 1 hour)
                const oldMetricsDeleted = yield this.deleteOldMetrics();
                totalKeysDeleted += oldMetricsDeleted;
                // 2. Set TTL on all metrics keys without expiration
                const ttlsSet = yield this.setTtlOnMetricsKeys();
                totalTtlsSet += ttlsSet;
                // 3. Clean up orphaned cache keys
                const orphanedDeleted = yield this.cleanupOrphanedCacheKeys();
                totalKeysDeleted += orphanedDeleted;
                // 4. Optimize session keys
                const sessionOptimized = yield this.optimizeSessionKeys();
                totalKeysDeleted += sessionOptimized;
                // Get memory usage after
                const memoryAfter = yield this.getMemoryUsage();
                console.log(`📊 Memory usage after: ${memoryAfter.toFixed(2)}%`);
                const result = {
                    memoryBefore,
                    memoryAfter,
                    keysDeleted: totalKeysDeleted,
                    ttlsSet: totalTtlsSet,
                };
                console.log('✅ EMERGENCY OPTIMIZATION COMPLETE:', result);
                return result;
            }
            catch (error) {
                console.error('❌ Emergency optimization failed:', error);
                throw error;
            }
            finally {
                this.isRunning = false;
            }
        });
    }
    /**
     * Get current Redis memory usage percentage
     */
    getMemoryUsage() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const info = yield redis_1.redis.info('memory');
                const usedMemoryMatch = info.match(/used_memory:(\d+)/);
                const maxMemoryMatch = info.match(/maxmemory:(\d+)/);
                if (usedMemoryMatch && maxMemoryMatch) {
                    const usedMemory = parseInt(usedMemoryMatch[1]);
                    const maxMemory = parseInt(maxMemoryMatch[1]);
                    return (usedMemory / maxMemory) * 100;
                }
                return 0;
            }
            catch (error) {
                console.error('Error getting memory usage:', error);
                return 0;
            }
        });
    }
    /**
     * Delete old metrics keys (older than 1 hour)
     */
    deleteOldMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🧹 Deleting old metrics keys...');
            const patterns = ['metrics:*', 'performance:*', 'monitoring:*', 'stats:*'];
            let totalDeleted = 0;
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            for (const pattern of patterns) {
                const keys = yield this.scanKeysWithPattern(pattern, 2000);
                const oldKeys = [];
                for (const key of keys) {
                    try {
                        // Check if key has timestamp in name
                        const timestampMatch = key.match(/:(\d{13})/); // 13-digit timestamp
                        if (timestampMatch) {
                            const timestamp = parseInt(timestampMatch[1]);
                            if (timestamp < oneHourAgo) {
                                oldKeys.push(key);
                            }
                        }
                        else {
                            // For keys without timestamp, check TTL
                            const ttl = yield redis_1.redis.ttl(key);
                            if (ttl === -1) {
                                // No expiration set
                                oldKeys.push(key);
                            }
                        }
                    }
                    catch (error) {
                        // Skip problematic keys
                    }
                }
                if (oldKeys.length > 0) {
                    const deleted = yield this.deleteBatch(oldKeys);
                    totalDeleted += deleted;
                    console.log(`   Deleted ${deleted} old ${pattern} keys`);
                }
            }
            return totalDeleted;
        });
    }
    /**
     * Set TTL on metrics keys that don't have expiration
     */
    setTtlOnMetricsKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('⏰ Setting TTL on metrics keys...');
            const patterns = [
                'metrics:*',
                'performance:*',
                'monitoring:*',
                'cache:stats:*',
            ];
            let totalTtlsSet = 0;
            const ttlSeconds = 3600; // 1 hour
            for (const pattern of patterns) {
                const keys = yield this.scanKeysWithPattern(pattern, 1000);
                for (const key of keys) {
                    try {
                        const ttl = yield redis_1.redis.ttl(key);
                        if (ttl === -1) {
                            // No expiration set
                            yield redis_1.redis.expire(key, ttlSeconds);
                            totalTtlsSet++;
                        }
                    }
                    catch (error) {
                        // Skip problematic keys
                    }
                }
                console.log(`   Set TTL on ${pattern} keys`);
            }
            return totalTtlsSet;
        });
    }
    /**
     * Clean up orphaned cache keys
     */
    cleanupOrphanedCacheKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🧹 Cleaning orphaned cache keys...');
            const tagKeys = yield this.scanKeysWithPattern('cache:tag:*', 500);
            let deletedCount = 0;
            for (const tagKey of tagKeys) {
                try {
                    const cacheKeys = yield redis_1.redis.smembers(tagKey);
                    const orphanedKeys = [];
                    for (const cacheKey of cacheKeys) {
                        const exists = yield redis_1.redis.exists(cacheKey);
                        if (!exists) {
                            orphanedKeys.push(cacheKey);
                        }
                    }
                    if (orphanedKeys.length > 0) {
                        yield redis_1.redis.srem(tagKey, ...orphanedKeys);
                        deletedCount += orphanedKeys.length;
                    }
                }
                catch (error) {
                    // Skip problematic tag keys
                }
            }
            return deletedCount;
        });
    }
    /**
     * Optimize session keys by removing expired ones
     */
    optimizeSessionKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔑 Optimizing session keys...');
            const sessionKeys = yield this.scanKeysWithPattern('session:*', 1000);
            let deletedCount = 0;
            for (const key of sessionKeys) {
                try {
                    const ttl = yield redis_1.redis.ttl(key);
                    if (ttl === -2) {
                        // Key doesn't exist
                        deletedCount++;
                    }
                    else if (ttl === -1) {
                        // No expiration, set one
                        yield redis_1.redis.expire(key, 86400); // 24 hours
                    }
                }
                catch (error) {
                    // Skip problematic keys
                }
            }
            return deletedCount;
        });
    }
    /**
     * Scan keys with pattern using SCAN instead of KEYS
     */
    scanKeysWithPattern(pattern_1) {
        return __awaiter(this, arguments, void 0, function* (pattern, limit = 1000) {
            const keys = [];
            let cursor = '0';
            do {
                try {
                    const result = yield redis_1.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 50);
                    cursor = result[0];
                    keys.push(...result[1]);
                    if (keys.length >= limit) {
                        break;
                    }
                }
                catch (error) {
                    console.error(`Error scanning pattern ${pattern}:`, error);
                    break;
                }
            } while (cursor !== '0' && keys.length < limit);
            return keys.slice(0, limit);
        });
    }
    /**
     * Delete keys in batches
     */
    deleteBatch(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keys.length === 0)
                return 0;
            const batchSize = 50;
            let totalDeleted = 0;
            for (let i = 0; i < keys.length; i += batchSize) {
                const batch = keys.slice(i, i + batchSize);
                try {
                    const deleted = yield redis_1.redis.del(...batch);
                    totalDeleted += deleted;
                }
                catch (error) {
                    console.error('Error deleting batch:', error);
                }
            }
            return totalDeleted;
        });
    }
    /**
     * Check if emergency optimization is needed
     */
    isOptimizationNeeded() {
        return __awaiter(this, void 0, void 0, function* () {
            const memoryUsage = yield this.getMemoryUsage();
            return memoryUsage > 90; // Trigger if memory usage > 90%
        });
    }
}
exports.EmergencyRedisOptimizer = EmergencyRedisOptimizer;
