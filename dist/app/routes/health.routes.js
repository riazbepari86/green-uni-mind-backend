"use strict";
/**
 * Optimized Health Check Routes
 * Provides ultra-fast health checks and detailed monitoring endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const MiddlewareFactory_1 = require("../middlewares/MiddlewareFactory");
const StartupProfiler_1 = require("../utils/StartupProfiler");
const router = (0, express_1.Router)();
/**
 * Ultra-fast health check for uptime monitoring
 * No middleware, no database checks, minimal processing
 */
router.get('/health', (_req, res) => {
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
/**
 * Ultra-fast ping endpoint for basic connectivity
 */
router.get('/ping', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        message: 'pong',
        timestamp: new Date().toISOString()
    });
});
/**
 * Basic test endpoint to verify Express is working
 */
router.get('/test', (_req, res) => {
    console.log('🧪 Test endpoint hit! Express is working!');
    res.json({
        message: 'Express is working!',
        timestamp: new Date().toISOString()
    });
});
/**
 * System status endpoint with more detailed information
 */
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
/**
 * Startup performance metrics endpoint
 */
router.get('/startup', (_req, res) => {
    try {
        const profile = StartupProfiler_1.startupProfiler.getProfile();
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
    }
    catch (error) {
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
router.get('/middleware', (_req, res) => {
    try {
        const stats = MiddlewareFactory_1.middlewareFactory.getStats();
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve middleware statistics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
