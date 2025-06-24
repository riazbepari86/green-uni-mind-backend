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
const logger_1 = require("../../config/logger");
const redis_1 = require("../../config/redis");
const EnhancedCacheService_1 = __importDefault(require("../cache/EnhancedCacheService"));
class PerformanceMonitoringService {
    constructor() {
        this.METRICS_RETENTION_DAYS = 7;
        this.STATS_UPDATE_INTERVAL = 60000; // 1 minute
        this.metricsBuffer = [];
        this.startStatsUpdater();
    }
    /**
     * Express middleware to track performance metrics
     */
    trackPerformance() {
        return (req, res, next) => {
            const startTime = Date.now();
            const startMemory = process.memoryUsage().heapUsed;
            // Track database queries (simplified)
            let dbQueries = 0;
            const originalQuery = req.dbQuery;
            req.dbQuery = (...args) => {
                dbQueries++;
                return originalQuery === null || originalQuery === void 0 ? void 0 : originalQuery.apply(this, args);
            };
            // Override res.end to capture metrics
            const originalEnd = res.end.bind(res);
            res.end = function (chunk, encoding, cb) {
                var _a;
                const responseTime = Date.now() - startTime;
                const endMemory = process.memoryUsage().heapUsed;
                const memoryUsage = endMemory - startMemory;
                const user = req.user;
                const metrics = {
                    endpoint: ((_a = req.route) === null || _a === void 0 ? void 0 : _a.path) || req.path,
                    method: req.method,
                    responseTime,
                    statusCode: res.statusCode,
                    timestamp: new Date(),
                    userId: (user === null || user === void 0 ? void 0 : user.userId) || (user === null || user === void 0 ? void 0 : user.teacherId) || (user === null || user === void 0 ? void 0 : user.studentId),
                    userType: user === null || user === void 0 ? void 0 : user.role,
                    cacheHit: res.cacheHit || false,
                    dbQueries,
                    memoryUsage,
                };
                // Add to buffer for batch processing
                PerformanceMonitoringService.getInstance().addMetric(metrics);
                // Log slow requests
                if (responseTime > 1000) {
                    logger_1.Logger.warn(`🐌 Slow request detected: ${req.method} ${req.path} - ${responseTime}ms`, {
                        endpoint: req.path,
                        method: req.method,
                        responseTime,
                        statusCode: res.statusCode,
                        userId: metrics.userId,
                        dbQueries,
                    });
                }
                // Log errors
                if (res.statusCode >= 400) {
                    logger_1.Logger.error(`❌ Request error: ${req.method} ${req.path} - ${res.statusCode}`, {
                        endpoint: req.path,
                        method: req.method,
                        responseTime,
                        statusCode: res.statusCode,
                        userId: metrics.userId,
                    });
                }
                return originalEnd(chunk, encoding, cb);
            };
            next();
        };
    }
    /**
     * Add metric to buffer
     */
    addMetric(metric) {
        this.metricsBuffer.push(metric);
        // Flush buffer if it gets too large
        if (this.metricsBuffer.length >= 100) {
            this.flushMetrics();
        }
    }
    /**
     * Flush metrics buffer to storage
     */
    flushMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.metricsBuffer.length === 0)
                return;
            try {
                const metrics = [...this.metricsBuffer];
                this.metricsBuffer = [];
                // Store metrics in Redis with TTL
                const pipeline = redis_1.redisOperations.pipeline();
                const now = Date.now();
                for (const metric of metrics) {
                    const key = `metrics:${metric.endpoint}:${now}:${Math.random()}`;
                    pipeline.setex(key, this.METRICS_RETENTION_DAYS * 24 * 60 * 60, JSON.stringify(metric));
                }
                yield pipeline.exec();
                // Update endpoint statistics
                yield this.updateEndpointStats(metrics);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to flush performance metrics:', error);
            }
        });
    }
    /**
     * Update endpoint statistics
     */
    updateEndpointStats(metrics) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const endpointGroups = metrics.reduce((groups, metric) => {
                    const key = `${metric.method}:${metric.endpoint}`;
                    if (!groups[key]) {
                        groups[key] = [];
                    }
                    groups[key].push(metric);
                    return groups;
                }, {});
                for (const [endpointKey, endpointMetrics] of Object.entries(endpointGroups)) {
                    const stats = yield this.calculateEndpointStats(endpointKey, endpointMetrics);
                    yield EnhancedCacheService_1.default.set(`endpoint_stats:${endpointKey}`, stats, { ttl: 3600, namespace: 'performance' });
                }
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to update endpoint stats:', error);
            }
        });
    }
    /**
     * Calculate statistics for an endpoint
     */
    calculateEndpointStats(endpointKey, newMetrics) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get recent metrics from Redis
                const pattern = `metrics:${endpointKey.split(':')[1]}:*`;
                const keys = yield redis_1.redisOperations.keys(pattern);
                const recentMetrics = [];
                if (keys.length > 0) {
                    const values = yield redis_1.redisOperations.mget(keys);
                    for (const value of values) {
                        if (value) {
                            try {
                                recentMetrics.push(JSON.parse(value));
                            }
                            catch (error) {
                                // Skip invalid JSON
                            }
                        }
                    }
                }
                // Combine with new metrics
                const allMetrics = [...recentMetrics, ...newMetrics];
                if (allMetrics.length === 0) {
                    return {
                        totalRequests: 0,
                        averageResponseTime: 0,
                        p95ResponseTime: 0,
                        p99ResponseTime: 0,
                        errorRate: 0,
                        cacheHitRate: 0,
                        lastUpdated: new Date(),
                    };
                }
                // Calculate statistics
                const responseTimes = allMetrics.map(m => m.responseTime).sort((a, b) => a - b);
                const totalRequests = allMetrics.length;
                const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / totalRequests;
                const p95ResponseTime = responseTimes[Math.floor(totalRequests * 0.95)] || 0;
                const p99ResponseTime = responseTimes[Math.floor(totalRequests * 0.99)] || 0;
                const errorCount = allMetrics.filter(m => m.statusCode >= 400).length;
                const errorRate = (errorCount / totalRequests) * 100;
                const cacheHits = allMetrics.filter(m => m.cacheHit).length;
                const cacheHitRate = (cacheHits / totalRequests) * 100;
                return {
                    totalRequests,
                    averageResponseTime: Math.round(averageResponseTime),
                    p95ResponseTime,
                    p99ResponseTime,
                    errorRate: Math.round(errorRate * 100) / 100,
                    cacheHitRate: Math.round(cacheHitRate * 100) / 100,
                    lastUpdated: new Date(),
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to calculate endpoint stats:', error);
                return {
                    totalRequests: 0,
                    averageResponseTime: 0,
                    p95ResponseTime: 0,
                    p99ResponseTime: 0,
                    errorRate: 0,
                    cacheHitRate: 0,
                    lastUpdated: new Date(),
                };
            }
        });
    }
    /**
     * Get performance statistics for an endpoint
     */
    getEndpointStats(method, endpoint) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const key = `${method}:${endpoint}`;
                return yield EnhancedCacheService_1.default.get(`endpoint_stats:${key}`, { namespace: 'performance' });
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get endpoint stats:', error);
                return null;
            }
        });
    }
    /**
     * Get overall system performance metrics
     */
    getSystemMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get all endpoint stats
                const pattern = 'performance:endpoint_stats:*';
                const keys = yield redis_1.redisOperations.keys(pattern);
                const allStats = [];
                if (keys.length > 0) {
                    const values = yield redis_1.redisOperations.mget(keys);
                    for (const value of values) {
                        if (value) {
                            try {
                                allStats.push(JSON.parse(value));
                            }
                            catch (error) {
                                // Skip invalid JSON
                            }
                        }
                    }
                }
                if (allStats.length === 0) {
                    return {
                        totalRequests: 0,
                        averageResponseTime: 0,
                        errorRate: 0,
                        cacheHitRate: 0,
                        topSlowEndpoints: [],
                        topErrorEndpoints: [],
                    };
                }
                // Calculate overall metrics
                const totalRequests = allStats.reduce((sum, stat) => sum + stat.totalRequests, 0);
                const weightedResponseTime = allStats.reduce((sum, stat) => sum + (stat.averageResponseTime * stat.totalRequests), 0);
                const averageResponseTime = totalRequests > 0 ? weightedResponseTime / totalRequests : 0;
                const weightedErrorRate = allStats.reduce((sum, stat) => sum + (stat.errorRate * stat.totalRequests), 0);
                const errorRate = totalRequests > 0 ? weightedErrorRate / totalRequests : 0;
                const weightedCacheHitRate = allStats.reduce((sum, stat) => sum + (stat.cacheHitRate * stat.totalRequests), 0);
                const cacheHitRate = totalRequests > 0 ? weightedCacheHitRate / totalRequests : 0;
                // Get top slow endpoints
                const topSlowEndpoints = keys
                    .map((key, index) => {
                    var _a;
                    return ({
                        endpoint: key.replace('performance:endpoint_stats:', ''),
                        averageResponseTime: ((_a = allStats[index]) === null || _a === void 0 ? void 0 : _a.averageResponseTime) || 0,
                    });
                })
                    .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
                    .slice(0, 5);
                // Get top error endpoints
                const topErrorEndpoints = keys
                    .map((key, index) => {
                    var _a;
                    return ({
                        endpoint: key.replace('performance:endpoint_stats:', ''),
                        errorRate: ((_a = allStats[index]) === null || _a === void 0 ? void 0 : _a.errorRate) || 0,
                    });
                })
                    .filter(item => item.errorRate > 0)
                    .sort((a, b) => b.errorRate - a.errorRate)
                    .slice(0, 5);
                return {
                    totalRequests,
                    averageResponseTime: Math.round(averageResponseTime),
                    errorRate: Math.round(errorRate * 100) / 100,
                    cacheHitRate: Math.round(cacheHitRate * 100) / 100,
                    topSlowEndpoints,
                    topErrorEndpoints,
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get system metrics:', error);
                return {
                    totalRequests: 0,
                    averageResponseTime: 0,
                    errorRate: 0,
                    cacheHitRate: 0,
                    topSlowEndpoints: [],
                    topErrorEndpoints: [],
                };
            }
        });
    }
    /**
     * Start periodic stats updater
     */
    startStatsUpdater() {
        this.statsUpdateTimer = setInterval(() => {
            this.flushMetrics();
        }, this.STATS_UPDATE_INTERVAL);
    }
    /**
     * Stop stats updater
     */
    stopStatsUpdater() {
        if (this.statsUpdateTimer) {
            clearInterval(this.statsUpdateTimer);
            this.statsUpdateTimer = undefined;
        }
    }
    /**
     * Get performance statistics
     */
    getStats() {
        const total = this.metricsBuffer.length;
        const hitRate = total > 0 ? 100 : 0; // Simplified calculation
        return {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0,
            hitRate
        };
    }
    /**
     * Reset performance statistics
     */
    resetStats() {
        this.metricsBuffer = [];
    }
    static getInstance() {
        if (!PerformanceMonitoringService.instance) {
            PerformanceMonitoringService.instance = new PerformanceMonitoringService();
        }
        return PerformanceMonitoringService.instance;
    }
}
exports.default = PerformanceMonitoringService;
