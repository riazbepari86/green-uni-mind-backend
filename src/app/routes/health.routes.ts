import { Router } from 'express';

const router = Router();

// Legacy health check routes - these are now handled in app.ts for better performance
// Keeping this file for potential future health check extensions

// System status endpoint with more detailed information
router.get('/status', (_req, res) => {
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

export default router;
