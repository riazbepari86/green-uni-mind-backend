"use strict";
/**
 * Middleware Registry
 * Registers all middleware with lazy loading and conditional configuration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMiddleware = registerMiddleware;
exports.getMiddlewareStats = getMiddlewareStats;
exports.resetMiddlewareRegistry = resetMiddlewareRegistry;
const MiddlewareFactory_1 = require("./MiddlewareFactory");
const environment_1 = require("../utils/environment");
/**
 * Register all middleware with optimized configurations
 */
function registerMiddleware() {
    // Security Middleware (lazy loaded)
    MiddlewareFactory_1.middlewareFactory.register('enhancedSecurityHeaders', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./security.middleware'))).then(m => m.enhancedSecurityHeaders)), {
        enabled: true,
        environments: ['development', 'production'],
        excludeRoutes: ['/health', '/ping', '/test'],
        priority: 10,
    });
    MiddlewareFactory_1.middlewareFactory.register('generalRateLimit', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./security.middleware'))).then(m => m.generalRateLimit)), {
        enabled: true,
        environments: ['development', 'production'],
        excludeRoutes: ['/health', '/ping', '/test'],
        priority: 20,
    });
    MiddlewareFactory_1.middlewareFactory.register('authRateLimit', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./security.middleware'))).then(m => m.authRateLimit)), {
        enabled: true,
        environments: ['development', 'production'],
        routes: ['/api/v1/auth'],
        priority: 15,
    });
    MiddlewareFactory_1.middlewareFactory.register('securityLogging', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./security.middleware'))).then(m => m.securityLogging)), {
        enabled: environment_1.Environment.isProduction(),
        environments: ['production'],
        excludeRoutes: ['/health', '/ping', '/test'],
        priority: 30,
    });
    MiddlewareFactory_1.middlewareFactory.register('requestSizeLimit', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./security.middleware'))).then(m => m.requestSizeLimit('10mb'))), {
        enabled: true,
        environments: ['development', 'production'],
        priority: 40,
    });
    MiddlewareFactory_1.middlewareFactory.register('encryptionMiddleware', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./security.middleware'))).then(m => m.encryptionMiddleware())), {
        enabled: environment_1.Environment.isProduction() && !!process.env.ENCRYPTION_KEY,
        environments: ['production'],
        routes: ['/api/v1/auth', '/api/v1/users', '/api/v1/payments'],
        priority: 50,
    });
    // Performance Middleware (conditionally loaded)
    MiddlewareFactory_1.middlewareFactory.register('responseCompression', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./performance.middleware'))).then(m => m.responseCompression)), {
        enabled: true,
        environments: ['development', 'production'],
        priority: 60,
    });
    MiddlewareFactory_1.middlewareFactory.register('cacheHeaders', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./performance.middleware'))).then(m => m.cacheHeaders)), {
        enabled: true,
        environments: ['development', 'production'],
        priority: 70,
    });
    // Performance monitoring (only when needed)
    MiddlewareFactory_1.middlewareFactory.register('performanceTracker', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./performance.middleware'))).then(m => m.performanceTracker)), {
        enabled: environment_1.Environment.isProduction() || process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
        environments: ['production'],
        excludeRoutes: ['/health', '/ping', '/test'],
        priority: 80,
    });
    MiddlewareFactory_1.middlewareFactory.register('memoryMonitor', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./performance.middleware'))).then(m => m.memoryMonitor)), {
        enabled: environment_1.Environment.isProduction() || process.env.ENABLE_MEMORY_MONITORING === 'true',
        environments: ['production'],
        excludeRoutes: ['/health', '/ping', '/test'],
        priority: 90,
    });
    MiddlewareFactory_1.middlewareFactory.register('requestTimeout', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./performance.middleware'))).then(m => m.requestTimeout(30000))), {
        enabled: true,
        environments: ['development', 'production'],
        excludeRoutes: ['/health', '/ping', '/test'],
        priority: 100,
    });
    MiddlewareFactory_1.middlewareFactory.register('requestSizeMonitor', createLazyMiddleware(() => Promise.resolve().then(() => __importStar(require('./performance.middleware'))).then(m => m.requestSizeMonitor)), {
        enabled: environment_1.Environment.isProduction() || process.env.ENABLE_REQUEST_MONITORING === 'true',
        environments: ['production'],
        excludeRoutes: ['/health', '/ping', '/test'],
        priority: 110,
    });
    console.log('✅ Middleware registry initialized with conditional loading');
}
/**
 * Create lazy-loaded middleware wrapper
 */
function createLazyMiddleware(importFn) {
    let cachedMiddleware = null;
    let isLoading = false;
    let loadPromise = null;
    return (req, res, next) => {
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
function getMiddlewareStats() {
    return MiddlewareFactory_1.middlewareFactory.getStats();
}
/**
 * Reset middleware registry (for testing)
 */
function resetMiddlewareRegistry() {
    MiddlewareFactory_1.middlewareFactory.reset();
}
