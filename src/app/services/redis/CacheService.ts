import { Redis } from 'ioredis';
import { BaseRedisService } from './BaseRedisService';
import { ICacheService, IRedisMonitoringService, CacheStrategy } from './interfaces';

export class CacheService extends BaseRedisService implements ICacheService {
  private defaultTTL: number = 3600; // 1 hour default TTL

  constructor(
    client: Redis,
    monitoring?: IRedisMonitoringService,
    defaultTTL: number = 3600,
    _strategy: CacheStrategy = CacheStrategy.CACHE_ASIDE
  ) {
    super(client, monitoring);
    this.defaultTTL = defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.executeWithMonitoring('cache_get', async () => {
      const value = await this.client.get(key);
      return this.deserializeValue<T>(value);
    });
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.defaultTTL;
    
    return this.executeWithMonitoring('cache_set', async () => {
      const serializedValue = this.serializeValue(value);
      await this.client.setex(key, ttl, serializedValue);
    });
  }

  async del(key: string): Promise<number> {
    return this.executeWithMonitoring('cache_del', async () => {
      return await this.client.del(key);
    });
  }

  async exists(key: string): Promise<boolean> {
    return this.executeWithMonitoring('cache_exists', async () => {
      const result = await this.client.exists(key);
      return result === 1;
    });
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return this.setExpiration(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    return this.getTTL(key);
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return this.getMultipleKeys<T>(keys);
  }

  async mset<T>(keyValuePairs: Record<string, T>, ttlSeconds?: number): Promise<void> {
    return this.setMultipleKeys(keyValuePairs, ttlSeconds || this.defaultTTL);
  }

  async invalidatePattern(pattern: string): Promise<number> {
    return this.deletePattern(pattern);
  }

  async getWithFallback<T>(
    key: string,
    fallbackFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    return this.executeWithMonitoring('cache_get_with_fallback', async () => {
      // Try to get from cache first
      const cachedValue = await this.get<T>(key);
      
      if (cachedValue !== null) {
        return cachedValue;
      }

      // Cache miss - execute fallback function
      const freshValue = await fallbackFn();
      
      // Cache the fresh value
      await this.set(key, freshValue, ttlSeconds);
      
      return freshValue;
    });
  }

  // Advanced caching methods

  async getOrSetWithLock<T>(
    key: string,
    fallbackFn: () => Promise<T>,
    ttlSeconds?: number,
    lockTtlSeconds: number = 30
  ): Promise<T> {
    const lockKey = `lock:${key}`;
    
    return this.executeWithMonitoring('cache_get_or_set_with_lock', async () => {
      // Try to get from cache first
      const cachedValue = await this.get<T>(key);
      if (cachedValue !== null) {
        return cachedValue;
      }

      // Try to acquire lock
      const lockAcquired = await this.client.set(lockKey, '1', 'EX', lockTtlSeconds, 'NX');
      
      if (lockAcquired === 'OK') {
        try {
          // Double-check cache after acquiring lock
          const doubleCheckValue = await this.get<T>(key);
          if (doubleCheckValue !== null) {
            return doubleCheckValue;
          }

          // Execute fallback and cache result
          const freshValue = await fallbackFn();
          await this.set(key, freshValue, ttlSeconds);
          return freshValue;
        } finally {
          // Release lock
          await this.client.del(lockKey);
        }
      } else {
        // Lock not acquired, wait and retry
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.getOrSetWithLock(key, fallbackFn, ttlSeconds, lockTtlSeconds);
      }
    });
  }

  async setWithTags<T>(
    key: string,
    value: T,
    tags: string[],
    ttlSeconds?: number
  ): Promise<void> {
    const ttl = ttlSeconds || this.defaultTTL;
    
    return this.executeWithMonitoring('cache_set_with_tags', async () => {
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
      
      await pipeline.exec();
    });
  }

  async invalidateByTag(tag: string): Promise<number> {
    return this.executeWithMonitoring('cache_invalidate_by_tag', async () => {
      const tagKey = `tag:${tag}`;
      const keys = await this.client.smembers(tagKey);
      
      if (keys.length === 0) {
        return 0;
      }

      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.del(key));
      pipeline.del(tagKey); // Remove the tag set itself
      
      const results = await pipeline.exec();
      return results?.length || 0;
    });
  }

  async incrementCounter(key: string, increment: number = 1, ttlSeconds?: number): Promise<number> {
    return this.executeWithMonitoring('cache_increment', async () => {
      const pipeline = this.client.pipeline();
      pipeline.incrby(key, increment);
      
      if (ttlSeconds) {
        pipeline.expire(key, ttlSeconds);
      }
      
      const results = await pipeline.exec();
      return results?.[0]?.[1] as number || 0;
    });
  }

  async decrementCounter(key: string, decrement: number = 1): Promise<number> {
    return this.executeWithMonitoring('cache_decrement', async () => {
      return await this.client.decrby(key, decrement);
    });
  }

  async addToSet(key: string, ...members: string[]): Promise<number>;
  async addToSet(key: string, members: string[], ttlSeconds?: number): Promise<number>;
  async addToSet(key: string, membersOrFirst: string[] | string, ttlSecondsOrSecond?: number | string, ...restMembers: string[]): Promise<number> {
    return this.executeWithMonitoring('cache_add_to_set', async () => {
      const pipeline = this.client.pipeline();

      // Handle both signatures
      let members: string[];
      let ttlSeconds: number | undefined;

      if (Array.isArray(membersOrFirst)) {
        // Called with array: addToSet(key, members[], ttl?)
        members = membersOrFirst;
        ttlSeconds = ttlSecondsOrSecond as number;
      } else {
        // Called with rest params: addToSet(key, ...members)
        members = [membersOrFirst, ...(typeof ttlSecondsOrSecond === 'string' ? [ttlSecondsOrSecond] : []), ...restMembers];
        ttlSeconds = undefined;
      }

      pipeline.sadd(key, ...members);

      if (ttlSeconds) {
        pipeline.expire(key, ttlSeconds);
      }

      const results = await pipeline.exec();
      return results?.[0]?.[1] as number || 0;
    });
  }

  async removeFromSet(key: string, ...members: string[]): Promise<number>;
  async removeFromSet(key: string, members: string[]): Promise<number>;
  async removeFromSet(key: string, membersOrFirst: string[] | string, ...restMembers: string[]): Promise<number> {
    return this.executeWithMonitoring('cache_remove_from_set', async () => {
      // Handle both signatures
      let members: string[];

      if (Array.isArray(membersOrFirst)) {
        // Called with array: removeFromSet(key, members[])
        members = membersOrFirst;
      } else {
        // Called with rest params: removeFromSet(key, ...members)
        members = [membersOrFirst, ...restMembers];
      }

      return await this.client.srem(key, ...members);
    });
  }

  async getSetMembers(key: string): Promise<string[]> {
    return this.executeWithMonitoring('cache_get_set_members', async () => {
      return await this.client.smembers(key);
    });
  }

  async isSetMember(key: string, member: string): Promise<boolean> {
    return this.executeWithMonitoring('cache_is_set_member', async () => {
      const result = await this.client.sismember(key, member);
      return result === 1;
    });
  }

  async setHash<T>(key: string, hash: Record<string, T>, ttlSeconds?: number): Promise<void> {
    return this.executeWithMonitoring('cache_set_hash', async () => {
      const pipeline = this.client.pipeline();
      
      // Convert values to strings
      const stringHash: Record<string, string> = {};
      for (const [field, value] of Object.entries(hash)) {
        stringHash[field] = this.serializeValue(value);
      }
      
      pipeline.hmset(key, stringHash);
      
      if (ttlSeconds) {
        pipeline.expire(key, ttlSeconds);
      }
      
      await pipeline.exec();
    });
  }

  async getHash<T>(key: string): Promise<Record<string, T> | null> {
    return this.executeWithMonitoring('cache_get_hash', async () => {
      const hash = await this.client.hgetall(key);
      
      if (Object.keys(hash).length === 0) {
        return null;
      }
      
      const result: Record<string, T> = {};
      for (const [field, value] of Object.entries(hash)) {
        const deserializedValue = this.deserializeValue<T>(value);
        if (deserializedValue !== null) {
          result[field] = deserializedValue;
        }
      }
      
      return result;
    });
  }

  async getHashField<T>(key: string, field: string): Promise<T | null> {
    return this.executeWithMonitoring('cache_get_hash_field', async () => {
      const value = await this.client.hget(key, field);
      return this.deserializeValue<T>(value);
    });
  }

  async setHashField<T>(key: string, field: string, value: T, ttlSeconds?: number): Promise<void> {
    return this.executeWithMonitoring('cache_set_hash_field', async () => {
      const pipeline = this.client.pipeline();
      pipeline.hset(key, field, this.serializeValue(value));
      
      if (ttlSeconds) {
        pipeline.expire(key, ttlSeconds);
      }
      
      await pipeline.exec();
    });
  }

  async deleteHashField(key: string, ...fields: string[]): Promise<number>;
  async deleteHashField(key: string, fields: string[]): Promise<number>;
  async deleteHashField(key: string, fieldsOrFirst: string[] | string, ...restFields: string[]): Promise<number> {
    return this.executeWithMonitoring('cache_delete_hash_field', async () => {
      // Handle both signatures
      let fields: string[];

      if (Array.isArray(fieldsOrFirst)) {
        // Called with array: deleteHashField(key, fields[])
        fields = fieldsOrFirst;
      } else {
        // Called with rest params: deleteHashField(key, ...fields)
        fields = [fieldsOrFirst, ...restFields];
      }

      return await this.client.hdel(key, ...fields);
    });
  }

  // Cache statistics and monitoring
  async getCacheStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
    keyCount: number;
    memoryUsage: number;
  }> {
    return this.executeWithMonitoring('cache_get_stats', async () => {
      const info = await this.client.info('stats');
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
        } else if (line.startsWith('keyspace_misses:')) {
          stats.misses = parseInt(line.split(':')[1]);
        }
      }
      
      stats.hitRate = stats.hits + stats.misses > 0 
        ? stats.hits / (stats.hits + stats.misses) 
        : 0;
      
      return stats;
    });
  }

  // Batch operations for better performance
  async batchGet<T>(keys: string[]): Promise<Map<string, T | null>> {
    return this.executeWithMonitoring('cache_batch_get', async () => {
      const values = await this.mget<T>(keys);
      const result = new Map<string, T | null>();
      
      keys.forEach((key, index) => {
        result.set(key, values[index]);
      });
      
      return result;
    });
  }

  async batchSet<T>(
    items: Array<{ key: string; value: T; ttl?: number }>,
    defaultTtl?: number
  ): Promise<void> {
    return this.executeWithMonitoring('cache_batch_set', async () => {
      const pipeline = this.client.pipeline();
      
      items.forEach(({ key, value, ttl }) => {
        const serializedValue = this.serializeValue(value);
        const finalTtl = ttl || defaultTtl || this.defaultTTL;
        pipeline.setex(key, finalTtl, serializedValue);
      });
      
      await pipeline.exec();
    });
  }

  async batchDelete(keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }
    
    return this.executeWithMonitoring('cache_batch_delete', async () => {
      return await this.client.del(...keys);
    });
  }
}
