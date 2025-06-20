import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { Environment } from '../utils/environment';
import { Logger } from '../config/logger';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import crypto from 'crypto';
import config from '../config';

/**
 * Production Security Middleware
 * Implements comprehensive security measures for production deployment
 */

// Security configuration interfaces
interface EncryptedPayload {
  data: string;
  iv: string;
  tag: string;
  timestamp: number;
}

interface SecurityHeaders {
  'x-request-signature'?: string;
  'x-timestamp'?: string;
  'x-nonce'?: string;
}

// Security configuration
const SECURITY_CONFIG = {
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  SIGNATURE_ALGORITHM: 'sha256',
  REQUEST_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  NONCE_LENGTH: 32,
};

// Rate limiting configurations based on environment
const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
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
    skip: (req: Request) => {
      const healthCheckPaths = ['/health', '/ping', '/test'];
      return healthCheckPaths.includes(req.path);
    },
    handler: (req: Request, res: Response) => {
      Logger.warn('Rate limit exceeded', {
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
export const generalRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  Environment.isProduction() ? 100 : 1000, // 100 requests per 15 min in prod, 1000 in dev
  'Too many requests from this IP, please try again later.'
);

// Strict rate limiting for authentication endpoints
export const authRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  Environment.isProduction() ? 5 : 50, // 5 attempts per 15 min in prod, 50 in dev
  'Too many authentication attempts, please try again later.'
);

// Rate limiting for sensitive operations
export const sensitiveOperationRateLimit = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  Environment.isProduction() ? 10 : 100, // 10 operations per hour in prod, 100 in dev
  'Too many sensitive operations, please try again later.'
);

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (Environment.isProduction()) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

/**
 * Production-only route protection
 * Blocks access to sensitive routes in production unless explicitly allowed
 */
export const productionRouteProtection = (allowedRoutes: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!Environment.isProduction()) {
      return next(); // Allow all routes in non-production environments
    }

    const path = req.path?.toLowerCase() || '';
    const isAllowed = allowedRoutes.some(route =>
      path.startsWith(route.toLowerCase()) || path === route.toLowerCase()
    );
    
    if (!isAllowed) {
      Logger.warn('Blocked access to protected route in production', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      throw new AppError(
        httpStatus.FORBIDDEN,
        'This endpoint is not available in production'
      );
    }
    
    next();
  };
};

/**
 * API endpoint visibility control
 * Prevents exposure of internal/debug endpoints in production
 */
export const hideInternalEndpoints = (req: Request, res: Response, next: NextFunction): void => {
  if (!Environment.isProduction()) {
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

  const path = req.path?.toLowerCase() || '';
  const isInternal = internalPaths.some(internalPath =>
    path.startsWith(internalPath.toLowerCase())
  );

  if (isInternal) {
    Logger.warn('Blocked access to internal endpoint in production', {
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

/**
 * Request logging for security monitoring
 */
export const securityLogging = (req: Request, _res: Response, next: NextFunction): void => {
  // Skip security logging for health check endpoints
  const healthCheckPaths = ['/health', '/ping', '/test'];
  if (healthCheckPaths.includes(req.path)) {
    return next();
  }

  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /exec\(/i, // Code injection
    /<script/i, // XSS
  ];

  const url = req.url?.toLowerCase() || '';
  const body = JSON.stringify(req.body || {}).toLowerCase();

  const isSuspicious = suspiciousPatterns.some(pattern =>
    pattern.test(url) || pattern.test(body)
  );

  if (isSuspicious) {
    Logger.warn('Suspicious request detected', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      body: req.body,
    });
  }

  next();
};

/**
 * IP-based access control (if needed)
 */
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!Environment.isProduction() || allowedIPs.length === 0) {
      return next();
    }
    
    const clientIP = req.ip || req.socket.remoteAddress;
    
    if (!clientIP || !allowedIPs.includes(clientIP)) {
      Logger.warn('Blocked request from non-whitelisted IP', {
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

/**
 * Content-Type validation for API endpoints
 */
export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
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

/**
 * Request size limiting
 */
export const requestSizeLimit = (maxSize: string = '10mb'): ((req: Request, res: Response, next: NextFunction) => void) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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

/**
 * Request/Response Encryption Middleware
 * Encrypts sensitive data in production environments
 */
export const encryptionMiddleware = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!Environment.isProduction() || !process.env.ENCRYPTION_KEY) {
      return next();
    }

    try {
      // Decrypt incoming request if encrypted
      if (req.body && req.body.encrypted === true) {
        const decryptedData = await decryptData(req.body);
        req.body = decryptedData;
      }

      // Override res.json to encrypt outgoing responses
      const originalJson = res.json;
      res.json = function(data: any) {
        if (shouldEncryptResponse(req, data)) {
          const encryptedData = encryptData(data);
          return originalJson.call(this, { encrypted: true, data: encryptedData });
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      Logger.error('Encryption middleware error', { error });
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid encrypted data');
    }
  };
};

/**
 * Enhanced security headers with CSP
 */
export const enhancedSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
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

  if (Environment.isProduction()) {
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
    res.setHeader('Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    );
  }

  next();
};

// Helper functions for encryption
function encryptData(data: any): EncryptedPayload {
  const encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

  // Create a 32-byte key from the provided key
  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    data: encrypted,
    iv: iv.toString('hex'),
    tag: '', // For compatibility with interface
    timestamp: Date.now(),
  };
}

async function decryptData(encryptedPayload: EncryptedPayload): Promise<any> {
  const encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

  // Create a 32-byte key from the provided key
  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = Buffer.from(encryptedPayload.iv, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

  let decrypted = decipher.update(encryptedPayload.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

function shouldEncryptResponse(req: Request, data: any): boolean {
  // Encrypt responses for sensitive endpoints
  const sensitiveEndpoints = [
    '/api/v1/auth',
    '/api/v1/users',
    '/api/v1/payments',
  ];

  const isSensitiveEndpoint = sensitiveEndpoints.some(endpoint =>
    req.path.startsWith(endpoint)
  );

  // Also encrypt if response contains sensitive data
  const hasSensitiveData = data && (
    data.token ||
    data.password ||
    data.email ||
    data.phone ||
    data.paymentMethod
  );

  return isSensitiveEndpoint || hasSensitiveData;
}
