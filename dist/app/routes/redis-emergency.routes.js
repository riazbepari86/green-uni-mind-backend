"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const redis_emergency_controller_1 = require("../controllers/redis-emergency.controller");
const router = (0, express_1.Router)();
/**
 * Emergency Redis Management Routes
 * These routes handle critical Redis performance issues
 */
// Get current Redis status and memory usage
router.get('/status', redis_emergency_controller_1.RedisEmergencyController.getRedisStatus);
// Execute emergency optimization
router.post('/optimize', redis_emergency_controller_1.RedisEmergencyController.executeEmergencyOptimization);
// Force cleanup specific pattern
router.post('/cleanup', redis_emergency_controller_1.RedisEmergencyController.forceCleanupPattern);
exports.default = router;
