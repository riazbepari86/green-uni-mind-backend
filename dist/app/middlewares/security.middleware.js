"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestSizeLimit = exports.validateContentType = exports.ipWhitelist = exports.securityLogging = exports.hideInternalEndpoints = exports.productionRouteProtection = exports.securityHeaders = exports.sensitiveOperationRateLimit = exports.authRateLimit = exports.generalRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const environment_1 = require("../utils/environment");
const logger_1 = require("../config/logger");
const AppError_1 = __importDefault(require("../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
/**
 * Production Security Middleware
 * Implements comprehensive security measures for production deployment
 */
// Rate limiting configurations based on environment
const createRateLimiter = (windowMs, max, message) => {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        message: {
            error: 'Too Many Requests',
            message,
            retryAfter: Math.ceil(windowMs / 1000),
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger_1.Logger.warn('Rate limit exceeded', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path,
                method: req.method,
            });
            res.status(429).json({
                error: 'Too Many Requests',
                message,
                retryAfter: Math.ceil(windowMs / 1000),
            });
        },
    });
};
// General API rate limiting
exports.generalRateLimit = createRateLimiter(15 * 60 * 1000, // 15 minutes
environment_1.Environment.isProduction() ? 100 : 1000, // 100 requests per 15 min in prod, 1000 in dev
'Too many requests from this IP, please try again later.');
// Strict rate limiting for authentication endpoints
exports.authRateLimit = createRateLimiter(15 * 60 * 1000, // 15 minutes
environment_1.Environment.isProduction() ? 5 : 50, // 5 attempts per 15 min in prod, 50 in dev
'Too many authentication attempts, please try again later.');
// Rate limiting for sensitive operations
exports.sensitiveOperationRateLimit = createRateLimiter(60 * 60 * 1000, // 1 hour
environment_1.Environment.isProduction() ? 10 : 100, // 10 operations per hour in prod, 100 in dev
'Too many sensitive operations, please try again later.');
/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
    // Remove server information
    res.removeHeader('X-Powered-By');
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (environment_1.Environment.isProduction()) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
};
exports.securityHeaders = securityHeaders;
/**
 * Production-only route protection
 * Blocks access to sensitive routes in production unless explicitly allowed
 */
const productionRouteProtection = (allowedRoutes = []) => {
    return (req, res, next) => {
        if (!environment_1.Environment.isProduction()) {
            return next(); // Allow all routes in non-production environments
        }
        const path = req.path.toLowerCase();
        const isAllowed = allowedRoutes.some(route => path.startsWith(route.toLowerCase()) || path === route.toLowerCase());
        if (!isAllowed) {
            logger_1.Logger.warn('Blocked access to protected route in production', {
                path: req.path,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
            });
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'This endpoint is not available in production');
        }
        next();
    };
};
exports.productionRouteProtection = productionRouteProtection;
/**
 * API endpoint visibility control
 * Prevents exposure of internal/debug endpoints in production
 */
const hideInternalEndpoints = (req, res, next) => {
    if (!environment_1.Environment.isProduction()) {
        return next();
    }
    const internalPaths = [
        '/api/v1/monitoring',
        '/api/v1/debug',
        '/api/v1/admin/system',
        '/api/v1/redis',
        '/api/v1/cache',
        '/health/detailed',
        '/metrics',
        '/status',
    ];
    const path = req.path.toLowerCase();
    const isInternal = internalPaths.some(internalPath => path.startsWith(internalPath.toLowerCase()));
    if (isInternal) {
        logger_1.Logger.warn('Blocked access to internal endpoint in production', {
            path: req.path,
            method: req.method,
            ip: req.ip,
        });
        res.status(404).json({
            error: 'Not Found',
            message: 'The requested resource was not found',
        });
        return;
    }
    next();
};
exports.hideInternalEndpoints = hideInternalEndpoints;
/**
 * Request logging for security monitoring
 */
const securityLogging = (req, _res, next) => {
    // Log suspicious patterns
    const suspiciousPatterns = [
        /\.\./, // Path traversal
        /script/i, // XSS attempts
        /union.*select/i, // SQL injection
        /exec\(/i, // Code injection
        /<script/i, // XSS
    ];
    const url = req.url.toLowerCase();
    const body = JSON.stringify(req.body).toLowerCase();
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url) || pattern.test(body));
    if (isSuspicious) {
        logger_1.Logger.warn('Suspicious request detected', {
            ip: req.ip,
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            body: req.body,
        });
    }
    next();
};
exports.securityLogging = securityLogging;
/**
 * IP-based access control (if needed)
 */
const ipWhitelist = (allowedIPs = []) => {
    return (req, res, next) => {
        if (!environment_1.Environment.isProduction() || allowedIPs.length === 0) {
            return next();
        }
        const clientIP = req.ip || req.socket.remoteAddress;
        if (!clientIP || !allowedIPs.includes(clientIP)) {
            logger_1.Logger.warn('Blocked request from non-whitelisted IP', {
                ip: clientIP,
                path: req.path,
                method: req.method,
            });
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied from this IP address',
            });
        }
        next();
    };
};
exports.ipWhitelist = ipWhitelist;
/**
 * Content-Type validation for API endpoints
 */
const validateContentType = (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type');
        if (!contentType || (!contentType.includes('application/json') && !contentType.includes('multipart/form-data'))) {
            return res.status(400).json({
                error: 'Invalid Content-Type',
                message: 'Content-Type must be application/json or multipart/form-data',
            });
        }
    }
    next();
};
exports.validateContentType = validateContentType;
/**
 * Request size limiting
 */
const requestSizeLimit = (maxSize = '10mb') => {
    return (req, res, next) => {
        const contentLength = req.get('Content-Length');
        if (contentLength) {
            const sizeInMB = parseInt(contentLength) / (1024 * 1024);
            const maxSizeInMB = parseInt(maxSize.replace('mb', ''));
            if (sizeInMB > maxSizeInMB) {
                return res.status(413).json({
                    error: 'Payload Too Large',
                    message: `Request size exceeds ${maxSize} limit`,
                });
            }
        }
        next();
    };
};
exports.requestSizeLimit = requestSizeLimit;
