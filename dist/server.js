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
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./app/config"));
const DB_1 = __importDefault(require("./app/DB"));
// Import keep-alive service
const keepAlive_1 = __importDefault(require("./utils/keepAlive"));
// Import production-safe logging
const logger_1 = require("./app/config/logger");
const console_replacement_1 = require("./app/utils/console-replacement");
// Import startup profiler
const StartupProfiler_1 = require("./app/utils/StartupProfiler");
// Import related services
const ActivityTrackingService_1 = __importDefault(require("./app/services/activity/ActivityTrackingService"));
const MessagingService_1 = __importDefault(require("./app/services/messaging/MessagingService"));
let server;
let activityTrackingService;
let messagingService;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, StartupProfiler_1.startPhase)('Environment Validation');
            // Check for required environment variables
            if (!process.env.FRONTEND_URL) {
                logger_1.Logger.warn('FRONTEND_URL environment variable is not set. Using https://example.com as fallback.');
                process.env.FRONTEND_URL = 'https://example.com';
            }
            if (!process.env.STRIPE_SECRET_KEY) {
                logger_1.Logger.warn('STRIPE_SECRET_KEY environment variable is not set. Stripe functionality may not work correctly.');
            }
            (0, StartupProfiler_1.completePhase)('Environment Validation');
            (0, StartupProfiler_1.startPhase)('Server Initialization');
            // Start the server FIRST - don't wait for anything else
            logger_1.Logger.info('🚀 Starting server on port ' + config_1.default.port);
            server = app_1.default.listen(config_1.default.port, () => {
                (0, StartupProfiler_1.completePhase)('Server Initialization');
                console.log(`🎉 Server is running on http://localhost:${config_1.default.port}`);
                console.log(`✅ Green Uni Mind API is ready to accept requests!`);
                console_replacement_1.specializedLog.system.startup('Green Uni Mind API', Number(config_1.default.port));
                (0, StartupProfiler_1.startPhase)('Keep-alive Service');
                // Start keep-alive service to prevent Render from sleeping
                try {
                    keepAlive_1.default.start();
                    console_replacement_1.specializedLog.system.startup('Keep-alive service');
                    (0, StartupProfiler_1.completePhase)('Keep-alive Service');
                }
                catch (error) {
                    logger_1.Logger.error('Failed to start keep-alive service', { error });
                    (0, StartupProfiler_1.failPhase)('Keep-alive Service', error);
                }
                // Initialize services (WebSocket removed - replaced with SSE/Polling)
                (0, StartupProfiler_1.startPhase)('Service Initialization');
                try {
                    activityTrackingService = new ActivityTrackingService_1.default();
                    messagingService = new MessagingService_1.default();
                    // Set up service dependencies
                    messagingService.setActivityTrackingService(activityTrackingService);
                    logger_1.Logger.info('✅ Services initialized successfully');
                    console_replacement_1.specializedLog.system.startup('Core services');
                    (0, StartupProfiler_1.completePhase)('Service Initialization');
                }
                catch (error) {
                    logger_1.Logger.error('❌ Service initialization failed:', { error });
                    (0, StartupProfiler_1.failPhase)('Service Initialization', error);
                }
                // Complete startup profiling after all immediate tasks
                setTimeout(() => {
                    (0, StartupProfiler_1.completeStartup)();
                }, 100);
            });
            // Handle server errors
            server.on('error', (error) => {
                if (error.syscall !== 'listen') {
                    throw error;
                }
                const bind = typeof config_1.default.port === 'string' ? 'Pipe ' + config_1.default.port : 'Port ' + config_1.default.port;
                switch (error.code) {
                    case 'EACCES':
                        logger_1.Logger.error(bind + ' requires elevated privileges');
                        process.exit(1);
                        break;
                    case 'EADDRINUSE':
                        logger_1.Logger.error(bind + ' is already in use');
                        process.exit(1);
                        break;
                    default:
                        throw error;
                }
            });
            // Now start all background processes AFTER server is listening
            logger_1.Logger.info('🔄 Starting background processes...');
            // Connect to MongoDB in background (non-blocking)
            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                (0, StartupProfiler_1.startPhase)('MongoDB Connection');
                try {
                    logger_1.Logger.info('🔄 Connecting to MongoDB...');
                    yield mongoose_1.default.connect(config_1.default.database_url);
                    logger_1.Logger.info('✅ MongoDB connected successfully');
                    (0, StartupProfiler_1.completePhase)('MongoDB Connection');
                }
                catch (error) {
                    logger_1.Logger.error('❌ MongoDB connection failed:', { error });
                    logger_1.Logger.info('Server will continue without MongoDB - API will be limited');
                    (0, StartupProfiler_1.failPhase)('MongoDB Connection', error);
                }
            }), 1000); // Wait 1 second after server starts
            // Initialize Redis in background (non-blocking)
            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    logger_1.Logger.info('🔄 Testing Redis connection...');
                    const { testRedisConnection } = yield Promise.resolve().then(() => __importStar(require('./app/config/redis')));
                    // Set a timeout for Redis connection test
                    const redisTestPromise = testRedisConnection();
                    const timeoutPromise = new Promise((resolve) => {
                        setTimeout(() => {
                            logger_1.Logger.warn('⚠️ Redis connection test timeout - continuing without Redis');
                            resolve(false);
                        }, 5000); // 5 second timeout
                    });
                    const redisHealthy = yield Promise.race([redisTestPromise, timeoutPromise]);
                    if (redisHealthy) {
                        logger_1.Logger.info('✅ Redis connection established successfully');
                    }
                    else {
                        logger_1.Logger.warn('⚠️ Redis connection failed - running in degraded mode');
                        logger_1.Logger.info('OTP functionality will use in-memory storage (fallback mode)');
                    }
                }
                catch (error) {
                    logger_1.Logger.error('❌ Redis initialization failed:', { error });
                    logger_1.Logger.info('Application will continue without Redis - some features may be limited');
                }
            }), 2000); // Wait 2 seconds after server starts
            // Seed super admin in background (non-blocking)
            setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    logger_1.Logger.info('🔄 Seeding super admin...');
                    yield (0, DB_1.default)();
                    logger_1.Logger.info('✅ Super admin seeded successfully');
                }
                catch (error) {
                    logger_1.Logger.error('❌ Super admin seeding failed:', { error });
                    logger_1.Logger.info('Server will continue without super admin seeding');
                }
            }), 3000); // Wait 3 seconds after server starts
            // Background job systems removed - using standard API patterns instead
            logger_1.Logger.info('✅ Background job systems disabled - using standard API patterns');
        }
        catch (err) {
            logger_1.Logger.error('Server startup failed', { error: err });
        }
    });
}
// Only run main() if this file is being run directly (not imported)
if (require.main === module) {
    main();
}
process.on('unhandledRejection', (reason) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.Logger.error('Unhandled rejection detected, shutting down...', { reason });
    console_replacement_1.specializedLog.system.shutdown('Server', 'Unhandled rejection');
    keepAlive_1.default.stop();
    if (server) {
        server.close(() => {
            process.exit(1);
        });
    }
    process.exit(1);
}));
process.on('uncaughtException', (error) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.Logger.error('Uncaught exception detected, shutting down...', { error });
    console_replacement_1.specializedLog.system.shutdown('Server', 'Uncaught exception');
    keepAlive_1.default.stop();
    process.exit(1);
}));
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.Logger.info('SIGTERM received, shutting down gracefully...');
    console_replacement_1.specializedLog.system.shutdown('Server', 'SIGTERM signal');
    keepAlive_1.default.stop();
    if (server) {
        server.close(() => {
            process.exit(0);
        });
    }
});
process.on('SIGINT', () => {
    logger_1.Logger.info('SIGINT received, shutting down gracefully...');
    console_replacement_1.specializedLog.system.shutdown('Server', 'SIGINT signal');
    keepAlive_1.default.stop();
    if (server) {
        server.close(() => {
            process.exit(0);
        });
    }
});
// Export the app for Vercel serverless functions
exports.default = app_1.default;
