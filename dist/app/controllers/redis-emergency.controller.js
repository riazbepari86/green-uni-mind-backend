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
exports.RedisEmergencyController = void 0;
const logger_1 = require("../config/logger");
const redis_1 = require("../config/redis");
const EmergencyRedisOptimizer_1 = require("../services/redis/EmergencyRedisOptimizer");
/**
 * Emergency Redis Controller
 * Handles critical Redis performance issues
 */
class RedisEmergencyController {
    /**
     * Execute emergency Redis optimization
     */
    static executeEmergencyOptimization(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const optimizer = EmergencyRedisOptimizer_1.EmergencyRedisOptimizer.getInstance();
                // Check if optimization is needed
                const isNeeded = yield optimizer.isOptimizationNeeded();
                if (!isNeeded) {
                    res.status(200).json({
                        success: true,
                        message: 'Emergency optimization not needed',
                        memoryUsage: yield RedisEmergencyController.getMemoryUsage(),
                    });
                    return;
                }
                // Execute optimization
                const result = yield optimizer.executeEmergencyOptimization();
                res.status(200).json({
                    success: true,
                    message: 'Emergency optimization completed successfully',
                    result,
                });
            }
            catch (error) {
                logger_1.Logger.error('Emergency optimization failed:', error);
                res.status(500).json({
                    success: false,
                    message: 'Emergency optimization failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Get current Redis status and memory usage
     */
    static getRedisStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const memoryInfo = yield redis_1.redis.info('memory');
                const serverInfo = yield redis_1.redis.info('server');
                const keyspaceInfo = yield redis_1.redis.info('keyspace');
                // Parse memory usage
                const usedMemoryMatch = memoryInfo.match(/used_memory_human:([^\r\n]+)/);
                const usedMemoryBytesMatch = memoryInfo.match(/used_memory:(\d+)/);
                const maxMemoryMatch = memoryInfo.match(/maxmemory:(\d+)/);
                const memoryUsageMatch = memoryInfo.match(/used_memory_rss_human:([^\r\n]+)/);
                // Parse keyspace info
                const dbKeysMatch = keyspaceInfo.match(/db0:keys=(\d+),expires=(\d+)/);
                // Calculate memory usage percentage
                let memoryUsagePercent = 0;
                if (usedMemoryBytesMatch && maxMemoryMatch) {
                    const usedMemory = parseInt(usedMemoryBytesMatch[1]);
                    const maxMemory = parseInt(maxMemoryMatch[1]);
                    memoryUsagePercent = (usedMemory / maxMemory) * 100;
                }
                // Get key patterns count
                const keyPatterns = yield RedisEmergencyController.getKeyPatternCounts();
                const status = {
                    memory: {
                        used: usedMemoryMatch ? usedMemoryMatch[1] : 'Unknown',
                        usagePercent: memoryUsagePercent.toFixed(2) + '%',
                        rss: memoryUsageMatch ? memoryUsageMatch[1] : 'Unknown',
                        isHighUsage: memoryUsagePercent > 90,
                        isCritical: memoryUsagePercent > 95,
                    },
                    keys: {
                        total: dbKeysMatch ? parseInt(dbKeysMatch[1]) : 0,
                        withExpiration: dbKeysMatch ? parseInt(dbKeysMatch[2]) : 0,
                        patterns: keyPatterns,
                    },
                    server: {
                        version: ((_a = serverInfo.match(/redis_version:([^\r\n]+)/)) === null || _a === void 0 ? void 0 : _a[1]) || 'Unknown',
                        uptime: ((_b = serverInfo.match(/uptime_in_seconds:(\d+)/)) === null || _b === void 0 ? void 0 : _b[1]) || 'Unknown',
                    },
                    recommendations: RedisEmergencyController.getRecommendations(memoryUsagePercent, keyPatterns),
                };
                res.status(200).json({
                    success: true,
                    status,
                });
            }
            catch (error) {
                logger_1.Logger.error('Failed to get Redis status:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to get Redis status',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Force cleanup of specific key patterns
     */
    static forceCleanupPattern(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { pattern, maxKeys = 1000 } = req.body;
                if (!pattern) {
                    res.status(400).json({
                        success: false,
                        message: 'Pattern is required',
                    });
                    return;
                }
                const keys = yield RedisEmergencyController.scanKeysWithPattern(pattern, maxKeys);
                if (keys.length === 0) {
                    res.status(200).json({
                        success: true,
                        message: `No keys found matching pattern: ${pattern}`,
                        deletedCount: 0,
                    });
                    return;
                }
                // Delete in batches
                const batchSize = 50;
                let totalDeleted = 0;
                for (let i = 0; i < keys.length; i += batchSize) {
                    const batch = keys.slice(i, i + batchSize);
                    const deleted = yield redis_1.redis.del(...batch);
                    totalDeleted += deleted;
                }
                res.status(200).json({
                    success: true,
                    message: `Successfully cleaned up pattern: ${pattern}`,
                    deletedCount: totalDeleted,
                    foundKeys: keys.length,
                });
            }
            catch (error) {
                logger_1.Logger.error('Force cleanup failed:', error);
                res.status(500).json({
                    success: false,
                    message: 'Force cleanup failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
    }
    /**
     * Get memory usage percentage
     */
    static getMemoryUsage() {
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
                return 0;
            }
        });
    }
    /**
     * Get key pattern counts
     */
    static getKeyPatternCounts() {
        return __awaiter(this, void 0, void 0, function* () {
            const patterns = [
                'metrics:*',
                'cache:*',
                'session:*',
                'auth:*',
                'otp:*',
                'performance:*',
                'monitoring:*',
                'api:cache:*',
            ];
            const counts = {};
            for (const pattern of patterns) {
                try {
                    const keys = yield RedisEmergencyController.scanKeysWithPattern(pattern, 100);
                    counts[pattern] = keys.length;
                }
                catch (error) {
                    counts[pattern] = 0;
                }
            }
            return counts;
        });
    }
    /**
     * Scan keys with pattern
     */
    static scanKeysWithPattern(pattern_1) {
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
     * Get recommendations based on current state
     */
    static getRecommendations(memoryUsage, keyPatterns) {
        const recommendations = [];
        if (memoryUsage > 95) {
            recommendations.push('CRITICAL: Execute emergency optimization immediately');
        }
        else if (memoryUsage > 90) {
            recommendations.push('HIGH: Consider running optimization soon');
        }
        // Check for high key counts
        Object.entries(keyPatterns).forEach(([pattern, count]) => {
            if (count > 500) {
                recommendations.push(`Consider cleaning up ${pattern} (${count} keys)`);
            }
        });
        if (recommendations.length === 0) {
            recommendations.push('System is operating normally');
        }
        return recommendations;
    }
}
exports.RedisEmergencyController = RedisEmergencyController;
