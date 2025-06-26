import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import globalErrorHandler from './app/middlewares/globalErrorhandler';
import notFound from './app/middlewares/notFound';
import router from './app/routes';
import { configurePassport } from './app/config/passport';
import PerformanceMonitoringService from './app/services/monitoring/PerformanceMonitoringService';
import { emailService } from './app/services/emailService';
import { complianceService } from './app/services/complianceService';
import { RetryService } from './app/services/retryService';
import { PayoutManagementService } from './app/modules/Payment/payoutManagement.service';



import { registerMiddleware } from './app/middlewares/MiddlewareRegistry';
import { startPhase, completePhase } from './app/utils/StartupProfiler';
import { serviceRegistry } from './app/services/ServiceRegistry';


startPhase('Middleware Registration');


registerMiddleware();

completePhase('Middleware Registration');

// Initialize Service Registry
startPhase('Service Registry Initialization');
serviceRegistry.initialize().catch(error => {
  console.error('Failed to initialize Service Registry:', error);
});
completePhase('Service Registry Initialization');


const lazyImports = {
  optimizedRedisConfig: () => import('./app/config/OptimizedRedisConfig').then(m => m.optimizedRedisConfig),
};

const app: Application = express();

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


// Middleware loading will be done after basic Express setup to avoid circular dependencies
console.log('⏳ Middleware loading deferred to avoid circular dependencies');


setTimeout(async () => {
  startPhase('Redis Initialization');
  try {
    console.log('🔧 Initializing optimized Redis configuration...');

    // Lazy load optimized Redis configuration
    const optimizedRedisConfig = await lazyImports.optimizedRedisConfig();

    // Initialize with timeout to prevent blocking
    const initPromise = optimizedRedisConfig.initialize();
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Redis initialization timeout')), 8000);
    });

    await Promise.race([initPromise, timeoutPromise]);

    console.log('✅ Optimized Redis configuration initialized successfully');
    completePhase('Redis Initialization');

  } catch (error) {
    console.error('❌ Redis initialization failed:', error);
    console.log('⚠️ Server will continue without Redis - some features may be limited');
    completePhase('Redis Initialization'); // Mark as complete even if failed to prevent hanging
  }
}, 500); 


const stripeWebhookPath = '/api/v1/payments/webhook';
app.post(
  stripeWebhookPath,
  express.raw({ type: 'application/json' })
);


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



app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:8083', // Added for current frontend port
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


app.use(passport.initialize());


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


// ========================================
// OPTIMIZED MIDDLEWARE LOADING (Simplified Approach)
// ========================================

startPhase('Security Middleware Loading');

// Load essential security middleware conditionally
const currentEnv = process.env.NODE_ENV || 'development';

// Only load necessary middleware based on environment
if (currentEnv === 'production') {
  // Production middleware stack
  const {
    enhancedSecurityHeaders,
    generalRateLimit,
    securityLogging,
    requestSizeLimit
  } = require('./app/middlewares/security.middleware');

  app.use(enhancedSecurityHeaders);
  app.use(generalRateLimit);
  app.use(securityLogging);
  app.use(requestSizeLimit('10mb'));

  console.log('✅ Loaded 4 production security middleware');
} else {
  // Development middleware stack (minimal)
  const {
    enhancedSecurityHeaders,
    generalRateLimit
  } = require('./app/middlewares/security.middleware');

  app.use(enhancedSecurityHeaders);
  app.use(generalRateLimit);

  console.log('✅ Loaded 2 development security middleware');
}

completePhase('Security Middleware Loading');

startPhase('Performance Middleware Loading');

// Load performance middleware conditionally
const { responseCompression, cacheHeaders } = require('./app/middlewares/performance.middleware');
app.use(responseCompression);
app.use(cacheHeaders);

// Only load monitoring in production or when explicitly enabled
if (currentEnv === 'production' || process.env.ENABLE_PERFORMANCE_MONITORING === 'true') {
  const { performanceTracker, memoryMonitor } = require('./app/middlewares/performance.middleware');
  app.use(performanceTracker);
  app.use(memoryMonitor);

  // Add enhanced performance monitoring
  app.use(PerformanceMonitoringService.getInstance().trackPerformance());

  console.log('✅ Loaded 4 performance middleware (with enhanced monitoring)');
} else {
  console.log('✅ Loaded 2 performance middleware (basic)');
}

completePhase('Performance Middleware Loading');

// Apply auth rate limiting to authentication routes (conditionally loaded)
const { authRateLimit } = require('./app/middlewares/security.middleware');
app.use('/api/v1/auth', authRateLimit);

// Health routes are now handled by dedicated health router for better organization
import healthRoutes from './app/routes/health.routes';
app.use('/', healthRoutes); // Mount health routes at root level for /health endpoint

// application routes
app.use('/api/v1', router);

// Initialize enterprise services
setTimeout(async () => {
  try {
    console.log('🚀 Initializing enterprise services...');

    // Initialize email service
    await emailService.initialize();
    console.log('✅ Email service initialized');

    // Initialize compliance monitoring
    complianceService.initializeComplianceMonitoring();
    console.log('✅ Compliance monitoring initialized');

    // Initialize retry services
    RetryService.initializeRetryJobs();
    console.log('✅ Retry services initialized');

    // Initialize payout management
    PayoutManagementService.initializePayoutJobs();
    console.log('✅ Payout management initialized');

    console.log('🎉 All enterprise services initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing enterprise services:', error);
  }
}, 1000);

console.log('📵 Monitoring routes disabled to prevent excessive Redis operations');

// Debug middleware to log all requests to /users/me or /api/users/me
app.use((req, _res, next) => {
  if (req.path.includes('/users/me') && !req.path.includes('/api/v1/users/me')) {
    console.log('🔍 DEBUG: Incorrect API call detected:');
    console.log('- Path:', req.path);
    console.log('- Method:', req.method);
    console.log('- Headers:', JSON.stringify(req.headers, null, 2));
    console.log('- User-Agent:', req.headers['user-agent']);
    console.log('- Referer:', req.headers['referer']);
    console.log('- Origin:', req.headers['origin']);
    console.log('- Stack trace:', new Error().stack);
  }
  next();
});

app.use(globalErrorHandler);

// Not found
app.use(notFound);

export default app;
