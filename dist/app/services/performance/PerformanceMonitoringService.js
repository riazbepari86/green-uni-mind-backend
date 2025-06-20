"use strict";
/**
 * Performance Monitoring Service
 * Implements comprehensive performance tracking and optimization
 */
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
exports.performanceMonitoringService = void 0;
const logger_1 = require("../../config/logger");
const environment_1 = require("../../utils/environment");
const redis_1 = require("../../config/redis");
class PerformanceMonitoringService {
    constructor() {
        this.endpointMetrics = new Map();
        this.monitoringInterval = null;
        this.isMonitoring = false;
        this.metrics = this.initializeMetrics();
        this.databaseMetrics = this.initializeDatabaseMetrics();
        this.startMonitoring();
    }
    static getInstance() {
        if (!PerformanceMonitoringService.instance) {
            PerformanceMonitoringService.instance = new PerformanceMonitoringService();
        }
        return PerformanceMonitoringService.instance;
    }
    initializeMetrics() {
        return {
            requestCount: 0,
            averageResponseTime: 0,
            errorRate: 0,
            throughput: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            databaseQueryTime: 0,
            redisResponseTime: 0,
            timestamp: Date.now(),
        };
    }
    initializeDatabaseMetrics() {
        return {
            queryCount: 0,
            totalQueryTime: 0,
            averageQueryTime: 0,
            slowQueries: [],
        };
    }
    /**
     * Start performance monitoring
     */
    startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.collectSystemMetrics();
                yield this.persistMetrics();
                this.analyzePerformance();
            }
            catch (error) {
                logger_1.Logger.error('Performance monitoring error', { error });
            }
        }), 60000); // Collect metrics every minute
        logger_1.Logger.info('Performance monitoring started');
    }
    /**
     * Record API request metrics
     */
    recordRequest(method, path, responseTime, statusCode) {
        const key = `${method}:${path}`;
        const existing = this.endpointMetrics.get(key);
        const isError = statusCode >= 400;
        if (existing) {
            existing.count++;
            existing.totalTime += responseTime;
            existing.averageTime = existing.totalTime / existing.count;
            existing.minTime = Math.min(existing.minTime, responseTime);
            existing.maxTime = Math.max(existing.maxTime, responseTime);
            existing.lastAccessed = Date.now();
            if (isError)
                existing.errorCount++;
        }
        else {
            this.endpointMetrics.set(key, {
                path,
                method,
                count: 1,
                totalTime: responseTime,
                averageTime: responseTime,
                minTime: responseTime,
                maxTime: responseTime,
                errorCount: isError ? 1 : 0,
                lastAccessed: Date.now(),
            });
        }
        // Update global metrics
        this.metrics.requestCount++;
        this.updateAverageResponseTime(responseTime);
        if (isError) {
            this.updateErrorRate();
        }
    }
    /**
     * Record database query metrics
     */
    recordDatabaseQuery(query, duration) {
        this.databaseMetrics.queryCount++;
        this.databaseMetrics.totalQueryTime += duration;
        this.databaseMetrics.averageQueryTime =
            this.databaseMetrics.totalQueryTime / this.databaseMetrics.queryCount;
        // Track slow queries (> 1 second)
        if (duration > 1000) {
            this.databaseMetrics.slowQueries.push({
                query: query.substring(0, 200), // Truncate long queries
                duration,
                timestamp: Date.now(),
            });
            // Keep only last 50 slow queries
            if (this.databaseMetrics.slowQueries.length > 50) {
                this.databaseMetrics.slowQueries = this.databaseMetrics.slowQueries.slice(-50);
            }
            logger_1.Logger.warn('Slow database query detected', {
                query: query.substring(0, 100),
                duration,
            });
        }
        this.metrics.databaseQueryTime = this.databaseMetrics.averageQueryTime;
    }
    /**
     * Record Redis operation metrics
     */
    recordRedisOperation(operation, duration) {
        // Update Redis response time (moving average)
        const alpha = 0.1; // Smoothing factor
        this.metrics.redisResponseTime =
            (alpha * duration) + ((1 - alpha) * this.metrics.redisResponseTime);
        if (duration > 100) { // Log slow Redis operations (> 100ms)
            logger_1.Logger.warn('Slow Redis operation detected', {
                operation,
                duration,
            });
        }
    }
    /**
     * Collect system metrics
     */
    collectSystemMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Memory usage
                const memUsage = process.memoryUsage();
                this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
                // CPU usage (simplified)
                const cpuUsage = process.cpuUsage();
                this.metrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
                // Calculate throughput (requests per minute)
                const now = Date.now();
                const timeDiff = (now - this.metrics.timestamp) / 1000 / 60; // minutes
                if (timeDiff > 0) {
                    this.metrics.throughput = this.metrics.requestCount / timeDiff;
                }
                this.metrics.timestamp = now;
            }
            catch (error) {
                logger_1.Logger.error('Failed to collect system metrics', { error });
            }
        });
    }
    /**
     * Persist metrics to Redis for historical analysis
     */
    persistMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!environment_1.Environment.isProduction())
                return; // Only persist in production
            try {
                const timestamp = Date.now();
                const metricsKey = `performance:${timestamp}`;
                yield redis_1.redisOperations.setex(metricsKey, 3600, // 1 hour TTL
                JSON.stringify(Object.assign(Object.assign({}, this.metrics), { endpointMetrics: Array.from(this.endpointMetrics.entries()), databaseMetrics: this.databaseMetrics })));
                // Keep only last 24 hours of metrics
                const cutoffTime = timestamp - (24 * 60 * 60 * 1000);
                const keys = yield redis_1.redisOperations.keys('performance:*');
                const oldKeys = keys.filter(key => {
                    const keyTimestamp = parseInt(key.split(':')[1]);
                    return keyTimestamp < cutoffTime;
                });
                if (oldKeys.length > 0) {
                    yield redis_1.redisOperations.del(...oldKeys);
                }
            }
            catch (error) {
                logger_1.Logger.error('Failed to persist performance metrics', { error });
            }
        });
    }
    /**
     * Analyze performance and trigger alerts
     */
    analyzePerformance() {
        const alerts = [];
        // Check response time
        if (this.metrics.averageResponseTime > 2000) { // > 2 seconds
            alerts.push(`High average response time: ${this.metrics.averageResponseTime}ms`);
        }
        // Check error rate
        if (this.metrics.errorRate > 5) { // > 5%
            alerts.push(`High error rate: ${this.metrics.errorRate.toFixed(2)}%`);
        }
        // Check memory usage
        if (this.metrics.memoryUsage > 500) { // > 500MB
            alerts.push(`High memory usage: ${this.metrics.memoryUsage.toFixed(2)}MB`);
        }
        // Check database performance
        if (this.metrics.databaseQueryTime > 500) { // > 500ms
            alerts.push(`Slow database queries: ${this.metrics.databaseQueryTime.toFixed(2)}ms average`);
        }
        // Check Redis performance
        if (this.metrics.redisResponseTime > 50) { // > 50ms
            alerts.push(`Slow Redis operations: ${this.metrics.redisResponseTime.toFixed(2)}ms average`);
        }
        // Log alerts
        if (alerts.length > 0) {
            logger_1.Logger.warn('Performance alerts detected', { alerts });
        }
    }
    /**
     * Get current performance metrics
     */
    getMetrics() {
        return Object.assign({}, this.metrics);
    }
    /**
     * Get endpoint performance metrics
     */
    getEndpointMetrics() {
        return Array.from(this.endpointMetrics.values())
            .sort((a, b) => b.averageTime - a.averageTime); // Sort by average response time
    }
    /**
     * Get database performance metrics
     */
    getDatabaseMetrics() {
        return Object.assign({}, this.databaseMetrics);
    }
    /**
     * Get performance summary
     */
    getPerformanceSummary() {
        const endpoints = this.getEndpointMetrics();
        return {
            overall: this.getMetrics(),
            topSlowEndpoints: endpoints.slice(0, 10),
            topErrorEndpoints: endpoints
                .filter(e => e.errorCount > 0)
                .sort((a, b) => b.errorCount - a.errorCount)
                .slice(0, 10),
            slowQueries: this.databaseMetrics.slowQueries.slice(-10),
        };
    }
    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = this.initializeMetrics();
        this.endpointMetrics.clear();
        this.databaseMetrics = this.initializeDatabaseMetrics();
        logger_1.Logger.info('Performance metrics reset');
    }
    /**
     * Update average response time using exponential moving average
     */
    updateAverageResponseTime(responseTime) {
        const alpha = 0.1; // Smoothing factor
        this.metrics.averageResponseTime =
            (alpha * responseTime) + ((1 - alpha) * this.metrics.averageResponseTime);
    }
    /**
     * Update error rate
     */
    updateErrorRate() {
        const errorCount = Array.from(this.endpointMetrics.values())
            .reduce((sum, metric) => sum + metric.errorCount, 0);
        this.metrics.errorRate = (errorCount / this.metrics.requestCount) * 100;
    }
    /**
     * Cleanup and shutdown
     */
    cleanup() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        logger_1.Logger.info('Performance monitoring service cleaned up');
    }
}
// Export singleton instance
exports.performanceMonitoringService = PerformanceMonitoringService.getInstance();
