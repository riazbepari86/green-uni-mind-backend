import { NextFunction, Request, RequestHandler, Response } from 'express';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import config from '../config';
import AppError from '../errors/AppError';
import catchAsync from '../utils/catchAsync';
import { IUser, IUserRole } from '../modules/User/user.interface';
import { User } from '../modules/User/user.model';
import { JwtUserPayload } from '../interface/auth';
import { AuthCacheService } from '../services/redis/AuthCacheService';
import { redisServiceManager } from '../services/redis/RedisServiceManager';
import crypto from 'crypto';
import { Logger } from '../config/logger';
import { conditionalLog, specializedLog } from '../utils/console-replacement';

// Extend Express Request type to include user property
declare module 'express-serve-static-core' {
  interface Request {
    user: JwtUserPayload;
    sessionId?: string;
    tokenId?: string;
  }
}

// Initialize auth cache service
const authCache = new AuthCacheService(
  redisServiceManager.authClient,
  redisServiceManager.monitoring
);

// Helper function to generate token ID from JWT
function generateTokenId(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
}

// Helper function to extract token from request
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Enhanced authentication middleware with Redis caching
const authWithCache = (...requiredRoles: IUserRole[]): RequestHandler => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Extract token from Authorization header
    const token = extractToken(req);
    
    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
    }

    // Generate token ID for caching
    const tokenId = generateTokenId(token);
    req.tokenId = tokenId;

    try {
      // Check if token is blacklisted (fast Redis check)
      const isBlacklisted = await redisServiceManager.executeWithCircuitBreaker(
        () => authCache.isTokenBlacklisted(tokenId),
        'auth',
        () => Promise.resolve(false) // Fallback: assume not blacklisted if Redis fails
      );

      if (isBlacklisted) {
        await authCache.logSecurityEvent('unknown', 'blacklisted_token_used', {
          tokenId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        throw new AppError(httpStatus.UNAUTHORIZED, 'Token has been revoked');
      }

      // Try to get cached token payload first
      let decoded: JwtUserPayload | null = await redisServiceManager.executeWithCircuitBreaker(
        () => authCache.getTokenPayload(tokenId),
        'auth',
        () => Promise.resolve(null) // Fallback: cache miss
      );

      // If not in cache, verify JWT and cache the result
      if (!decoded) {
        if (!config.jwt_access_secret) {
          Logger.error('JWT access secret is not configured');
          throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'JWT configuration error');
        }

        // Verify JWT token
        decoded = jwt.verify(token, config.jwt_access_secret) as JwtUserPayload;
        
        // Cache the verified token payload
        const tokenTTL = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
        if (tokenTTL > 0) {
          await redisServiceManager.executeWithCircuitBreaker(
            () => authCache.cacheToken(tokenId, decoded, tokenTTL),
            'auth'
          ).catch(error => {
            Logger.warn('Failed to cache token', { error });
            // Don't fail the request if caching fails
          });
        }

        conditionalLog.dev('Token verified and cached for user:', decoded.email);
      } else {
        conditionalLog.dev('Token retrieved from cache for user:', decoded.email);
      }

      const { role, email, iat } = decoded;

      // Try to get user from cache first
      let user: IUser | null = await redisServiceManager.executeWithCircuitBreaker(
        () => redisServiceManager.cache.get(`user:${email}`),
        'cache',
        () => Promise.resolve(null)
      );

      // If not in cache, get from database and cache
      if (!user) {
        user = await User.isUserExists(email);

        if (user) {
          // Cache user data for 15 minutes
          await redisServiceManager.executeWithCircuitBreaker(
            () => redisServiceManager.cache.set(`user:${email}`, user, 900),
            'cache'
          ).catch(error => {
            Logger.warn('Failed to cache user data', { error });
          });
        }
      }

      if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'This user is not found!');
      }

      // Check if user is deleted or blocked
      if (user.isDeleted) {
        throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted!');
      }

      if (user.status === 'blocked') {
        throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked!');
      }

      // Check if JWT was issued before password change
      if (
        user.passwordChangedAt &&
        User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat as number)
      ) {
        // Blacklist the token since password was changed
        const tokenTTL = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
        await redisServiceManager.executeWithCircuitBreaker(
          () => authCache.blacklistToken(tokenId, tokenTTL),
          'auth'
        ).catch(error => {
          Logger.warn('Failed to blacklist token', { error });
        });

        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
      }

      // Check role permissions
      if (requiredRoles && requiredRoles.length > 0) {
        conditionalLog.dev(`Required roles: ${requiredRoles.join(', ')}, User role: ${role}`);

        if (!requiredRoles.includes(role)) {
          await authCache.logSecurityEvent(user._id?.toString() || 'unknown', 'unauthorized_access_attempt', {
            requiredRoles,
            userRole: role,
            endpoint: req.path,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });

          specializedLog.auth.security('role_mismatch', {
            userRole: role,
            requiredRoles,
            endpoint: req.path,
            userId: user._id?.toString()
          });
          throw new AppError(httpStatus.FORBIDDEN, `Access denied. Required role: ${requiredRoles.join(' or ')}`);
        }
      }

      // Track user activity
      await redisServiceManager.executeWithCircuitBreaker(
        () => authCache.trackUserActivity(user._id?.toString() || 'unknown', 'api_access', {
          endpoint: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }),
        'auth'
      ).catch(error => {
        Logger.warn('Failed to track user activity', { error });
      });

      // Add user info to request
      req.user = {
        ...decoded,
        _id: user._id?.toString() || '',
      };

      // Log performance metrics
      const duration = Date.now() - startTime;
      conditionalLog.perf('auth_middleware', startTime, { email, duration });

      next();
    } catch (err) {
      Logger.error('JWT verification error', { error: err });

      // Log security event for failed authentication
      await authCache.logSecurityEvent('unknown', 'authentication_failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
        tokenId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }).catch(logError => {
        Logger.warn('Failed to log security event', { error: logError });
      });

      // Handle specific JWT errors
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        conditionalLog.dev('Token expired at:', (err as any).expiredAt);

        // Blacklist expired token to prevent reuse
        await redisServiceManager.executeWithCircuitBreaker(
          () => authCache.blacklistToken(tokenId, 3600),
          'auth'
        ).catch(error => {
          Logger.warn('Failed to blacklist expired token', { error });
        });

        throw new AppError(
          httpStatus.UNAUTHORIZED,
          'Token expired: Please refresh your authentication'
        );
      }

      if (err instanceof Error) {
        throw new AppError(httpStatus.UNAUTHORIZED, `Unauthorized: ${err.message}`);
      }

      throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }
  });
};

// Logout middleware that blacklists the current token
export const logout = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  
  if (token) {
    const tokenId = generateTokenId(token);
    
    try {
      // Decode token to get expiration
      const decoded = jwt.decode(token) as any;
      const tokenTTL = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
      
      // Blacklist the token
      await redisServiceManager.executeWithCircuitBreaker(
        () => authCache.blacklistToken(tokenId, Math.max(tokenTTL, 0)),
        'auth'
      );

      // Log security event
      await authCache.logSecurityEvent(req.user?._id || 'unknown', 'user_logout', {
        tokenId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      specializedLog.auth.success(req.user?._id || 'unknown', 'user_logout_token_blacklisted');
    } catch (error) {
      Logger.warn('Failed to blacklist token during logout', { error });
      // Don't fail the logout process if blacklisting fails
    }
  }
  
  next();
});

// Middleware to destroy all user sessions (useful for "logout from all devices")
export const logoutAllDevices = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (req.user?._id) {
    try {
      await redisServiceManager.executeWithCircuitBreaker(
        () => authCache.destroyAllUserSessions(req.user._id),
        'auth'
      );

      // Log security event
      await authCache.logSecurityEvent(req.user._id, 'logout_all_devices', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      specializedLog.auth.success(req.user._id, 'all_sessions_destroyed');
    } catch (error) {
      Logger.warn('Failed to destroy all sessions', { error, userId: req.user._id });
    }
  }
  
  next();
});

// Middleware to check if user has specific permissions (cached)
export const requirePermissions = (...permissions: string[]): RequestHandler => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?._id) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    try {
      // Try to get permissions from cache
      let userPermissions = await redisServiceManager.executeWithCircuitBreaker(
        () => authCache.getUserPermissions(req.user._id),
        'auth',
        () => Promise.resolve(null)
      );

      // If not cached, you would typically fetch from database and cache
      // For now, we'll use a simple role-based permission mapping
      if (!userPermissions) {
        // This is a simplified example - in practice, you'd fetch from your permission system
        const rolePermissions: Record<string, string[]> = {
          admin: ['read', 'write', 'delete', 'manage_users', 'manage_system'],
          teacher: ['read', 'write', 'manage_courses', 'grade_students'],
          student: ['read', 'submit_assignments', 'view_grades']
        };

        userPermissions = rolePermissions[req.user.role] || [];
        
        // Cache permissions for 1 hour
        await redisServiceManager.executeWithCircuitBreaker(
          () => authCache.cacheUserPermissions(req.user._id, userPermissions!, 3600),
          'auth'
        ).catch(error => {
          Logger.warn('Failed to cache user permissions', { error, userId: req.user._id });
        });
      }

      // Check if user has all required permissions
      const hasAllPermissions = permissions.every(permission => 
        userPermissions!.includes(permission)
      );

      if (!hasAllPermissions) {
        await authCache.logSecurityEvent(req.user._id, 'insufficient_permissions', {
          requiredPermissions: permissions,
          userPermissions,
          endpoint: req.path,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        throw new AppError(
          httpStatus.FORBIDDEN, 
          `Insufficient permissions. Required: ${permissions.join(', ')}`
        );
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Permission check error', { error, userId: req.user?._id });
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Permission check failed');
    }
  });
};

export default authWithCache;
