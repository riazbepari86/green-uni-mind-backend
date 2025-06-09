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

const app: Application = express();

// Set up webhook route first (before body parsers)
// This ensures the raw body is preserved for Stripe signature verification
const stripeWebhookPath = '/api/v1/payments/webhook';
console.log('Setting up Stripe webhook endpoint at:', stripeWebhookPath);
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
  console.log('Passport strategies configured successfully');
} catch (error) {
  console.error('Error configuring Passport strategies:', error);
  console.log('OAuth authentication will not be available');
}

// welcome route
app.get('/', (_req, res) => {
  res.send('🚀 Welcome to the Green Uni Mind API!');
});

// application routes
app.use('/api/v1', router);

// global error handler
app.use(globalErrorHandler);

// Not found
app.use(notFound);

export default app;
