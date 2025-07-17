import { redis } from '../../config/redis';

/**
 * Emergency Redis Optimizer
 * Implements immediate memory cleanup and TTL enforcement
 */
export class EmergencyRedisOptimizer {
  private static instance: EmergencyRedisOptimizer;
  private isRunning = false;

  public static getInstance(): EmergencyRedisOptimizer {
    if (!EmergencyRedisOptimizer.instance) {
      EmergencyRedisOptimizer.instance = new EmergencyRedisOptimizer();
    }
    return EmergencyRedisOptimizer.instance;
  }

  /**
   * Execute emergency Redis optimization
   */
  async executeEmergencyOptimization(): Promise<{
    memoryBefore: number;
    memoryAfter: number;
    keysDeleted: number;
    ttlsSet: number;
  }> {
    if (this.isRunning) {
      throw new Error('Emergency optimization already running');
    }

    this.isRunning = true;
    console.log('🚨 STARTING EMERGENCY REDIS OPTIMIZATION...');

    try {
      // Get memory usage before
      const memoryBefore = await this.getMemoryUsage();
      console.log(`📊 Memory usage before: ${memoryBefore.toFixed(2)}%`);

      let totalKeysDeleted = 0;
      let totalTtlsSet = 0;

      // 1. Delete old metrics keys (older than 1 hour)
      const oldMetricsDeleted = await this.deleteOldMetrics();
      totalKeysDeleted += oldMetricsDeleted;

      // 2. Set TTL on all metrics keys without expiration
      const ttlsSet = await this.setTtlOnMetricsKeys();
      totalTtlsSet += ttlsSet;

      // 3. Clean up orphaned cache keys
      const orphanedDeleted = await this.cleanupOrphanedCacheKeys();
      totalKeysDeleted += orphanedDeleted;

      // 4. Optimize session keys
      const sessionOptimized = await this.optimizeSessionKeys();
      totalKeysDeleted += sessionOptimized;

      // Get memory usage after
      const memoryAfter = await this.getMemoryUsage();
      console.log(`📊 Memory usage after: ${memoryAfter.toFixed(2)}%`);

      const result = {
        memoryBefore,
        memoryAfter,
        keysDeleted: totalKeysDeleted,
        ttlsSet: totalTtlsSet,
      };

      console.log('✅ EMERGENCY OPTIMIZATION COMPLETE:', result);
      return result;
    } catch (error) {
      console.error('❌ Emergency optimization failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get current Redis memory usage percentage
   */
  private async getMemoryUsage(): Promise<number> {
    try {
      const info = await redis.info('memory');
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      const maxMemoryMatch = info.match(/maxmemory:(\d+)/);

      if (usedMemoryMatch && maxMemoryMatch) {
        const usedMemory = parseInt(usedMemoryMatch[1]);
        const maxMemory = parseInt(maxMemoryMatch[1]);
        return (usedMemory / maxMemory) * 100;
      }

      return 0;
    } catch (error) {
      console.error('Error getting memory usage:', error);
      return 0;
    }
  }

  /**
   * Delete old metrics keys (older than 1 hour)
   */
  private async deleteOldMetrics(): Promise<number> {
    console.log('🧹 Deleting old metrics keys...');

    const patterns = ['metrics:*', 'performance:*', 'monitoring:*', 'stats:*'];

    let totalDeleted = 0;
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const pattern of patterns) {
      const keys = await this.scanKeysWithPattern(pattern, 2000);
      const oldKeys: string[] = [];

      for (const key of keys) {
        try {
          // Check if key has timestamp in name
          const timestampMatch = key.match(/:(\d{13})/); // 13-digit timestamp
          if (timestampMatch) {
            const timestamp = parseInt(timestampMatch[1]);
            if (timestamp < oneHourAgo) {
              oldKeys.push(key);
            }
          } else {
            // For keys without timestamp, check TTL
            const ttl = await redis.ttl(key);
            if (ttl === -1) {
              // No expiration set
              oldKeys.push(key);
            }
          }
        } catch (error) {
          // Skip problematic keys
        }
      }

      if (oldKeys.length > 0) {
        const deleted = await this.deleteBatch(oldKeys);
        totalDeleted += deleted;
        console.log(`   Deleted ${deleted} old ${pattern} keys`);
      }
    }

    return totalDeleted;
  }

  /**
   * Set TTL on metrics keys that don't have expiration
   */
  private async setTtlOnMetricsKeys(): Promise<number> {
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
      const keys = await this.scanKeysWithPattern(pattern, 1000);

      for (const key of keys) {
        try {
          const ttl = await redis.ttl(key);
          if (ttl === -1) {
            // No expiration set
            await redis.expire(key, ttlSeconds);
            totalTtlsSet++;
          }
        } catch (error) {
          // Skip problematic keys
        }
      }

      console.log(`   Set TTL on ${pattern} keys`);
    }

    return totalTtlsSet;
  }

  /**
   * Clean up orphaned cache keys
   */
  private async cleanupOrphanedCacheKeys(): Promise<number> {
    console.log('🧹 Cleaning orphaned cache keys...');

    const tagKeys = await this.scanKeysWithPattern('cache:tag:*', 500);
    let deletedCount = 0;

    for (const tagKey of tagKeys) {
      try {
        const cacheKeys = await redis.smembers(tagKey);
        const orphanedKeys: string[] = [];

        for (const cacheKey of cacheKeys) {
          const exists = await redis.exists(cacheKey);
          if (!exists) {
            orphanedKeys.push(cacheKey);
          }
        }

        if (orphanedKeys.length > 0) {
          await redis.srem(tagKey, ...orphanedKeys);
          deletedCount += orphanedKeys.length;
        }
      } catch (error) {
        // Skip problematic tag keys
      }
    }

    return deletedCount;
  }

  /**
   * Optimize session keys by removing expired ones
   */
  private async optimizeSessionKeys(): Promise<number> {
    console.log('🔑 Optimizing session keys...');

    const sessionKeys = await this.scanKeysWithPattern('session:*', 1000);
    let deletedCount = 0;

    for (const key of sessionKeys) {
      try {
        const ttl = await redis.ttl(key);
        if (ttl === -2) {
          // Key doesn't exist
          deletedCount++;
        } else if (ttl === -1) {
          // No expiration, set one
          await redis.expire(key, 86400); // 24 hours
        }
      } catch (error) {
        // Skip problematic keys
      }
    }

    return deletedCount;
  }

  /**
   * Scan keys with pattern using SCAN instead of KEYS
   */
  private async scanKeysWithPattern(
    pattern: string,
    limit: number = 1000,
  ): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      try {
        const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 50);
        cursor = result[0];
        keys.push(...result[1]);

        if (keys.length >= limit) {
          break;
        }
      } catch (error) {
        console.error(`Error scanning pattern ${pattern}:`, error);
        break;
      }
    } while (cursor !== '0' && keys.length < limit);

    return keys.slice(0, limit);
  }

  /**
   * Delete keys in batches
   */
  private async deleteBatch(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    const batchSize = 50;
    let totalDeleted = 0;

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      try {
        const deleted = await redis.del(...batch);
        totalDeleted += deleted;
      } catch (error) {
        console.error('Error deleting batch:', error);
      }
    }

    return totalDeleted;
  }

  /**
   * Check if emergency optimization is needed
   */
  async isOptimizationNeeded(): Promise<boolean> {
    const memoryUsage = await this.getMemoryUsage();
    return memoryUsage > 90; // Trigger if memory usage > 90%
  }
}
