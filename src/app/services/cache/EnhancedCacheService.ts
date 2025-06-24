import { redisOperations } from '../../config/redis';
import { Logger } from '../../config/logger';

interface CacheOptions {
  ttl?: number;
  tags?: string[];
  namespace?: string;
  compress?: boolean;
  version?: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

class EnhancedCacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  private readonly DEFAULT_TTL = {
    analytics: 3600, // 1 hour
    activities: 300, // 5 minutes
    messaging: 1800, // 30 minutes
    enrollment: 7200, // 2 hours
    performance: 14400, // 4 hours
    realtime: 60, // 1 minute
  };

  private readonly CACHE_PREFIXES = {
    analytics: 'analytics:',
    activities: 'activities:',
    messaging: 'messaging:',
    enrollment: 'enrollment:',
    performance: 'performance:',
    user: 'user:',
    course: 'course:',
    session: 'session:',
  };

  /**
   * Enhanced get with automatic decompression and stats tracking
   */
  public async get<T>(
    key: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const cached = await redisOperations.get(fullKey);
      
      if (cached === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      
      let data = cached;
      if (options.compress) {
        data = this.decompress(cached);
      }

      return JSON.parse(data);
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache get error:', error);
      return null;
    }
  }

  /**
   * Enhanced set with automatic compression and tagging
   */
  public async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      let data = JSON.stringify(value);
      
      if (options.compress) {
        data = this.compress(data);
      }

      const ttl = options.ttl || this.DEFAULT_TTL.analytics;
      await redisOperations.setex(fullKey, ttl, data);

      // Handle tags for cache invalidation
      if (options.tags && options.tags.length > 0) {
        await this.addToTags(fullKey, options.tags, ttl);
      }

      // Store version for cache busting
      if (options.version) {
        await redisOperations.setex(`${fullKey}:version`, ttl, options.version);
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache set error:', error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  public async mget<T>(
    keys: string[],
    options: CacheOptions = {}
  ): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map(key => this.buildKey(key, options.namespace));
      const results = await redisOperations.mget(fullKeys);
      
      return results.map((result: string | null, index: number) => {
        if (result === null) {
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;
        try {
          let data = result;
          if (options.compress) {
            data = this.decompress(result);
          }
          return JSON.parse(data);
        } catch (error) {
          Logger.error(`❌ Failed to parse cached data for key ${keys[index]}:`, error);
          return null;
        }
      });
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once
   */
  public async mset<T>(
    keyValuePairs: Array<{ key: string; value: T; options?: CacheOptions }>,
    globalOptions: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const pipeline = redisOperations.pipeline();
      
      for (const { key, value, options = {} } of keyValuePairs) {
        const mergedOptions = { ...globalOptions, ...options };
        const fullKey = this.buildKey(key, mergedOptions.namespace);
        let data = JSON.stringify(value);
        
        if (mergedOptions.compress) {
          data = this.compress(data);
        }

        const ttl = mergedOptions.ttl || this.DEFAULT_TTL.analytics;
        pipeline.setex(fullKey, ttl, data);

        // Handle tags
        if (mergedOptions.tags && mergedOptions.tags.length > 0) {
          for (const tag of mergedOptions.tags) {
            pipeline.sadd(`tag:${tag}`, fullKey);
            pipeline.expire(`tag:${tag}`, ttl);
          }
        }
      }

      await pipeline.exec();
      this.stats.sets += keyValuePairs.length;
      return true;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache mset error:', error);
      return false;
    }
  }

  /**
   * Delete by key
   */
  public async del(key: string, namespace?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const result = await redisOperations.del(fullKey);
      this.stats.deletes++;
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete by pattern
   */
  public async delPattern(pattern: string, namespace?: string): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern, namespace);
      const keys = await redisOperations.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await redisOperations.del(...keys);
      this.stats.deletes += result;
      return result;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache delete pattern error:', error);
      return 0;
    }
  }

  /**
   * Delete by tags
   */
  public async delByTags(tags: string[]): Promise<number> {
    try {
      let totalDeleted = 0;
      
      for (const tag of tags) {
        const keys = await redisOperations.smembers(`tag:${tag}`);
        if (keys.length > 0) {
          const deleted = await redisOperations.del(...keys);
          totalDeleted += deleted;
          await redisOperations.del(`tag:${tag}`);
        }
      }

      this.stats.deletes += totalDeleted;
      return totalDeleted;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache delete by tags error:', error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  public async exists(key: string, namespace?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const result = await redisOperations.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  public async ttl(key: string, namespace?: string): Promise<number> {
    try {
      const fullKey = this.buildKey(key, namespace);
      return await redisOperations.ttl(fullKey);
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache TTL error:', error);
      return -1;
    }
  }

  /**
   * Extend TTL for a key
   */
  public async expire(key: string, ttl: number, namespace?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const result = await redisOperations.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache expire error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Reset cache statistics
   */
  public resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Warm up cache with frequently accessed data
   */
  public async warmUp(teacherId: string): Promise<void> {
    try {
      Logger.info(`🔥 Warming up cache for teacher: ${teacherId}`);
      
      // Pre-load analytics data
      const analyticsKeys = [
        `analytics:enrollment:${teacherId}:monthly`,
        `analytics:revenue:${teacherId}:monthly`,
        `analytics:performance:${teacherId}:monthly`,
        `analytics:engagement:${teacherId}:monthly`
      ];

      // Check which keys are missing
      const existingKeys = await Promise.all(
        analyticsKeys.map(key => this.exists(key))
      );

      const missingKeys = analyticsKeys.filter((_, index) => !existingKeys[index]);
      
      if (missingKeys.length > 0) {
        Logger.info(`📊 Pre-loading ${missingKeys.length} analytics cache entries`);
        // Note: Actual data loading would be done by the respective services
      }

      Logger.info(`✅ Cache warm-up completed for teacher: ${teacherId}`);
    } catch (error) {
      Logger.error('❌ Cache warm-up error:', error);
    }
  }

  /**
   * Build full cache key with namespace
   */
  private buildKey(key: string, namespace?: string): string {
    if (namespace) {
      return `${this.CACHE_PREFIXES[namespace as keyof typeof this.CACHE_PREFIXES] || namespace}${key}`;
    }
    return key;
  }

  /**
   * Add key to tags for invalidation
   */
  private async addToTags(key: string, tags: string[], ttl: number): Promise<void> {
    const pipeline = redisOperations.pipeline();
    
    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key);
      pipeline.expire(`tag:${tag}`, ttl);
    }
    
    await pipeline.exec();
  }

  /**
   * Compress data (placeholder - implement actual compression if needed)
   */
  private compress(data: string): string {
    // For now, just return the data as-is
    // In production, you might want to use zlib or similar
    return data;
  }

  /**
   * Decompress data (placeholder - implement actual decompression if needed)
   */
  private decompress(data: string): string {
    // For now, just return the data as-is
    // In production, you might want to use zlib or similar
    return data;
  }
}

export default new EnhancedCacheService();
