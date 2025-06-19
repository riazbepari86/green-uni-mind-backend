import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import globalErrorHandler from './app/middlewares/globalErrorhandler';
import notFound from './app/middlewares/notFound';
import router from './app/routes';
import { configurePassport } from './app/config/passport';
// Security middleware imports
import {
  authRateLimit,
} from './app/middlewares/security.middleware';
// import monitoringRoutes from './app/routes/monitoring.routes'; // Disabled to prevent Redis overload
import { redisConservativeConfig } from './app/services/redis/RedisConservativeConfig';
import { redisCleanupService } from './app/services/redis/RedisCleanupService';

const app: Application = express();

// Test route BEFORE any middleware to check if Express is working
app.get('/test', (_req, res) => {
  console.log('🧪 Test endpoint hit! Express is working!');
  res.json({ message: 'Express is working!', timestamp: new Date().toISOString() });
});

// TEMPORARILY DISABLE ALL MIDDLEWARE TO TEST
// Apply security headers first
// app.use(securityHeaders);

// TEMPORARILY DISABLE RATE LIMITING TO TEST
// Apply general rate limiting
// app.use(generalRateLimit);

// TEMPORARILY DISABLE INTERNAL ENDPOINTS HIDING TO TEST
// Hide internal endpoints in production
// app.use(hideInternalEndpoints);

// TEMPORARILY DISABLE SECURITY LOGGING TO TEST
// Security logging for suspicious requests
// app.use(securityLogging);

// Initialize conservative Redis configuration to minimize usage (non-blocking)
setTimeout(() => {
  try {
    console.log('🔧 Initializing Redis configuration in background...');
    redisConservativeConfig.initialize();
  } catch (error) {
    console.error('❌ Redis configuration initialization failed:', error);
    console.log('⚠️ Server will continue without Redis optimization');
  }
}, 100); // Initialize Redis config after a short delay

// Clean up excessive Redis keys on startup (non-blocking)
setTimeout(async () => {
  try {
    console.log('🧹 Starting Redis cleanup to remove excessive monitoring data...');

    // Run cleanup operations in parallel with timeout
    const cleanupPromises = [
      redisCleanupService.cleanupPerformanceMetrics(),
      redisCleanupService.getMemoryStats()
    ];

    // Set a timeout for cleanup operations to prevent blocking startup
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn('⚠️ Redis cleanup timeout - continuing with startup');
        resolve();
      }, 10000); // 10 second timeout
    });

    await Promise.race([
      Promise.allSettled(cleanupPromises),
      timeoutPromise
    ]);

    console.log('✅ Redis cleanup completed (or timed out)');
  } catch (error) {
    console.error('❌ Redis cleanup failed:', error);
    // Don't throw the error - just log it and continue with startup
  }
}, 2000); // Reduced wait time to 2 seconds

// Set up webhook route first (before body parsers)
// This ensures the raw body is preserved for Stripe signature verification
const stripeWebhookPath = '/api/v1/payments/webhook';
app.post(
  stripeWebhookPath,
  express.raw({ type: 'application/json' })
);

// Regular parsers for all other routes (except webhook)
app.use((req, _res, next) => {
  if (req.originalUrl === stripeWebhookPath) {
    console.log('Webhook request detected, preserving raw body');
    // Skip JSON parsing for webhook - raw body is already handled above
    next();
  } else {
    // Apply JSON parsing for all other routes
    next();
  }
});

// Apply JSON parser for all routes except webhook
app.use(express.json({
  limit: '10mb',
  strict: false, // Allow any JSON-like content
  verify: (req: any, _res, buf) => {
    // Store the raw body for debugging (except for webhook)
    if (req.originalUrl !== stripeWebhookPath) {
      req.rawBody = buf.toString();
    }
  }
}));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());



// Simple CORS configuration for development
app.use(cors({
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
    'x-role'
  ]
}));

// Initialize Passport
app.use(passport.initialize());

// Configure Passport strategies if OAuth is configured
try {
  configurePassport();
} catch (error) {
  console.error('Error configuring Passport strategies:', error);
  console.log('OAuth authentication will not be available');
}

// welcome route
app.get('/', (req, res) => {
  console.log('🏠 Root endpoint hit!', req.method, req.url);
  res.send('🚀 Welcome to the Green Uni Mind API!');
});

// Robust health check route for Docker and monitoring
// This endpoint MUST respond quickly and reliably for Render.com deployment
app.get('/health', async (_req, res) => {
  const startTime = Date.now();

  try {
    // Basic health check - always responds quickly
    const healthData: any = {
      status: 'OK',
      message: 'Green Uni Mind API is healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      responseTime: Date.now() - startTime
    };

    // Optional: Add Redis status if available (but don't fail if Redis is down)
    try {
      const { isRedisHealthy } = await import('./app/config/redis');
      const redisHealthy = await Promise.race([
        isRedisHealthy(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000)) // 1 second timeout
      ]);

      healthData.redis = redisHealthy ? 'connected' : 'disconnected';
    } catch (error) {
      // Redis check failed, but don't fail the health check
      healthData.redis = 'unavailable';
    }

    res.status(200).json(healthData);
  } catch (error) {
    // Even if something goes wrong, return a basic health response
    console.error('Health check error:', error);
    res.status(200).json({
      status: 'OK',
      message: 'Green Uni Mind API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      responseTime: Date.now() - startTime,
      note: 'Basic health check - some services may be degraded'
    });
  }
});

// Ultra-fast ping endpoint for basic connectivity checks
app.get('/ping', (req, res) => {
  console.log('🏓 Ping endpoint hit!', req.method, req.url);
  res.status(200).json({
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

// Apply auth rate limiting to authentication routes
app.use('/api/v1/auth', authRateLimit);

// application routes
app.use('/api/v1', router);

// monitoring routes (admin only) - DISABLED to prevent Redis overload
// app.use('/api/v1/monitoring', monitoringRoutes);
console.log('📵 Monitoring routes disabled to prevent excessive Redis operations');

// global error handler
app.use(globalErrorHandler);

// Not found
app.use(notFound);

export default app;
