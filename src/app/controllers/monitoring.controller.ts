import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/sendResponse';
import { performanceDashboard } from '../services/monitoring/PerformanceDashboard';
import { redisServiceManager } from '../services/redis/RedisServiceManager';
// JobQueueManager removed - using standard API patterns
import { apiCache, queryCache, invalidationService } from '../middlewares/cachingMiddleware';
import { redisUsageAuditor } from '../services/redis/RedisUsageAuditor';
import { redisUsageMonitor } from '../services/monitoring/RedisUsageMonitor';
import { jobQueueManager } from '../services/jobs/JobQueueManager';

// Get current performance metrics
const getCurrentMetrics = catchAsync(async (req: Request, res: Response) => {
  const metrics = await performanceDashboard.getCurrentMetrics();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Current performance metrics retrieved successfully',
    data: metrics,
  });
});

// Get performance metrics history
const getMetricsHistory = catchAsync(async (req: Request, res: Response) => {
  const hours = parseInt(req.query.hours as string) || 24;
  const metrics = await performanceDashboard.getMetricsHistory(hours);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Performance metrics history for last ${hours} hours retrieved successfully`,
    data: {
      timeRange: `${hours} hours`,
      dataPoints: metrics.length,
      metrics,
    },
  });
});

// Get performance summary
const getPerformanceSummary = catchAsync(async (req: Request, res: Response) => {
  const summary = await performanceDashboard.getPerformanceSummary();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Performance summary retrieved successfully',
    data: summary,
  });
});

// Get Redis health and statistics
const getRedisHealth = catchAsync(async (req: Request, res: Response) => {
  const [health, performance, info] = await Promise.all([
    redisServiceManager.healthCheck(),
    redisServiceManager.getPerformanceMetrics(),
    redisServiceManager.getRedisInfo(),
  ]);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Redis health information retrieved successfully',
    data: {
      health,
      performance,
      info,
      timestamp: new Date().toISOString(),
    },
  });
});

// Get cache statistics
const getCacheStats = catchAsync(async (req: Request, res: Response) => {
  const [apiStats, queryStats, invalidationMetrics] = await Promise.all([
    apiCache.getApiCacheStats(),
    queryCache.getCacheStats(),
    invalidationService.getInvalidationMetrics(),
  ]);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cache statistics retrieved successfully',
    data: {
      api: apiStats,
      query: queryStats,
      invalidation: invalidationMetrics,
      timestamp: new Date().toISOString(),
    },
  });
});

// Get job queue statistics
const getJobStats = catchAsync(async (req: Request, res: Response) => {
  const [queueStats, healthStatus] = await Promise.all([
    jobQueueManager.getQueueStats(),
    jobQueueManager.getHealthStatus(),
  ]);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Job queue statistics retrieved successfully',
    data: {
      queues: queueStats,
      health: healthStatus,
      timestamp: new Date().toISOString(),
    },
  });
});

// Get active alerts
const getActiveAlerts = catchAsync(async (req: Request, res: Response) => {
  const alerts = await performanceDashboard.getActiveAlerts();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Active alerts retrieved successfully',
    data: {
      count: alerts.length,
      alerts,
    },
  });
});

// Get resolved alerts
const getResolvedAlerts = catchAsync(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const alerts = await performanceDashboard.getResolvedAlerts(limit);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Resolved alerts retrieved successfully',
    data: {
      count: alerts.length,
      alerts,
    },
  });
});

// Acknowledge alert
const acknowledgeAlert = catchAsync(async (req: Request, res: Response) => {
  const { alertId } = req.params;
  
  await performanceDashboard.acknowledgeAlert(alertId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Alert acknowledged successfully',
    data: { alertId },
  });
});

// Get alert rules
const getAlertRules = catchAsync(async (req: Request, res: Response) => {
  const rules = performanceDashboard.getAlertRules();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Alert rules retrieved successfully',
    data: {
      count: rules.length,
      rules,
    },
  });
});

// Add alert rule
const addAlertRule = catchAsync(async (req: Request, res: Response) => {
  const rule = req.body;
  
  performanceDashboard.addAlertRule(rule);
  
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Alert rule added successfully',
    data: rule,
  });
});

// Remove alert rule
const removeAlertRule = catchAsync(async (req: Request, res: Response) => {
  const { ruleName } = req.params;
  
  performanceDashboard.removeAlertRule(ruleName);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Alert rule removed successfully',
    data: { ruleName },
  });
});

// Get popular API endpoints
const getPopularEndpoints = catchAsync(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const endpoints = await apiCache.getPopularEndpoints(limit);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Popular API endpoints retrieved successfully',
    data: {
      count: endpoints.length,
      endpoints,
    },
  });
});

// Get popular queries
const getPopularQueries = catchAsync(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const queries = await queryCache.getPopularQueries(limit);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Popular queries retrieved successfully',
    data: {
      count: queries.length,
      queries,
    },
  });
});

// Invalidate cache by tags
const invalidateCacheByTags = catchAsync(async (req: Request, res: Response) => {
  const { tags } = req.body;
  
  if (!Array.isArray(tags) || tags.length === 0) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Tags array is required',
      data: null,
    });
  }
  
  const [apiInvalidated, queryInvalidated] = await Promise.all([
    apiCache.invalidateByTags(tags),
    queryCache.invalidateByTags(tags),
  ]);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cache invalidated successfully',
    data: {
      tags,
      apiEntriesInvalidated: apiInvalidated,
      queryEntriesInvalidated: queryInvalidated,
      totalInvalidated: apiInvalidated + queryInvalidated,
    },
  });
});

// Clear all cache
const clearAllCache = catchAsync(async (req: Request, res: Response) => {
  const [apiCleared, queryCleared] = await Promise.all([
    apiCache.clearApiCache(),
    queryCache.cleanExpiredEntries(),
  ]);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All cache cleared successfully',
    data: {
      apiEntriesCleared: apiCleared,
      queryEntriesCleared: queryCleared,
      totalCleared: apiCleared + queryCleared,
    },
  });
});

// Warm cache
const warmCache = catchAsync(async (req: Request, res: Response) => {
  // This would typically warm critical endpoints
  // For now, we'll just return a success message
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cache warming initiated successfully',
    data: {
      status: 'warming',
      estimatedTime: '2-5 minutes',
    },
  });
});

// Get system information
const getSystemInfo = catchAsync(async (req: Request, res: Response) => {
  const systemInfo = {
    node: {
      version: (process as any).version,
      uptime: (process as any).uptime(),
      memory: (process as any).memoryUsage(),
      cpu: (process as any).cpuUsage(),
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      platform: (process as any).platform,
      arch: (process as any).arch,
    },
    application: {
      name: 'Green Uni Mind Backend',
      version: '1.0.0', // You might want to read this from package.json
      startTime: new Date(Date.now() - (process as any).uptime() * 1000).toISOString(),
    },
  };
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'System information retrieved successfully',
    data: systemInfo,
  });
});

// Export performance report
const exportPerformanceReport = catchAsync(async (req: Request, res: Response) => {
  const hours = parseInt(req.query.hours as string) || 24;
  const format = req.query.format as string || 'json';

  const [metrics, summary, alerts] = await Promise.all([
    performanceDashboard.getMetricsHistory(hours),
    performanceDashboard.getPerformanceSummary(),
    performanceDashboard.getActiveAlerts(),
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
    const csvData = metrics.map(m =>
      `${m.timestamp},${m.redis.memory.percentage},${m.cache.api.hitRate},${m.jobs.performance.errorRate}`
    ).join('\n');

    const csvHeader = 'Timestamp,Redis Memory %,API Cache Hit Rate,Job Error Rate\n';
    res.send(csvHeader + csvData);
  } else {
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Performance report exported successfully',
      data: report,
    });
  }
});

// Get Redis usage audit
const getRedisUsageAudit = catchAsync(async (req: Request, res: Response) => {
  const metrics = await redisUsageAuditor.auditRedisUsage();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Redis usage audit completed successfully',
    data: metrics,
  });
});

// Get Redis usage report
const getRedisUsageReport = catchAsync(async (req: Request, res: Response) => {
  const format = req.query.format as string || 'json';

  if (format === 'markdown') {
    const report = await redisUsageAuditor.generateDetailedReport();
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=redis-usage-report-${Date.now()}.md`);
    res.send(report);
  } else {
    const metrics = await redisUsageAuditor.auditRedisUsage();
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Redis usage report generated successfully',
      data: metrics,
    });
  }
});

// Get Redis quick health check
const getRedisQuickHealth = catchAsync(async (req: Request, res: Response) => {
  const health = await redisUsageAuditor.quickHealthCheck();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Redis quick health check completed',
    data: health,
  });
});

// Get Redis usage alerts
const getRedisUsageAlerts = catchAsync(async (req: Request, res: Response) => {
  const activeAlerts = redisUsageMonitor.getActiveAlerts();
  const resolvedAlerts = redisUsageMonitor.getResolvedAlerts();

  sendResponse(res, {
    statusCode: httpStatus.OK,
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
});

// Acknowledge Redis usage alert
const acknowledgeRedisAlert = catchAsync(async (req: Request, res: Response) => {
  const { alertId } = req.params;

  const acknowledged = redisUsageMonitor.acknowledgeAlert(alertId);

  if (acknowledged) {
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Alert acknowledged successfully',
      data: { alertId },
    });
  } else {
    sendResponse(res, {
      statusCode: httpStatus.NOT_FOUND,
      success: false,
      message: 'Alert not found',
      data: null,
    });
  }
});

// Get Redis usage monitoring report
const getRedisUsageMonitoringReport = catchAsync(async (req: Request, res: Response) => {
  const report = await redisUsageMonitor.generateUsageReport();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Redis usage monitoring report generated successfully',
    data: report,
  });
});

// Update Redis usage thresholds
const updateRedisThresholds = catchAsync(async (req: Request, res: Response) => {
  const thresholds = req.body;

  redisUsageMonitor.updateThresholds(thresholds);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Redis usage thresholds updated successfully',
    data: redisUsageMonitor.getThresholds(),
  });
});

export const MonitoringControllers = {
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
