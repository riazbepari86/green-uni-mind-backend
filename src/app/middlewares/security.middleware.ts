import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { Environment } from '../utils/environment';
import { Logger } from '../config/logger';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';

/**
 * Production Security Middleware
 * Implements comprehensive security measures for production deployment
 */

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
    
    const path = req.path.toLowerCase();
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

  const path = req.path.toLowerCase();
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
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /exec\(/i, // Code injection
    /<script/i, // XSS
  ];

  const url = req.url.toLowerCase();
  const body = JSON.stringify(req.body).toLowerCase();

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
export const requestSizeLimit = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
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
