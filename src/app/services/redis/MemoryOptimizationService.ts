import { redisOperations } from '../../config/redis';

interface MemoryOptimizationConfig {
  maxKeysPerPattern: number;
  defaultTTL: number;
  cleanupInterval: number;
  maxMemoryUsagePercent: number;
}

class MemoryOptimizationService {
  private config: MemoryOptimizationConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<MemoryOptimizationConfig>) {
    this.config = {
      maxKeysPerPattern: 1000,
      defaultTTL: 3600, // 1 hour
      cleanupInterval: 300000, // 5 minutes
      maxMemoryUsagePercent: 80,
      ...config,
    };
  }

  /**
   * Start automatic memory optimization
   */
  public startOptimization(): void {
    console.log('🚀 Starting Redis memory optimization service');

    // Run initial cleanup
    this.performCleanup().catch((error) => {
      console.error('Initial Redis cleanup failed:', error);
    });

    // Schedule periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.performCleanup().catch((error) => {
        console.error('Scheduled Redis cleanup failed:', error);
      });
    }, this.config.cleanupInterval);
  }

  /**
   * Stop automatic memory optimization
   */
  public stopOptimization(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      console.log('🛑 Stopped Redis memory optimization service');
    }
  }

  /**
   * Perform comprehensive memory cleanup
   */
  public async performCleanup(): Promise<void> {
    try {
      console.log('🧹 Starting Redis memory cleanup...');

      const startTime = Date.now();
      let totalKeysRemoved = 0;

      // Define cleanup patterns with their specific rules
      const cleanupPatterns = [
        {
          pattern: 'performance:*',
          maxAge: 3600, // 1 hour
          maxKeys: 500,
          description: 'Performance monitoring data',
        },
        {
          pattern: 'alert:*',
          maxAge: 7200, // 2 hours
          maxKeys: 200,
          description: 'Alert notifications',
        },
        {
          pattern: 'metrics:*',
          maxAge: 1800, // 30 minutes
          maxKeys: 300,
          description: 'System metrics',
        },
        {
          pattern: 'cache:*',
          maxAge: 3600, // 1 hour
          maxKeys: 1000,
          description: 'General cache data',
        },
        {
          pattern: 'session:*',
          maxAge: 86400, // 24 hours
          maxKeys: 500,
          description: 'User sessions',
        },
      ];

      for (const rule of cleanupPatterns) {
        const removed = await this.cleanupPattern(rule);
        totalKeysRemoved += removed;
      }

      // Clean up keys without expiration
      const expiredKeysRemoved = await this.addMissingExpirations();
      totalKeysRemoved += expiredKeysRemoved;

      const duration = Date.now() - startTime;
      console.log(
        `✅ Redis cleanup completed in ${duration}ms, removed ${totalKeysRemoved} keys`,
      );

      // Log memory usage after cleanup
      await this.logMemoryUsage();
    } catch (error) {
      console.error('❌ Redis cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Clean up keys matching a specific pattern
   */
  private async cleanupPattern(rule: {
    pattern: string;
    maxAge: number;
    maxKeys: number;
    description: string;
  }): Promise<number> {
    try {
      let cursor = '0';
      let keysRemoved = 0;
      const keysToDelete: string[] = [];
      const keysWithTimestamps: Array<{ key: string; timestamp: number }> = [];

      // Scan all keys matching the pattern
      do {
        const result = await redisOperations.scan(
          cursor,
          'MATCH',
          rule.pattern,
          'COUNT',
          100,
        );
        cursor = result[0];
        const keys = result[1];

        for (const key of keys) {
          try {
            // Check if key has expiration
            const ttl = await redisOperations.getTtl(key);

            if (ttl === -1) {
              // No expiration set, check if it's old based on key pattern
              const timestamp = this.extractTimestampFromKey(key);
              if (timestamp && Date.now() - timestamp > rule.maxAge * 1000) {
                keysToDelete.push(key);
              } else {
                // Set expiration for keys without timestamp
                await redisOperations.expire(key, rule.maxAge);
              }
            }

            // Collect keys with timestamps for count-based cleanup
            const keyTimestamp = this.extractTimestampFromKey(key);
            if (keyTimestamp) {
              keysWithTimestamps.push({ key, timestamp: keyTimestamp });
            }
          } catch (error) {
            // Key might have been deleted, skip
          }
        }
      } while (cursor !== '0');

      // Remove old keys
      if (keysToDelete.length > 0) {
        await redisOperations.del(...keysToDelete);
        keysRemoved += keysToDelete.length;
      }

      // Remove excess keys if we have too many
      if (keysWithTimestamps.length > rule.maxKeys) {
        keysWithTimestamps.sort((a, b) => a.timestamp - b.timestamp); // Oldest first
        const excessKeys = keysWithTimestamps.slice(
          0,
          keysWithTimestamps.length - rule.maxKeys,
        );

        if (excessKeys.length > 0) {
          await redisOperations.del(...excessKeys.map((k) => k.key));
          keysRemoved += excessKeys.length;
        }
      }

      if (keysRemoved > 0) {
        console.log(
          `🗑️  Cleaned up ${keysRemoved} keys from ${rule.description} (${rule.pattern})`,
        );
      }

      return keysRemoved;
    } catch (error) {
      console.error(`Failed to cleanup pattern ${rule.pattern}:`, error);
      return 0;
    }
  }

  /**
   * Add expiration to keys that don't have it
   */
  private async addMissingExpirations(): Promise<number> {
    try {
      let cursor = '0';
      let keysUpdated = 0;

      do {
        const result = await redisOperations.scan(cursor, 'COUNT', 100);
        cursor = result[0];
        const keys = result[1];

        for (const key of keys) {
          try {
            const ttl = await redisOperations.getTtl(key);
            if (ttl === -1) {
              // No expiration
              // Set default expiration based on key pattern
              const expiration = this.getDefaultExpirationForKey(key);
              await redisOperations.expire(key, expiration);
              keysUpdated++;
            }
          } catch (error) {
            // Key might have been deleted, skip
          }
        }
      } while (cursor !== '0');

      if (keysUpdated > 0) {
        console.log(`⏰ Added expiration to ${keysUpdated} keys without TTL`);
      }

      return keysUpdated;
    } catch (error) {
      console.error('Failed to add missing expirations:', error);
      return 0;
    }
  }

  /**
   * Extract timestamp from key name (if present)
   */
  private extractTimestampFromKey(key: string): number | null {
    // Look for timestamp patterns in key names
    const timestampMatch = key.match(/:(\d{13})(?::|$)/); // 13-digit timestamp
    if (timestampMatch) {
      return parseInt(timestampMatch[1], 10);
    }

    const dateMatch = key.match(/:(\d{4}-\d{2}-\d{2})/); // Date pattern
    if (dateMatch) {
      return new Date(dateMatch[1]).getTime();
    }

    return null;
  }

  /**
   * Get default expiration time for a key based on its pattern
   */
  private getDefaultExpirationForKey(key: string): number {
    if (key.startsWith('performance:')) return 3600; // 1 hour
    if (key.startsWith('alert:')) return 7200; // 2 hours
    if (key.startsWith('metrics:')) return 1800; // 30 minutes
    if (key.startsWith('cache:')) return 3600; // 1 hour
    if (key.startsWith('session:')) return 86400; // 24 hours
    if (key.startsWith('payout:')) return 300; // 5 minutes
    if (key.startsWith('stripe:')) return 600; // 10 minutes

    return this.config.defaultTTL; // Default 1 hour
  }

  /**
   * Log current memory usage
   */
  private async logMemoryUsage(): Promise<void> {
    try {
      const info = await redisOperations.info('memory');
      const memoryLines = info
        .split('\r\n')
        .filter(
          (line) =>
            line.includes('used_memory_human') ||
            line.includes('maxmemory_human') ||
            line.includes('used_memory_dataset_perc'),
        );

      console.log('📊 Redis Memory Status:');
      memoryLines.forEach((line) => {
        if (line.trim()) {
          console.log(`  ${line}`);
        }
      });
    } catch (error) {
      console.warn('Failed to get memory info:', error);
    }
  }

  /**
   * Get memory optimization statistics
   */
  public async getOptimizationStats(): Promise<{
    totalKeys: number;
    keysWithoutTTL: number;
    memoryUsage: string;
    recommendations: string[];
  }> {
    try {
      // Count total keys
      const scanResult = await redisOperations.scan(0, 'COUNT', 1000);
      const totalKeys = scanResult[1].length;

      // Count keys without TTL
      let keysWithoutTTL = 0;
      for (const key of scanResult[1].slice(0, 100)) {
        // Sample
        try {
          const ttl = await redisOperations.getTtl(key);
          if (ttl === -1) keysWithoutTTL++;
        } catch (error) {
          // Skip
        }
      }

      // Get memory usage
      const info = await redisOperations.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'Unknown';

      // Generate recommendations
      const recommendations: string[] = [];
      const percentWithoutTTL =
        (keysWithoutTTL / Math.min(100, totalKeys)) * 100;

      if (percentWithoutTTL > 20) {
        recommendations.push(
          'High percentage of keys without expiration - consider adding TTL',
        );
      }
      if (totalKeys > 5000) {
        recommendations.push(
          'Large number of keys - consider implementing key rotation',
        );
      }

      return {
        totalKeys,
        keysWithoutTTL,
        memoryUsage,
        recommendations,
      };
    } catch (error) {
      console.error('Failed to get optimization stats:', error);
      throw error;
    }
  }
}

export default MemoryOptimizationService;
