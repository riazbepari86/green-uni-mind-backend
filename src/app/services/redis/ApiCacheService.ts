import { Redis } from 'ioredis';
import { Request, Response } from 'express';
import { BaseRedisService } from './BaseRedisService';
import { IRedisMonitoringService, RedisKeys } from './interfaces';
import crypto from 'crypto';

export interface ApiCacheOptions {
  ttl?: number;
  varyBy?: string[];
  tags?: string[];
  condition?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
  skipCache?: (req: Request) => boolean;
  onHit?: (req: Request, cachedData: any) => void;
  onMiss?: (req: Request) => void;
}

export interface CachedApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  cachedAt: string;
  expiresAt: string;
  etag: string;
  tags: string[];
  hitCount: number;
  lastAccessed: string;
  requestInfo: {
    method: string;
    url: string;
    userAgent?: string;
    userId?: string;
  };
}

export class ApiCacheService extends BaseRedisService {
  private defaultTTL = 300; // 5 minutes

  constructor(
    client: Redis,
    monitoring?: IRedisMonitoringService
  ) {
    super(client, monitoring);
  }

  // Generate cache key for API request
  private generateCacheKey(req: Request, options: ApiCacheOptions = {}): string {
    if (options.keyGenerator) {
      return options.keyGenerator(req);
    }

    const method = req.method;
    const path = req.path;
    const query = req.query;
    
    // Include vary-by headers in key generation
    const varyHeaders: Record<string, string> = {};
    if (options.varyBy) {
      options.varyBy.forEach(header => {
        const value = req.get(header);
        if (value) {
          varyHeaders[header.toLowerCase()] = value;
        }
      });
    }

    // Include user context if available
    const userContext = {
      userId: req.user?._id,
      role: req.user?.role,
    };

    const keyData = {
      method,
      path,
      query,
      varyHeaders,
      userContext,
    };

    const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
    const hash = crypto.createHash('sha256').update(keyString).digest('hex');
    
    return RedisKeys.API_RESPONSE(path, hash);
  }

  // Generate ETag for response
  private generateETag(data: any): string {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // Cache API response
  async cacheResponse(
    req: Request,
    res: Response,
    data: any,
    options: ApiCacheOptions = {}
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(req, options);
    const ttl = options.ttl || this.defaultTTL;
    const tags = options.tags || [];

    return this.executeWithMonitoring('cache_api_response', async () => {
      const etag = this.generateETag(data);
      
      const cachedResponse: CachedApiResponse = {
        statusCode: res.statusCode,
        headers: {
          'content-type': res.get('content-type') || 'application/json',
          'etag': etag,
        },
        body: data,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        etag,
        tags,
        hitCount: 0,
        lastAccessed: new Date().toISOString(),
        requestInfo: {
          method: req.method,
          url: req.originalUrl,
          userAgent: req.get('User-Agent'),
          userId: req.user?._id,
        },
      };

      const pipeline = this.client.pipeline();
      
      // Store the cached response
      pipeline.setex(cacheKey, ttl, JSON.stringify(cachedResponse));
      
      // Add to tag sets for invalidation
      tags.forEach(tag => {
        const tagKey = `api:cache:tag:${tag}`;
        pipeline.sadd(tagKey, cacheKey);
        pipeline.expire(tagKey, ttl + 300);
      });
      
      // Track cache statistics
      pipeline.incr('api:cache:stats:responses:stored');
      pipeline.incr(`api:cache:stats:responses:stored:${new Date().toISOString().slice(0, 10)}`);
      pipeline.expire(`api:cache:stats:responses:stored:${new Date().toISOString().slice(0, 10)}`, 86400 * 7);
      
      await pipeline.exec();
      
      console.log(`📦 API response cached: ${req.method} ${req.path} (TTL: ${ttl}s)`);
    });
  }

  // Get cached API response
  async getCachedResponse(req: Request, options: ApiCacheOptions = {}): Promise<CachedApiResponse | null> {
    const cacheKey = this.generateCacheKey(req, options);

    return this.executeWithMonitoring('get_cached_api_response', async () => {
      const data = await this.client.get(cacheKey);
      
      if (!data) {
        // Track cache miss
        await this.client.incr('api:cache:stats:responses:misses');
        if (options.onMiss) {
          options.onMiss(req);
        }
        return null;
      }

      try {
        const cachedResponse: CachedApiResponse = JSON.parse(data);
        
        // Update hit count and last accessed time
        cachedResponse.hitCount++;
        cachedResponse.lastAccessed = new Date().toISOString();
        
        // Update the cached data with new stats
        const ttl = await this.client.ttl(cacheKey);
        if (ttl > 0) {
          await this.client.setex(cacheKey, ttl, JSON.stringify(cachedResponse));
        }
        
        // Track cache hit
        await this.client.incr('api:cache:stats:responses:hits');
        
        if (options.onHit) {
          options.onHit(req, cachedResponse);
        }
        
        console.log(`🎯 API cache hit: ${req.method} ${req.path} (hits: ${cachedResponse.hitCount})`);
        
        return cachedResponse;
      } catch (error) {
        console.error('Error parsing cached API response:', error);
        // Remove corrupted cache entry
        await this.client.del(cacheKey);
        return null;
      }
    });
  }

  // Middleware for automatic API caching
  cache(options: ApiCacheOptions = {}) {
    return async (req: Request, res: Response, next: Function) => {
      try {
        // Skip caching for certain conditions
        if (options.skipCache && options.skipCache(req)) {
          return next();
        }

        // Skip caching for non-GET requests by default
        if (req.method !== 'GET') {
          return next();
        }

        // Check condition if provided
        if (options.condition && !options.condition(req)) {
          return next();
        }

        // Check for cached response
        const cachedResponse = await this.getCachedResponse(req, options);
        
        if (cachedResponse) {
          // Check if client has the same ETag (304 Not Modified)
          const clientETag = req.get('If-None-Match');
          if (clientETag && clientETag === cachedResponse.etag) {
            return res.status(304).end();
          }

          // Set cache headers
          res.set(cachedResponse.headers);
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Key', this.generateCacheKey(req, options).slice(-16));
          
          return res.status(cachedResponse.statusCode).json(cachedResponse.body);
        }

        // Cache miss - intercept response
        const originalJson = res.json;
        const originalSend = res.send;
        
        const self = this;
        res.json = function(data: any) {
          // Cache the response
          setImmediate(async () => {
            try {
              await self.cacheResponse(req, res, data, options);
            } catch (error) {
              console.error('Error caching API response:', error);
            }
          });

          // Set cache headers
          res.set('X-Cache', 'MISS');
          res.set('ETag', self.generateETag(data));

          return originalJson.call(this, data);
        };

        res.send = function(data: any) {
          // For non-JSON responses
          if (typeof data === 'string' || Buffer.isBuffer(data)) {
            setImmediate(async () => {
              try {
                await self.cacheResponse(req, res, data, options);
              } catch (error) {
                console.error('Error caching API response:', error);
              }
            });
          }

          res.set('X-Cache', 'MISS');
          return originalSend.call(this, data);
        };

        next();
      } catch (error) {
        console.error('Error in API cache middleware:', error);
        next();
      }
    };
  }

  // Invalidate cache by tags
  async invalidateByTags(tags: string[]): Promise<number> {
    return this.executeWithMonitoring('invalidate_api_cache_by_tags', async () => {
      let totalInvalidated = 0;
      
      for (const tag of tags) {
        const tagKey = `api:cache:tag:${tag}`;
        const cacheKeys = await this.client.smembers(tagKey);
        
        if (cacheKeys.length > 0) {
          const pipeline = this.client.pipeline();
          
          // Delete all cached responses with this tag
          cacheKeys.forEach(key => pipeline.del(key));
          
          // Delete the tag set
          pipeline.del(tagKey);
          
          await pipeline.exec();
          totalInvalidated += cacheKeys.length;
          
          console.log(`🗑️ Invalidated ${cacheKeys.length} API responses with tag: ${tag}`);
        }
      }
      
      // Track invalidation stats
      await this.client.incrby('api:cache:stats:responses:invalidated', totalInvalidated);
      
      return totalInvalidated;
    });
  }

  // Invalidate cache by pattern
  async invalidateByPattern(pattern: string): Promise<number> {
    return this.executeWithMonitoring('invalidate_api_cache_by_pattern', async () => {
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      await this.client.del(...keys);
      
      // Track invalidation stats
      await this.client.incrby('api:cache:stats:responses:invalidated', keys.length);
      
      console.log(`🗑️ Invalidated ${keys.length} API responses matching pattern: ${pattern}`);
      return keys.length;
    });
  }

  // Get API cache statistics
  async getApiCacheStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
    stored: number;
    invalidated: number;
    totalRequests: number;
  }> {
    return this.executeWithMonitoring('get_api_cache_stats', async () => {
      const [hits, misses, stored, invalidated] = await Promise.all([
        this.client.get('api:cache:stats:responses:hits'),
        this.client.get('api:cache:stats:responses:misses'),
        this.client.get('api:cache:stats:responses:stored'),
        this.client.get('api:cache:stats:responses:invalidated'),
      ]);
      
      const hitsNum = parseInt(hits || '0');
      const missesNum = parseInt(misses || '0');
      const storedNum = parseInt(stored || '0');
      const invalidatedNum = parseInt(invalidated || '0');
      const totalRequests = hitsNum + missesNum;
      const hitRate = totalRequests > 0 ? (hitsNum / totalRequests) * 100 : 0;
      
      return {
        hits: hitsNum,
        misses: missesNum,
        hitRate,
        stored: storedNum,
        invalidated: invalidatedNum,
        totalRequests,
      };
    });
  }

  // Get popular API endpoints
  async getPopularEndpoints(limit: number = 10): Promise<Array<{
    endpoint: string;
    method: string;
    hitCount: number;
    lastAccessed: string;
    averageResponseTime?: number;
  }>> {
    return this.executeWithMonitoring('get_popular_api_endpoints', async () => {
      const pattern = 'cache:api:*';
      const keys = await this.client.keys(pattern);
      
      const endpoints: Array<{
        endpoint: string;
        method: string;
        hitCount: number;
        lastAccessed: string;
      }> = [];
      
      for (const key of keys.slice(0, limit * 2)) {
        try {
          const data = await this.client.get(key);
          if (data) {
            const cachedResponse: CachedApiResponse = JSON.parse(data);
            endpoints.push({
              endpoint: cachedResponse.requestInfo.url,
              method: cachedResponse.requestInfo.method,
              hitCount: cachedResponse.hitCount,
              lastAccessed: cachedResponse.lastAccessed,
            });
          }
        } catch (error) {
          continue;
        }
      }
      
      return endpoints
        .sort((a, b) => b.hitCount - a.hitCount)
        .slice(0, limit);
    });
  }

  // Warm API cache
  async warmApiCache(endpoints: Array<{
    method: string;
    path: string;
    headers?: Record<string, string>;
    query?: Record<string, any>;
    fetchFn: () => Promise<any>;
    options?: ApiCacheOptions;
  }>): Promise<number> {
    return this.executeWithMonitoring('warm_api_cache', async () => {
      let warmedCount = 0;
      
      for (const { method, path, headers, query, fetchFn, options } of endpoints) {
        try {
          // Create mock request object
          const mockReq = {
            method,
            path,
            query: query || {},
            get: (header: string) => headers?.[header.toLowerCase()],
            originalUrl: path + (query ? '?' + new URLSearchParams(query).toString() : ''),
          } as any;

          // Check if already cached
          const existing = await this.getCachedResponse(mockReq, options);
          if (!existing) {
            // Not cached, fetch and cache
            const result = await fetchFn();
            
            // Create mock response object
            const mockRes = {
              statusCode: 200,
              get: () => 'application/json',
            } as any;
            
            await this.cacheResponse(mockReq, mockRes, result, options);
            warmedCount++;
          }
        } catch (error) {
          console.error(`Error warming API cache for ${method} ${path}:`, error);
        }
      }
      
      console.log(`🔥 API cache warmed: ${warmedCount} endpoints`);
      return warmedCount;
    });
  }

  // Clear all API cache
  async clearApiCache(): Promise<number> {
    return this.executeWithMonitoring('clear_api_cache', async () => {
      const pattern = 'cache:api:*';
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      await this.client.del(...keys);
      
      console.log(`🗑️ Cleared ${keys.length} API cache entries`);
      return keys.length;
    });
  }
}
