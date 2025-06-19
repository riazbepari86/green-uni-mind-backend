import { Request, Response, NextFunction } from 'express';
import { featureToggleService } from '../services/redis/FeatureToggleService';
import { smartCacheService } from '../services/cache/SmartCacheService';
import { redisUsageAuditor } from '../services/redis/RedisUsageAuditor';

// Extend Request interface to include redisHealth
declare global {
  namespace Express {
    interface Request {
      redisHealth?: any;
    }
  }
}

// Optimized API response caching with feature toggles
export const optimizedCacheApiResponse = (options: {
  ttl?: number;
  tags?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
  fallbackToMemory?: boolean;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if API response caching is enabled
    if (!featureToggleService.isFeatureEnabled('api_response_caching')) {
      console.log('📵 API response caching disabled, skipping cache');
      return next();
    }

    const cacheKey = generateCacheKey(req);
    const priority = options.priority || 'medium';
    const ttl = options.ttl || getSmartTTL(req.path, priority);

    try {
      // Try to get from smart cache (L1 + L2)
      const cachedData = await smartCacheService.get(cacheKey, {
        priority,
        l1Only: options.fallbackToMemory && !featureToggleService.isFeatureEnabled('api_response_caching')
      });

      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Source', 'SMART');
        console.log(`🎯 Smart Cache Hit: ${req.method} ${req.path}`);
        return res.json(cachedData);
      }

      // Cache miss - continue to route handler
      res.setHeader('X-Cache', 'MISS');
      
      // Intercept response to cache it
      const originalJson = res.json;
      res.json = function(data: any) {
        // Cache the response if caching is still enabled
        if (featureToggleService.isFeatureEnabled('api_response_caching')) {
          smartCacheService.set(cacheKey, data, {
            ttl,
            priority,
            compress: shouldCompress(data)
          }).catch(error => {
            console.error('Error caching response:', error);
          });
        }
        
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
};

// Conditional performance tracking
export const conditionalPerformanceTracking = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only track performance if monitoring is enabled
    if (!featureToggleService.isFeatureEnabled('performance_monitoring')) {
      return next();
    }

    const startTime = Date.now();
    
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        const endpoint = `${req.method} ${req.path}`;
        
        // Only track if API metrics tracking is enabled
        if (featureToggleService.isFeatureEnabled('api_metrics_tracking')) {
          // Use smart caching for metrics to reduce Redis usage
          const metricsKey = `metrics:api:${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
          
          await smartCacheService.set(
            `${metricsKey}:latest`,
            {
              duration,
              timestamp: Date.now(),
              status: res.statusCode,
              cacheStatus: res.get('X-Cache') || 'UNKNOWN'
            },
            {
              ttl: 3600, // 1 hour
              priority: 'low',
              l1Only: true // Keep metrics in memory only
            }
          );
        }
      } catch (error) {
        console.error('Error in performance tracking:', error);
      }
    });

    next();
  };
};

// Smart cache warming with feature checks
export const smartCacheWarming = async (): Promise<void> => {
  if (!featureToggleService.isFeatureEnabled('cache_warming')) {
    console.log('📵 Cache warming disabled');
    return;
  }

  console.log('🔥 Starting smart cache warming...');
  
  try {
    // Only warm critical endpoints
    const criticalEndpoints = [
      {
        key: 'courses:list',
        data: { courses: [], total: 0 },
        options: { ttl: 1800, priority: 'high' as const }
      },
      {
        key: 'categories:list',
        data: { categories: [] },
        options: { ttl: 3600, priority: 'medium' as const }
      }
    ];

    for (const endpoint of criticalEndpoints) {
      await smartCacheService.set(endpoint.key, endpoint.data, endpoint.options);
    }

    console.log('✅ Smart cache warming completed');
  } catch (error) {
    console.error('❌ Error in smart cache warming:', error);
  }
};

// Adaptive caching based on Redis usage
export const adaptiveCaching = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check Redis usage before applying caching
      const healthCheck = await redisUsageAuditor.quickHealthCheck();
      
      // Adjust caching strategy based on Redis health
      if (healthCheck.status === 'critical') {
        // Disable all non-critical caching
        featureToggleService.setOptimizationMode('aggressive');
        console.log('🚨 Critical Redis usage - aggressive optimization enabled');
      } else if (healthCheck.status === 'warning') {
        // Conservative caching
        featureToggleService.setOptimizationMode('conservative');
        console.log('⚠️ High Redis usage - conservative optimization enabled');
      }

      // Add Redis usage info to request context
      req.redisHealth = healthCheck;
      
      next();
    } catch (error) {
      console.error('Error in adaptive caching:', error);
      next();
    }
  };
};

// Selective cache invalidation
export const selectiveCacheInvalidation = (tags: string[], priority: 'critical' | 'high' | 'medium' | 'low' = 'medium') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only invalidate if invalidation tracking is enabled
    if (!featureToggleService.isFeatureEnabled('invalidation_tracking')) {
      return next();
    }

    // Store original end function
    const originalEnd = res.end;
    
    res.end = function(chunk?: any, encoding?: any) {
      // Only invalidate on successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Invalidate based on priority
        if (priority === 'critical' || featureToggleService.isFeatureEnabled('cache_statistics')) {
          // Perform invalidation asynchronously
          setImmediate(async () => {
            try {
              for (const tag of tags) {
                // Use pattern-based invalidation for efficiency
                const pattern = `*${tag}*`;
                console.log(`🗑️ Invalidating cache pattern: ${pattern}`);
                
                // Clear from smart cache
                // In a real implementation, you'd implement pattern-based clearing
              }
            } catch (error) {
              console.error('Error in cache invalidation:', error);
            }
          });
        }
      }
      
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
};

// Memory-only caching for low priority data
export const memoryOnlyCache = (options: {
  ttl?: number;
  condition?: (req: Request) => boolean;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Always use memory-only for low priority data
    const cacheKey = generateCacheKey(req);
    
    // Check condition if provided
    if (options.condition && !options.condition(req)) {
      return next();
    }

    try {
      // Try L1 cache only
      const cachedData = await smartCacheService.get(cacheKey, { l1Only: true });
      
      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Source', 'MEMORY');
        return res.json(cachedData);
      }

      // Cache miss - intercept response
      const originalJson = res.json;
      res.json = function(data: any) {
        // Cache in memory only
        smartCacheService.set(cacheKey, data, {
          ttl: options.ttl || 300,
          priority: 'low',
          l1Only: true
        }).catch(error => {
          console.error('Error caching in memory:', error);
        });
        
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Memory cache error:', error);
      next();
    }
  };
};

// Helper functions
function generateCacheKey(req: Request): string {
  const baseKey = `${req.method}:${req.path}`;
  const queryString = Object.keys(req.query).length > 0 ? `:${JSON.stringify(req.query)}` : '';
  const userKey = req.user ? `:user:${req.user._id}` : '';
  
  return `api:${baseKey}${queryString}${userKey}`;
}

function getSmartTTL(path: string, priority: string): number {
  // Smart TTL based on path and priority
  if (path.includes('/auth') || path.includes('/login')) return 300; // 5 minutes
  if (path.includes('/user') || path.includes('/profile')) return 900; // 15 minutes
  if (path.includes('/courses')) return 1800; // 30 minutes
  if (path.includes('/categories')) return 3600; // 1 hour
  
  // Priority-based TTL
  switch (priority) {
    case 'critical': return 3600; // 1 hour
    case 'high': return 1800; // 30 minutes
    case 'medium': return 900; // 15 minutes
    case 'low': return 300; // 5 minutes
    default: return 600; // 10 minutes
  }
}

function shouldCompress(data: any): boolean {
  const serialized = JSON.stringify(data);
  return serialized.length > 1024; // Compress if larger than 1KB
}

// Feature-aware cache statistics
export const featureAwareCacheStats = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only collect stats if enabled
    if (!featureToggleService.isFeatureEnabled('cache_statistics')) {
      return next();
    }

    const cacheStatus = res.get('X-Cache');
    if (cacheStatus) {
      // Use memory-only storage for stats to reduce Redis usage
      const statsKey = `cache:stats:${cacheStatus?.toLowerCase() || 'unknown'}`;
      
      try {
        await smartCacheService.set(
          `${statsKey}:${Date.now()}`,
          {
            endpoint: `${req.method} ${req.path}`,
            timestamp: Date.now(),
            status: cacheStatus
          },
          {
            ttl: 3600,
            priority: 'low',
            l1Only: true
          }
        );
      } catch (error) {
        console.error('Error collecting cache stats:', error);
      }
    }

    next();
  };
};

// Export optimized middleware functions
export {
  smartCacheService,
  featureToggleService
};
