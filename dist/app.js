"use strict";
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
const debugMiddleware_1 = require("./app/middlewares/debugMiddleware");
const oauthLinkMiddleware_1 = require("./app/middlewares/oauthLinkMiddleware");
const formDataMiddleware_1 = require("./app/middlewares/formDataMiddleware");
// Security middleware imports
const security_middleware_1 = require("./app/middlewares/security.middleware");
// import monitoringRoutes from './app/routes/monitoring.routes'; // Disabled to prevent Redis overload
const RedisConservativeConfig_1 = require("./app/services/redis/RedisConservativeConfig");
const RedisCleanupService_1 = require("./app/services/redis/RedisCleanupService");
const app = (0, express_1.default)();
// Apply security headers first
app.use(security_middleware_1.securityHeaders);
// Apply general rate limiting
app.use(security_middleware_1.generalRateLimit);
// Hide internal endpoints in production
app.use(security_middleware_1.hideInternalEndpoints);
// Security logging for suspicious requests
app.use(security_middleware_1.securityLogging);
// Initialize conservative Redis configuration to minimize usage
RedisConservativeConfig_1.redisConservativeConfig.initialize();
// Clean up excessive Redis keys on startup
setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🧹 Starting Redis cleanup to remove excessive monitoring data...');
        yield RedisCleanupService_1.redisCleanupService.cleanupPerformanceMetrics();
        yield RedisCleanupService_1.redisCleanupService.getMemoryStats();
        console.log('✅ Redis cleanup completed');
    }
    catch (error) {
        console.error('❌ Redis cleanup failed:', error);
    }
}), 5000); // Wait 5 seconds for Redis connections to be ready
// Set up webhook route first (before body parsers)
// This ensures the raw body is preserved for Stripe signature verification
const stripeWebhookPath = '/api/v1/payments/webhook';
app.post(stripeWebhookPath, express_1.default.raw({ type: 'application/json' }));
// Regular parsers for all other routes
app.use((req, res, next) => {
    if (req.originalUrl === stripeWebhookPath) {
        console.log('Webhook request detected, preserving raw body');
        // Make sure the raw body is available for the webhook handler
        if (Buffer.isBuffer(req.body)) {
            console.log('Request body is a buffer, length:', req.body.length);
        }
        else if (typeof req.body === 'string') {
            console.log('Request body is a string, length:', req.body.length);
        }
        else if (req.body) {
            console.log('Request body is an object:', typeof req.body);
        }
        else {
            console.log('Request body is empty or undefined');
        }
        next();
    }
    else {
        // Use a more robust JSON parser configuration
        express_1.default.json({
            limit: '10mb',
            strict: false, // Allow any JSON-like content
            verify: (req, _res, buf) => {
                // Store the raw body for debugging
                req.rawBody = buf.toString();
            }
        })(req, res, next);
    }
});
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Add debug middleware to log request details
app.use(debugMiddleware_1.debugRequestMiddleware);
// Add OAuth link middleware to handle OAuth link requests
app.use(oauthLinkMiddleware_1.oauthLinkMiddleware);
// Add form data middleware to handle form data requests
app.use(formDataMiddleware_1.formDataMiddleware);
// Cache monitoring disabled (Redis not available)
// Configure CORS with dynamic origin handling
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin)
            return callback(null, true);
        // List of allowed origins
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:8080',
            'http://localhost:8081',
            'https://green-uni-mind.pages.dev',
            'https://green-uni-mind-di79.vercel.app',
            // Production domains
            'https://green-uni-mind.vercel.app',
            'https://www.green-uni-mind.vercel.app',
            'https://green-uni-mind-di79.vercel.app',
            // Cloudflare Pages domain
            'https://green-uni-mind.pages.dev',
            // Allow all vercel.app subdomains for development/staging
            /\.vercel\.app$/,
            // Allow all pages.dev subdomains for Cloudflare Pages
            /\.pages\.dev$/
        ];
        // allow pages
        // Check if the origin is allowed
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (typeof allowedOrigin === 'string') {
                return allowedOrigin === origin;
            }
            else if (allowedOrigin instanceof RegExp) {
                return allowedOrigin.test(origin);
            }
            return false;
        });
        if (isAllowed) {
            callback(null, true);
        }
        else if (process.env.NODE_ENV !== 'production') {
            // In development, allow all origins but log them
            console.log('🔓 CORS allowing request from (dev mode):', origin);
            callback(null, true);
        }
        else {
            // In production, strictly block unauthorized origins
            console.error('🚫 CORS blocked unauthorized request from:', origin);
            callback(new Error('Not allowed by CORS policy'));
        }
    },
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
        'x-requested-with',
        'X-Requested-With',
        'content-type',
        'accept',
        'origin',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Methods'
    ],
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
app.get('/', (_req, res) => {
    res.send('🚀 Welcome to the Green Uni Mind API!');
});
// health check route for Docker and monitoring
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Green Uni Mind API is healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});
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
