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
let server;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Check for required environment variables
            if (!process.env.FRONTEND_URL) {
                console.warn('⚠️ WARNING: FRONTEND_URL environment variable is not set. Using https://example.com as fallback.');
                process.env.FRONTEND_URL = 'https://example.com';
            }
            if (!process.env.STRIPE_SECRET_KEY) {
                console.warn('⚠️ WARNING: STRIPE_SECRET_KEY environment variable is not set. Stripe functionality may not work correctly.');
            }
            yield mongoose_1.default.connect(config_1.default.database_url);
            // Skip Redis initialization due to connection issues - using Agenda.js for jobs
            console.log('⚠️ Skipping Redis initialization - using MongoDB-based Agenda.js for job scheduling');
            // Note: OTP functionality will be limited without Redis
            console.log('ℹ️ OTP functionality will use in-memory storage (development mode)');
            // Seed super admin
            yield (0, DB_1.default)();
            // Start payout jobs
            try {
                // Start both payout jobs
                yield (0, payout_job_1.startPayoutJobs)();
                yield (0, payoutSync_job_1.startPayoutSyncJob)();
                console.log('✅ Payout jobs started successfully');
                // Log additional information about the payout jobs
                console.log('✅ Payout jobs will run on the following schedule:');
                console.log('   - Daily payout sync: 1:00 AM');
                console.log('   - Daily payout scheduling: Every day');
                console.log('   - Hourly payout status checks: Every hour');
            }
            catch (error) {
                console.error('❌ Failed to start payout jobs:', error);
            }
            server = app_1.default.listen(config_1.default.port, () => {
                console.log(`app is listening on port http://localhost:${config_1.default.port}`);
                // Start keep-alive service to prevent Render from sleeping
                try {
                    keepAlive_1.default.start();
                    console.log('✅ Keep-alive service started successfully');
                }
                catch (error) {
                    console.error('❌ Failed to start keep-alive service:', error);
                }
            });
        }
        catch (err) {
            console.log(err);
        }
    });
}
// Only run main() if this file is being run directly (not imported)
if (require.main === module) {
    main();
}
process.on('unhandledRejection', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`😈 unhandledRejection is detected , shutting down ...`);
    keepAlive_1.default.stop();
    if (server) {
        server.close(() => {
            process.exit(1);
        });
    }
    process.exit(1);
}));
process.on('uncaughtException', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`😈 uncaughtException is detected , shutting down ...`);
    keepAlive_1.default.stop();
    process.exit(1);
}));
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    keepAlive_1.default.stop();
    if (server) {
        server.close(() => {
            process.exit(0);
        });
    }
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    keepAlive_1.default.stop();
    if (server) {
        server.close(() => {
            process.exit(0);
        });
    }
});
// Export the app for Vercel serverless functions
exports.default = app_1.default;
