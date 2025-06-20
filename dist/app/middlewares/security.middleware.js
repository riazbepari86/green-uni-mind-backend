"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedSecurityHeaders = exports.encryptionMiddleware = exports.requestSizeLimit = exports.validateContentType = exports.ipWhitelist = exports.securityLogging = exports.hideInternalEndpoints = exports.productionRouteProtection = exports.securityHeaders = exports.sensitiveOperationRateLimit = exports.authRateLimit = exports.generalRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const environment_1 = require("../utils/environment");
const logger_1 = require("../config/logger");
const AppError_1 = __importDefault(require("../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const crypto_1 = __importDefault(require("crypto"));
// Security configuration
const SECURITY_CONFIG = {
    ENCRYPTION_ALGORITHM: 'aes-256-gcm',
    SIGNATURE_ALGORITHM: 'sha256',
    REQUEST_TIMEOUT: 5 * 60 * 1000, // 5 minutes
    NONCE_LENGTH: 32,
};
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
        // Skip rate limiting for health check endpoints
        skip: (req) => {
            const healthCheckPaths = ['/health', '/ping', '/test'];
            return healthCheckPaths.includes(req.path);
        },
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
        var _a;
        if (!environment_1.Environment.isProduction()) {
            return next(); // Allow all routes in non-production environments
        }
        const path = ((_a = req.path) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
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
    var _a;
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
    const path = ((_a = req.path) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
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
    var _a;
    // Skip security logging for health check endpoints
    const healthCheckPaths = ['/health', '/ping', '/test'];
    if (healthCheckPaths.includes(req.path)) {
        return next();
    }
    // Log suspicious patterns
    const suspiciousPatterns = [
        /\.\./, // Path traversal
        /script/i, // XSS attempts
        /union.*select/i, // SQL injection
        /exec\(/i, // Code injection
        /<script/i, // XSS
    ];
    const url = ((_a = req.url) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
    const body = JSON.stringify(req.body || {}).toLowerCase();
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
                res.status(413).json({
                    error: 'Payload Too Large',
                    message: `Request size exceeds ${maxSize} limit`,
                });
                return;
            }
        }
        next();
    };
};
exports.requestSizeLimit = requestSizeLimit;
/**
 * Request/Response Encryption Middleware
 * Encrypts sensitive data in production environments
 */
const encryptionMiddleware = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        if (!environment_1.Environment.isProduction() || !process.env.ENCRYPTION_KEY) {
            return next();
        }
        try {
            // Decrypt incoming request if encrypted
            if (req.body && req.body.encrypted === true) {
                const decryptedData = yield decryptData(req.body);
                req.body = decryptedData;
            }
            // Override res.json to encrypt outgoing responses
            const originalJson = res.json;
            res.json = function (data) {
                if (shouldEncryptResponse(req, data)) {
                    const encryptedData = encryptData(data);
                    return originalJson.call(this, { encrypted: true, data: encryptedData });
                }
                return originalJson.call(this, data);
            };
            next();
        }
        catch (error) {
            logger_1.Logger.error('Encryption middleware error', { error });
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid encrypted data');
        }
    });
};
exports.encryptionMiddleware = encryptionMiddleware;
/**
 * Enhanced security headers with CSP
 */
const enhancedSecurityHeaders = (req, res, next) => {
    // Skip enhanced security headers for health check endpoints (for faster response)
    const healthCheckPaths = ['/health', '/ping', '/test'];
    if (healthCheckPaths.includes(req.path)) {
        return next();
    }
    // Remove server information
    res.removeHeader('X-Powered-By');
    // Basic security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    if (environment_1.Environment.isProduction()) {
        // HSTS
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        // Content Security Policy
        const csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https: wss:",
            "media-src 'self' blob: https:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "upgrade-insecure-requests"
        ].join('; ');
        res.setHeader('Content-Security-Policy', csp);
        // Permissions Policy
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');
    }
    next();
};
exports.enhancedSecurityHeaders = enhancedSecurityHeaders;
// Helper functions for encryption
function encryptData(data) {
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    // Create a 32-byte key from the provided key
    const key = crypto_1.default.createHash('sha256').update(encryptionKey).digest();
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
        data: encrypted,
        iv: iv.toString('hex'),
        tag: '', // For compatibility with interface
        timestamp: Date.now(),
    };
}
function decryptData(encryptedPayload) {
    return __awaiter(this, void 0, void 0, function* () {
        const encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
        // Create a 32-byte key from the provided key
        const key = crypto_1.default.createHash('sha256').update(encryptionKey).digest();
        const iv = Buffer.from(encryptedPayload.iv, 'hex');
        const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedPayload.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    });
}
function shouldEncryptResponse(req, data) {
    // Encrypt responses for sensitive endpoints
    const sensitiveEndpoints = [
        '/api/v1/auth',
        '/api/v1/users',
        '/api/v1/payments',
    ];
    const isSensitiveEndpoint = sensitiveEndpoints.some(endpoint => req.path.startsWith(endpoint));
    // Also encrypt if response contains sensitive data
    const hasSensitiveData = data && (data.token ||
        data.password ||
        data.email ||
        data.phone ||
        data.paymentMethod);
    return isSensitiveEndpoint || hasSensitiveData;
}
