import express from 'express';
import { MonitoringControllers } from '../controllers/monitoring.controller';
import authWithCache from '../middlewares/authWithCache';
import { requirePermissions } from '../middlewares/authWithCache';
import { cacheApiResponse } from '../middlewares/cachingMiddleware';

const router = express.Router();

// All monitoring routes require teacher access (highest available role)
router.use(authWithCache('teacher'));

// Performance Metrics Routes
router.get(
  '/metrics/current',
  cacheApiResponse({
    ttl: 30, // Cache for 30 seconds
    tags: ['monitoring', 'metrics'],
    condition: (req) => req.method === 'GET',
  }),
  MonitoringControllers.getCurrentMetrics
);

router.get(
  '/metrics/history',
  cacheApiResponse({
    ttl: 60, // Cache for 1 minute
    tags: ['monitoring', 'metrics_history'],
    varyBy: ['hours'],
  }),
  MonitoringControllers.getMetricsHistory
);

router.get(
  '/metrics/summary',
  cacheApiResponse({
    ttl: 120, // Cache for 2 minutes
    tags: ['monitoring', 'performance_summary'],
  }),
  MonitoringControllers.getPerformanceSummary
);

// Redis Health Routes
router.get(
  '/redis/health',
  cacheApiResponse({
    ttl: 30,
    tags: ['monitoring', 'redis_health'],
  }),
  MonitoringControllers.getRedisHealth
);

// Cache Statistics Routes
router.get(
  '/cache/stats',
  cacheApiResponse({
    ttl: 60,
    tags: ['monitoring', 'cache_stats'],
  }),
  MonitoringControllers.getCacheStats
);

router.get(
  '/cache/popular-endpoints',
  cacheApiResponse({
    ttl: 300, // Cache for 5 minutes
    tags: ['monitoring', 'popular_endpoints'],
    varyBy: ['limit'],
  }),
  MonitoringControllers.getPopularEndpoints
);

router.get(
  '/cache/popular-queries',
  cacheApiResponse({
    ttl: 300,
    tags: ['monitoring', 'popular_queries'],
    varyBy: ['limit'],
  }),
  MonitoringControllers.getPopularQueries
);

// Cache Management Routes
router.post(
  '/cache/invalidate',
  requirePermissions('manage_cache'),
  MonitoringControllers.invalidateCacheByTags
);

router.post(
  '/cache/clear',
  requirePermissions('manage_cache'),
  MonitoringControllers.clearAllCache
);

router.post(
  '/cache/warm',
  requirePermissions('manage_cache'),
  MonitoringControllers.warmCache
);

// Job Queue Routes
router.get(
  '/jobs/stats',
  cacheApiResponse({
    ttl: 30,
    tags: ['monitoring', 'job_stats'],
  }),
  MonitoringControllers.getJobStats
);

// Alert Management Routes
router.get(
  '/alerts/active',
  MonitoringControllers.getActiveAlerts
);

router.get(
  '/alerts/resolved',
  cacheApiResponse({
    ttl: 300,
    tags: ['monitoring', 'resolved_alerts'],
    varyBy: ['limit'],
  }),
  MonitoringControllers.getResolvedAlerts
);

router.post(
  '/alerts/:alertId/acknowledge',
  MonitoringControllers.acknowledgeAlert
);

router.get(
  '/alerts/rules',
  cacheApiResponse({
    ttl: 600, // Cache for 10 minutes
    tags: ['monitoring', 'alert_rules'],
  }),
  MonitoringControllers.getAlertRules
);

router.post(
  '/alerts/rules',
  requirePermissions('manage_alerts'),
  MonitoringControllers.addAlertRule
);

router.delete(
  '/alerts/rules/:ruleName',
  requirePermissions('manage_alerts'),
  MonitoringControllers.removeAlertRule
);

// System Information Routes
router.get(
  '/system/info',
  cacheApiResponse({
    ttl: 300,
    tags: ['monitoring', 'system_info'],
  }),
  MonitoringControllers.getSystemInfo
);

// Export and Reporting Routes
router.get(
  '/reports/performance',
  MonitoringControllers.exportPerformanceReport
);

// Real-time monitoring endpoints (no caching)
router.get('/realtime/metrics', MonitoringControllers.getCurrentMetrics);
router.get('/realtime/alerts', MonitoringControllers.getActiveAlerts);

// Redis Usage Audit Routes
router.get(
  '/redis/usage-audit',
  requirePermissions('view_monitoring'),
  MonitoringControllers.getRedisUsageAudit
);

router.get(
  '/redis/usage-report',
  requirePermissions('view_monitoring'),
  MonitoringControllers.getRedisUsageReport
);

router.get(
  '/redis/quick-health',
  requirePermissions('view_monitoring'),
  MonitoringControllers.getRedisQuickHealth
);

// Redis Usage Monitoring Routes
router.get(
  '/redis/usage-alerts',
  requirePermissions('view_monitoring'),
  MonitoringControllers.getRedisUsageAlerts
);

router.post(
  '/redis/alerts/:alertId/acknowledge',
  requirePermissions('manage_monitoring'),
  MonitoringControllers.acknowledgeRedisAlert
);

router.get(
  '/redis/usage-monitoring-report',
  requirePermissions('view_monitoring'),
  MonitoringControllers.getRedisUsageMonitoringReport
);

router.put(
  '/redis/usage-thresholds',
  requirePermissions('manage_monitoring'),
  MonitoringControllers.updateRedisThresholds
);

export default router;
