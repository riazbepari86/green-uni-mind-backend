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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisMonitoringService = void 0;
class RedisMonitoringService {
    constructor(redis) {
        this.redis = redis;
        this.operationMetrics = new Map();
        this.connectionMetrics = {
            totalConnections: 0,
            activeConnections: 0,
            failedConnections: 0,
            reconnections: 0,
            lastConnectionTime: new Date()
        };
        this.healthHistory = [];
        this.maxHistorySize = 100;
        this.startTime = new Date();
        this.setupRedisEventListeners();
        this.startPeriodicHealthCheck();
    }
    setupRedisEventListeners() {
        this.redis.on('connect', () => {
            this.connectionMetrics.totalConnections++;
            this.connectionMetrics.activeConnections++;
            this.connectionMetrics.lastConnectionTime = new Date();
        });
        this.redis.on('close', () => {
            this.connectionMetrics.activeConnections = Math.max(0, this.connectionMetrics.activeConnections - 1);
        });
        this.redis.on('error', () => {
            this.connectionMetrics.failedConnections++;
        });
        this.redis.on('reconnecting', () => {
            this.connectionMetrics.reconnections++;
        });
    }
    recordOperation(operation, duration, success) {
        const existing = this.operationMetrics.get(operation);
        if (existing) {
            existing.totalCalls++;
            existing.totalDuration += duration;
            existing.averageDuration = existing.totalDuration / existing.totalCalls;
            existing.minDuration = Math.min(existing.minDuration, duration);
            existing.maxDuration = Math.max(existing.maxDuration, duration);
            existing.lastExecuted = new Date();
            if (success) {
                existing.successfulCalls++;
            }
            else {
                existing.failedCalls++;
            }
        }
        else {
            this.operationMetrics.set(operation, {
                operation,
                totalCalls: 1,
                successfulCalls: success ? 1 : 0,
                failedCalls: success ? 0 : 1,
                totalDuration: duration,
                averageDuration: duration,
                minDuration: duration,
                maxDuration: duration,
                lastExecuted: new Date()
            });
        }
    }
    getOperationMetrics(operation) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.operationMetrics.get(operation) || null;
        });
    }
    getAllOperationMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            return Array.from(this.operationMetrics.values());
        });
    }
    getConnectionMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            return Object.assign({}, this.connectionMetrics);
        });
    }
    getMemoryUsage() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const info = yield this.redis.info('memory');
                const lines = info.split('\r\n');
                let used = 0;
                let peak = 0;
                let total = 0;
                for (const line of lines) {
                    if (line.startsWith('used_memory:')) {
                        used = parseInt(line.split(':')[1]);
                    }
                    else if (line.startsWith('used_memory_peak:')) {
                        peak = parseInt(line.split(':')[1]);
                    }
                    else if (line.startsWith('maxmemory:')) {
                        total = parseInt(line.split(':')[1]);
                    }
                }
                const percentage = total > 0 ? (used / total) * 100 : 0;
                return { used, peak, total, percentage };
            }
            catch (error) {
                console.error('Error getting Redis memory usage:', error);
                return { used: 0, peak: 0, total: 0, percentage: 0 };
            }
        });
    }
    healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            let status = 'healthy';
            let latency = 0;
            let errors = 0;
            try {
                // Test basic connectivity
                yield this.redis.ping();
                latency = Date.now() - startTime;
                // Get memory usage
                const memoryInfo = yield this.getMemoryUsage();
                // Determine health status based on metrics
                if (latency > 1000) { // > 1 second
                    status = 'unhealthy';
                }
                else if (latency > 500 || memoryInfo.percentage > 90) { // > 500ms or > 90% memory
                    status = 'degraded';
                }
                // Count recent errors
                const recentMetrics = Array.from(this.operationMetrics.values())
                    .filter(metric => Date.now() - metric.lastExecuted.getTime() < 60000); // Last minute
                errors = recentMetrics.reduce((sum, metric) => sum + metric.failedCalls, 0);
                if (errors > 10) { // More than 10 errors in the last minute
                    status = status === 'healthy' ? 'degraded' : 'unhealthy';
                }
                const healthStatus = {
                    status,
                    latency,
                    memoryUsage: memoryInfo.percentage,
                    connections: this.connectionMetrics.activeConnections,
                    errors,
                    uptime: Date.now() - this.startTime.getTime(),
                    lastCheck: new Date()
                };
                // Store in history
                this.healthHistory.push(healthStatus);
                if (this.healthHistory.length > this.maxHistorySize) {
                    this.healthHistory.shift();
                }
                return healthStatus;
            }
            catch (error) {
                const healthStatus = {
                    status: 'unhealthy',
                    latency: Date.now() - startTime,
                    memoryUsage: 0,
                    connections: 0,
                    errors: errors + 1,
                    uptime: Date.now() - this.startTime.getTime(),
                    lastCheck: new Date()
                };
                this.healthHistory.push(healthStatus);
                if (this.healthHistory.length > this.maxHistorySize) {
                    this.healthHistory.shift();
                }
                return healthStatus;
            }
        });
    }
    startPeriodicHealthCheck() {
        // Run health check every 30 seconds
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.healthCheck();
            }
            catch (error) {
                console.error('Error during periodic health check:', error);
            }
        }), 30000);
    }
    getHealthHistory() {
        return __awaiter(this, arguments, void 0, function* (limit = 10) {
            return this.healthHistory.slice(-limit);
        });
    }
    getPerformanceReport() {
        return __awaiter(this, void 0, void 0, function* () {
            const operations = Array.from(this.operationMetrics.values());
            const totalOperations = operations.reduce((sum, op) => sum + op.totalCalls, 0);
            const totalSuccessful = operations.reduce((sum, op) => sum + op.successfulCalls, 0);
            const totalDuration = operations.reduce((sum, op) => sum + op.totalDuration, 0);
            const successRate = totalOperations > 0 ? (totalSuccessful / totalOperations) * 100 : 100;
            const averageLatency = totalOperations > 0 ? totalDuration / totalOperations : 0;
            const currentHealth = yield this.healthCheck();
            // Calculate trends based on recent history
            const recentHistory = this.healthHistory.slice(-10);
            const trends = this.calculateTrends(recentHistory);
            return {
                overall: {
                    totalOperations,
                    successRate,
                    averageLatency,
                    uptime: Date.now() - this.startTime.getTime()
                },
                operations,
                connections: this.connectionMetrics,
                currentHealth,
                trends
            };
        });
    }
    calculateTrends(history) {
        if (history.length < 3) {
            return {
                latencyTrend: 'stable',
                errorTrend: 'stable',
                memoryTrend: 'stable'
            };
        }
        const recent = history.slice(-3);
        const older = history.slice(-6, -3);
        const avgRecentLatency = recent.reduce((sum, h) => sum + h.latency, 0) / recent.length;
        const avgOlderLatency = older.length > 0 ? older.reduce((sum, h) => sum + h.latency, 0) / older.length : avgRecentLatency;
        const avgRecentErrors = recent.reduce((sum, h) => sum + h.errors, 0) / recent.length;
        const avgOlderErrors = older.length > 0 ? older.reduce((sum, h) => sum + h.errors, 0) / older.length : avgRecentErrors;
        const avgRecentMemory = recent.reduce((sum, h) => sum + h.memoryUsage, 0) / recent.length;
        const avgOlderMemory = older.length > 0 ? older.reduce((sum, h) => sum + h.memoryUsage, 0) / older.length : avgRecentMemory;
        const latencyTrend = avgRecentLatency < avgOlderLatency * 0.9 ? 'improving' :
            avgRecentLatency > avgOlderLatency * 1.1 ? 'degrading' : 'stable';
        const errorTrend = avgRecentErrors < avgOlderErrors * 0.9 ? 'improving' :
            avgRecentErrors > avgOlderErrors * 1.1 ? 'degrading' : 'stable';
        const memoryTrend = avgRecentMemory < avgOlderMemory * 0.95 ? 'improving' :
            avgRecentMemory > avgOlderMemory * 1.05 ? 'degrading' : 'stable';
        return { latencyTrend, errorTrend, memoryTrend };
    }
    // Reset all metrics (useful for testing or periodic cleanup)
    resetMetrics() {
        this.operationMetrics.clear();
        this.connectionMetrics = {
            totalConnections: 0,
            activeConnections: 0,
            failedConnections: 0,
            reconnections: 0,
            lastConnectionTime: new Date()
        };
        this.healthHistory = [];
        this.startTime = new Date();
    }
    // Export metrics for external monitoring systems
    exportMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            const operations = {};
            this.operationMetrics.forEach((metric, key) => {
                operations[key] = metric;
            });
            const health = yield this.healthCheck();
            return {
                timestamp: new Date().toISOString(),
                operations,
                connections: this.connectionMetrics,
                health,
                uptime: Date.now() - this.startTime.getTime()
            };
        });
    }
}
exports.RedisMonitoringService = RedisMonitoringService;
