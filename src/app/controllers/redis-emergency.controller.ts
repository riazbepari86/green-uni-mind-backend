import { Request, Response } from 'express';
import { Logger } from '../config/logger';
import { redis } from '../config/redis';
import { EmergencyRedisOptimizer } from '../services/redis/EmergencyRedisOptimizer';

/**
 * Emergency Redis Controller
 * Handles critical Redis performance issues
 */
export class RedisEmergencyController {
  /**
   * Execute emergency Redis optimization
   */
  static async executeEmergencyOptimization(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const optimizer = EmergencyRedisOptimizer.getInstance();

      // Check if optimization is needed
      const isNeeded = await optimizer.isOptimizationNeeded();

      if (!isNeeded) {
        res.status(200).json({
          success: true,
          message: 'Emergency optimization not needed',
          memoryUsage: await RedisEmergencyController.getMemoryUsage(),
        });
        return;
      }

      // Execute optimization
      const result = await optimizer.executeEmergencyOptimization();

      res.status(200).json({
        success: true,
        message: 'Emergency optimization completed successfully',
        result,
      });
    } catch (error) {
      Logger.error('Emergency optimization failed:', error);
      res.status(500).json({
        success: false,
        message: 'Emergency optimization failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get current Redis status and memory usage
   */
  static async getRedisStatus(req: Request, res: Response): Promise<void> {
    try {
      const memoryInfo = await redis.info('memory');
      const serverInfo = await redis.info('server');
      const keyspaceInfo = await redis.info('keyspace');

      // Parse memory usage
      const usedMemoryMatch = memoryInfo.match(/used_memory_human:([^\r\n]+)/);
      const usedMemoryBytesMatch = memoryInfo.match(/used_memory:(\d+)/);
      const maxMemoryMatch = memoryInfo.match(/maxmemory:(\d+)/);
      const memoryUsageMatch = memoryInfo.match(
        /used_memory_rss_human:([^\r\n]+)/,
      );

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
      const keyPatterns = await RedisEmergencyController.getKeyPatternCounts();

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
          version:
            serverInfo.match(/redis_version:([^\r\n]+)/)?.[1] || 'Unknown',
          uptime: serverInfo.match(/uptime_in_seconds:(\d+)/)?.[1] || 'Unknown',
        },
        recommendations: RedisEmergencyController.getRecommendations(
          memoryUsagePercent,
          keyPatterns,
        ),
      };

      res.status(200).json({
        success: true,
        status,
      });
    } catch (error) {
      Logger.error('Failed to get Redis status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get Redis status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Force cleanup of specific key patterns
   */
  static async forceCleanupPattern(req: Request, res: Response): Promise<void> {
    try {
      const { pattern, maxKeys = 1000 } = req.body;

      if (!pattern) {
        res.status(400).json({
          success: false,
          message: 'Pattern is required',
        });
        return;
      }

      const keys = await RedisEmergencyController.scanKeysWithPattern(
        pattern,
        maxKeys,
      );

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
        const deleted = await redis.del(...batch);
        totalDeleted += deleted;
      }

      res.status(200).json({
        success: true,
        message: `Successfully cleaned up pattern: ${pattern}`,
        deletedCount: totalDeleted,
        foundKeys: keys.length,
      });
    } catch (error) {
      Logger.error('Force cleanup failed:', error);
      res.status(500).json({
        success: false,
        message: 'Force cleanup failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get memory usage percentage
   */
  private static async getMemoryUsage(): Promise<number> {
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
      return 0;
    }
  }

  /**
   * Get key pattern counts
   */
  private static async getKeyPatternCounts(): Promise<Record<string, number>> {
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

    const counts: Record<string, number> = {};

    for (const pattern of patterns) {
      try {
        const keys = await RedisEmergencyController.scanKeysWithPattern(
          pattern,
          100,
        );
        counts[pattern] = keys.length;
      } catch (error) {
        counts[pattern] = 0;
      }
    }

    return counts;
  }

  /**
   * Scan keys with pattern
   */
  private static async scanKeysWithPattern(
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
   * Get recommendations based on current state
   */
  private static getRecommendations(
    memoryUsage: number,
    keyPatterns: Record<string, number>,
  ): string[] {
    const recommendations: string[] = [];

    if (memoryUsage > 95) {
      recommendations.push(
        'CRITICAL: Execute emergency optimization immediately',
      );
    } else if (memoryUsage > 90) {
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
