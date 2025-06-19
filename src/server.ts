import { Server } from 'http';
import mongoose from 'mongoose';
import app from './app';
import config from './app/config';
import seedSuperAdmin from './app/DB';
// Import payout jobs
import { startPayoutJobs } from './app/jobs/payout.job';
import { startPayoutSyncJob } from './app/jobs/payoutSync.job';
// Import keep-alive service
import keepAliveService from './utils/keepAlive';
// Import production-safe logging
import { Logger } from './app/config/logger';
import { specializedLog } from './app/utils/console-replacement';

let server: Server;

async function main() {
  try {
    // Check for required environment variables
    if (!process.env.FRONTEND_URL) {
      Logger.warn('FRONTEND_URL environment variable is not set. Using https://example.com as fallback.');
      process.env.FRONTEND_URL = 'https://example.com';
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      Logger.warn('STRIPE_SECRET_KEY environment variable is not set. Stripe functionality may not work correctly.');
    }

    await mongoose.connect(config.database_url as string);

    // Skip Redis initialization due to connection issues - using Agenda.js for jobs
    Logger.info('Skipping Redis initialization - using MongoDB-based Agenda.js for job scheduling');

    // Note: OTP functionality will be limited without Redis
    Logger.info('OTP functionality will use in-memory storage (development mode)');

    // Seed super admin
    await seedSuperAdmin();

    // Start payout jobs
    try {
      // Start both payout jobs
      await startPayoutJobs();
      await startPayoutSyncJob();
      specializedLog.system.startup('Payout jobs');

      // Log additional information about the payout jobs
      Logger.info('Payout jobs will run on the following schedule:');
      Logger.info('   - Daily payout sync: 1:00 AM');
      Logger.info('   - Daily payout scheduling: Every day');
      Logger.info('   - Hourly payout status checks: Every hour');
    } catch (error) {
      Logger.error('Failed to start payout jobs', { error });
    }

    server = app.listen(config.port, () => {
      specializedLog.system.startup('Green Uni Mind API', Number(config.port));

      // Start keep-alive service to prevent Render from sleeping
      try {
        keepAliveService.start();
        specializedLog.system.startup('Keep-alive service');
      } catch (error) {
        Logger.error('Failed to start keep-alive service', { error });
      }
    });
  } catch (err) {
    Logger.error('Server startup failed', { error: err });
  }
}

// Only run main() if this file is being run directly (not imported)
if (require.main === module) {
  main();
}

process.on('unhandledRejection', async (reason) => {
  Logger.error('Unhandled rejection detected, shutting down...', { reason });
  specializedLog.system.shutdown('Server', 'Unhandled rejection');
  keepAliveService.stop();
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
  process.exit(1);
});

process.on('uncaughtException', async (error) => {
  Logger.error('Uncaught exception detected, shutting down...', { error });
  specializedLog.system.shutdown('Server', 'Uncaught exception');
  keepAliveService.stop();
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  Logger.info('SIGTERM received, shutting down gracefully...');
  specializedLog.system.shutdown('Server', 'SIGTERM signal');
  keepAliveService.stop();
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  Logger.info('SIGINT received, shutting down gracefully...');
  specializedLog.system.shutdown('Server', 'SIGINT signal');
  keepAliveService.stop();
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  }
});

// Export the app for Vercel serverless functions
export default app;
