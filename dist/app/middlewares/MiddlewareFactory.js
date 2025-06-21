"use strict";
/**
 * Professional Middleware Factory
 * Implements conditional middleware loading and performance optimization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.middlewareFactory = exports.MiddlewareFactory = void 0;
const environment_1 = require("../utils/environment");
const logger_1 = require("../config/logger");
/**
 * Professional Middleware Factory
 * Loads middleware conditionally based on environment and route patterns
 */
class MiddlewareFactory {
    constructor() {
        this.registry = {};
        this.loadedMiddleware = new Set();
    }
    static getInstance() {
        if (!MiddlewareFactory.instance) {
            MiddlewareFactory.instance = new MiddlewareFactory();
        }
        return MiddlewareFactory.instance;
    }
    /**
     * Register middleware with configuration
     */
    register(name, handler, config = {}) {
        const defaultConfig = Object.assign({ enabled: true, environments: ['development', 'production'], priority: 100 }, config);
        this.registry[name] = {
            handler,
            config: defaultConfig,
            loaded: false,
        };
    }
    /**
     * Get middleware handler with conditional loading
     */
    getMiddleware(name) {
        const middleware = this.registry[name];
        if (!middleware) {
            logger_1.Logger.warn(`Middleware '${name}' not found in registry`);
            return (req, res, next) => next();
        }
        // Check if middleware should be loaded in current environment
        if (!this.shouldLoadMiddleware(middleware.config)) {
            return (req, res, next) => next();
        }
        // Mark as loaded
        if (!middleware.loaded) {
            middleware.loaded = true;
            this.loadedMiddleware.add(name);
            logger_1.Logger.info(`Middleware '${name}' loaded for ${environment_1.Environment.current()}`);
        }
        // Return conditional middleware wrapper
        return this.createConditionalWrapper(name, middleware.handler, middleware.config);
    }
    /**
     * Get multiple middleware handlers in priority order
     */
    getMiddlewareStack(names) {
        return names
            .map(name => ({ name, middleware: this.registry[name] }))
            .filter(({ middleware }) => middleware && this.shouldLoadMiddleware(middleware.config))
            .sort((a, b) => a.middleware.config.priority - b.middleware.config.priority)
            .map(({ name }) => this.getMiddleware(name));
    }
    /**
     * Create optimized security middleware stack
     */
    getSecurityStack() {
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
    getPerformanceStack() {
        const performanceMiddleware = [
            'responseCompression',
            'cacheHeaders',
        ];
        // Add monitoring middleware only in production or when explicitly enabled
        if (environment_1.Environment.isProduction() || process.env.ENABLE_PERFORMANCE_MONITORING === 'true') {
            performanceMiddleware.push('performanceTracker', 'memoryMonitor');
        }
        return this.getMiddlewareStack(performanceMiddleware);
    }
    /**
     * Create route-specific middleware
     */
    getRouteMiddleware(route) {
        const routeMiddleware = [];
        // Add auth rate limiting for auth routes
        if (route.startsWith('/api/v1/auth')) {
            routeMiddleware.push('authRateLimit');
        }
        // Add encryption for sensitive routes in production
        if (environment_1.Environment.isProduction() && this.isSensitiveRoute(route)) {
            routeMiddleware.push('encryptionMiddleware');
        }
        return this.getMiddlewareStack(routeMiddleware);
    }
    /**
     * Check if middleware should be loaded
     */
    shouldLoadMiddleware(config) {
        if (!config.enabled) {
            return false;
        }
        const currentEnv = environment_1.Environment.current();
        return config.environments.includes(currentEnv);
    }
    /**
     * Create conditional middleware wrapper
     */
    createConditionalWrapper(name, handler, config) {
        return (req, res, next) => {
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
            }
            catch (error) {
                logger_1.Logger.error(`Middleware '${name}' error`, { error, path: req.path });
                next(error);
            }
        };
    }
    /**
     * Check if route is a health check endpoint
     */
    isHealthCheckEndpoint(path) {
        const healthCheckPaths = ['/health', '/ping', '/test'];
        return healthCheckPaths.includes(path);
    }
    /**
     * Check if route is sensitive and needs encryption
     */
    isSensitiveRoute(route) {
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
    getStats() {
        return {
            total: Object.keys(this.registry).length,
            loaded: this.loadedMiddleware.size,
            loadedMiddleware: Array.from(this.loadedMiddleware),
            environment: environment_1.Environment.current(),
        };
    }
    /**
     * Reset middleware factory (for testing)
     */
    reset() {
        this.registry = {};
        this.loadedMiddleware.clear();
    }
}
exports.MiddlewareFactory = MiddlewareFactory;
// Export singleton instance
exports.middlewareFactory = MiddlewareFactory.getInstance();
