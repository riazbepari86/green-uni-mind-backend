/**
 * Middleware Registry
 * Registers all middleware with lazy loading and conditional configuration
 */

import { middlewareFactory } from './MiddlewareFactory';
import { Environment } from '../utils/environment';

/**
 * Register all middleware with optimized configurations
 */
export function registerMiddleware(): void {
  // Security Middleware (lazy loaded)
  middlewareFactory.register(
    'enhancedSecurityHeaders',
    createLazyMiddleware(() => import('./security.middleware').then(m => m.enhancedSecurityHeaders)),
    {
      enabled: true,
      environments: ['development', 'production'],
      excludeRoutes: ['/health', '/ping', '/test'],
      priority: 10,
    }
  );

  middlewareFactory.register(
    'generalRateLimit',
    createLazyMiddleware(() => import('./security.middleware').then(m => m.generalRateLimit)),
    {
      enabled: true,
      environments: ['development', 'production'],
      excludeRoutes: ['/health', '/ping', '/test'],
      priority: 20,
    }
  );

  middlewareFactory.register(
    'authRateLimit',
    createLazyMiddleware(() => import('./security.middleware').then(m => m.authRateLimit)),
    {
      enabled: true,
      environments: ['development', 'production'],
      routes: ['/api/v1/auth'],
      priority: 15,
    }
  );

  middlewareFactory.register(
    'securityLogging',
    createLazyMiddleware(() => import('./security.middleware').then(m => m.securityLogging)),
    {
      enabled: Environment.isProduction(),
      environments: ['production'],
      excludeRoutes: ['/health', '/ping', '/test'],
      priority: 30,
    }
  );

  middlewareFactory.register(
    'requestSizeLimit',
    createLazyMiddleware(() => import('./security.middleware').then(m => m.requestSizeLimit('10mb'))),
    {
      enabled: true,
      environments: ['development', 'production'],
      priority: 40,
    }
  );

  middlewareFactory.register(
    'encryptionMiddleware',
    createLazyMiddleware(() => import('./security.middleware').then(m => m.encryptionMiddleware())),
    {
      enabled: Environment.isProduction() && !!process.env.ENCRYPTION_KEY,
      environments: ['production'],
      routes: ['/api/v1/auth', '/api/v1/users', '/api/v1/payments'],
      priority: 50,
    }
  );

  // Performance Middleware (conditionally loaded)
  middlewareFactory.register(
    'responseCompression',
    createLazyMiddleware(() => import('./performance.middleware').then(m => m.responseCompression)),
    {
      enabled: true,
      environments: ['development', 'production'],
      priority: 60,
    }
  );

  middlewareFactory.register(
    'cacheHeaders',
    createLazyMiddleware(() => import('./performance.middleware').then(m => m.cacheHeaders)),
    {
      enabled: true,
      environments: ['development', 'production'],
      priority: 70,
    }
  );

  // Performance monitoring (only when needed)
  middlewareFactory.register(
    'performanceTracker',
    createLazyMiddleware(() => import('./performance.middleware').then(m => m.performanceTracker)),
    {
      enabled: Environment.isProduction() || process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
      environments: ['production'],
      excludeRoutes: ['/health', '/ping', '/test'],
      priority: 80,
    }
  );

  middlewareFactory.register(
    'memoryMonitor',
    createLazyMiddleware(() => import('./performance.middleware').then(m => m.memoryMonitor)),
    {
      enabled: Environment.isProduction() || process.env.ENABLE_MEMORY_MONITORING === 'true',
      environments: ['production'],
      excludeRoutes: ['/health', '/ping', '/test'],
      priority: 90,
    }
  );

  middlewareFactory.register(
    'requestTimeout',
    createLazyMiddleware(() => import('./performance.middleware').then(m => m.requestTimeout(30000))),
    {
      enabled: true,
      environments: ['development', 'production'],
      excludeRoutes: ['/health', '/ping', '/test'],
      priority: 100,
    }
  );

  middlewareFactory.register(
    'requestSizeMonitor',
    createLazyMiddleware(() => import('./performance.middleware').then(m => m.requestSizeMonitor)),
    {
      enabled: Environment.isProduction() || process.env.ENABLE_REQUEST_MONITORING === 'true',
      environments: ['production'],
      excludeRoutes: ['/health', '/ping', '/test'],
      priority: 110,
    }
  );

  console.log('✅ Middleware registry initialized with conditional loading');
}

/**
 * Create lazy-loaded middleware wrapper
 */
function createLazyMiddleware(importFn: () => Promise<any>) {
  let cachedMiddleware: any = null;
  let isLoading = false;
  let loadPromise: Promise<any> | null = null;

  return (req: any, res: any, next: any) => {
    // If middleware is already cached, use it
    if (cachedMiddleware) {
      return cachedMiddleware(req, res, next);
    }

    // If already loading, wait for the load to complete
    if (isLoading && loadPromise) {
      loadPromise
        .then((middleware) => {
          cachedMiddleware = middleware;
          return cachedMiddleware(req, res, next);
        })
        .catch((error) => {
          console.error('Failed to load middleware:', error);
          return next();
        });
      return;
    }

    // Start loading the middleware
    isLoading = true;
    loadPromise = importFn();

    loadPromise
      .then((middleware) => {
        cachedMiddleware = middleware;
        isLoading = false;
        return cachedMiddleware(req, res, next);
      })
      .catch((error) => {
        console.error('Failed to load middleware:', error);
        isLoading = false;
        return next();
      });
  };
}

/**
 * Get middleware loading statistics
 */
export function getMiddlewareStats() {
  return middlewareFactory.getStats();
}

/**
 * Reset middleware registry (for testing)
 */
export function resetMiddlewareRegistry() {
  middlewareFactory.reset();
}
