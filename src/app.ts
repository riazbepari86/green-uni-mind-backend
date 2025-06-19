import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import globalErrorHandler from './app/middlewares/globalErrorhandler';
import notFound from './app/middlewares/notFound';
import router from './app/routes';
import { configurePassport } from './app/config/passport';
import { debugRequestMiddleware } from './app/middlewares/debugMiddleware';
import { oauthLinkMiddleware } from './app/middlewares/oauthLinkMiddleware';
import { formDataMiddleware } from './app/middlewares/formDataMiddleware';
// import monitoringRoutes from './app/routes/monitoring.routes'; // Disabled to prevent Redis overload
import { redisConservativeConfig } from './app/services/redis/RedisConservativeConfig';
import { redisCleanupService } from './app/services/redis/RedisCleanupService';

const app: Application = express();

// Initialize conservative Redis configuration to minimize usage
redisConservativeConfig.initialize();

// Clean up excessive Redis keys on startup
setTimeout(async () => {
  try {
    console.log('🧹 Starting Redis cleanup to remove excessive monitoring data...');
    await redisCleanupService.cleanupPerformanceMetrics();
    await redisCleanupService.getMemoryStats();
    console.log('✅ Redis cleanup completed');
  } catch (error) {
    console.error('❌ Redis cleanup failed:', error);
  }
}, 5000); // Wait 5 seconds for Redis connections to be ready

// Set up webhook route first (before body parsers)
// This ensures the raw body is preserved for Stripe signature verification
const stripeWebhookPath = '/api/v1/payments/webhook';
app.post(
  stripeWebhookPath,
  express.raw({ type: 'application/json' })
);

// Regular parsers for all other routes
app.use((req, res, next) => {
  if (req.originalUrl === stripeWebhookPath) {
    console.log('Webhook request detected, preserving raw body');
    // Make sure the raw body is available for the webhook handler
    if (Buffer.isBuffer(req.body)) {
      console.log('Request body is a buffer, length:', req.body.length);
    } else if (typeof req.body === 'string') {
      console.log('Request body is a string, length:', req.body.length);
    } else if (req.body) {
      console.log('Request body is an object:', typeof req.body);
    } else {
      console.log('Request body is empty or undefined');
    }
    next();
  } else {
    // Use a more robust JSON parser configuration
    express.json({
      limit: '10mb',
      strict: false, // Allow any JSON-like content
      verify: (req: any, _res, buf) => {
        // Store the raw body for debugging
        req.rawBody = buf.toString();
      }
    })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Add debug middleware to log request details
app.use(debugRequestMiddleware);

// Add OAuth link middleware to handle OAuth link requests
app.use(oauthLinkMiddleware);

// Add form data middleware to handle form data requests
app.use(formDataMiddleware);

// Cache monitoring disabled (Redis not available)

// Configure CORS with dynamic origin handling
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

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
        } else if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return false;
      });

      if (isAllowed || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        console.log('CORS blocked request from:', origin);
        // In development, allow all origins but log them
        if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          // In production, be more strict but still allow for now with a warning
          console.warn('⚠️ CORS request from unauthorized origin:', origin);
          callback(null, true);
          // In strict mode, you would use:
          // callback(new Error('Not allowed by CORS'));
        }
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
  }),
);

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
