import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { OAuthCacheService } from '../services/redis/OAuthCacheService';
import { SessionCacheService } from '../services/redis/SessionCacheService';
import { redisServiceManager } from '../services/redis/RedisServiceManager';
import { jwtService } from '../services/auth/JWTService';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import crypto from 'crypto';

// Initialize services
const oauthCache = new OAuthCacheService(
  redisServiceManager.sessionsClient,
  redisServiceManager.monitoring
);

const sessionCache = new SessionCacheService(
  redisServiceManager.sessionsClient,
  redisServiceManager.monitoring
);

// Enhanced OAuth state generation with Redis caching
export const generateOAuthState = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const state = crypto.randomBytes(32).toString('hex');
    const stateData = {
      provider: req.params.provider,
      returnUrl: req.query.returnUrl as string || '/',
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      createdAt: new Date().toISOString(),
    };

    // Store state in Redis with 10-minute expiration
    await redisServiceManager.executeWithCircuitBreaker(
      () => oauthCache.storeOAuthState(state, stateData, 600),
      'sessions'
    );

    // Store state in session for fallback
    req.session = req.session || {};
    req.session.oauthState = state;

    // Add state to request for use in OAuth URL generation
    req.oauthState = state;

    console.log(`✅ OAuth state generated: ${state} for provider: ${req.params.provider}`);
    next();
  } catch (error) {
    console.error('Error generating OAuth state:', error);
    next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to initialize OAuth flow'));
  }
};

// Enhanced OAuth state validation with Redis lookup
export const validateOAuthState = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const { state } = req.query;
    
    if (!state || typeof state !== 'string') {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid OAuth state parameter');
    }

    // Check rate limiting for OAuth operations
    const rateLimitResult = await redisServiceManager.executeWithCircuitBreaker(
      () => oauthCache.checkOAuthRateLimit(req.ip || 'unknown', 'oauth_callback', 10, 300), // 10 attempts per 5 minutes
      'sessions',
      () => Promise.resolve({ allowed: true, remaining: 10, resetTime: new Date() })
    );

    if (!rateLimitResult.allowed) {
      throw new AppError(
        httpStatus.TOO_MANY_REQUESTS, 
        `OAuth rate limit exceeded. Try again after ${rateLimitResult.resetTime.toISOString()}`
      );
    }

    // Retrieve and validate state from Redis
    const stateData = await redisServiceManager.executeWithCircuitBreaker(
      () => oauthCache.getOAuthState(state),
      'sessions',
      () => Promise.resolve(null)
    );

    if (!stateData) {
      // Fallback to session-based state validation
      if (req.session?.oauthState !== state) {
        await oauthCache.recordOAuthMetric(req.params.provider || 'unknown', 'state_validation', false, {
          reason: 'invalid_state',
          ip: req.ip,
        });
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired OAuth state');
      }
    } else {
      // Validate state data
      if (stateData.ip !== req.ip) {
        await oauthCache.recordOAuthMetric(req.params.provider || 'unknown', 'state_validation', false, {
          reason: 'ip_mismatch',
          originalIp: stateData.ip,
          currentIp: req.ip,
        });
        throw new AppError(httpStatus.BAD_REQUEST, 'OAuth state validation failed: IP mismatch');
      }

      // Clean up used state
      await oauthCache.deleteOAuthState(state);
    }

    // Record successful state validation
    await oauthCache.recordOAuthMetric(req.params.provider || 'unknown', 'state_validation', true);

    console.log(`✅ OAuth state validated: ${state}`);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      console.error('Error validating OAuth state:', error);
      next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'OAuth state validation failed'));
    }
  }
};

// Enhanced OAuth authentication with caching
export const authenticateOAuth = (provider: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if account is locked
      const isLocked = await redisServiceManager.executeWithCircuitBreaker(
        () => oauthCache.isAccountLocked(req.ip || 'unknown'),
        'sessions',
        () => Promise.resolve(false)
      );

      if (isLocked) {
        throw new AppError(httpStatus.TOO_MANY_REQUESTS, 'Account temporarily locked due to suspicious activity');
      }

      // Use Passport for OAuth authentication
      passport.authenticate(provider, {
        scope: getOAuthScope(provider),
        state: req.oauthState,
      })(req, res, next);

    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        console.error(`OAuth authentication error for ${provider}:`, error);
        next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'OAuth authentication failed'));
      }
    }
  };
};

// Enhanced OAuth callback handler with Redis caching
export const handleOAuthCallback = (provider: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Track login attempt
      await oauthCache.trackLoginAttempt(req.ip || 'unknown', false, {
        provider,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });

      passport.authenticate(provider, { session: false }, async (err: any, user: any, info: any) => {
        try {
          if (err) {
            console.error(`OAuth callback error for ${provider}:`, err);
            await oauthCache.recordOAuthMetric(provider, 'callback', false, { error: err.message });
            throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'OAuth authentication failed');
          }

          if (!user) {
            console.log(`OAuth callback failed for ${provider}:`, info);
            await oauthCache.recordOAuthMetric(provider, 'callback', false, { reason: info?.message || 'unknown' });
            throw new AppError(httpStatus.UNAUTHORIZED, info?.message || 'OAuth authentication failed');
          }

          // Cache OAuth tokens if available
          if (user.oauthTokens) {
            await redisServiceManager.executeWithCircuitBreaker(
              () => oauthCache.cacheOAuthTokens(
                user._id.toString(),
                provider,
                user.oauthTokens,
                3600 // 1 hour
              ),
              'sessions'
            ).catch(error => {
              console.warn('Failed to cache OAuth tokens:', error);
            });
          }

          // Cache user profile
          if (user.profile) {
            await redisServiceManager.executeWithCircuitBreaker(
              () => oauthCache.cacheUserProfile(
                user._id.toString(),
                provider,
                user.profile,
                3600 // 1 hour
              ),
              'sessions'
            ).catch(error => {
              console.warn('Failed to cache user profile:', error);
            });
          }

          // Create JWT tokens
          const tokenPair = await jwtService.createTokenPair({
            email: user.email,
            role: user.role,
            _id: user._id.toString(),
          });

          // Create enhanced session
          const sessionId = await sessionCache.createSession({
            userId: user._id.toString(),
            userRole: user.role,
            loginMethod: provider as any,
            deviceInfo: {
              userAgent: req.get('User-Agent') || 'unknown',
              ip: req.ip || 'unknown',
              deviceType: parseDeviceType(req.get('User-Agent') || ''),
            },
            permissions: getUserPermissions(user.role),
            metadata: {
              provider,
              oauthProfile: user.profile,
              loginTimestamp: new Date().toISOString(),
            },
          }, 86400 * 30); // 30 days

          // Track successful login
          await Promise.all([
            oauthCache.trackLoginAttempt(req.ip || 'unknown', true, {
              provider,
              userId: user._id.toString(),
              userAgent: req.get('User-Agent'),
            }),
            oauthCache.recordOAuthMetric(provider, 'callback', true, {
              userId: user._id.toString(),
            }),
            sessionCache.trackUserActivity({
              sessionId,
              userId: user._id.toString(),
              activity: 'oauth_login',
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              metadata: { provider },
            }),
          ]);

          // Set tokens in response
          res.cookie('refreshToken', tokenPair.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          });

          res.cookie('sessionId', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          });

          // Add user and tokens to request
          req.user = {
            _id: user._id.toString(),
            email: user.email,
            role: user.role,
          };
          req.accessToken = tokenPair.accessToken;
          req.sessionId = sessionId;

          console.log(`✅ OAuth authentication successful for ${provider}: ${user.email}`);
          next();

        } catch (error) {
          if (error instanceof AppError) {
            next(error);
          } else {
            console.error('Error in OAuth callback handler:', error);
            next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'OAuth callback processing failed'));
          }
        }
      })(req, res, next);

    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        console.error(`OAuth callback error for ${provider}:`, error);
        next(new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'OAuth callback failed'));
      }
    }
  };
};

// OAuth session validation middleware
export const validateOAuthSession = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies?.sessionId;
    
    if (!sessionId) {
      return next();
    }

    const session = await redisServiceManager.executeWithCircuitBreaker(
      () => sessionCache.getSession(sessionId),
      'sessions',
      () => Promise.resolve(null)
    );

    if (session) {
      // Add session info to request
      req.sessionData = session;
      
      // Track session activity
      await sessionCache.trackUserActivity({
        sessionId: session.sessionId,
        userId: session.userId,
        activity: 'api_access',
        endpoint: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      }).catch(error => {
        console.warn('Failed to track session activity:', error);
      });
    }

    next();
  } catch (error) {
    console.error('Error validating OAuth session:', error);
    next();
  }
};

// Utility functions
function getOAuthScope(provider: string): string[] {
  const scopes: Record<string, string[]> = {
    google: ['profile', 'email'],
    facebook: ['email', 'public_profile'],
    apple: ['name', 'email'],
  };
  
  return scopes[provider] || ['profile', 'email'];
}

function parseDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' | 'unknown' {
  if (/Mobile|Android|iPhone/.test(userAgent)) return 'mobile';
  if (/iPad|Tablet/.test(userAgent)) return 'tablet';
  if (/Windows|Mac|Linux/.test(userAgent)) return 'desktop';
  return 'unknown';
}

function getUserPermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    admin: ['read', 'write', 'delete', 'manage_users', 'manage_system'],
    teacher: ['read', 'write', 'manage_courses', 'grade_students'],
    student: ['read', 'submit_assignments', 'view_grades'],
  };
  
  return permissions[role] || ['read'];
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      oauthState?: string;
      sessionData?: any;
      accessToken?: string;
      sessionId?: string;
      session?: {
        oauthState?: string;
        [key: string]: any;
      };
    }
  }
}
