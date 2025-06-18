"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const monitoring_controller_1 = require("../controllers/monitoring.controller");
const authWithCache_1 = __importDefault(require("../middlewares/authWithCache"));
const authWithCache_2 = require("../middlewares/authWithCache");
const cachingMiddleware_1 = require("../middlewares/cachingMiddleware");
const router = express_1.default.Router();
// All monitoring routes require teacher access (highest available role)
router.use((0, authWithCache_1.default)('teacher'));
// Performance Metrics Routes
router.get('/metrics/current', (0, cachingMiddleware_1.cacheApiResponse)({
    ttl: 30, // Cache for 30 seconds
    tags: ['monitoring', 'metrics'],
    condition: (req) => req.method === 'GET',
}), monitoring_controller_1.MonitoringControllers.getCurrentMetrics);
router.get('/metrics/history', (0, cachingMiddleware_1.cacheApiResponse)({
    ttl: 60, // Cache for 1 minute
    tags: ['monitoring', 'metrics_history'],
    varyBy: ['hours'],
}), monitoring_controller_1.MonitoringControllers.getMetricsHistory);
router.get('/metrics/summary', (0, cachingMiddleware_1.cacheApiResponse)({
    ttl: 120, // Cache for 2 minutes
    tags: ['monitoring', 'performance_summary'],
}), monitoring_controller_1.MonitoringControllers.getPerformanceSummary);
// Redis Health Routes
router.get('/redis/health', (0, cachingMiddleware_1.cacheApiResponse)({
    ttl: 30,
    tags: ['monitoring', 'redis_health'],
}), monitoring_controller_1.MonitoringControllers.getRedisHealth);
// Cache Statistics Routes
router.get('/cache/stats', (0, cachingMiddleware_1.cacheApiResponse)({
    ttl: 60,
    tags: ['monitoring', 'cache_stats'],
}), monitoring_controller_1.MonitoringControllers.getCacheStats);
router.get('/cache/popular-endpoints', (0, cachingMiddleware_1.cacheApiResponse)({
    ttl: 300, // Cache for 5 minutes
    tags: ['monitoring', 'popular_endpoints'],
    varyBy: ['limit'],
}), monitoring_controller_1.MonitoringControllers.getPopularEndpoints);
router.get('/cache/popular-queries', (0, cachingMiddleware_1.cacheApiResponse)({
    ttl: 300,
    tags: ['monitoring', 'popular_queries'],
    varyBy: ['limit'],
}), monitoring_controller_1.MonitoringControllers.getPopularQueries);
// Cache Management Routes
router.post('/cache/invalidate', (0, authWithCache_2.requirePermissions)('manage_cache'), monitoring_controller_1.MonitoringControllers.invalidateCacheByTags);
router.post('/cache/clear', (0, authWithCache_2.requirePermissions)('manage_cache'), monitoring_controller_1.MonitoringControllers.clearAllCache);
router.post('/cache/warm', (0, authWithCache_2.requirePermissions)('manage_cache'), monitoring_controller_1.MonitoringControllers.warmCache);
// Job Queue Routes
router.get('/jobs/stats', (0, cachingMiddleware_1.cacheApiResponse)({
    ttl: 30,
    tags: ['monitoring', 'job_stats'],
}), monitoring_controller_1.MonitoringControllers.getJobStats);
// Alert Management Routes
router.get('/alerts/active', monitoring_controller_1.MonitoringControllers.getActiveAlerts);
router.get('/alerts/resolved', (0, cachingMiddleware_1.cacheApiResponse)({
    ttl: 300,
    tags: ['monitoring', 'resolved_alerts'],
    varyBy: ['limit'],
}), monitoring_controller_1.MonitoringControllers.getResolvedAlerts);
router.post('/alerts/:alertId/acknowledge', monitoring_controller_1.MonitoringControllers.acknowledgeAlert);
router.get('/alerts/rules', (0, cachingMiddleware_1.cacheApiResponse)({
    ttl: 600, // Cache for 10 minutes
    tags: ['monitoring', 'alert_rules'],
}), monitoring_controller_1.MonitoringControllers.getAlertRules);
router.post('/alerts/rules', (0, authWithCache_2.requirePermissions)('manage_alerts'), monitoring_controller_1.MonitoringControllers.addAlertRule);
router.delete('/alerts/rules/:ruleName', (0, authWithCache_2.requirePermissions)('manage_alerts'), monitoring_controller_1.MonitoringControllers.removeAlertRule);
// System Information Routes
router.get('/system/info', (0, cachingMiddleware_1.cacheApiResponse)({
    ttl: 300,
    tags: ['monitoring', 'system_info'],
}), monitoring_controller_1.MonitoringControllers.getSystemInfo);
// Export and Reporting Routes
router.get('/reports/performance', monitoring_controller_1.MonitoringControllers.exportPerformanceReport);
// Real-time monitoring endpoints (no caching)
router.get('/realtime/metrics', monitoring_controller_1.MonitoringControllers.getCurrentMetrics);
router.get('/realtime/alerts', monitoring_controller_1.MonitoringControllers.getActiveAlerts);
// Redis Usage Audit Routes
router.get('/redis/usage-audit', (0, authWithCache_2.requirePermissions)('view_monitoring'), monitoring_controller_1.MonitoringControllers.getRedisUsageAudit);
router.get('/redis/usage-report', (0, authWithCache_2.requirePermissions)('view_monitoring'), monitoring_controller_1.MonitoringControllers.getRedisUsageReport);
router.get('/redis/quick-health', (0, authWithCache_2.requirePermissions)('view_monitoring'), monitoring_controller_1.MonitoringControllers.getRedisQuickHealth);
// Redis Usage Monitoring Routes
router.get('/redis/usage-alerts', (0, authWithCache_2.requirePermissions)('view_monitoring'), monitoring_controller_1.MonitoringControllers.getRedisUsageAlerts);
router.post('/redis/alerts/:alertId/acknowledge', (0, authWithCache_2.requirePermissions)('manage_monitoring'), monitoring_controller_1.MonitoringControllers.acknowledgeRedisAlert);
router.get('/redis/usage-monitoring-report', (0, authWithCache_2.requirePermissions)('view_monitoring'), monitoring_controller_1.MonitoringControllers.getRedisUsageMonitoringReport);
router.put('/redis/usage-thresholds', (0, authWithCache_2.requirePermissions)('manage_monitoring'), monitoring_controller_1.MonitoringControllers.updateRedisThresholds);
exports.default = router;
