import { Router } from 'express';
import { RedisEmergencyController } from '../controllers/redis-emergency.controller';

const router = Router();

/**
 * Emergency Redis Management Routes
 * These routes handle critical Redis performance issues
 */

// Get current Redis status and memory usage
router.get('/status', RedisEmergencyController.getRedisStatus);

// Execute emergency optimization
router.post('/optimize', RedisEmergencyController.executeEmergencyOptimization);

// Force cleanup specific pattern
router.post('/cleanup', RedisEmergencyController.forceCleanupPattern);

export default router;
