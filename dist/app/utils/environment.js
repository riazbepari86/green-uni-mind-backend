"use strict";
/**
 * Environment detection and configuration utilities
 * Provides consistent environment handling across the backend application
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentValidation = exports.EnvironmentConfig = exports.Environment = exports.getEnvironment = void 0;
const config_1 = __importDefault(require("../config"));
/**
 * Get the current environment
 */
const getEnvironment = () => {
    const env = (config_1.default.NODE_ENV || 'development').toLowerCase();
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
exports.getEnvironment = getEnvironment;
/**
 * Environment detection utilities
 */
exports.Environment = {
    /**
     * Check if running in development environment
     */
    isDevelopment: () => (0, exports.getEnvironment)() === 'development',
    /**
     * Check if running in production environment
     */
    isProduction: () => (0, exports.getEnvironment)() === 'production',
    /**
     * Check if running in test environment
     */
    isTest: () => (0, exports.getEnvironment)() === 'test',
    /**
     * Check if running in staging environment
     */
    isStaging: () => (0, exports.getEnvironment)() === 'staging',
    /**
     * Check if running in any non-production environment
     */
    isNonProduction: () => (0, exports.getEnvironment)() !== 'production',
    /**
     * Get current environment string
     */
    current: () => (0, exports.getEnvironment)(),
    /**
     * Check if debugging should be enabled
     */
    isDebuggingEnabled: () => {
        const env = (0, exports.getEnvironment)();
        return env === 'development' || env === 'test' || process.env.ENABLE_DEBUG === 'true';
    },
    /**
     * Check if verbose logging should be enabled
     */
    isVerboseLoggingEnabled: () => {
        return exports.Environment.isDevelopment() || process.env.ENABLE_VERBOSE_LOGGING === 'true';
    },
    /**
     * Check if performance monitoring should be enabled
     */
    isPerformanceMonitoringEnabled: () => {
        return exports.Environment.isProduction() || process.env.ENABLE_PERFORMANCE_MONITORING === 'true';
    },
    /**
     * Check if error tracking should be enabled
     */
    isErrorTrackingEnabled: () => {
        return exports.Environment.isProduction() || process.env.ENABLE_ERROR_TRACKING === 'true';
    },
    /**
     * Check if Redis caching should be enabled
     */
    isRedisCachingEnabled: () => {
        // Enable Redis caching in production by default, or when explicitly enabled
        return exports.Environment.isProduction() || process.env.ENABLE_REDIS_CACHING === 'true';
    },
    /**
     * Check if file logging should be enabled
     */
    isFileLoggingEnabled: () => {
        return exports.Environment.isProduction() || process.env.ENABLE_FILE_LOGGING === 'true';
    },
    /**
     * Check if security features should be strict
     */
    isStrictSecurityEnabled: () => {
        return exports.Environment.isProduction() || process.env.ENABLE_STRICT_SECURITY === 'true';
    },
};
/**
 * Configuration values based on environment
 */
exports.EnvironmentConfig = {
    /**
     * Get log level based on environment
     */
    getLogLevel: () => {
        switch ((0, exports.getEnvironment)()) {
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
    getDatabasePoolSize: () => {
        switch ((0, exports.getEnvironment)()) {
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
    getRedisTimeout: () => {
        switch ((0, exports.getEnvironment)()) {
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
        switch ((0, exports.getEnvironment)()) {
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
        switch ((0, exports.getEnvironment)()) {
            case 'production':
                return {
                    origin: [
                        config_1.default.frontend_url,
                        'https://green-uni-mind.pages.dev',
                        'https://green-uni-mind-frontend.vercel.app',
                    ],
                    credentials: true,
                    optionsSuccessStatus: 200,
                };
            case 'staging':
                return {
                    origin: [
                        config_1.default.frontend_url,
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
        const isProduction = exports.Environment.isProduction();
        return {
            secret: config_1.default.jwt_access_secret,
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
exports.EnvironmentValidation = {
    /**
     * Validate that all required environment variables are set
     */
    validateRequiredEnvVars: () => {
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
        const allRequired = exports.Environment.isProduction()
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
    validateAndWarn: () => {
        const { isValid, missing } = exports.EnvironmentValidation.validateRequiredEnvVars();
        if (!isValid) {
            console.warn('⚠️ Missing required environment variables:', missing.join(', '));
            if (exports.Environment.isProduction()) {
                console.error('❌ Production environment is missing critical environment variables!');
                process.exit(1);
            }
        }
        // Additional warnings
        if (exports.Environment.isProduction() && !config_1.default.redis.url && !config_1.default.redis.host) {
            console.warn('⚠️ Redis configuration is missing in production environment');
        }
        if (exports.Environment.isProduction() && config_1.default.frontend_url.includes('localhost')) {
            console.warn('⚠️ Frontend URL appears to be localhost in production environment');
        }
    },
};
// Export default environment utilities
exports.default = exports.Environment;
