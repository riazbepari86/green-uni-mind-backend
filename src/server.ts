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

    // Start the server FIRST - don't wait for anything else
    Logger.info('🚀 Starting server on port ' + config.port);
    server = app.listen(config.port, () => {
      console.log(`🎉 Server is running on http://localhost:${config.port}`);
      console.log(`✅ Green Uni Mind API is ready to accept requests!`);
      specializedLog.system.startup('Green Uni Mind API', Number(config.port));

      // Start keep-alive service to prevent Render from sleeping
      try {
        keepAliveService.start();
        specializedLog.system.startup('Keep-alive service');
      } catch (error) {
        Logger.error('Failed to start keep-alive service', { error });
      }
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof config.port === 'string' ? 'Pipe ' + config.port : 'Port ' + config.port;

      switch (error.code) {
        case 'EACCES':
          Logger.error(bind + ' requires elevated privileges');
          process.exit(1);
          break;
        case 'EADDRINUSE':
          Logger.error(bind + ' is already in use');
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Now start all background processes AFTER server is listening
    Logger.info('🔄 Starting background processes...');

    // Connect to MongoDB in background (non-blocking)
    setTimeout(async () => {
      try {
        Logger.info('🔄 Connecting to MongoDB...');
        await mongoose.connect(config.database_url as string);
        Logger.info('✅ MongoDB connected successfully');
      } catch (error) {
        Logger.error('❌ MongoDB connection failed:', { error });
        Logger.info('Server will continue without MongoDB - API will be limited');
      }
    }, 1000); // Wait 1 second after server starts

    // Initialize Redis in background (non-blocking)
    setTimeout(async () => {
      try {
        Logger.info('🔄 Testing Redis connection...');
        const { testRedisConnection } = await import('./app/config/redis');

        // Set a timeout for Redis connection test
        const redisTestPromise = testRedisConnection();
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => {
            Logger.warn('⚠️ Redis connection test timeout - continuing without Redis');
            resolve(false);
          }, 5000); // 5 second timeout
        });

        const redisHealthy = await Promise.race([redisTestPromise, timeoutPromise]);

        if (redisHealthy) {
          Logger.info('✅ Redis connection established successfully');
        } else {
          Logger.warn('⚠️ Redis connection failed - running in degraded mode');
          Logger.info('OTP functionality will use in-memory storage (fallback mode)');
        }
      } catch (error) {
        Logger.error('❌ Redis initialization failed:', { error });
        Logger.info('Application will continue without Redis - some features may be limited');
      }
    }, 2000); // Wait 2 seconds after server starts

    // Seed super admin in background (non-blocking)
    setTimeout(async () => {
      try {
        Logger.info('🔄 Seeding super admin...');
        await seedSuperAdmin();
        Logger.info('✅ Super admin seeded successfully');
      } catch (error) {
        Logger.error('❌ Super admin seeding failed:', { error });
        Logger.info('Server will continue without super admin seeding');
      }
    }, 3000); // Wait 3 seconds after server starts

    // Start payout jobs in background (non-blocking)
    setTimeout(async () => {
      try {
        Logger.info('🔄 Starting payout jobs...');
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
        Logger.error('❌ Payout jobs initialization failed:', { error });
        Logger.info('Server will continue without payout jobs');
      }
    }, 4000); // Wait 4 seconds after server starts
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
