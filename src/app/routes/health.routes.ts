import { Router } from 'express';

const router = Router();

// Health check endpoint for keep-alive service
router.get('/health', (_req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  };

  res.status(200).json(healthData);
});

// Simple ping endpoint
router.get('/ping', (_req, res) => {
  res.status(200).json({
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

export default router;
