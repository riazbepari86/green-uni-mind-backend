/**
 * Environment detection and configuration utilities
 * Provides consistent environment handling across the backend application
 */

import config from '../config';

// Environment types
export type Environment = 'development' | 'production' | 'test' | 'staging';

/**
 * Get the current environment
 */
export const getEnvironment = (): Environment => {
  const env = (config.NODE_ENV || 'development').toLowerCase();
  
  switch (env) {
    case 'production':
    case 'prod':
      return 'production';
    case 'test':
    case 'testing':
      return 'test';
    case 'staging':
    case 'stage':
      return 'staging';
    case 'development':
    case 'dev':
    default:
      return 'development';
  }
};

/**
 * Environment detection utilities
 */
export const Environment = {
  /**
   * Check if running in development environment
   */
  isDevelopment: (): boolean => getEnvironment() === 'development',

  /**
   * Check if running in production environment
   */
  isProduction: (): boolean => getEnvironment() === 'production',

  /**
   * Check if running in test environment
   */
  isTest: (): boolean => getEnvironment() === 'test',

  /**
   * Check if running in staging environment
   */
  isStaging: (): boolean => getEnvironment() === 'staging',

  /**
   * Check if running in any non-production environment
   */
  isNonProduction: (): boolean => getEnvironment() !== 'production',

  /**
   * Get current environment string
   */
  current: (): Environment => getEnvironment(),

  /**
   * Check if debugging should be enabled
   */
  isDebuggingEnabled: (): boolean => {
    const env = getEnvironment();
    return env === 'development' || env === 'test' || process.env.ENABLE_DEBUG === 'true';
  },

  /**
   * Check if verbose logging should be enabled
   */
  isVerboseLoggingEnabled: (): boolean => {
    return Environment.isDevelopment() || process.env.ENABLE_VERBOSE_LOGGING === 'true';
  },

  /**
   * Check if performance monitoring should be enabled
   */
  isPerformanceMonitoringEnabled: (): boolean => {
    return Environment.isProduction() || process.env.ENABLE_PERFORMANCE_MONITORING === 'true';
  },

  /**
   * Check if error tracking should be enabled
   */
  isErrorTrackingEnabled: (): boolean => {
    return Environment.isProduction() || process.env.ENABLE_ERROR_TRACKING === 'true';
  },

  /**
   * Check if Redis caching should be enabled
   */
  isRedisCachingEnabled: (): boolean => {
    // Enable Redis caching in production by default, or when explicitly enabled
    return Environment.isProduction() || process.env.ENABLE_REDIS_CACHING === 'true';
  },

  /**
   * Check if file logging should be enabled
   */
  isFileLoggingEnabled: (): boolean => {
    return Environment.isProduction() || process.env.ENABLE_FILE_LOGGING === 'true';
  },

  /**
   * Check if security features should be strict
   */
  isStrictSecurityEnabled: (): boolean => {
    return Environment.isProduction() || process.env.ENABLE_STRICT_SECURITY === 'true';
  },
};

/**
 * Configuration values based on environment
 */
export const EnvironmentConfig = {
  /**
   * Get log level based on environment
   */
  getLogLevel: (): string => {
    switch (getEnvironment()) {
      case 'production':
        return 'warn';
      case 'test':
        return 'error';
      case 'staging':
        return 'info';
      case 'development':
      default:
        return 'debug';
    }
  },

  /**
   * Get database connection pool size based on environment
   */
  getDatabasePoolSize: (): number => {
    switch (getEnvironment()) {
      case 'production':
        return 20;
      case 'staging':
        return 10;
      case 'test':
        return 5;
      case 'development':
      default:
        return 5;
    }
  },

  /**
   * Get Redis connection timeout based on environment
   */
  getRedisTimeout: (): number => {
    switch (getEnvironment()) {
      case 'production':
        return 5000; // 5 seconds
      case 'staging':
        return 3000; // 3 seconds
      case 'test':
        return 1000; // 1 second
      case 'development':
      default:
        return 2000; // 2 seconds
    }
  },

  /**
   * Get rate limiting configuration based on environment
   */
  getRateLimitConfig: () => {
    switch (getEnvironment()) {
      case 'production':
        return {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100, // limit each IP to 100 requests per windowMs
          message: 'Too many requests from this IP, please try again later.',
        };
      case 'staging':
        return {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 200, // more lenient for staging
          message: 'Too many requests from this IP, please try again later.',
        };
      case 'test':
        return {
          windowMs: 1 * 60 * 1000, // 1 minute
          max: 1000, // very lenient for testing
          message: 'Rate limit exceeded in test environment.',
        };
      case 'development':
      default:
        return {
          windowMs: 1 * 60 * 1000, // 1 minute
          max: 1000, // very lenient for development
          message: 'Rate limit exceeded in development environment.',
        };
    }
  },

  /**
   * Get CORS configuration based on environment
   */
  getCorsConfig: () => {
    switch (getEnvironment()) {
      case 'production':
        return {
          origin: [
            config.frontend_url,
            'https://green-uni-mind.pages.dev',
            'https://green-uni-mind-frontend.vercel.app',
          ],
          credentials: true,
          optionsSuccessStatus: 200,
        };
      case 'staging':
        return {
          origin: [
            config.frontend_url,
            'https://staging-green-uni-mind.pages.dev',
            /localhost:\d+$/,
          ],
          credentials: true,
          optionsSuccessStatus: 200,
        };
      case 'test':
        return {
          origin: true, // Allow all origins in test
          credentials: true,
          optionsSuccessStatus: 200,
        };
      case 'development':
      default:
        return {
          origin: [
            'http://localhost:8080',
            'http://localhost:8081',
            'http://localhost:8082',
            'http://localhost:8083', // Added for current frontend port
            'http://localhost:3000',
            'http://localhost:5173',
            /localhost:\d+$/,
          ],
          credentials: true,
          optionsSuccessStatus: 200,
        };
    }
  },

  /**
   * Get session configuration based on environment
   */
  getSessionConfig: () => {
    const isProduction = Environment.isProduction();
    
    return {
      secret: config.jwt_access_secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction, // Only use secure cookies in production
        httpOnly: true,
        maxAge: isProduction ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 1 day in prod, 7 days in dev
        sameSite: isProduction ? 'strict' : 'lax',
      },
    };
  },
};

/**
 * Validation utilities for environment configuration
 */
export const EnvironmentValidation = {
  /**
   * Validate that all required environment variables are set
   */
  validateRequiredEnvVars: (): { isValid: boolean; missing: string[] } => {
    const required = [
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
    ];

    const productionRequired = [
      'STRIPE_SECRET_KEY',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'EMAIL_USER',
      'EMAIL_PASS',
    ];

    const allRequired = Environment.isProduction() 
      ? [...required, ...productionRequired]
      : required;

    const missing = allRequired.filter(envVar => !process.env[envVar]);

    return {
      isValid: missing.length === 0,
      missing,
    };
  },

  /**
   * Validate environment configuration and log warnings
   */
  validateAndWarn: (): void => {
    const { isValid, missing } = EnvironmentValidation.validateRequiredEnvVars();

    if (!isValid) {
      console.warn('⚠️ Missing required environment variables:', missing.join(', '));
      
      if (Environment.isProduction()) {
        console.error('❌ Production environment is missing critical environment variables!');
        process.exit(1);
      }
    }

    // Additional warnings
    if (Environment.isProduction() && !config.redis.url && !config.redis.host) {
      console.warn('⚠️ Redis configuration is missing in production environment');
    }

    if (Environment.isProduction() && config.frontend_url.includes('localhost')) {
      console.warn('⚠️ Frontend URL appears to be localhost in production environment');
    }
  },
};

// Export default environment utilities
export default Environment;
