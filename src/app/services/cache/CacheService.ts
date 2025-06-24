import { redisOperations, redis } from '../../config/redis';
import { Logger } from '../../config/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
  tags?: string[]; // For cache invalidation by tags
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

/**
 * Comprehensive caching service with Redis backend
 */
class CacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly MAX_KEY_LENGTH = 250;

  /**
   * Get value from cache
   */
  public async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const value = await redisOperations.get(cacheKey);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      
      try {
        return JSON.parse(value) as T;
      } catch {
        // If parsing fails, return as string
        return value as unknown as T;
      }
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache get error:', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  public async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl || this.DEFAULT_TTL;
      
      let serializedValue: string;
      if (typeof value === 'string') {
        serializedValue = value;
      } else {
        serializedValue = JSON.stringify(value);
      }

      // Check if value is too large (Redis limit is 512MB, but we'll be conservative)
      if (serializedValue.length > 10 * 1024 * 1024) { // 10MB
        Logger.warn('⚠️ Cache value too large, skipping cache:', { key, size: serializedValue.length });
        return false;
      }

      await redisOperations.setex(cacheKey, ttl, serializedValue);

      // Store tags for invalidation
      if (options?.tags && options.tags.length > 0) {
        await this.addToTags(cacheKey, options.tags);
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache set error:', { key, error });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  public async del(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const result = await redisOperations.del(cacheKey);
      
      this.stats.deletes++;
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache delete error:', { key, error });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  public async exists(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const result = await redisOperations.exists(cacheKey);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache exists error:', { key, error });
      return false;
    }
  }

  /**
   * Get or set pattern - get from cache, if not exists, execute function and cache result
   */
  public async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key, options);
      if (cached !== null) {
        return cached;
      }

      // If not in cache, execute function
      const result = await fetchFunction();
      
      // Cache the result
      await this.set(key, result, options);
      
      return result;
    } catch (error) {
      Logger.error('❌ Cache getOrSet error:', { key, error });
      // If cache fails, still return the function result
      return await fetchFunction();
    }
  }

  /**
   * Increment a numeric value in cache
   */
  public async increment(key: string, amount: number = 1, options?: CacheOptions): Promise<number> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);

      if (amount === 1) {
        const result = await redisOperations.incr(cacheKey);

        // Set expiration if it's a new key
        if (result === 1) {
          const ttl = options?.ttl || this.DEFAULT_TTL;
          await redisOperations.expire(cacheKey, ttl);
        }

        return result;
      } else {
        // Use raw redis client for incrby
        const result = await redis.incrby(cacheKey, amount);

        // Set expiration if it's a new key
        if (result === amount) {
          const ttl = options?.ttl || this.DEFAULT_TTL;
          await redisOperations.expire(cacheKey, ttl);
        }

        return result;
      }
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache increment error:', { key, error });
      return 0;
    }
  }

  /**
   * Set expiration for a key
   */
  public async expire(key: string, ttl: number, options?: CacheOptions): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(key, options?.prefix);
      const result = await redisOperations.expire(cacheKey, ttl);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache expire error:', { key, error });
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  public async mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    try {
      const cacheKeys = keys.map(key => this.buildKey(key, options?.prefix));
      const values = await redisOperations.mget(cacheKeys);
      
      return values.map(value => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        
        this.stats.hits++;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      });
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache mget error:', { keys, error });
      return keys.map(() => null);
    }
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let deletedCount = 0;
      
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const keys = await redisOperations.smembers(tagKey);
        
        if (keys.length > 0) {
          const deleted = await redisOperations.del(...keys);
          deletedCount += deleted;
          
          // Remove the tag set itself
          await redisOperations.del(tagKey);
        }
      }
      
      Logger.info(`🗑️ Invalidated ${deletedCount} cache entries by tags:`, tags);
      return deletedCount;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache invalidate by tags error:', { tags, error });
      return 0;
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  public async clear(): Promise<boolean> {
    try {
      await redis.flushdb();
      Logger.warn('🧹 All cache cleared');
      return true;
    } catch (error) {
      this.stats.errors++;
      Logger.error('❌ Cache clear error:', error);
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
      hitRate: Math.round(hitRate * 100) / 100,
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
      errors: 0,
    };
  }

  /**
   * Build cache key with optional prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const fullKey = prefix ? `${prefix}:${key}` : key;
    
    // Ensure key doesn't exceed Redis key length limit
    if (fullKey.length > this.MAX_KEY_LENGTH) {
      // Use hash of the key if it's too long
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(fullKey).digest('hex').substring(0, 32);
      return prefix ? `${prefix}:${hash}` : hash;
    }
    
    return fullKey;
  }

  /**
   * Add cache key to tag sets for invalidation
   */
  private async addToTags(cacheKey: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        await redisOperations.sadd(tagKey, cacheKey);
        // Set expiration for tag sets (longer than cache entries)
        await redisOperations.expire(tagKey, this.DEFAULT_TTL * 2);
      }
    } catch (error) {
      Logger.error('❌ Error adding cache key to tags:', { cacheKey, tags, error });
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();

// Specific cache services for different domains
export class AnalyticsCacheService {
  private cache = cacheService;
  private readonly PREFIX = 'analytics';
  private readonly TTL = {
    realtime: 300, // 5 minutes
    hourly: 3600, // 1 hour
    daily: 86400, // 24 hours
  };

  public async getTeacherAnalytics(teacherId: string, period: string): Promise<any> {
    const key = `teacher:${teacherId}:${period}`;
    return this.cache.get(key, { prefix: this.PREFIX, ttl: this.TTL.hourly });
  }

  public async setTeacherAnalytics(teacherId: string, period: string, data: any): Promise<boolean> {
    const key = `teacher:${teacherId}:${period}`;
    return this.cache.set(key, data, {
      prefix: this.PREFIX,
      ttl: this.TTL.hourly,
      tags: [`teacher:${teacherId}`, 'analytics'],
    });
  }

  public async invalidateTeacher(teacherId: string): Promise<void> {
    await this.cache.invalidateByTags([`teacher:${teacherId}`]);
  }
}

export class MessagingCacheService {
  private cache = cacheService;
  private readonly PREFIX = 'messaging';
  private readonly TTL = {
    conversations: 1800, // 30 minutes
    messages: 900, // 15 minutes
    unreadCounts: 300, // 5 minutes
  };

  public async getConversations(userId: string, userType: string): Promise<any> {
    const key = `conversations:${userType}:${userId}`;
    return this.cache.get(key, { prefix: this.PREFIX, ttl: this.TTL.conversations });
  }

  public async setConversations(userId: string, userType: string, data: any): Promise<boolean> {
    const key = `conversations:${userType}:${userId}`;
    return this.cache.set(key, data, {
      prefix: this.PREFIX,
      ttl: this.TTL.conversations,
      tags: [`user:${userId}`, 'conversations'],
    });
  }

  public async invalidateUser(userId: string): Promise<void> {
    await this.cache.invalidateByTags([`user:${userId}`]);
  }
}

export const analyticsCacheService = new AnalyticsCacheService();
export const messagingCacheService = new MessagingCacheService();

export default cacheService;
