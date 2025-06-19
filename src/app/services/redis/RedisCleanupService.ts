import { redisOperations, redis } from '../../config/redis';

/**
 * Service to clean up excessive Redis keys that are consuming storage
 * This service removes performance metrics, monitoring data, and other non-essential keys
 */
export class RedisCleanupService {
  private static instance: RedisCleanupService;

  public static getInstance(): RedisCleanupService {
    if (!RedisCleanupService.instance) {
      RedisCleanupService.instance = new RedisCleanupService();
    }
    return RedisCleanupService.instance;
  }

  /**
   * Clean up all performance metrics and monitoring keys
   */
  async cleanupPerformanceMetrics(): Promise<void> {
    console.log('🧹 Starting Redis cleanup of performance metrics...');

    try {
      const patterns = [
        'metrics:performance:*',
        'cache:api:cache:stats:*',
        'cache:api:cache:response:*',
        'monitoring:*',
        'performance:*',
        'stats:*',
        'alerts:*',
        'audit:*',
        'usage:*',
        'health:*',
        'optimization:*',
        'dashboard:*',
        'analytics:*'
      ];

      let totalDeleted = 0;

      for (const pattern of patterns) {
        try {
          // Use SCAN instead of KEYS to handle large keysets
          const keys: string[] = [];
          let cursor = '0';

          do {
            const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = result[0];
            keys.push(...result[1]);
          } while (cursor !== '0' && keys.length < 1000); // Limit to 1000 keys per pattern

          if (keys.length > 0) {
            console.log(`🗑️ Found ${keys.length} keys matching pattern: ${pattern}`);

            // Delete in batches to avoid overwhelming Redis
            const batchSize = 50; // Reduced batch size for safety
            for (let i = 0; i < keys.length; i += batchSize) {
              const batch = keys.slice(i, i + batchSize);
              if (batch.length > 0) {
                const deleted = await redis.del(...batch);
                totalDeleted += deleted;
                console.log(`   Deleted batch of ${deleted} keys`);
              }

              // Small delay between batches
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        } catch (error) {
          console.error(`❌ Error cleaning pattern ${pattern}:`, error);
        }
      }

      console.log(`✅ Redis cleanup completed. Total keys deleted: ${totalDeleted}`);
      
      // Get current key count
      const info = await redis.info('keyspace');
      console.log('📊 Current Redis keyspace info:', info);

    } catch (error) {
      console.error('❌ Error during Redis cleanup:', error);
    }
  }

  /**
   * Clean up specific cache keys that might be consuming too much space
   */
  async cleanupLargeCacheKeys(): Promise<void> {
    console.log('🧹 Cleaning up large cache keys...');

    try {
      // Use SCAN to get cache keys instead of KEYS
      const cacheKeys: string[] = [];
      let cursor = '0';

      do {
        const result = await redis.scan(cursor, 'MATCH', 'cache:*', 'COUNT', 100);
        cursor = result[0];
        cacheKeys.push(...result[1]);
      } while (cursor !== '0' && cacheKeys.length < 500); // Limit to 500 keys

      let totalFreed = 0;

      for (const key of cacheKeys) {
        try {
          const size = await redis.memory('USAGE', key);

          // If key is larger than 1MB, consider removing it
          if (size && size > 1024 * 1024) {
            await redisOperations.del(key);
            totalFreed += size;
            console.log(`🗑️ Removed large cache key: ${key} (${(size / 1024 / 1024).toFixed(2)}MB)`);
          }
        } catch (error) {
          // Ignore individual key errors
        }
      }

      if (totalFreed > 0) {
        console.log(`✅ Freed ${(totalFreed / 1024 / 1024).toFixed(2)}MB from large cache keys`);
      } else {
        console.log('✅ No large cache keys found to clean up');
      }

    } catch (error) {
      console.error('❌ Error cleaning large cache keys:', error);
    }
  }

  /**
   * Get Redis memory usage statistics
   */
  async getMemoryStats(): Promise<void> {
    try {
      const info = await redis.info('memory');
      console.log('📊 Redis Memory Statistics:');
      console.log(info);

      // Get key count by pattern
      const patterns = ['cache:*', 'auth:*', 'otp:*', 'sessions:*', 'metrics:*'];
      for (const pattern of patterns) {
        try {
          const keys = await redis.keys(pattern);
          console.log(`   ${pattern}: ${keys.length} keys`);
        } catch (error) {
          console.log(`   ${pattern}: Error counting keys`);
        }
      }

    } catch (error) {
      console.error('❌ Error getting memory stats:', error);
    }
  }

  /**
   * Emergency cleanup - removes all non-essential keys
   */
  async emergencyCleanup(): Promise<void> {
    console.log('🚨 Starting emergency Redis cleanup...');

    try {
      // Keep only essential keys
      const essentialPatterns = [
        'auth:*',
        'otp:*', 
        'sessions:*',
        'user:*',
        'jwt:*'
      ];

      // Use SCAN to get all keys instead of KEYS
      const allKeys: string[] = [];
      let cursor = '0';

      do {
        const result = await redis.scan(cursor, 'COUNT', 100);
        cursor = result[0];
        allKeys.push(...result[1]);
      } while (cursor !== '0' && allKeys.length < 2000); // Limit to 2000 keys for safety

      const keysToDelete: string[] = [];

      for (const key of allKeys) {
        let isEssential = false;

        for (const pattern of essentialPatterns) {
          const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
          if (regex.test(key)) {
            isEssential = true;
            break;
          }
        }

        if (!isEssential) {
          keysToDelete.push(key);
        }
      }

      console.log(`🗑️ Emergency cleanup will delete ${keysToDelete.length} non-essential keys`);
      console.log(`✅ Keeping ${allKeys.length - keysToDelete.length} essential keys`);

      if (keysToDelete.length > 0) {
        // Delete in batches
        const batchSize = 100;
        let totalDeleted = 0;

        for (let i = 0; i < keysToDelete.length; i += batchSize) {
          const batch = keysToDelete.slice(i, i + batchSize);
          const deleted = await redis.del(...batch);
          totalDeleted += deleted;
          console.log(`   Deleted batch: ${deleted} keys`);
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`✅ Emergency cleanup completed. Deleted ${totalDeleted} keys`);
      }

    } catch (error) {
      console.error('❌ Error during emergency cleanup:', error);
    }
  }
}

export const redisCleanupService = RedisCleanupService.getInstance();