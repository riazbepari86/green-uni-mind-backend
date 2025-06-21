"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const passport_1 = __importDefault(require("passport"));
const globalErrorhandler_1 = __importDefault(require("./app/middlewares/globalErrorhandler"));
const notFound_1 = __importDefault(require("./app/middlewares/notFound"));
const routes_1 = __importDefault(require("./app/routes"));
const passport_2 = require("./app/config/passport");
// Security middleware imports
const security_middleware_1 = require("./app/middlewares/security.middleware");
// Performance middleware imports
const performance_middleware_1 = require("./app/middlewares/performance.middleware");
// import monitoringRoutes from './app/routes/monitoring.routes'; // Disabled to prevent Redis overload
const RedisConservativeConfig_1 = require("./app/services/redis/RedisConservativeConfig");
const RedisCleanupService_1 = require("./app/services/redis/RedisCleanupService");
const app = (0, express_1.default)();
// CRITICAL: Ultra-lightweight health check BEFORE any middleware
// This endpoint MUST be first to ensure UptimeRobot can always reach it
app.get('/health', (_req, res) => {
    // Set headers immediately for fastest response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    // Send minimal response as fast as possible
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// Ultra-fast ping endpoint for basic connectivity checks
app.get('/ping', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        message: 'pong',
        timestamp: new Date().toISOString()
    });
});
// Test route BEFORE any middleware to check if Express is working
app.get('/test', (_req, res) => {
    console.log('🧪 Test endpoint hit! Express is working!');
    res.json({ message: 'Express is working!', timestamp: new Date().toISOString() });
});
// Apply enhanced security headers first
app.use(security_middleware_1.enhancedSecurityHeaders);
// Apply response compression for better performance
app.use(performance_middleware_1.responseCompression);
// Apply performance tracking
app.use(performance_middleware_1.performanceTracker);
// Apply memory monitoring
app.use(performance_middleware_1.memoryMonitor);
// Apply request timeout (30 seconds)
app.use((0, performance_middleware_1.requestTimeout)(30000));
// Apply cache headers
app.use(performance_middleware_1.cacheHeaders);
// Apply request size monitoring
app.use(performance_middleware_1.requestSizeMonitor);
// Apply general rate limiting (production-ready)
app.use(security_middleware_1.generalRateLimit);
// Apply security logging for suspicious requests
app.use(security_middleware_1.securityLogging);
// Apply request/response encryption in production
app.use((0, security_middleware_1.encryptionMiddleware)());
// Apply request size limiting
app.use((0, security_middleware_1.requestSizeLimit)('10mb'));
// Initialize conservative Redis configuration to minimize usage (non-blocking)
setTimeout(() => {
    try {
        console.log('🔧 Initializing Redis configuration in background...');
        RedisConservativeConfig_1.redisConservativeConfig.initialize();
    }
    catch (error) {
        console.error('❌ Redis configuration initialization failed:', error);
        console.log('⚠️ Server will continue without Redis optimization');
    }
}, 100); // Initialize Redis config after a short delay
// Clean up excessive Redis keys on startup (non-blocking)
setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🧹 Starting Redis cleanup to remove excessive monitoring data...');
        // Run cleanup operations in parallel with timeout
        const cleanupPromises = [
            RedisCleanupService_1.redisCleanupService.cleanupPerformanceMetrics(),
            RedisCleanupService_1.redisCleanupService.getMemoryStats()
        ];
        // Set a timeout for cleanup operations to prevent blocking startup
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                console.warn('⚠️ Redis cleanup timeout - continuing with startup');
                resolve();
            }, 10000); // 10 second timeout
        });
        yield Promise.race([
            Promise.allSettled(cleanupPromises),
            timeoutPromise
        ]);
        console.log('✅ Redis cleanup completed (or timed out)');
    }
    catch (error) {
        console.error('❌ Redis cleanup failed:', error);
        // Don't throw the error - just log it and continue with startup
    }
}), 2000); // Reduced wait time to 2 seconds
// Set up webhook route first (before body parsers)
// This ensures the raw body is preserved for Stripe signature verification
const stripeWebhookPath = '/api/v1/payments/webhook';
app.post(stripeWebhookPath, express_1.default.raw({ type: 'application/json' }));
// Regular parsers for all other routes (except webhook)
app.use((req, _res, next) => {
    if (req.originalUrl === stripeWebhookPath) {
        console.log('Webhook request detected, preserving raw body');
        // Skip JSON parsing for webhook - raw body is already handled above
        next();
    }
    else {
        // Apply JSON parsing for all other routes
        next();
    }
});
// Apply JSON parser for all routes except webhook
app.use(express_1.default.json({
    limit: '10mb',
    strict: false, // Allow any JSON-like content
    verify: (req, _res, buf) => {
        // Store the raw body for debugging (except for webhook)
        if (req.originalUrl !== stripeWebhookPath) {
            req.rawBody = buf.toString();
        }
    }
}));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Enhanced CORS configuration for development and security headers
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://localhost:8081',
        'https://green-uni-mind.pages.dev',
        'https://green-uni-mind.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-refresh-token',
        'x-user-id',
        'x-provider',
        'x-provider-id',
        'x-role',
        // Security headers for request signing and encryption
        'x-nonce',
        'x-timestamp',
        'x-request-signature',
        'x-api-version',
        'x-client-version'
    ],
    // Expose headers that the frontend might need to read
    exposedHeaders: [
        'x-total-count',
        'x-page-count',
        'x-current-page',
        'x-rate-limit-remaining',
        'x-rate-limit-reset'
    ]
}));
// Initialize Passport
app.use(passport_1.default.initialize());
// Configure Passport strategies if OAuth is configured
try {
    (0, passport_2.configurePassport)();
}
catch (error) {
    console.error('Error configuring Passport strategies:', error);
    console.log('OAuth authentication will not be available');
}
// welcome route
app.get('/', (req, res) => {
    console.log('🏠 Root endpoint hit!', req.method, req.url);
    res.send('🚀 Welcome to the Green Uni Mind API!');
});
// Detailed health check route for internal monitoring (with Redis status)
app.get('/health/detailed', (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        // Detailed health check with Redis status
        const healthData = {
            status: 'OK',
            message: 'Green Uni Mind API is healthy',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            responseTime: Date.now() - startTime
        };
        // Optional: Add Redis status if available (but don't fail if Redis is down)
        try {
            const { isRedisHealthy } = yield Promise.resolve().then(() => __importStar(require('./app/config/redis')));
            const redisHealthy = yield Promise.race([
                isRedisHealthy(),
                new Promise((resolve) => setTimeout(() => resolve(false), 1000)) // 1 second timeout
            ]);
            healthData.redis = redisHealthy ? 'connected' : 'disconnected';
        }
        catch (error) {
            // Redis check failed, but don't fail the health check
            healthData.redis = 'unavailable';
        }
        res.status(200).json(healthData);
    }
    catch (error) {
        // Even if something goes wrong, return a basic health response
        console.error('Detailed health check error:', error);
        res.status(200).json({
            status: 'OK',
            message: 'Green Uni Mind API is running',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            responseTime: Date.now() - startTime,
            note: 'Basic health check - some services may be degraded'
        });
    }
}));
// Apply auth rate limiting to authentication routes
app.use('/api/v1/auth', security_middleware_1.authRateLimit);
// application routes
app.use('/api/v1', routes_1.default);
// monitoring routes (admin only) - DISABLED to prevent Redis overload
// app.use('/api/v1/monitoring', monitoringRoutes);
console.log('📵 Monitoring routes disabled to prevent excessive Redis operations');
// global error handler
app.use(globalErrorhandler_1.default);
// Not found
app.use(notFound_1.default);
exports.default = app;
