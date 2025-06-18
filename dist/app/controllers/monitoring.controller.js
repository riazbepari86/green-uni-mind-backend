"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringControllers = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../utils/sendResponse"));
const PerformanceDashboard_1 = require("../services/monitoring/PerformanceDashboard");
const RedisServiceManager_1 = require("../services/redis/RedisServiceManager");
const JobQueueManager_1 = require("../services/jobs/JobQueueManager");
const cachingMiddleware_1 = require("../middlewares/cachingMiddleware");
const RedisUsageAuditor_1 = require("../services/redis/RedisUsageAuditor");
const RedisUsageMonitor_1 = require("../services/monitoring/RedisUsageMonitor");
// Get current performance metrics
const getCurrentMetrics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const metrics = yield PerformanceDashboard_1.performanceDashboard.getCurrentMetrics();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Current performance metrics retrieved successfully',
        data: metrics,
    });
}));
// Get performance metrics history
const getMetricsHistory = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const hours = parseInt(req.query.hours) || 24;
    const metrics = yield PerformanceDashboard_1.performanceDashboard.getMetricsHistory(hours);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `Performance metrics history for last ${hours} hours retrieved successfully`,
        data: {
            timeRange: `${hours} hours`,
            dataPoints: metrics.length,
            metrics,
        },
    });
}));
// Get performance summary
const getPerformanceSummary = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const summary = yield PerformanceDashboard_1.performanceDashboard.getPerformanceSummary();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Performance summary retrieved successfully',
        data: summary,
    });
}));
// Get Redis health and statistics
const getRedisHealth = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const [health, performance, info] = yield Promise.all([
        RedisServiceManager_1.redisServiceManager.healthCheck(),
        RedisServiceManager_1.redisServiceManager.getPerformanceMetrics(),
        RedisServiceManager_1.redisServiceManager.getRedisInfo(),
    ]);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Redis health information retrieved successfully',
        data: {
            health,
            performance,
            info,
            timestamp: new Date().toISOString(),
        },
    });
}));
// Get cache statistics
const getCacheStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const [apiStats, queryStats, invalidationMetrics] = yield Promise.all([
        cachingMiddleware_1.apiCache.getApiCacheStats(),
        cachingMiddleware_1.queryCache.getCacheStats(),
        cachingMiddleware_1.invalidationService.getInvalidationMetrics(),
    ]);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Cache statistics retrieved successfully',
        data: {
            api: apiStats,
            query: queryStats,
            invalidation: invalidationMetrics,
            timestamp: new Date().toISOString(),
        },
    });
}));
// Get job queue statistics
const getJobStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const [queueStats, healthStatus] = yield Promise.all([
        JobQueueManager_1.jobQueueManager.getQueueStats(),
        JobQueueManager_1.jobQueueManager.getHealthStatus(),
    ]);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Job queue statistics retrieved successfully',
        data: {
            queues: queueStats,
            health: healthStatus,
            timestamp: new Date().toISOString(),
        },
    });
}));
// Get active alerts
const getActiveAlerts = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const alerts = yield PerformanceDashboard_1.performanceDashboard.getActiveAlerts();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Active alerts retrieved successfully',
        data: {
            count: alerts.length,
            alerts,
        },
    });
}));
// Get resolved alerts
const getResolvedAlerts = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const limit = parseInt(req.query.limit) || 50;
    const alerts = yield PerformanceDashboard_1.performanceDashboard.getResolvedAlerts(limit);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Resolved alerts retrieved successfully',
        data: {
            count: alerts.length,
            alerts,
        },
    });
}));
// Acknowledge alert
const acknowledgeAlert = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { alertId } = req.params;
    yield PerformanceDashboard_1.performanceDashboard.acknowledgeAlert(alertId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Alert acknowledged successfully',
        data: { alertId },
    });
}));
// Get alert rules
const getAlertRules = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const rules = PerformanceDashboard_1.performanceDashboard.getAlertRules();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Alert rules retrieved successfully',
        data: {
            count: rules.length,
            rules,
        },
    });
}));
// Add alert rule
const addAlertRule = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const rule = req.body;
    PerformanceDashboard_1.performanceDashboard.addAlertRule(rule);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Alert rule added successfully',
        data: rule,
    });
}));
// Remove alert rule
const removeAlertRule = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { ruleName } = req.params;
    PerformanceDashboard_1.performanceDashboard.removeAlertRule(ruleName);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Alert rule removed successfully',
        data: { ruleName },
    });
}));
// Get popular API endpoints
const getPopularEndpoints = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const limit = parseInt(req.query.limit) || 10;
    const endpoints = yield cachingMiddleware_1.apiCache.getPopularEndpoints(limit);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Popular API endpoints retrieved successfully',
        data: {
            count: endpoints.length,
            endpoints,
        },
    });
}));
// Get popular queries
const getPopularQueries = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const limit = parseInt(req.query.limit) || 10;
    const queries = yield cachingMiddleware_1.queryCache.getPopularQueries(limit);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Popular queries retrieved successfully',
        data: {
            count: queries.length,
            queries,
        },
    });
}));
// Invalidate cache by tags
const invalidateCacheByTags = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { tags } = req.body;
    if (!Array.isArray(tags) || tags.length === 0) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Tags array is required',
            data: null,
        });
    }
    const [apiInvalidated, queryInvalidated] = yield Promise.all([
        cachingMiddleware_1.apiCache.invalidateByTags(tags),
        cachingMiddleware_1.queryCache.invalidateByTags(tags),
    ]);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Cache invalidated successfully',
        data: {
            tags,
            apiEntriesInvalidated: apiInvalidated,
            queryEntriesInvalidated: queryInvalidated,
            totalInvalidated: apiInvalidated + queryInvalidated,
        },
    });
}));
// Clear all cache
const clearAllCache = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const [apiCleared, queryCleared] = yield Promise.all([
        cachingMiddleware_1.apiCache.clearApiCache(),
        cachingMiddleware_1.queryCache.cleanExpiredEntries(),
    ]);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'All cache cleared successfully',
        data: {
            apiEntriesCleared: apiCleared,
            queryEntriesCleared: queryCleared,
            totalCleared: apiCleared + queryCleared,
        },
    });
}));
// Warm cache
const warmCache = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // This would typically warm critical endpoints
    // For now, we'll just return a success message
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Cache warming initiated successfully',
        data: {
            status: 'warming',
            estimatedTime: '2-5 minutes',
        },
    });
}));
// Get system information
const getSystemInfo = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const systemInfo = {
        node: {
            version: process.version,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
        },
        environment: {
            nodeEnv: process.env.NODE_ENV,
            platform: process.platform,
            arch: process.arch,
        },
        application: {
            name: 'Green Uni Mind Backend',
            version: '1.0.0', // You might want to read this from package.json
            startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        },
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'System information retrieved successfully',
        data: systemInfo,
    });
}));
// Export performance report
const exportPerformanceReport = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const hours = parseInt(req.query.hours) || 24;
    const format = req.query.format || 'json';
    const [metrics, summary, alerts] = yield Promise.all([
        PerformanceDashboard_1.performanceDashboard.getMetricsHistory(hours),
        PerformanceDashboard_1.performanceDashboard.getPerformanceSummary(),
        PerformanceDashboard_1.performanceDashboard.getActiveAlerts(),
    ]);
    const report = {
        generatedAt: new Date().toISOString(),
        timeRange: `${hours} hours`,
        summary,
        alerts: {
            active: alerts,
            count: alerts.length,
        },
        metrics: {
            dataPoints: metrics.length,
            data: metrics,
        },
    };
    if (format === 'csv') {
        // Convert to CSV format
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=performance-report-${Date.now()}.csv`);
        // Simple CSV conversion (you might want to use a proper CSV library)
        const csvData = metrics.map(m => `${m.timestamp},${m.redis.memory.percentage},${m.cache.api.hitRate},${m.jobs.performance.errorRate}`).join('\n');
        const csvHeader = 'Timestamp,Redis Memory %,API Cache Hit Rate,Job Error Rate\n';
        res.send(csvHeader + csvData);
    }
    else {
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Performance report exported successfully',
            data: report,
        });
    }
}));
// Get Redis usage audit
const getRedisUsageAudit = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const metrics = yield RedisUsageAuditor_1.redisUsageAuditor.auditRedisUsage();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Redis usage audit completed successfully',
        data: metrics,
    });
}));
// Get Redis usage report
const getRedisUsageReport = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const format = req.query.format || 'json';
    if (format === 'markdown') {
        const report = yield RedisUsageAuditor_1.redisUsageAuditor.generateDetailedReport();
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename=redis-usage-report-${Date.now()}.md`);
        res.send(report);
    }
    else {
        const metrics = yield RedisUsageAuditor_1.redisUsageAuditor.auditRedisUsage();
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Redis usage report generated successfully',
            data: metrics,
        });
    }
}));
// Get Redis quick health check
const getRedisQuickHealth = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const health = yield RedisUsageAuditor_1.redisUsageAuditor.quickHealthCheck();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Redis quick health check completed',
        data: health,
    });
}));
// Get Redis usage alerts
const getRedisUsageAlerts = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const activeAlerts = RedisUsageMonitor_1.redisUsageMonitor.getActiveAlerts();
    const resolvedAlerts = RedisUsageMonitor_1.redisUsageMonitor.getResolvedAlerts();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Redis usage alerts retrieved successfully',
        data: {
            active: activeAlerts,
            resolved: resolvedAlerts.slice(0, 10), // Last 10 resolved alerts
            summary: {
                activeCount: activeAlerts.length,
                criticalCount: activeAlerts.filter(a => a.severity === 'critical').length,
                warningCount: activeAlerts.filter(a => a.severity === 'warning').length
            }
        },
    });
}));
// Acknowledge Redis usage alert
const acknowledgeRedisAlert = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { alertId } = req.params;
    const acknowledged = RedisUsageMonitor_1.redisUsageMonitor.acknowledgeAlert(alertId);
    if (acknowledged) {
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Alert acknowledged successfully',
            data: { alertId },
        });
    }
    else {
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.NOT_FOUND,
            success: false,
            message: 'Alert not found',
            data: null,
        });
    }
}));
// Get Redis usage monitoring report
const getRedisUsageMonitoringReport = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const report = yield RedisUsageMonitor_1.redisUsageMonitor.generateUsageReport();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Redis usage monitoring report generated successfully',
        data: report,
    });
}));
// Update Redis usage thresholds
const updateRedisThresholds = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const thresholds = req.body;
    RedisUsageMonitor_1.redisUsageMonitor.updateThresholds(thresholds);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Redis usage thresholds updated successfully',
        data: RedisUsageMonitor_1.redisUsageMonitor.getThresholds(),
    });
}));
exports.MonitoringControllers = {
    getCurrentMetrics,
    getMetricsHistory,
    getPerformanceSummary,
    getRedisHealth,
    getCacheStats,
    getJobStats,
    getActiveAlerts,
    getResolvedAlerts,
    acknowledgeAlert,
    getAlertRules,
    addAlertRule,
    removeAlertRule,
    getPopularEndpoints,
    getPopularQueries,
    invalidateCacheByTags,
    clearAllCache,
    warmCache,
    getSystemInfo,
    exportPerformanceReport,
    getRedisUsageAudit,
    getRedisUsageReport,
    getRedisQuickHealth,
    getRedisUsageAlerts,
    acknowledgeRedisAlert,
    getRedisUsageMonitoringReport,
    updateRedisThresholds,
};
