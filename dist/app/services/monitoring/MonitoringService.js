"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringService = void 0;
const logger_1 = require("../../config/logger");
const redis_1 = require("../../config/redis");
const events_1 = require("events");
class MonitoringService extends events_1.EventEmitter {
    constructor() {
        super();
        this.metrics = new Map();
        this.healthChecks = new Map();
        this.alerts = new Map();
        this.monitoringInterval = null;
        this.alertingInterval = null;
        this.METRIC_RETENTION_TIME = 24 * 60 * 60 * 1000; // 24 hours
        this.MONITORING_INTERVAL = 30000; // 30 seconds
        this.ALERTING_INTERVAL = 60000; // 1 minute
        this.MAX_METRICS_PER_NAME = 1000;
        this.startMonitoring();
        this.startAlerting();
        logger_1.Logger.info('📊 Monitoring Service initialized');
    }
    /**
     * Record a metric
     */
    recordMetric(metric) {
        const fullMetric = Object.assign(Object.assign({}, metric), { timestamp: new Date() });
        if (!this.metrics.has(metric.name)) {
            this.metrics.set(metric.name, []);
        }
        const metricArray = this.metrics.get(metric.name);
        metricArray.push(fullMetric);
        // Limit array size
        if (metricArray.length > this.MAX_METRICS_PER_NAME) {
            metricArray.shift();
        }
        this.emit('metric:recorded', fullMetric);
        logger_1.Logger.debug(`📊 Metric recorded: ${metric.name} = ${metric.value}`);
    }
    /**
     * Record multiple metrics at once
     */
    recordMetrics(metrics) {
        for (const metric of metrics) {
            this.recordMetric(metric);
        }
    }
    /**
     * Increment a counter metric
     */
    incrementCounter(name, value = 1, tags = {}) {
        this.recordMetric({
            name,
            value,
            tags,
            type: 'counter'
        });
    }
    /**
     * Set a gauge metric
     */
    setGauge(name, value, tags = {}) {
        this.recordMetric({
            name,
            value,
            tags,
            type: 'gauge'
        });
    }
    /**
     * Record a timer metric
     */
    recordTimer(name, duration, tags = {}) {
        this.recordMetric({
            name,
            value: duration,
            tags,
            type: 'timer'
        });
    }
    /**
     * Register a health check
     */
    registerHealthCheck(healthCheck) {
        this.healthChecks.set(healthCheck.name, healthCheck);
        this.emit('health:check_registered', healthCheck);
        if (healthCheck.status !== 'healthy') {
            this.createAlert({
                level: healthCheck.status === 'degraded' ? 'warning' : 'error',
                title: `Health Check Failed: ${healthCheck.name}`,
                message: healthCheck.message,
                source: 'health_check',
                metadata: { healthCheck }
            });
        }
    }
    /**
     * Get current health status
     */
    getHealthStatus() {
        const checks = Array.from(this.healthChecks.values());
        const unhealthyChecks = checks.filter(check => check.status === 'unhealthy');
        const degradedChecks = checks.filter(check => check.status === 'degraded');
        let overallStatus = 'healthy';
        if (unhealthyChecks.length > 0) {
            overallStatus = 'unhealthy';
        }
        else if (degradedChecks.length > 0) {
            overallStatus = 'degraded';
        }
        return { status: overallStatus, checks };
    }
    /**
     * Create an alert
     */
    createAlert(alert) {
        const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const fullAlert = Object.assign(Object.assign({}, alert), { id: alertId, timestamp: new Date(), resolved: false });
        this.alerts.set(alertId, fullAlert);
        this.emit('alert:created', fullAlert);
        logger_1.Logger.warn(`🚨 Alert created: ${alert.title} - ${alert.message}`);
        // Store in Redis for persistence
        this.persistAlert(fullAlert);
        return alertId;
    }
    /**
     * Resolve an alert
     */
    resolveAlert(alertId, resolution) {
        const alert = this.alerts.get(alertId);
        if (!alert || alert.resolved) {
            return false;
        }
        alert.resolved = true;
        alert.resolvedAt = new Date();
        if (resolution) {
            alert.metadata.resolution = resolution;
        }
        this.emit('alert:resolved', alert);
        logger_1.Logger.info(`✅ Alert resolved: ${alert.title}`);
        // Update in Redis
        this.persistAlert(alert);
        return true;
    }
    /**
     * Get system metrics
     */
    getSystemMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            const process = yield Promise.resolve().then(() => __importStar(require('process')));
            const os = yield Promise.resolve().then(() => __importStar(require('os')));
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            return {
                cpu: {
                    usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
                    loadAverage: os.loadavg()
                },
                memory: {
                    used: memUsage.heapUsed,
                    total: memUsage.heapTotal,
                    percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
                },
                connections: {
                    sse: this.getMetricValue('sse_connections_active') || 0,
                    polling: this.getMetricValue('polling_subscriptions_active') || 0,
                    database: this.getMetricValue('database_connections_active') || 0
                },
                performance: {
                    averageResponseTime: this.getAverageMetricValue('response_time') || 0,
                    requestsPerSecond: this.getMetricRate('requests_total') || 0,
                    errorRate: this.getMetricRate('errors_total') || 0
                },
                timestamp: new Date()
            };
        });
    }
    /**
     * Get metrics for a specific name
     */
    getMetrics(name, since) {
        const metrics = this.metrics.get(name) || [];
        if (since) {
            return metrics.filter(metric => metric.timestamp >= since);
        }
        return [...metrics];
    }
    /**
     * Get all active alerts
     */
    getActiveAlerts() {
        return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
    }
    /**
     * Get monitoring statistics
     */
    getMonitoringStats() {
        const totalMetrics = Array.from(this.metrics.values())
            .reduce((sum, metrics) => sum + metrics.length, 0);
        const activeAlerts = this.getActiveAlerts().length;
        const healthChecks = this.healthChecks.size;
        const unhealthyServices = Array.from(this.healthChecks.values())
            .filter(check => check.status === 'unhealthy').length;
        return {
            totalMetrics,
            activeAlerts,
            healthChecks,
            unhealthyServices
        };
    }
    /**
     * Private helper methods
     */
    getMetricValue(name) {
        const metrics = this.metrics.get(name);
        if (!metrics || metrics.length === 0) {
            return null;
        }
        return metrics[metrics.length - 1].value;
    }
    getAverageMetricValue(name, timeWindow = 300000) {
        const metrics = this.metrics.get(name);
        if (!metrics || metrics.length === 0) {
            return null;
        }
        const cutoff = new Date(Date.now() - timeWindow);
        const recentMetrics = metrics.filter(metric => metric.timestamp >= cutoff);
        if (recentMetrics.length === 0) {
            return null;
        }
        const sum = recentMetrics.reduce((total, metric) => total + metric.value, 0);
        return sum / recentMetrics.length;
    }
    getMetricRate(name, timeWindow = 60000) {
        const metrics = this.metrics.get(name);
        if (!metrics || metrics.length < 2) {
            return null;
        }
        const cutoff = new Date(Date.now() - timeWindow);
        const recentMetrics = metrics.filter(metric => metric.timestamp >= cutoff);
        if (recentMetrics.length < 2) {
            return null;
        }
        const firstMetric = recentMetrics[0];
        const lastMetric = recentMetrics[recentMetrics.length - 1];
        const timeDiff = lastMetric.timestamp.getTime() - firstMetric.timestamp.getTime();
        const valueDiff = lastMetric.value - firstMetric.value;
        return (valueDiff / timeDiff) * 1000; // Per second
    }
    persistAlert(alert) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield redis_1.redisOperations.setex(`alert:${alert.id}`, 7 * 24 * 60 * 60, // 7 days
                JSON.stringify(alert));
            }
            catch (error) {
                logger_1.Logger.error('Failed to persist alert to Redis:', error);
            }
        });
    }
    startMonitoring() {
        this.monitoringInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                // Collect system metrics
                const systemMetrics = yield this.getSystemMetrics();
                // Record system metrics
                this.setGauge('system_cpu_usage', systemMetrics.cpu.usage);
                this.setGauge('system_memory_usage', systemMetrics.memory.percentage);
                this.setGauge('system_memory_used', systemMetrics.memory.used);
                // Clean up old metrics
                this.cleanupOldMetrics();
                this.emit('monitoring:cycle_complete', systemMetrics);
            }
            catch (error) {
                logger_1.Logger.error('Monitoring cycle failed:', error);
            }
        }), this.MONITORING_INTERVAL);
    }
    startAlerting() {
        this.alertingInterval = setInterval(() => {
            this.checkAlertConditions();
        }, this.ALERTING_INTERVAL);
    }
    checkAlertConditions() {
        // Check for high error rates
        const errorRate = this.getMetricRate('errors_total');
        if (errorRate && errorRate > 10) { // More than 10 errors per second
            this.createAlert({
                level: 'error',
                title: 'High Error Rate',
                message: `Error rate is ${errorRate.toFixed(2)} errors/second`,
                source: 'monitoring',
                metadata: { errorRate }
            });
        }
        // Check for high memory usage
        const memoryUsage = this.getMetricValue('system_memory_usage');
        if (memoryUsage && memoryUsage > 90) {
            this.createAlert({
                level: 'warning',
                title: 'High Memory Usage',
                message: `Memory usage is ${memoryUsage.toFixed(1)}%`,
                source: 'monitoring',
                metadata: { memoryUsage }
            });
        }
    }
    cleanupOldMetrics() {
        const cutoff = new Date(Date.now() - this.METRIC_RETENTION_TIME);
        for (const [name, metrics] of this.metrics.entries()) {
            const filteredMetrics = metrics.filter(metric => metric.timestamp >= cutoff);
            this.metrics.set(name, filteredMetrics);
        }
    }
    /**
     * Shutdown monitoring service
     */
    shutdown() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.alertingInterval) {
            clearInterval(this.alertingInterval);
        }
        logger_1.Logger.info('📊 Monitoring Service shutdown complete');
    }
}
// Create singleton instance
const monitoringService = new MonitoringService();
exports.monitoringService = monitoringService;
exports.default = MonitoringService;
