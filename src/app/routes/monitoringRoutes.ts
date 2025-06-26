import { Router } from 'express';
import { monitoringService } from '../services/monitoring/MonitoringService';
import { resourceManagerService } from '../services/resource/ResourceManagerService';
import { circuitBreakerService } from '../services/resilience/CircuitBreakerService';
import { auditLogService } from '../services/audit/AuditLogService';
import { Logger } from '../config/logger';

const router = Router();

/**
 * Health check endpoint
 * GET /api/monitoring/health
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = monitoringService.getHealthStatus();
    const systemMetrics = await monitoringService.getSystemMetrics();
    
    // Perform additional health checks
    const resourceStats = resourceManagerService.getStats();
    
    const response = {
      status: healthStatus.status,
      timestamp: new Date(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        resources: {
          status: resourceStats.totalResources < 5000 ? 'healthy' : 'warning',
          totalResources: resourceStats.totalResources,
          memoryUsage: resourceStats.memoryUsage
        }
      },
      system: systemMetrics,
      checks: healthStatus.checks
    };

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    Logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date()
    });
  }
});

/**
 * Metrics endpoint
 * GET /api/monitoring/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { name, since } = req.query;
    const sinceDate = since ? new Date(since as string) : undefined;
    
    if (name) {
      const metrics = monitoringService.getMetrics(name as string, sinceDate);
      res.json({
        success: true,
        data: {
          name,
          metrics,
          count: metrics.length
        }
      });
    } else {
      const systemMetrics = await monitoringService.getSystemMetrics();
      const monitoringStats = monitoringService.getMonitoringStats();
      
      res.json({
        success: true,
        data: {
          system: systemMetrics,
          monitoring: monitoringStats,
          timestamp: new Date()
        }
      });
    }
  } catch (error) {
    Logger.error('Failed to get metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Alerts endpoint
 * GET /api/monitoring/alerts
 */
router.get('/alerts', (req, res) => {
  try {
    const { active } = req.query;
    
    let alerts;
    if (active === 'true') {
      alerts = monitoringService.getActiveAlerts();
    } else {
      // This would need to be implemented to get all alerts
      alerts = monitoringService.getActiveAlerts();
    }
    
    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        timestamp: new Date()
      }
    });
  } catch (error) {
    Logger.error('Failed to get alerts:', error);
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create alert endpoint
 * POST /api/monitoring/alerts
 */
router.post('/alerts', async (req: any, res: any) => {
  try {
    const { level, title, message, source, metadata = {} } = req.body;
    
    if (!level || !title || !message || !source) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'level, title, message, and source are required'
      });
    }
    
    const alertId = monitoringService.createAlert({
      level,
      title,
      message,
      source,
      metadata
    });
    
    res.status(201).json({
      success: true,
      data: {
        alertId,
        message: 'Alert created successfully'
      }
    });
  } catch (error) {
    Logger.error('Failed to create alert:', error);
    res.status(500).json({
      error: 'Failed to create alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Resolve alert endpoint
 * POST /api/monitoring/alerts/:alertId/resolve
 */
router.post('/alerts/:alertId/resolve', (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolution } = req.body;
    
    const resolved = monitoringService.resolveAlert(alertId, resolution);
    
    if (resolved) {
      res.json({
        success: true,
        message: 'Alert resolved successfully'
      });
    } else {
      res.status(404).json({
        error: 'Alert not found',
        message: 'Alert not found or already resolved'
      });
    }
  } catch (error) {
    Logger.error('Failed to resolve alert:', error);
    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Circuit breaker status endpoint
 * GET /api/monitoring/circuit-breakers
 */
router.get('/circuit-breakers', (req, res) => {
  try {
    const metrics = circuitBreakerService.getAllMetrics();
    
    res.json({
      success: true,
      data: {
        circuitBreakers: metrics,
        count: metrics.length,
        timestamp: new Date()
      }
    });
  } catch (error) {
    Logger.error('Failed to get circuit breaker metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve circuit breaker metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Reset circuit breaker endpoint
 * POST /api/monitoring/circuit-breakers/:name/reset
 */
router.post('/circuit-breakers/:name/reset', (req, res) => {
  try {
    const { name } = req.params;
    const success = circuitBreakerService.reset(name);
    
    if (success) {
      res.json({
        success: true,
        message: `Circuit breaker ${name} reset successfully`
      });
    } else {
      res.status(404).json({
        error: 'Circuit breaker not found',
        message: `Circuit breaker ${name} not found`
      });
    }
  } catch (error) {
    Logger.error('Failed to reset circuit breaker:', error);
    res.status(500).json({
      error: 'Failed to reset circuit breaker',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Resource manager status endpoint
 * GET /api/monitoring/resources
 */
router.get('/resources', (req, res) => {
  try {
    const stats = resourceManagerService.getStats();
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date()
      }
    });
  } catch (error) {
    Logger.error('Failed to get resource stats:', error);
    res.status(500).json({
      error: 'Failed to retrieve resource statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Audit logs endpoint
 * GET /api/monitoring/audit-logs
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const { service, action, userId, severity, success, limit = 100, offset = 0 } = req.query;
    
    const query = {
      service: service as string,
      action: action as string,
      userId: userId as string,
      severity: severity as string,
      success: success === 'true' ? true : success === 'false' ? false : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };
    
    const logs = await auditLogService.queryLogs(query);
    const stats = await auditLogService.getStats();
    
    res.json({
      success: true,
      data: {
        logs,
        stats,
        query,
        timestamp: new Date()
      }
    });
  } catch (error) {
    Logger.error('Failed to get audit logs:', error);
    res.status(500).json({
      error: 'Failed to retrieve audit logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Performance metrics endpoint
 * GET /api/monitoring/performance
 */
router.get('/performance', async (req, res) => {
  try {
    const systemMetrics = await monitoringService.getSystemMetrics();

    const performance = {
      system: {
        cpu: systemMetrics.cpu,
        memory: systemMetrics.memory,
        uptime: process.uptime()
      },
      realTime: {
        status: 'disabled',
        message: 'Real-time features have been disabled in favor of REST API patterns'
      },
      timestamp: new Date()
    };
    
    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    Logger.error('Failed to get performance metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
