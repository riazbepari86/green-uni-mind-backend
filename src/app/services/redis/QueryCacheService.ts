import { Redis } from 'ioredis';
import { BaseRedisService } from './BaseRedisService';
import { IRedisMonitoringService, RedisKeys } from './interfaces';
import crypto from 'crypto';

export interface QueryCacheOptions {
  ttl?: number;
  tags?: string[];
  invalidateOnWrite?: boolean;
  compression?: boolean;
  version?: string;
}

export interface CachedQuery {
  query: string;
  params: any;
  result: any;
  cachedAt: string;
  expiresAt: string;
  tags: string[];
  version: string;
  hitCount: number;
  lastAccessed: string;
}

export class QueryCacheService extends BaseRedisService {
  private defaultTTL = 3600; // 1 hour
  private compressionThreshold = 1024; // Compress results larger than 1KB

  constructor(
    client: Redis,
    monitoring?: IRedisMonitoringService
  ) {
    super(client, monitoring);
  }

  // Generate cache key from query and parameters
  private generateCacheKey(query: string, params: any = {}): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const paramsString = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash('sha256').update(normalizedQuery + paramsString).digest('hex');
    return RedisKeys.QUERY_RESULT(hash);
  }

  // Cache query result
  async cacheQuery(
    query: string,
    params: any,
    result: any,
    options: QueryCacheOptions = {}
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(query, params);
    const ttl = options.ttl || this.defaultTTL;
    const tags = options.tags || [];
    const version = options.version || '1.0';

    return this.executeWithMonitoring('cache_query', async () => {
      const cachedQuery: CachedQuery = {
        query,
        params,
        result,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        tags,
        version,
        hitCount: 0,
        lastAccessed: new Date().toISOString(),
      };

      const serializedData = JSON.stringify(cachedQuery);
      
      // Compress if data is large
      let dataToStore = serializedData;
      if (options.compression && serializedData.length > this.compressionThreshold) {
        // In a real implementation, you'd use a compression library like zlib
        // For now, we'll just mark it as compressed
        cachedQuery.result = { __compressed: true, data: cachedQuery.result };
        dataToStore = JSON.stringify(cachedQuery);
      }

      const pipeline = this.client.pipeline();
      
      // Store the cached query
      pipeline.setex(cacheKey, ttl, dataToStore);
      
      // Add to tag sets for invalidation
      tags.forEach(tag => {
        const tagKey = `cache:tag:${tag}`;
        pipeline.sadd(tagKey, cacheKey);
        pipeline.expire(tagKey, ttl + 300); // Tag expires 5 minutes after content
      });
      
      // Track cache statistics
      pipeline.incr('cache:stats:queries:stored');
      pipeline.incr(`cache:stats:queries:stored:${new Date().toISOString().slice(0, 10)}`);
      pipeline.expire(`cache:stats:queries:stored:${new Date().toISOString().slice(0, 10)}`, 86400 * 7);
      
      await pipeline.exec();
      
      console.log(`📦 Query cached: ${cacheKey.slice(-8)}... (TTL: ${ttl}s)`);
    });
  }

  // Get cached query result
  async getCachedQuery(query: string, params: any = {}): Promise<any | null> {
    const cacheKey = this.generateCacheKey(query, params);

    return this.executeWithMonitoring('get_cached_query', async () => {
      const data = await this.client.get(cacheKey);
      
      if (!data) {
        // Track cache miss
        await this.client.incr('cache:stats:queries:misses');
        return null;
      }

      try {
        const cachedQuery: CachedQuery = JSON.parse(data);
        
        // Update hit count and last accessed time
        cachedQuery.hitCount++;
        cachedQuery.lastAccessed = new Date().toISOString();
        
        // Update the cached data with new stats
        const ttl = await this.client.ttl(cacheKey);
        if (ttl > 0) {
          await this.client.setex(cacheKey, ttl, JSON.stringify(cachedQuery));
        }
        
        // Track cache hit
        await this.client.incr('cache:stats:queries:hits');
        
        console.log(`🎯 Query cache hit: ${cacheKey.slice(-8)}... (hits: ${cachedQuery.hitCount})`);
        
        // Handle decompression if needed
        if (cachedQuery.result?.__compressed) {
          // In a real implementation, you'd decompress here
          return cachedQuery.result.data;
        }
        
        return cachedQuery.result;
      } catch (error) {
        console.error('Error parsing cached query:', error);
        // Remove corrupted cache entry
        await this.client.del(cacheKey);
        return null;
      }
    });
  }

  // Cache with fallback function
  async cacheWithFallback<T>(
    query: string,
    params: any,
    fallbackFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    return this.executeWithMonitoring('cache_with_fallback', async () => {
      // Try to get from cache first
      const cachedResult = await this.getCachedQuery(query, params);
      
      if (cachedResult !== null) {
        return cachedResult;
      }

      // Cache miss - execute fallback function
      const freshResult = await fallbackFn();
      
      // Cache the fresh result
      await this.cacheQuery(query, params, freshResult, options);
      
      return freshResult;
    });
  }

  // Invalidate cache by tags
  async invalidateByTags(tags: string[]): Promise<number> {
    return this.executeWithMonitoring('invalidate_by_tags', async () => {
      let totalInvalidated = 0;
      
      for (const tag of tags) {
        const tagKey = `cache:tag:${tag}`;
        const cacheKeys = await this.client.smembers(tagKey);
        
        if (cacheKeys.length > 0) {
          const pipeline = this.client.pipeline();
          
          // Delete all cached queries with this tag
          cacheKeys.forEach(key => pipeline.del(key));
          
          // Delete the tag set
          pipeline.del(tagKey);
          
          await pipeline.exec();
          totalInvalidated += cacheKeys.length;
          
          console.log(`🗑️ Invalidated ${cacheKeys.length} queries with tag: ${tag}`);
        }
      }
      
      // Track invalidation stats
      await this.client.incrby('cache:stats:queries:invalidated', totalInvalidated);
      
      return totalInvalidated;
    });
  }

  // Invalidate cache by pattern
  async invalidateByPattern(pattern: string): Promise<number> {
    return this.executeWithMonitoring('invalidate_by_pattern', async () => {
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      await this.client.del(...keys);
      
      // Track invalidation stats
      await this.client.incrby('cache:stats:queries:invalidated', keys.length);
      
      console.log(`🗑️ Invalidated ${keys.length} queries matching pattern: ${pattern}`);
      return keys.length;
    });
  }

  // Get cache statistics
  async getCacheStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
    stored: number;
    invalidated: number;
    totalQueries: number;
  }> {
    return this.executeWithMonitoring('get_cache_stats', async () => {
      const [hits, misses, stored, invalidated] = await Promise.all([
        this.client.get('cache:stats:queries:hits'),
        this.client.get('cache:stats:queries:misses'),
        this.client.get('cache:stats:queries:stored'),
        this.client.get('cache:stats:queries:invalidated'),
      ]);
      
      const hitsNum = parseInt(hits || '0');
      const missesNum = parseInt(misses || '0');
      const storedNum = parseInt(stored || '0');
      const invalidatedNum = parseInt(invalidated || '0');
      const totalQueries = hitsNum + missesNum;
      const hitRate = totalQueries > 0 ? (hitsNum / totalQueries) * 100 : 0;
      
      return {
        hits: hitsNum,
        misses: missesNum,
        hitRate,
        stored: storedNum,
        invalidated: invalidatedNum,
        totalQueries,
      };
    });
  }

  // Get popular queries
  async getPopularQueries(limit: number = 10): Promise<Array<{
    query: string;
    hitCount: number;
    lastAccessed: string;
    tags: string[];
  }>> {
    return this.executeWithMonitoring('get_popular_queries', async () => {
      // This is a simplified implementation
      // In production, you might want to maintain a separate sorted set for popular queries
      const pattern = 'cache:query:*';
      const keys = await this.client.keys(pattern);
      
      const queries: Array<{
        query: string;
        hitCount: number;
        lastAccessed: string;
        tags: string[];
      }> = [];
      
      for (const key of keys.slice(0, limit * 2)) { // Get more than needed to filter
        try {
          const data = await this.client.get(key);
          if (data) {
            const cachedQuery: CachedQuery = JSON.parse(data);
            queries.push({
              query: cachedQuery.query,
              hitCount: cachedQuery.hitCount,
              lastAccessed: cachedQuery.lastAccessed,
              tags: cachedQuery.tags,
            });
          }
        } catch (error) {
          // Skip invalid entries
          continue;
        }
      }
      
      // Sort by hit count and return top queries
      return queries
        .sort((a, b) => b.hitCount - a.hitCount)
        .slice(0, limit);
    });
  }

  // Warm cache with predefined queries
  async warmCache(queries: Array<{
    query: string;
    params: any;
    fetchFn: () => Promise<any>;
    options?: QueryCacheOptions;
  }>): Promise<number> {
    return this.executeWithMonitoring('warm_cache', async () => {
      let warmedCount = 0;
      
      for (const { query, params, fetchFn, options } of queries) {
        try {
          // Check if already cached
          const existing = await this.getCachedQuery(query, params);
          if (existing === null) {
            // Not cached, fetch and cache
            const result = await fetchFn();
            await this.cacheQuery(query, params, result, options);
            warmedCount++;
          }
        } catch (error) {
          console.error(`Error warming cache for query: ${query}`, error);
        }
      }
      
      console.log(`🔥 Cache warmed: ${warmedCount} queries`);
      return warmedCount;
    });
  }

  // Clean expired entries (manual cleanup)
  async cleanExpiredEntries(): Promise<number> {
    return this.executeWithMonitoring('clean_expired_entries', async () => {
      // Redis automatically removes expired keys, but we can clean up orphaned tag references
      const tagPattern = 'cache:tag:*';
      const tagKeys = await this.client.keys(tagPattern);
      
      let cleanedCount = 0;
      
      for (const tagKey of tagKeys) {
        const cacheKeys = await this.client.smembers(tagKey);
        const existingKeys = await this.existsMultiple(cacheKeys);
        
        // Remove references to non-existent cache keys
        const keysToRemove = cacheKeys.filter((_, index) => !existingKeys[index]);
        
        if (keysToRemove.length > 0) {
          await this.client.srem(tagKey, ...keysToRemove);
          cleanedCount += keysToRemove.length;
        }
        
        // Remove empty tag sets
        const remainingCount = await this.client.scard(tagKey);
        if (remainingCount === 0) {
          await this.client.del(tagKey);
        }
      }
      
      console.log(`🧹 Cleaned ${cleanedCount} orphaned cache references`);
      return cleanedCount;
    });
  }

  // Reset cache statistics
  async resetStats(): Promise<void> {
    return this.executeWithMonitoring('reset_stats', async () => {
      const statsKeys = [
        'cache:stats:queries:hits',
        'cache:stats:queries:misses',
        'cache:stats:queries:stored',
        'cache:stats:queries:invalidated',
      ];
      
      await this.client.del(...statsKeys);
      console.log('📊 Cache statistics reset');
    });
  }

  // Get cache size information
  async getCacheSize(): Promise<{
    totalKeys: number;
    totalMemory: number;
    averageKeySize: number;
  }> {
    return this.executeWithMonitoring('get_cache_size', async () => {
      const pattern = 'cache:query:*';
      const keys = await this.client.keys(pattern);
      
      let totalMemory = 0;
      
      // Sample a subset of keys to estimate memory usage
      const sampleSize = Math.min(100, keys.length);
      const sampleKeys = keys.slice(0, sampleSize);
      
      for (const key of sampleKeys) {
        try {
          const data = await this.client.get(key);
          if (data) {
            totalMemory += Buffer.byteLength(data, 'utf8');
          }
        } catch (error) {
          // Skip invalid entries
          continue;
        }
      }
      
      // Extrapolate total memory usage
      const estimatedTotalMemory = sampleSize > 0 
        ? (totalMemory / sampleSize) * keys.length 
        : 0;
      
      const averageKeySize = keys.length > 0 ? estimatedTotalMemory / keys.length : 0;
      
      return {
        totalKeys: keys.length,
        totalMemory: Math.round(estimatedTotalMemory),
        averageKeySize: Math.round(averageKeySize),
      };
    });
  }
}
