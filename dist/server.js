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
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./app/config"));
const DB_1 = __importDefault(require("./app/DB"));
// Import payout jobs
const payout_job_1 = require("./app/jobs/payout.job");
const payoutSync_job_1 = require("./app/jobs/payoutSync.job");
// Import keep-alive service
const keepAlive_1 = __importDefault(require("./utils/keepAlive"));
// Import production-safe logging
const logger_1 = require("./app/config/logger");
const console_replacement_1 = require("./app/utils/console-replacement");
let server;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Check for required environment variables
            if (!process.env.FRONTEND_URL) {
                logger_1.Logger.warn('FRONTEND_URL environment variable is not set. Using https://example.com as fallback.');
                process.env.FRONTEND_URL = 'https://example.com';
            }
            if (!process.env.STRIPE_SECRET_KEY) {
                logger_1.Logger.warn('STRIPE_SECRET_KEY environment variable is not set. Stripe functionality may not work correctly.');
            }
            yield mongoose_1.default.connect(config_1.default.database_url);
            // Skip Redis initialization due to connection issues - using Agenda.js for jobs
            logger_1.Logger.info('Skipping Redis initialization - using MongoDB-based Agenda.js for job scheduling');
            // Note: OTP functionality will be limited without Redis
            logger_1.Logger.info('OTP functionality will use in-memory storage (development mode)');
            // Seed super admin
            yield (0, DB_1.default)();
            // Start payout jobs
            try {
                // Start both payout jobs
                yield (0, payout_job_1.startPayoutJobs)();
                yield (0, payoutSync_job_1.startPayoutSyncJob)();
                console_replacement_1.specializedLog.system.startup('Payout jobs');
                // Log additional information about the payout jobs
                logger_1.Logger.info('Payout jobs will run on the following schedule:');
                logger_1.Logger.info('   - Daily payout sync: 1:00 AM');
                logger_1.Logger.info('   - Daily payout scheduling: Every day');
                logger_1.Logger.info('   - Hourly payout status checks: Every hour');
            }
            catch (error) {
                logger_1.Logger.error('Failed to start payout jobs', { error });
            }
            server = app_1.default.listen(config_1.default.port, () => {
                console_replacement_1.specializedLog.system.startup('Green Uni Mind API', Number(config_1.default.port));
                // Start keep-alive service to prevent Render from sleeping
                try {
                    keepAlive_1.default.start();
                    console_replacement_1.specializedLog.system.startup('Keep-alive service');
                }
                catch (error) {
                    logger_1.Logger.error('Failed to start keep-alive service', { error });
                }
            });
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
