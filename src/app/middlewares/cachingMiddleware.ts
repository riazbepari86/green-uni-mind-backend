import { Request, Response, NextFunction } from 'express';
import { ApiCacheService } from '../services/redis/ApiCacheService';
import { QueryCacheService } from '../services/redis/QueryCacheService';
import { CacheInvalidationService } from '../services/redis/CacheInvalidationService';
import { redisServiceManager } from '../services/redis/RedisServiceManager';

// Initialize cache services
const apiCache = new ApiCacheService(
  redisServiceManager.cacheClient,
  redisServiceManager.monitoring
);

const queryCache = new QueryCacheService(
  redisServiceManager.cacheClient,
  redisServiceManager.monitoring
);

const invalidationService = new CacheInvalidationService(
  redisServiceManager.cacheClient,
  redisServiceManager.monitoring
);

// API Response Caching Middleware
export const cacheApiResponse = (options: {
  ttl?: number;
  tags?: string[];
  varyBy?: string[];
  condition?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  return apiCache.cache({
    ttl: options.ttl || 300, // 5 minutes default
    tags: options.tags || [],
    varyBy: options.varyBy || ['authorization'],
    condition: options.condition,
    keyGenerator: options.keyGenerator,
    onHit: (req, _cachedData) => {
      console.log(`🎯 API Cache Hit: ${req.method} ${req.path}`);
    },
    onMiss: (req) => {
      console.log(`❌ API Cache Miss: ${req.method} ${req.path}`);
    },
  });
};

// User-specific caching
export const cacheUserData = (ttl: number = 900) => { // 15 minutes default
  return cacheApiResponse({
    ttl,
    tags: ['user_data'],
    varyBy: ['authorization'],
    condition: (req) => !!req.user,
    keyGenerator: (req) => `user:${req.user?._id}:${req.path}:${JSON.stringify(req.query)}`,
  });
};

// Course content caching
export const cacheCourseContent = (ttl: number = 1800) => { // 30 minutes default
  return cacheApiResponse({
    ttl,
    tags: ['course_content', 'course_list'],
    varyBy: ['authorization'],
    condition: (req) => req.method === 'GET',
  });
};

// Public content caching (longer TTL)
export const cachePublicContent = (ttl: number = 3600) => { // 1 hour default
  return cacheApiResponse({
    ttl,
    tags: ['public_content'],
    condition: (req) => req.method === 'GET' && !req.user,
  });
};

// Dashboard data caching
export const cacheDashboardData = (ttl: number = 600) => { // 10 minutes default
  return cacheApiResponse({
    ttl,
    tags: ['dashboard', 'user_dashboard'],
    varyBy: ['authorization'],
    condition: (req) => !!req.user && req.method === 'GET',
    keyGenerator: (req) => `dashboard:${req.user?.role}:${req.user?._id}:${req.path}`,
  });
};

// Search results caching
export const cacheSearchResults = (ttl: number = 1200) => { // 20 minutes default
  return cacheApiResponse({
    ttl,
    tags: ['search_results'],
    varyBy: ['authorization'],
    condition: (req) => req.method === 'GET' && !!(req.query.q || req.query.search),
    keyGenerator: (req) => {
      const searchTerm = req.query.q || req.query.search;
      const filters = { ...req.query };
      delete filters.q;
      delete filters.search;
      return `search:${searchTerm}:${JSON.stringify(filters)}:${req.user?._id || 'anonymous'}`;
    },
  });
};

// Cache invalidation middleware for write operations
export const invalidateCache = (tags: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original response methods
    const originalJson = res.json;
    const originalSend = res.send;

    // Override response methods to trigger invalidation on successful writes
    res.json = function(data: any) {
      const statusCode = res.statusCode;
      
      // Trigger invalidation for successful write operations
      if (statusCode >= 200 && statusCode < 300 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        setImmediate(async () => {
          try {
            await invalidationService.triggerInvalidation(
              `${req.method.toLowerCase()}_${req.path.split('/')[1]}`,
              { path: req.path, method: req.method, userId: req.user?._id },
              req.user?._id,
              'api_middleware'
            );
            
            // Also invalidate specific tags
            if (tags.length > 0) {
              await Promise.all([
                apiCache.invalidateByTags(tags),
                queryCache.invalidateByTags(tags),
              ]);
            }
          } catch (error) {
            console.error('Error in cache invalidation middleware:', error);
          }
        });
      }
      
      return originalJson.call(this, data);
    };

    res.send = function(data: any) {
      const statusCode = res.statusCode;
      
      if (statusCode >= 200 && statusCode < 300 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        setImmediate(async () => {
          try {
            await invalidationService.triggerInvalidation(
              `${req.method.toLowerCase()}_${req.path.split('/')[1]}`,
              { path: req.path, method: req.method, userId: req.user?._id },
              req.user?._id,
              'api_middleware'
            );
            
            if (tags.length > 0) {
              await Promise.all([
                apiCache.invalidateByTags(tags),
                queryCache.invalidateByTags(tags),
              ]);
            }
          } catch (error) {
            console.error('Error in cache invalidation middleware:', error);
          }
        });
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
};

// Smart cache invalidation based on route patterns
export const smartCacheInvalidation = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    res.json = function(data: any) {
      const statusCode = res.statusCode;
      
      if (statusCode >= 200 && statusCode < 300 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        setImmediate(async () => {
          try {
            // Extract entity type and ID from path
            const pathParts = req.path.split('/').filter(Boolean);
            const entityType = pathParts[1]; // e.g., 'users', 'courses', 'enrollments'
            const entityId = pathParts[2];
            
            if (entityType && entityId) {
              await invalidationService.smartInvalidate(
                entityType.slice(0, -1), // Remove 's' from plural
                entityId,
                req.method === 'POST' ? 'create' : 
                req.method === 'DELETE' ? 'delete' : 'update'
              );
            }
          } catch (error) {
            console.error('Error in smart cache invalidation:', error);
          }
        });
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
};

// Cache warming middleware for critical endpoints
export const warmCriticalCache = async (): Promise<void> => {
  console.log('🔥 Warming critical cache endpoints...');
  
  try {
    // Warm popular API endpoints
    await apiCache.warmApiCache([
      {
        method: 'GET',
        path: '/api/courses',
        fetchFn: async () => {
          // This would typically call your course service
          return { courses: [], total: 0 };
        },
        options: { ttl: 1800, tags: ['course_list'] },
      },
      {
        method: 'GET',
        path: '/api/categories',
        fetchFn: async () => {
          return { categories: [] };
        },
        options: { ttl: 3600, tags: ['categories'] },
      },
    ]);

    console.log('✅ Critical cache warmed successfully');
  } catch (error) {
    console.error('❌ Error warming critical cache:', error);
  }
};

// Cache monitoring middleware
export const cacheMonitoring = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Add cache info to response headers
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      
      // Track API performance metrics
      try {
        const cacheStatus = res.get('X-Cache') || 'UNKNOWN';
        const endpoint = `${req.method} ${req.path}`;
        
        // Store performance metrics in Redis
        const metricsKey = `metrics:api:${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const pipeline = redisServiceManager.cacheClient.pipeline();
        
        pipeline.lpush(`${metricsKey}:response_times`, duration);
        pipeline.ltrim(`${metricsKey}:response_times`, 0, 99); // Keep last 100 measurements
        pipeline.incr(`${metricsKey}:${cacheStatus.toLowerCase()}_count`);
        pipeline.expire(`${metricsKey}:response_times`, 86400); // 24 hours
        pipeline.expire(`${metricsKey}:${cacheStatus.toLowerCase()}_count`, 86400);
        
        await pipeline.exec();
      } catch (error) {
        console.error('Error tracking cache metrics:', error);
      }
    });

    next();
  };
};

// Cache health check middleware
export const cacheHealthCheck = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Quick health check for cache services
    const healthPromises = [
      redisServiceManager.healthCheck(),
      apiCache.getApiCacheStats(),
      queryCache.getCacheStats(),
    ];

    const [redisHealth, apiStats, queryStats] = await Promise.all(healthPromises);
    
    // Add cache health info to request context
    req.cacheHealth = {
      redis: redisHealth,
      api: apiStats,
      query: queryStats,
      timestamp: new Date().toISOString(),
    };

    next();
  } catch (error) {
    console.error('Cache health check failed:', error);
    // Don't fail the request, just log the error
    req.cacheHealth = {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
    next();
  }
};

// Export cache services for direct use
export {
  apiCache,
  queryCache,
  invalidationService,
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      cacheHealth?: any;
    }
  }
}
