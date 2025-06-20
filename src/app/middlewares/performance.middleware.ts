/**
 * Performance Monitoring Middleware
 * Tracks request performance and system metrics
 */

import { Request, Response, NextFunction } from 'express';
import { performanceMonitoringService } from '../services/performance/PerformanceMonitoringService';
import { Logger } from '../config/logger';
import { Environment } from '../utils/environment';
import compression from 'compression';

// Extend Request interface to include performance tracking
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
      requestId?: string;
    }
  }
}

/**
 * Request performance tracking middleware
 */
export const performanceTracker = (req: Request, res: Response, next: NextFunction) => {
  // Skip performance tracking for health check endpoints
  const healthCheckPaths = ['/health', '/ping', '/test'];
  if (healthCheckPaths.includes(req.path)) {
    return next();
  }

  // Record start time
  req.startTime = Date.now();
  req.requestId = generateRequestId();

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
    const responseTime = Date.now() - (req.startTime || Date.now());

    // Record metrics
    performanceMonitoringService.recordRequest(
      req.method,
      req.route?.path || req.path,
      responseTime,
      res.statusCode
    );

    // Log slow requests
    if (responseTime > 1000) { // > 1 second
      Logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        responseTime,
        statusCode: res.statusCode,
        requestId: req.requestId,
      });
    }

    // Call original end method and return its result
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

/**
 * Response compression middleware
 */
export const responseCompression = compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  
  // Compression level (1-9, 6 is default)
  level: Environment.isProduction() ? 6 : 1,
  
  // Filter function to determine what to compress
  filter: (req: Request, res: Response) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Don't compress images, videos, or already compressed files
    const contentType = res.getHeader('content-type') as string;
    if (contentType) {
      const skipTypes = [
        'image/',
        'video/',
        'audio/',
        'application/zip',
        'application/gzip',
        'application/x-rar',
        'application/pdf',
      ];
      
      if (skipTypes.some(type => contentType.includes(type))) {
        return false;
      }
    }

    // Use default compression filter
    return compression.filter(req, res);
  },
});

/**
 * Database query performance tracking
 */
export const trackDatabaseQuery = (query: string, startTime: number) => {
  const duration = Date.now() - startTime;
  performanceMonitoringService.recordDatabaseQuery(query, duration);
  
  return duration;
};

/**
 * Redis operation performance tracking
 */
export const trackRedisOperation = (operation: string, startTime: number) => {
  const duration = Date.now() - startTime;
  performanceMonitoringService.recordRedisOperation(operation, duration);
  
  return duration;
};

/**
 * Memory usage monitoring middleware
 */
export const memoryMonitor = (req: Request, res: Response, next: NextFunction) => {
  // Skip memory monitoring for health check endpoints
  const healthCheckPaths = ['/health', '/ping', '/test'];
  if (healthCheckPaths.includes(req.path)) {
    return next();
  }

  // Check memory usage before processing request
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

  // Log high memory usage
  if (heapUsedMB > 400) { // > 400MB
    Logger.warn('High memory usage detected', {
      heapUsed: `${heapUsedMB.toFixed(2)}MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memUsage.external / 1024 / 1024).toFixed(2)}MB`,
      requestId: req.requestId,
    });
  }

  // Force garbage collection if memory is very high (production only)
  if (Environment.isProduction() && heapUsedMB > 500 && global.gc) {
    Logger.info('Forcing garbage collection due to high memory usage');
    global.gc();
  }

  next();
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip timeout for health check endpoints
    const healthCheckPaths = ['/health', '/ping', '/test'];
    if (healthCheckPaths.includes(req.path)) {
      return next();
    }

    // Set timeout for the request
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        Logger.error('Request timeout', {
          method: req.method,
          path: req.path,
          timeout: timeoutMs,
          requestId: req.requestId,
        });

        res.status(408).json({
          error: 'Request Timeout',
          message: 'The request took too long to process',
          requestId: req.requestId,
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Rate limiting based on performance
 */
export const performanceBasedRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const metrics = performanceMonitoringService.getMetrics();
  
  // If system is under high load, apply stricter rate limiting
  if (metrics.averageResponseTime > 2000 || metrics.memoryUsage > 400) {
    const rateLimitHeader = req.get('x-rate-limit-remaining');
    
    if (rateLimitHeader) {
      const remaining = parseInt(rateLimitHeader);
      
      // Reduce allowed requests when system is under load
      if (remaining > 10) {
        res.setHeader('x-rate-limit-remaining', Math.floor(remaining / 2));
        Logger.info('Applied performance-based rate limiting', {
          originalRemaining: remaining,
          newRemaining: Math.floor(remaining / 2),
          avgResponseTime: metrics.averageResponseTime,
          memoryUsage: metrics.memoryUsage,
        });
      }
    }
  }

  next();
};

/**
 * Health check endpoint performance
 */
export const healthCheckPerformance = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.path === '/ping') {
    // Skip detailed performance tracking for health checks
    return next();
  }

  // Apply performance tracking for all other endpoints
  performanceTracker(req, res, next);
};

/**
 * API response caching headers
 */
export const cacheHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Set cache headers based on request type
  if (req.method === 'GET') {
    const path = req.path.toLowerCase();
    
    // Cache static content longer
    if (path.includes('/static/') || path.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    }
    // Cache API responses briefly
    else if (path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
    }
    // Don't cache dynamic content
    else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  } else {
    // Don't cache non-GET requests
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  next();
};

/**
 * Request size monitoring
 */
export const requestSizeMonitor = (req: Request, res: Response, next: NextFunction) => {
  // Skip request size monitoring for health check endpoints
  const healthCheckPaths = ['/health', '/ping', '/test'];
  if (healthCheckPaths.includes(req.path)) {
    return next();
  }

  const contentLength = req.get('content-length');

  if (contentLength) {
    const sizeInMB = parseInt(contentLength) / (1024 * 1024);

    // Log large requests
    if (sizeInMB > 5) { // > 5MB
      Logger.warn('Large request detected', {
        size: `${sizeInMB.toFixed(2)}MB`,
        method: req.method,
        path: req.path,
        contentType: req.get('content-type'),
        requestId: req.requestId,
      });
    }
  }

  next();
};

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Performance metrics endpoint (admin only)
 */
export const performanceMetricsHandler = (req: Request, res: Response) => {
  try {
    const summary = performanceMonitoringService.getPerformanceSummary();
    
    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('Failed to get performance metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics',
    });
  }
};

/**
 * Reset performance metrics endpoint (admin only)
 */
export const resetPerformanceMetricsHandler = (req: Request, res: Response) => {
  try {
    performanceMonitoringService.resetMetrics();
    
    res.json({
      success: true,
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error('Failed to reset performance metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to reset performance metrics',
    });
  }
};
