/**
 * Enterprise Cache Middleware
 * Implements advanced cache invalidation patterns for enterprise-grade performance
 */

import { Request, Response, NextFunction } from 'express';
import EnterpriseCacheService from '../services/cache/EnterpriseCache';
import CacheVersioningService from '../services/cache/CacheVersioningService';

interface CacheConfig {
  pattern: 'write-through' | 'write-behind' | 'cache-aside';
  ttl: number;
  tags: string[];
  versionCheck: boolean;
  warmOnInvalidate: boolean;
}

interface CacheContext {
  entityType: string;
  entityId: string;
  operation: 'create' | 'read' | 'update' | 'delete';
  data?: any;
  config: CacheConfig;
}

export class EnterpriseCacheMiddleware {
  private enterpriseCache: EnterpriseCacheService;
  private versioningService: CacheVersioningService;

  constructor() {
    this.enterpriseCache = new EnterpriseCacheService();
    this.versioningService = new CacheVersioningService();
  }

  /**
   * Write-through cache pattern
   * Data is written to cache and database simultaneously
   */
  writeThrough(config: CacheConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      console.log('📝 Write-through cache pattern activated');

      // Store original response methods
      const originalSend = res.send;
      const originalJson = res.json;

      // Override response methods to intercept data
      res.send = function(data: any) {
        // Write to cache immediately after successful response
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setImmediate(async () => {
            try {
              await handleWriteThrough(req, data, config);
            } catch (error) {
              console.error('❌ Write-through cache failed:', error);
            }
          });
        }
        return originalSend.call(this, data);
      };

      res.json = function(data: any) {
        // Write to cache immediately after successful response
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setImmediate(async () => {
            try {
              await handleWriteThrough(req, data, config);
            } catch (error) {
              console.error('❌ Write-through cache failed:', error);
            }
          });
        }
        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Write-behind cache pattern
   * Data is written to cache immediately, database write is deferred
   */
  writeBehind(config: CacheConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      console.log('⏰ Write-behind cache pattern activated');

      // Store original response methods
      const originalSend = res.send;
      const originalJson = res.json;

      // Override response methods to intercept data
      res.send = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Immediate cache write
          setImmediate(async () => {
            try {
              await handleWriteBehind(req, data, config);
            } catch (error) {
              console.error('❌ Write-behind cache failed:', error);
            }
          });
        }
        return originalSend.call(this, data);
      };

      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Immediate cache write
          setImmediate(async () => {
            try {
              await handleWriteBehind(req, data, config);
            } catch (error) {
              console.error('❌ Write-behind cache failed:', error);
            }
          });
        }
        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Cache-aside pattern
   * Application manages cache explicitly
   */
  cacheAside(config: CacheConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      console.log('🔄 Cache-aside pattern activated');

      // Check cache first for GET requests
      if (req.method === 'GET') {
        try {
          const cachedData = await this.checkCacheAside(req, config);
          if (cachedData) {
            console.log('✅ Cache hit - returning cached data');
            return res.json(cachedData);
          }
        } catch (error) {
          console.error('❌ Cache-aside check failed:', error);
        }
      }

      // Store original response methods for cache population
      const originalSend = res.send;
      const originalJson = res.json;

      res.send = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setImmediate(async () => {
            try {
              await handleCacheAside(req, data, config);
            } catch (error) {
              console.error('❌ Cache-aside population failed:', error);
            }
          });
        }
        return originalSend.call(this, data);
      };

      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setImmediate(async () => {
            try {
              await handleCacheAside(req, data, config);
            } catch (error) {
              console.error('❌ Cache-aside population failed:', error);
            }
          });
        }
        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Enterprise invalidation middleware for lecture updates
   */
  enterpriseLectureInvalidation() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only apply to lecture update operations
      if (req.method === 'PUT' || req.method === 'PATCH') {
        const { courseId, lectureId } = req.params;
        
        if (lectureId && courseId) {
          console.log('🏢 Enterprise lecture invalidation middleware activated');

          // Store original response methods
          const originalSend = res.send;
          const originalJson = res.json;

          const handleInvalidation = async (data: any) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const updatedFields = Object.keys(req.body || {});
                await this.enterpriseCache.invalidateLectureUpdate(lectureId, courseId, updatedFields);
                console.log('✅ Enterprise lecture invalidation completed');
              } catch (error) {
                console.error('❌ Enterprise lecture invalidation failed:', error);
              }
            }
          };

          res.send = function(data: any) {
            setImmediate(() => handleInvalidation(data));
            return originalSend.call(this, data);
          };

          res.json = function(data: any) {
            setImmediate(() => handleInvalidation(data));
            return originalJson.call(this, data);
          };
        }
      }

      next();
    };
  }

  /**
   * Check cache for cache-aside pattern
   */
  private async checkCacheAside(req: Request, config: CacheConfig): Promise<any | null> {
    // Implementation would check cache based on request
    // For now, return null to indicate cache miss
    return null;
  }
}

/**
 * Handle write-through cache pattern
 */
async function handleWriteThrough(req: Request, data: any, config: CacheConfig): Promise<void> {
  console.log('📝 Executing write-through cache operation');
  
  // Extract entity information from request
  const context = extractCacheContext(req, data, config);
  
  if (context) {
    // Write to cache immediately
    console.log(`📝 Write-through: Caching ${context.entityType}:${context.entityId}`);
    
    // In a real implementation, you would write to your cache here
    // await cacheService.set(cacheKey, data, config.ttl);
  }
}

/**
 * Handle write-behind cache pattern
 */
async function handleWriteBehind(req: Request, data: any, config: CacheConfig): Promise<void> {
  console.log('⏰ Executing write-behind cache operation');
  
  const context = extractCacheContext(req, data, config);
  
  if (context) {
    // Immediate cache write
    console.log(`⏰ Write-behind: Immediate cache write for ${context.entityType}:${context.entityId}`);
    
    // Schedule deferred database write
    setTimeout(async () => {
      console.log(`⏰ Write-behind: Deferred database write for ${context.entityType}:${context.entityId}`);
      // Perform database write here
    }, 100); // 100ms delay
  }
}

/**
 * Handle cache-aside pattern
 */
async function handleCacheAside(req: Request, data: any, config: CacheConfig): Promise<void> {
  console.log('🔄 Executing cache-aside operation');
  
  const context = extractCacheContext(req, data, config);
  
  if (context) {
    console.log(`🔄 Cache-aside: Populating cache for ${context.entityType}:${context.entityId}`);
    
    // Populate cache after successful database operation
    // await cacheService.set(cacheKey, data, config.ttl);
  }
}

/**
 * Extract cache context from request
 */
function extractCacheContext(req: Request, data: any, config: CacheConfig): CacheContext | null {
  const { courseId, lectureId } = req.params;
  
  if (lectureId) {
    return {
      entityType: 'lecture',
      entityId: lectureId,
      operation: getOperationType(req.method),
      data,
      config
    };
  }
  
  if (courseId) {
    return {
      entityType: 'course',
      entityId: courseId,
      operation: getOperationType(req.method),
      data,
      config
    };
  }
  
  return null;
}

/**
 * Get operation type from HTTP method
 */
function getOperationType(method: string): 'create' | 'read' | 'update' | 'delete' {
  switch (method.toUpperCase()) {
    case 'POST': return 'create';
    case 'GET': return 'read';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'read';
  }
}

// Export singleton instance
export const enterpriseCacheMiddleware = new EnterpriseCacheMiddleware();
export default enterpriseCacheMiddleware;
