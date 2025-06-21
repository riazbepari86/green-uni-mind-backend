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
const MiddlewareRegistry_1 = require("./app/middlewares/MiddlewareRegistry");
const StartupProfiler_1 = require("./app/utils/StartupProfiler");
(0, StartupProfiler_1.startPhase)('Middleware Registration');
(0, MiddlewareRegistry_1.registerMiddleware)();
(0, StartupProfiler_1.completePhase)('Middleware Registration');
const lazyImports = {
    optimizedRedisConfig: () => Promise.resolve().then(() => __importStar(require('./app/config/OptimizedRedisConfig'))).then(m => m.optimizedRedisConfig),
};
const app = (0, express_1.default)();
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
app.get('/ping', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        message: 'pong',
        timestamp: new Date().toISOString()
    });
});
app.get('/test', (_req, res) => {
    console.log('🧪 Test endpoint hit! Express is working!');
    res.json({ message: 'Express is working!', timestamp: new Date().toISOString() });
});
(0, StartupProfiler_1.startPhase)('Security Middleware Loading');
const securityStack = MiddlewareFactory_1.middlewareFactory.getSecurityStack();
securityStack.forEach((middleware) => app.use(middleware));
(0, StartupProfiler_1.completePhase)('Security Middleware Loading');
(0, StartupProfiler_1.startPhase)('Performance Middleware Loading');
const performanceStack = MiddlewareFactory_1.middlewareFactory.getPerformanceStack();
performanceStack.forEach((middleware) => app.use(middleware));
(0, StartupProfiler_1.completePhase)('Performance Middleware Loading');
const currentEnv = process.env.NODE_ENV || 'development';
console.log(`✅ Loaded ${securityStack.length + performanceStack.length} middleware functions for ${currentEnv} environment`);
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
    }
}));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
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
// Health routes are now handled by dedicated health router for better organization
// Import and use health routes
const health_routes_1 = __importDefault(require("./app/routes/health.routes"));
const MiddlewareFactory_1 = require("./app/middlewares/MiddlewareFactory");
app.use('/health', health_routes_1.default);
app.use('/api/v1/auth', MiddlewareFactory_1.middlewareFactory.getMiddleware('authRateLimit'));
// application routes
app.use('/api/v1', routes_1.default);
console.log('📵 Monitoring routes disabled to prevent excessive Redis operations');
app.use(globalErrorhandler_1.default);
// Not found
app.use(notFound_1.default);
exports.default = app;
