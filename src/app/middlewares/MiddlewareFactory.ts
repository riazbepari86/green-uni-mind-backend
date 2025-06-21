/**
 * Professional Middleware Factory
 * Implements conditional middleware loading and performance optimization
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Environment } from '../utils/environment';
import { Logger } from '../config/logger';

// Middleware configuration interface
interface MiddlewareConfig {
  enabled: boolean;
  environments: string[];
  routes?: string[];
  excludeRoutes?: string[];
  priority: number;
}

// Middleware registry
interface MiddlewareRegistry {
  [key: string]: {
    handler: RequestHandler;
    config: MiddlewareConfig;
    loaded: boolean;
  };
}

/**
 * Professional Middleware Factory
 * Loads middleware conditionally based on environment and route patterns
 */
export class MiddlewareFactory {
  private static instance: MiddlewareFactory;
  private registry: MiddlewareRegistry = {};
  private loadedMiddleware: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): MiddlewareFactory {
    if (!MiddlewareFactory.instance) {
      MiddlewareFactory.instance = new MiddlewareFactory();
    }
    return MiddlewareFactory.instance;
  }

  /**
   * Register middleware with configuration
   */
  public register(
    name: string,
    handler: RequestHandler,
    config: Partial<MiddlewareConfig> = {}
  ): void {
    const defaultConfig: MiddlewareConfig = {
      enabled: true,
      environments: ['development', 'production'],
      priority: 100,
      ...config,
    };

    this.registry[name] = {
      handler,
      config: defaultConfig,
      loaded: false,
    };
  }

  /**
   * Get middleware handler with conditional loading
   */
  public getMiddleware(name: string): RequestHandler {
    const middleware = this.registry[name];
    
    if (!middleware) {
      Logger.warn(`Middleware '${name}' not found in registry`);
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    // Check if middleware should be loaded in current environment
    if (!this.shouldLoadMiddleware(middleware.config)) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    // Mark as loaded
    if (!middleware.loaded) {
      middleware.loaded = true;
      this.loadedMiddleware.add(name);
      Logger.info(`Middleware '${name}' loaded for ${Environment.current()}`);
    }

    // Return conditional middleware wrapper
    return this.createConditionalWrapper(name, middleware.handler, middleware.config);
  }

  /**
   * Get multiple middleware handlers in priority order
   */
  public getMiddlewareStack(names: string[]): RequestHandler[] {
    return names
      .map(name => ({ name, middleware: this.registry[name] }))
      .filter(({ middleware }) => middleware && this.shouldLoadMiddleware(middleware.config))
      .sort((a, b) => a.middleware.config.priority - b.middleware.config.priority)
      .map(({ name }) => this.getMiddleware(name));
  }

  /**
   * Create optimized security middleware stack
   */
  public getSecurityStack(): RequestHandler[] {
    const securityMiddleware = [
      'enhancedSecurityHeaders',
      'generalRateLimit',
      'securityLogging',
      'requestSizeLimit',
    ];

    return this.getMiddlewareStack(securityMiddleware);
  }

  /**
   * Create optimized performance middleware stack
   */
  public getPerformanceStack(): RequestHandler[] {
    const performanceMiddleware = [
      'responseCompression',
      'cacheHeaders',
    ];

    // Add monitoring middleware only in production or when explicitly enabled
    if (Environment.isProduction() || process.env.ENABLE_PERFORMANCE_MONITORING === 'true') {
      performanceMiddleware.push('performanceTracker', 'memoryMonitor');
    }

    return this.getMiddlewareStack(performanceMiddleware);
  }

  /**
   * Create route-specific middleware
   */
  public getRouteMiddleware(route: string): RequestHandler[] {
    const routeMiddleware: string[] = [];

    // Add auth rate limiting for auth routes
    if (route.startsWith('/api/v1/auth')) {
      routeMiddleware.push('authRateLimit');
    }

    // Add encryption for sensitive routes in production
    if (Environment.isProduction() && this.isSensitiveRoute(route)) {
      routeMiddleware.push('encryptionMiddleware');
    }

    return this.getMiddlewareStack(routeMiddleware);
  }

  /**
   * Check if middleware should be loaded
   */
  private shouldLoadMiddleware(config: MiddlewareConfig): boolean {
    if (!config.enabled) {
      return false;
    }

    const currentEnv = Environment.current();
    return config.environments.includes(currentEnv);
  }

  /**
   * Create conditional middleware wrapper
   */
  private createConditionalWrapper(
    name: string,
    handler: RequestHandler,
    config: MiddlewareConfig
  ): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip middleware for excluded routes
      if (config.excludeRoutes && config.excludeRoutes.some(route => req.path.startsWith(route))) {
        return next();
      }

      // Apply middleware only to specified routes
      if (config.routes && !config.routes.some(route => req.path.startsWith(route))) {
        return next();
      }

      // Skip middleware for health check endpoints (performance optimization)
      if (this.isHealthCheckEndpoint(req.path)) {
        return next();
      }

      try {
        return handler(req, res, next);
      } catch (error) {
        Logger.error(`Middleware '${name}' error`, { error, path: req.path });
        next(error);
      }
    };
  }

  /**
   * Check if route is a health check endpoint
   */
  private isHealthCheckEndpoint(path: string): boolean {
    const healthCheckPaths = ['/health', '/ping', '/test'];
    return healthCheckPaths.includes(path);
  }

  /**
   * Check if route is sensitive and needs encryption
   */
  private isSensitiveRoute(route: string): boolean {
    const sensitiveRoutes = [
      '/api/v1/auth',
      '/api/v1/users',
      '/api/v1/payments',
      '/api/v1/admin',
    ];
    return sensitiveRoutes.some(sensitiveRoute => route.startsWith(sensitiveRoute));
  }

  /**
   * Get loaded middleware statistics
   */
  public getStats(): {
    total: number;
    loaded: number;
    loadedMiddleware: string[];
    environment: string;
  } {
    return {
      total: Object.keys(this.registry).length,
      loaded: this.loadedMiddleware.size,
      loadedMiddleware: Array.from(this.loadedMiddleware),
      environment: Environment.current(),
    };
  }

  /**
   * Reset middleware factory (for testing)
   */
  public reset(): void {
    this.registry = {};
    this.loadedMiddleware.clear();
  }
}

// Export singleton instance
export const middlewareFactory = MiddlewareFactory.getInstance();
