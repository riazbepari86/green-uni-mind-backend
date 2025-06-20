"use strict";
/**
 * Performance Monitoring Middleware
 * Tracks request performance and system metrics
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPerformanceMetricsHandler = exports.performanceMetricsHandler = exports.requestSizeMonitor = exports.cacheHeaders = exports.healthCheckPerformance = exports.performanceBasedRateLimit = exports.requestTimeout = exports.memoryMonitor = exports.trackRedisOperation = exports.trackDatabaseQuery = exports.responseCompression = exports.performanceTracker = void 0;
const PerformanceMonitoringService_1 = require("../services/performance/PerformanceMonitoringService");
const logger_1 = require("../config/logger");
const environment_1 = require("../utils/environment");
const compression_1 = __importDefault(require("compression"));
/**
 * Request performance tracking middleware
 */
const performanceTracker = (req, res, next) => {
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
    res.end = function (chunk, encoding, cb) {
        var _a;
        const responseTime = Date.now() - (req.startTime || Date.now());
        // Record metrics
        PerformanceMonitoringService_1.performanceMonitoringService.recordRequest(req.method, ((_a = req.route) === null || _a === void 0 ? void 0 : _a.path) || req.path, responseTime, res.statusCode);
        // Log slow requests
        if (responseTime > 1000) { // > 1 second
            logger_1.Logger.warn('Slow request detected', {
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
exports.performanceTracker = performanceTracker;
/**
 * Response compression middleware
 */
exports.responseCompression = (0, compression_1.default)({
    // Only compress responses larger than 1KB
    threshold: 1024,
    // Compression level (1-9, 6 is default)
    level: environment_1.Environment.isProduction() ? 6 : 1,
    // Filter function to determine what to compress
    filter: (req, res) => {
        // Don't compress if client doesn't support it
        if (req.headers['x-no-compression']) {
            return false;
        }
        // Don't compress images, videos, or already compressed files
        const contentType = res.getHeader('content-type');
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
        return compression_1.default.filter(req, res);
    },
});
/**
 * Database query performance tracking
 */
const trackDatabaseQuery = (query, startTime) => {
    const duration = Date.now() - startTime;
    PerformanceMonitoringService_1.performanceMonitoringService.recordDatabaseQuery(query, duration);
    return duration;
};
exports.trackDatabaseQuery = trackDatabaseQuery;
/**
 * Redis operation performance tracking
 */
const trackRedisOperation = (operation, startTime) => {
    const duration = Date.now() - startTime;
    PerformanceMonitoringService_1.performanceMonitoringService.recordRedisOperation(operation, duration);
    return duration;
};
exports.trackRedisOperation = trackRedisOperation;
/**
 * Memory usage monitoring middleware
 */
const memoryMonitor = (req, res, next) => {
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
        logger_1.Logger.warn('High memory usage detected', {
            heapUsed: `${heapUsedMB.toFixed(2)}MB`,
            heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
            external: `${(memUsage.external / 1024 / 1024).toFixed(2)}MB`,
            requestId: req.requestId,
        });
    }
    // Force garbage collection if memory is very high (production only)
    if (environment_1.Environment.isProduction() && heapUsedMB > 500 && global.gc) {
        logger_1.Logger.info('Forcing garbage collection due to high memory usage');
        global.gc();
    }
    next();
};
exports.memoryMonitor = memoryMonitor;
/**
 * Request timeout middleware
 */
const requestTimeout = (timeoutMs = 30000) => {
    return (req, res, next) => {
        // Skip timeout for health check endpoints
        const healthCheckPaths = ['/health', '/ping', '/test'];
        if (healthCheckPaths.includes(req.path)) {
            return next();
        }
        // Set timeout for the request
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                logger_1.Logger.error('Request timeout', {
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
exports.requestTimeout = requestTimeout;
/**
 * Rate limiting based on performance
 */
const performanceBasedRateLimit = (req, res, next) => {
    const metrics = PerformanceMonitoringService_1.performanceMonitoringService.getMetrics();
    // If system is under high load, apply stricter rate limiting
    if (metrics.averageResponseTime > 2000 || metrics.memoryUsage > 400) {
        const rateLimitHeader = req.get('x-rate-limit-remaining');
        if (rateLimitHeader) {
            const remaining = parseInt(rateLimitHeader);
            // Reduce allowed requests when system is under load
            if (remaining > 10) {
                res.setHeader('x-rate-limit-remaining', Math.floor(remaining / 2));
                logger_1.Logger.info('Applied performance-based rate limiting', {
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
exports.performanceBasedRateLimit = performanceBasedRateLimit;
/**
 * Health check endpoint performance
 */
const healthCheckPerformance = (req, res, next) => {
    if (req.path === '/health' || req.path === '/ping') {
        // Skip detailed performance tracking for health checks
        return next();
    }
    // Apply performance tracking for all other endpoints
    (0, exports.performanceTracker)(req, res, next);
};
exports.healthCheckPerformance = healthCheckPerformance;
/**
 * API response caching headers
 */
const cacheHeaders = (req, res, next) => {
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
    }
    else {
        // Don't cache non-GET requests
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
};
exports.cacheHeaders = cacheHeaders;
/**
 * Request size monitoring
 */
const requestSizeMonitor = (req, res, next) => {
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
            logger_1.Logger.warn('Large request detected', {
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
exports.requestSizeMonitor = requestSizeMonitor;
/**
 * Generate unique request ID
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Performance metrics endpoint (admin only)
 */
const performanceMetricsHandler = (req, res) => {
    try {
        const summary = PerformanceMonitoringService_1.performanceMonitoringService.getPerformanceSummary();
        res.json({
            success: true,
            data: summary,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.Logger.error('Failed to get performance metrics', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve performance metrics',
        });
    }
};
exports.performanceMetricsHandler = performanceMetricsHandler;
/**
 * Reset performance metrics endpoint (admin only)
 */
const resetPerformanceMetricsHandler = (req, res) => {
    try {
        PerformanceMonitoringService_1.performanceMonitoringService.resetMetrics();
        res.json({
            success: true,
            message: 'Performance metrics reset successfully',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.Logger.error('Failed to reset performance metrics', { error });
        res.status(500).json({
            success: false,
            error: 'Failed to reset performance metrics',
        });
    }
};
exports.resetPerformanceMetricsHandler = resetPerformanceMetricsHandler;
