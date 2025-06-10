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

let server: Server;

async function main() {
  try {
    // Check for required environment variables
    if (!process.env.FRONTEND_URL) {
      console.warn('⚠️ WARNING: FRONTEND_URL environment variable is not set. Using https://example.com as fallback.');
      process.env.FRONTEND_URL = 'https://example.com';
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('⚠️ WARNING: STRIPE_SECRET_KEY environment variable is not set. Stripe functionality may not work correctly.');
    }

    await mongoose.connect(config.database_url as string);

    // Seed super admin
    await seedSuperAdmin();

    // Start payout jobs
    try {
      // Start both payout jobs
      await startPayoutJobs();
      await startPayoutSyncJob();
      console.log('✅ Payout jobs started successfully');

      // Log additional information about the payout jobs
      console.log('✅ Payout jobs will run on the following schedule:');
      console.log('   - Daily payout sync: 1:00 AM');
      console.log('   - Daily payout scheduling: Every day');
      console.log('   - Hourly payout status checks: Every hour');
    } catch (error) {
      console.error('❌ Failed to start payout jobs:', error);
    }

    server = app.listen(config.port, () => {
      console.log(`app is listening on port http://localhost:${config.port}`);

      // Start keep-alive service to prevent Render from sleeping
      try {
        keepAliveService.start();
        console.log('✅ Keep-alive service started successfully');
      } catch (error) {
        console.error('❌ Failed to start keep-alive service:', error);
      }
    });
  } catch (err) {
    console.log(err);
  }
}

// Only run main() if this file is being run directly (not imported)
if (require.main === module) {
  main();
}

process.on('unhandledRejection', () => {
  console.log(`😈 unhandledRejection is detected , shutting down ...`);
  keepAliveService.stop();
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
  process.exit(1);
});

process.on('uncaughtException', () => {
  console.log(`😈 uncaughtException is detected , shutting down ...`);
  keepAliveService.stop();
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  keepAliveService.stop();
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  keepAliveService.stop();
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  }
});

// Export the app for Vercel serverless functions
export default app;
