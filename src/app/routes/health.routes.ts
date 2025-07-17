/**
 * Optimized Health Check Routes
 * Provides ultra-fast health checks and detailed monitoring endpoints
 */

import { Router, Request, Response } from 'express';
import { middlewareFactory } from '../middlewares/MiddlewareFactory';
import { startupProfiler } from '../utils/StartupProfiler';

const router = Router();

/**
 * Ultra-fast health check for uptime monitoring
 * No middleware, no database checks, minimal processing
 */
// Note: The main /health endpoint is handled directly in app.ts
// This route is kept for potential future use or alternative health checks
router.get('/health-detailed', (_req: Request, res: Response) => {
  // Set headers immediately for fastest response
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  // Send detailed health response
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    source: 'health-router',
    details: {
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      memory: process.memoryUsage()
    }
  });
});

/**
 * OPTIONS handler for health endpoint preflight requests
 */
router.options('/health', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).end();
});

/**
 * Ultra-fast ping endpoint for basic connectivity
 */
router.get('/ping', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');

  // Let the main CORS middleware handle CORS headers
  // No need to set explicit CORS headers here

  res.status(200).json({
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

/**
 * OPTIONS handler for ping endpoint preflight requests
 * The main CORS middleware will handle the CORS headers
 */
router.options('/ping', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).end();
});

/**
 * Basic test endpoint to verify Express is working
 */
router.get('/test', (_req: Request, res: Response) => {
  console.log('🧪 Test endpoint hit! Express is working!');
  res.json({
    message: 'Express is working!',
    timestamp: new Date().toISOString()
  });
});

/**
 * System status endpoint with more detailed information
 */
router.get('/status', (_req: Request, res: Response) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    memory: process.memoryUsage(),
    uptime: process.uptime()
  };

  res.status(200).json(healthData);
});

/**
 * Startup performance metrics endpoint
 */
router.get('/startup', (_req: Request, res: Response) => {
  try {
    const profile = startupProfiler.getProfile();

    res.json({
      success: true,
      data: profile,
      summary: {
        totalTime: profile.totalStartupTime,
        completedPhases: profile.metrics.filter(m => m.status === 'completed').length,
        failedPhases: profile.metrics.filter(m => m.status === 'failed').length,
        environment: profile.environment,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve startup metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Middleware statistics endpoint
 */
router.get('/middleware', (_req: Request, res: Response) => {
  try {
    const stats = middlewareFactory.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve middleware statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
