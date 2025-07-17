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
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const passport_2 = require("./app/config/passport");
const globalErrorhandler_1 = __importDefault(require("./app/middlewares/globalErrorhandler"));
const notFound_1 = __importDefault(require("./app/middlewares/notFound"));
const payoutManagement_service_1 = require("./app/modules/Payment/payoutManagement.service");
const routes_1 = __importDefault(require("./app/routes"));
const complianceService_1 = require("./app/services/complianceService");
const emailService_1 = require("./app/services/emailService");
const PerformanceMonitoringService_1 = __importDefault(require("./app/services/monitoring/PerformanceMonitoringService"));
const retryService_1 = require("./app/services/retryService");
const environment_1 = require("./app/utils/environment");
const MiddlewareRegistry_1 = require("./app/middlewares/MiddlewareRegistry");
const ServiceRegistry_1 = require("./app/services/ServiceRegistry");
const StartupProfiler_1 = require("./app/utils/StartupProfiler");
(0, StartupProfiler_1.startPhase)('Middleware Registration');
(0, MiddlewareRegistry_1.registerMiddleware)();
(0, StartupProfiler_1.completePhase)('Middleware Registration');
// Initialize Service Registry
(0, StartupProfiler_1.startPhase)('Service Registry Initialization');
ServiceRegistry_1.serviceRegistry.initialize().catch((error) => {
    console.error('Failed to initialize Service Registry:', error);
});
(0, StartupProfiler_1.completePhase)('Service Registry Initialization');
const lazyImports = {
    optimizedRedisConfig: () => Promise.resolve().then(() => __importStar(require('./app/config/OptimizedRedisConfig'))).then((m) => m.optimizedRedisConfig),
};
const app = (0, express_1.default)();
app.get('/health', (req, res) => {
    // Set headers immediately for fastest response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    // Ensure CORS headers are set for health endpoint
    const origin = req.get('Origin');
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Expose-Headers', 'x-total-count,x-page-count,x-current-page,x-rate-limit-remaining,x-rate-limit-reset');
    }
    // Send minimal response as fast as possible
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
app.get('/ping', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        message: 'pong',
        timestamp: new Date().toISOString(),
    });
});
app.get('/test', (_req, res) => {
    console.log('🧪 Test endpoint hit! Express is working!');
    res.json({
        message: 'Express is working!',
        timestamp: new Date().toISOString(),
    });
});
// Middleware loading will be done after basic Express setup to avoid circular dependencies
console.log('⏳ Middleware loading deferred to avoid circular dependencies');
setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
    (0, StartupProfiler_1.startPhase)('Redis Initialization');
    try {
        console.log('🔧 Initializing optimized Redis configuration...');
        // Lazy load optimized Redis configuration
        const optimizedRedisConfig = yield lazyImports.optimizedRedisConfig();
        // Initialize with timeout to prevent blocking
        const initPromise = optimizedRedisConfig.initialize();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Redis initialization timeout')), 8000);
        });
        yield Promise.race([initPromise, timeoutPromise]);
        console.log('✅ Optimized Redis configuration initialized successfully');
        (0, StartupProfiler_1.completePhase)('Redis Initialization');
    }
    catch (error) {
        console.error('❌ Redis initialization failed:', error);
        console.log('⚠️ Server will continue without Redis - some features may be limited');
        (0, StartupProfiler_1.completePhase)('Redis Initialization'); // Mark as complete even if failed to prevent hanging
    }
}), 500);
const stripeWebhookPath = '/api/v1/payments/webhook';
app.post(stripeWebhookPath, express_1.default.raw({ type: 'application/json' }));
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
app.use(express_1.default.json({
    limit: '10mb',
    strict: false, // Allow any JSON-like content
    verify: (req, _res, buf) => {
        // Store the raw body for debugging (except for webhook)
        if (req.originalUrl !== stripeWebhookPath) {
            req.rawBody = buf.toString();
        }
    },
}));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Enhanced CORS configuration with environment-based origins
const corsConfig = Object.assign(Object.assign({}, environment_1.EnvironmentConfig.getCorsConfig()), { methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], allowedHeaders: [
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
        'x-client-version',
        // Cache control headers for preventing browser caching
        'Cache-Control',
        'Pragma',
        'Expires',
        // Additional cache-related headers that might be sent by frontend
        'x-cache-timestamp',
        'x-cache-key',
        'x-cache-control',
        // Common AJAX and browser headers
        'x-requested-with',
        'x-csrf-token',
        'x-xsrf-token',
    ], 
    // Expose headers that the frontend might need to read
    exposedHeaders: [
        'x-total-count',
        'x-page-count',
        'x-current-page',
        'x-rate-limit-remaining',
        'x-rate-limit-reset',
    ], 
    // Enable preflight for all routes
    preflightContinue: false, optionsSuccessStatus: 200 });
console.log('🌐 CORS Configuration:', JSON.stringify(corsConfig, null, 2));
app.use((0, cors_1.default)(corsConfig));
app.use(passport_1.default.initialize());
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
// ========================================
// OPTIMIZED MIDDLEWARE LOADING (Simplified Approach)
// ========================================
(0, StartupProfiler_1.startPhase)('Security Middleware Loading');
// Load essential security middleware conditionally
const currentEnv = process.env.NODE_ENV || 'development';
// Only load necessary middleware based on environment
if (currentEnv === 'production') {
    // Production middleware stack
    const { enhancedSecurityHeaders, generalRateLimit, securityLogging, requestSizeLimit, } = require('./app/middlewares/security.middleware');
    app.use(enhancedSecurityHeaders);
    app.use(generalRateLimit);
    app.use(securityLogging);
    app.use(requestSizeLimit('10mb'));
    console.log('✅ Loaded 4 production security middleware');
}
else {
    // Development middleware stack (minimal)
    const { enhancedSecurityHeaders, generalRateLimit, } = require('./app/middlewares/security.middleware');
    app.use(enhancedSecurityHeaders);
    app.use(generalRateLimit);
    console.log('✅ Loaded 2 development security middleware');
}
(0, StartupProfiler_1.completePhase)('Security Middleware Loading');
(0, StartupProfiler_1.startPhase)('Performance Middleware Loading');
// Load performance middleware conditionally
const { responseCompression, cacheHeaders, } = require('./app/middlewares/performance.middleware');
app.use(responseCompression);
// Only load monitoring in production or when explicitly enabled
if (currentEnv === 'production' ||
    process.env.ENABLE_PERFORMANCE_MONITORING === 'true') {
    const { performanceTracker, memoryMonitor, } = require('./app/middlewares/performance.middleware');
    app.use(performanceTracker);
    app.use(memoryMonitor);
    // Add enhanced performance monitoring
    app.use(PerformanceMonitoringService_1.default.getInstance().trackPerformance());
    console.log('✅ Loaded 4 performance middleware (with enhanced monitoring)');
}
else {
    console.log('✅ Loaded 2 performance middleware (basic)');
}
(0, StartupProfiler_1.completePhase)('Performance Middleware Loading');
// Apply auth rate limiting to authentication routes (conditionally loaded)
const { authRateLimit } = require('./app/middlewares/security.middleware');
app.use('/api/v1/auth', authRateLimit);
// Health routes are now handled by dedicated health router for better organization
const health_routes_1 = __importDefault(require("./app/routes/health.routes"));
app.use('/', health_routes_1.default); // Mount health routes at root level for /health endpoint
// Emergency Redis routes for critical performance issues
const redis_emergency_routes_1 = __importDefault(require("./app/routes/redis-emergency.routes"));
app.use('/api/v1/redis-emergency', redis_emergency_routes_1.default);
// application routes
app.use('/api/v1', routes_1.default);
// Initialize enterprise services
setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🚀 Initializing enterprise services...');
        // Initialize email service
        yield emailService_1.emailService.initialize();
        console.log('✅ Email service initialized');
        // Initialize compliance monitoring
        complianceService_1.complianceService.initializeComplianceMonitoring();
        console.log('✅ Compliance monitoring initialized');
        // Initialize retry services
        retryService_1.RetryService.initializeRetryJobs();
        console.log('✅ Retry services initialized');
        // Initialize payout management
        payoutManagement_service_1.PayoutManagementService.initializePayoutJobs();
        console.log('✅ Payout management initialized');
        console.log('🎉 All enterprise services initialized successfully');
    }
    catch (error) {
        console.error('❌ Error initializing enterprise services:', error);
    }
}), 1000);
console.log('📵 Monitoring routes disabled to prevent excessive Redis operations');
// Debug middleware to log all requests to /users/me or /api/users/me
app.use((req, _res, next) => {
    if (req.path.includes('/users/me') &&
        !req.path.includes('/api/v1/users/me')) {
        console.log('🔍 DEBUG: Incorrect API call detected:');
        console.log('- Path:', req.path);
        console.log('- Method:', req.method);
        console.log('- Headers:', JSON.stringify(req.headers, null, 2));
        console.log('- User-Agent:', req.headers['user-agent']);
        console.log('- Referer:', req.headers['referer']);
        console.log('- Origin:', req.headers['origin']);
        console.log('- Stack trace:', new Error().stack);
    }
    next();
});
app.use(globalErrorhandler_1.default);
// Not found
app.use(notFound_1.default);
exports.default = app;
