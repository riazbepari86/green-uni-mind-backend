import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/sendResponse';
import { AuthServices } from '../modules/Auth/auth.service';
import config from '../config';
import { jwtService } from '../services/auth/JWTService';
import { redisServiceManager } from '../services/redis/RedisServiceManager';

// Enhanced login with Redis caching
const loginUser = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.loginUser(req.body);
  
  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    secure: config.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User is logged in successfully!',
    data: {
      user: result.user,
      accessToken: result.accessToken,
      tokenFamily: result.tokenFamily,
      expiresIn: result.expiresIn,
    },
  });
});

// Enhanced refresh token with family tracking
const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const tokenFromCookie = req.cookies?.refreshToken;
  const tokenFromBody = req.body?.refreshToken;
  const tokenFromHeader = req.headers['x-refresh-token'];
  
  const authHeader = req.headers?.authorization;
  let tokenFromBearer;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    tokenFromBearer = authHeader.split(' ')[1];
  }

  const refreshToken = tokenFromCookie || tokenFromBody || tokenFromHeader || tokenFromBearer;

  if (!refreshToken) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: 'Refresh token is required!',
      data: null,
    });
  }

  try {
    const cleanToken = refreshToken.trim();

    if (!cleanToken || cleanToken.length < 10) {
      throw new Error('Invalid refresh token format');
    }

    const result = await AuthServices.refreshToken(cleanToken);

    // Set new refresh token in cookie
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        secure: config.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: req.get('origin') ? new URL(req.get('origin') || '').hostname : undefined,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      });
    }

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Access token is retrieved successfully!',
      data: result,
    });
  } catch (error) {
    console.error('Error refreshing token:', error);

    // Clear refresh token cookie on error
    res.clearCookie('refreshToken', {
      secure: config.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: error instanceof Error ? error.message : 'Invalid refresh token',
      data: null,
    });
  }
});

// Enhanced logout with token blacklisting
const logoutUser = catchAsync(async (req: Request, res: Response) => {
  const accessToken = req.headers.authorization?.split(' ')[1];
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  // Logout user and blacklist tokens
  await AuthServices.logoutUser(accessToken, refreshToken);

  // Clear refresh token cookie
  res.clearCookie('refreshToken', {
    secure: config.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User logged out successfully!',
    data: null,
  });
});

// Logout from all devices
const logoutAllDevices = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  
  if (userId) {
    try {
      // Destroy all user sessions
      await redisServiceManager.executeWithCircuitBreaker(
        async () => {
          const authCache = new (await import('../services/redis/AuthCacheService')).AuthCacheService(
            redisServiceManager.authClient,
            redisServiceManager.monitoring
          );
          await authCache.destroyAllUserSessions(userId);
        },
        'auth'
      );
    } catch (error) {
      console.warn('Failed to destroy all sessions:', error);
    }
  }

  // Clear refresh token cookie
  res.clearCookie('refreshToken', {
    secure: config.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Logged out from all devices successfully!',
    data: null,
  });
});

// Get user activity
const getUserActivity = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: 'User not authenticated',
      data: null,
    });
  }

  try {
    const authCache = new (await import('../services/redis/AuthCacheService')).AuthCacheService(
      redisServiceManager.authClient,
      redisServiceManager.monitoring
    );
    
    const activities = await redisServiceManager.executeWithCircuitBreaker(
      () => authCache.getUserActivity(userId, limit),
      'auth',
      () => Promise.resolve([])
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'User activity retrieved successfully!',
      data: activities,
    });
  } catch (error) {
    console.error('Error getting user activity:', error);
    sendResponse(res, {
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Failed to retrieve user activity',
      data: null,
    });
  }
});

// Get security events
const getSecurityEvents = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: 'User not authenticated',
      data: null,
    });
  }

  try {
    const authCache = new (await import('../services/redis/AuthCacheService')).AuthCacheService(
      redisServiceManager.authClient,
      redisServiceManager.monitoring
    );
    
    const events = await redisServiceManager.executeWithCircuitBreaker(
      () => authCache.getSecurityEvents(userId, limit),
      'auth',
      () => Promise.resolve([])
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Security events retrieved successfully!',
      data: events,
    });
  } catch (error) {
    console.error('Error getting security events:', error);
    sendResponse(res, {
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Failed to retrieve security events',
      data: null,
    });
  }
});

// Check token status
const checkTokenStatus = catchAsync(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Token is required',
      data: null,
    });
  }

  try {
    const [isBlacklisted, tokenInfo] = await Promise.all([
      jwtService.isTokenBlacklisted(token),
      jwtService.getTokenInfo(token)
    ]);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Token status retrieved successfully!',
      data: {
        isValid: !isBlacklisted && tokenInfo !== null,
        isBlacklisted,
        tokenInfo: isBlacklisted ? null : tokenInfo,
      },
    });
  } catch (error) {
    console.error('Error checking token status:', error);
    sendResponse(res, {
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Failed to check token status',
      data: null,
    });
  }
});

// Get authentication statistics (admin only)
const getAuthStats = catchAsync(async (_req: Request, res: Response) => {
  try {
    const [healthCheck, performanceMetrics] = await Promise.all([
      redisServiceManager.healthCheck(),
      redisServiceManager.getPerformanceMetrics()
    ]);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Authentication statistics retrieved successfully!',
      data: {
        redis: {
          health: healthCheck,
          performance: performanceMetrics
        }
      },
    });
  } catch (error) {
    console.error('Error getting auth stats:', error);
    sendResponse(res, {
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Failed to retrieve authentication statistics',
      data: null,
    });
  }
});

export const AuthWithCacheControllers = {
  loginUser,
  refreshToken,
  logoutUser,
  logoutAllDevices,
  getUserActivity,
  getSecurityEvents,
  checkTokenStatus,
  getAuthStats,
};
