import { NextFunction, Request, RequestHandler, Response } from 'express';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import config from '../config';
import AppError from '../errors/AppError';
import catchAsync from '../utils/catchAsync';
import { IUser, IUserRole } from '../modules/User/user.interface';
import { User } from '../modules/User/user.model';
import { JwtUserPayload } from '../interface/auth';
import { jwtService } from '../services/auth/JWTService';
import { redisOperations } from '../config/redis';
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
      // Check if token is blacklisted using JWT service
      const isBlacklisted = await jwtService.isTokenBlacklisted(token);

      if (isBlacklisted) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Token has been revoked');
      }

      // Verify JWT token using JWT service
      if (!config.jwt_access_secret) {
        Logger.error('JWT access secret is not configured');
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'JWT configuration error');
      }

      const decoded = await jwtService.verifyToken(token, config.jwt_access_secret) as JwtUserPayload;
      
      const { role, email, iat } = decoded;

      // Try to get user from Redis cache first
      let user: IUser | null = null;
      const cachedUser = await redisOperations.get(`user:${email}`);
      if (cachedUser) {
        try {
          user = JSON.parse(cachedUser);
        } catch (parseError) {
          console.warn('Failed to parse cached user data:', parseError);
        }
      }

      // If not in cache, get from database and cache
      if (!user) {
        user = await User.isUserExists(email);

        if (user) {
          // Cache user data for 15 minutes
          await redisOperations.setex(`user:${email}`, 900, JSON.stringify(user));
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
        await jwtService.blacklistToken(token);
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
      }

      // Check role permissions
      if (requiredRoles && requiredRoles.length > 0) {
        conditionalLog.dev(`Required roles: ${requiredRoles.join(', ')}, User role: ${role}`);

        if (!requiredRoles.includes(role)) {
          specializedLog.auth.security('role_mismatch', {
            userRole: role,
            requiredRoles,
            endpoint: req.path,
            userId: user._id?.toString()
          });
          throw new AppError(httpStatus.FORBIDDEN, `Access denied. Required role: ${requiredRoles.join(' or ')}`);
        }
      }

      // Track user activity in Redis
      const activityKey = `activity:${user._id}`;
      const activity = {
        endpoint: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      };
      
      // Use pipeline for atomic operations
      const pipeline = redisOperations.pipeline();
      pipeline.lpush(activityKey, JSON.stringify(activity));
      pipeline.ltrim(activityKey, 0, 99); // Keep last 100 activities
      pipeline.expire(activityKey, 86400); // Expire after 24 hours
      await pipeline.exec();

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

      // Handle specific JWT errors
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        conditionalLog.dev('Token expired at:', (err as any).expiredAt);

        // Blacklist expired token to prevent reuse
        await jwtService.blacklistToken(token);

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
    try {
      // Blacklist the token
      await jwtService.blacklistToken(token);
      specializedLog.auth.success(req.user?._id || 'unknown', 'user_logout_token_blacklisted');
    } catch (error) {
      Logger.warn('Failed to blacklist token during logout', { error });
      // Don't fail the logout process if blacklisting fails
    }
  }
  
  next();
});

// Middleware to destroy all user sessions
export const logoutAllDevices = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (req.user?._id) {
    try {
      // Clear user cache
      await redisOperations.del(`user:${req.user.email}`);
      // Clear user activity
      await redisOperations.del(`activity:${req.user._id}`);
      
      specializedLog.auth.success(req.user._id, 'logout_all_devices_completed');
    } catch (error) {
      Logger.warn('Failed to destroy all sessions', { error, userId: req.user._id });
    }
  }
  
  next();
});

// Middleware to check if user has specific permissions
export const requirePermissions = (...permissions: string[]): RequestHandler => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?._id) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    try {
      // Try to get permissions from Redis cache
      let userPermissions: string[] | null = null;
      const cachedPermissions = await redisOperations.get(`permissions:${req.user._id}`);
      if (cachedPermissions) {
        try {
          userPermissions = JSON.parse(cachedPermissions);
        } catch (parseError) {
          console.warn('Failed to parse cached permissions:', parseError);
        }
      }

      // If not cached, use role-based permission mapping
      if (!userPermissions) {
        const rolePermissions: Record<string, string[]> = {
          admin: ['read', 'write', 'delete', 'manage_users', 'manage_system'],
          teacher: ['read', 'write', 'manage_courses', 'grade_students'],
          student: ['read', 'submit_assignments', 'view_grades']
        };

        userPermissions = rolePermissions[req.user.role] || [];
        
        // Cache permissions for 1 hour
        await redisOperations.setex(`permissions:${req.user._id}`, 3600, JSON.stringify(userPermissions));
      }

      // Check if user has all required permissions
      const hasAllPermissions = permissions.every(permission => 
        userPermissions!.includes(permission)
      );

      if (!hasAllPermissions) {
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