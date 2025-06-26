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
exports.performanceDashboard = exports.PerformanceDashboard = void 0;
const RedisServiceManager_1 = require("../redis/RedisServiceManager");
const ApiCacheService_1 = require("../redis/ApiCacheService");
const QueryCacheService_1 = require("../redis/QueryCacheService");
const CacheInvalidationService_1 = require("../redis/CacheInvalidationService");
const JobQueueManager_1 = require("../jobs/JobQueueManager");
class PerformanceDashboard {
    constructor() {
        this.alertRules = new Map();
        this.activeAlerts = new Map();
        this.metricsHistory = [];
        this.maxHistorySize = 1440; // 24 hours of minute-by-minute data
        this.redis = RedisServiceManager_1.redisServiceManager.primaryClient;
        this.apiCache = new ApiCacheService_1.ApiCacheService(RedisServiceManager_1.redisServiceManager.cacheClient, RedisServiceManager_1.redisServiceManager.monitoring);
        this.queryCache = new QueryCacheService_1.QueryCacheService(RedisServiceManager_1.redisServiceManager.cacheClient, RedisServiceManager_1.redisServiceManager.monitoring);
        this.invalidationService = new CacheInvalidationService_1.CacheInvalidationService(RedisServiceManager_1.redisServiceManager.cacheClient, RedisServiceManager_1.redisServiceManager.monitoring);
        // DISABLED: Excessive Redis operations causing 121K+ ops/min
        console.log('📵 PerformanceDashboard disabled to prevent Redis overload');
        // Don't setup alert rules or start metrics collection
        // this.setupDefaultAlertRules();
        // this.startMetricsCollection();
    }
    setupDefaultAlertRules() {
        const defaultRules = [
            {
                name: 'High Redis Memory Usage',
                metric: 'redis.memory.percentage',
                threshold: 90,
                operator: 'gte',
                severity: 'high',
                enabled: true,
                cooldown: 15,
            },
            {
                name: 'Low Cache Hit Rate',
                metric: 'cache.api.hitRate',
                threshold: 50,
                operator: 'lt',
                severity: 'medium',
                enabled: true,
                cooldown: 30,
                // Only alert if we have meaningful traffic (at least 10 requests)
                condition: (metrics) => {
                    var _a, _b;
                    const totalRequests = ((_b = (_a = metrics.cache) === null || _a === void 0 ? void 0 : _a.api) === null || _b === void 0 ? void 0 : _b.totalRequests) || 0;
                    return totalRequests >= 10;
                },
            },
            {
                name: 'High Job Queue Failures',
                metric: 'jobs.performance.errorRate',
                threshold: 10,
                operator: 'gte',
                severity: 'high',
                enabled: true,
                cooldown: 10,
            },
            {
                name: 'Redis Connection Issues',
                metric: 'redis.connections.failed',
                threshold: 5,
                operator: 'gte',
                severity: 'critical',
                enabled: true,
                cooldown: 5,
            },
            {
                name: 'High Authentication Failures',
                metric: 'auth.failedLogins',
                threshold: 100,
                operator: 'gte',
                severity: 'medium',
                enabled: true,
                cooldown: 20,
            },
        ];
        defaultRules.forEach(rule => {
            this.alertRules.set(rule.name, rule);
        });
    }
    startMetricsCollection() {
        // DISABLED: Excessive Redis operations and storage consumption
        console.log('📵 Performance metrics collection disabled to prevent Redis overload');
        // Optional: Very basic metrics collection every 30 minutes (instead of every minute)
        // and store in memory only (not Redis)
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                // Only collect basic system metrics, no Redis operations
                const basicMetrics = {
                    timestamp: new Date().toISOString(),
                    system: {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        cpu: process.cpuUsage()
                    }
                };
                // Store only in memory, not Redis
                this.metricsHistory.push(basicMetrics);
                // Keep only the last 10 entries (much smaller)
                if (this.metricsHistory.length > 10) {
                    this.metricsHistory = this.metricsHistory.slice(-10);
                }
                console.log('📊 Basic system metrics collected (memory only)');
            }
            catch (error) {
                console.error('Error collecting basic metrics:', error);
            }
        }), 1800000); // Every 30 minutes instead of 1 minute
        console.log('📊 Minimal performance monitoring started (30min intervals, memory only)');
    }
    collectMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const timestamp = new Date().toISOString();
            // Collect Redis metrics
            const redisHealth = yield RedisServiceManager_1.redisServiceManager.healthCheck();
            const redisMemory = yield RedisServiceManager_1.redisServiceManager.monitoring.getMemoryUsage();
            const redisPerformance = yield RedisServiceManager_1.redisServiceManager.getPerformanceMetrics();
            // Collect cache metrics
            const apiCacheStats = yield this.apiCache.getApiCacheStats();
            const queryCacheStats = yield this.queryCache.getCacheStats();
            const invalidationMetrics = yield this.invalidationService.getInvalidationMetrics();
            // Collect job metrics
            const jobStats = yield JobQueueManager_1.jobQueueManager.getQueueStats();
            // Collect auth metrics
            const authMetrics = yield this.collectAuthMetrics();
            // Collect system metrics
            const systemMetrics = this.collectSystemMetrics();
            return {
                timestamp,
                redis: {
                    health: redisHealth,
                    memory: redisMemory,
                    connections: {
                        active: (typeof redisHealth === 'object' && redisHealth !== null && ((_b = (_a = redisHealth.clients) === null || _a === void 0 ? void 0 : _a.primary) === null || _b === void 0 ? void 0 : _b.connections)) || 0,
                        total: (typeof redisHealth === 'object' && redisHealth !== null && ((_d = (_c = redisHealth.clients) === null || _c === void 0 ? void 0 : _c.primary) === null || _d === void 0 ? void 0 : _d.totalConnections)) || 0,
                        failed: (typeof redisHealth === 'object' && redisHealth !== null && ((_f = (_e = redisHealth.clients) === null || _e === void 0 ? void 0 : _e.primary) === null || _f === void 0 ? void 0 : _f.failedConnections)) || 0,
                    },
                    operations: {
                        totalCommands: ((_g = redisPerformance.overall) === null || _g === void 0 ? void 0 : _g.totalOperations) || 0,
                        commandsPerSecond: yield this.calculateCommandsPerSecond(),
                        averageLatency: ((_h = redisPerformance.overall) === null || _h === void 0 ? void 0 : _h.averageLatency) || 0,
                    },
                },
                cache: {
                    api: Object.assign(Object.assign({}, apiCacheStats), { averageResponseTime: yield this.calculateAverageResponseTime() }),
                    query: Object.assign(Object.assign({}, queryCacheStats), { popularQueries: yield this.queryCache.getPopularQueries(5) }),
                    invalidation: Object.assign(Object.assign({}, invalidationMetrics), { topRules: Object.entries(invalidationMetrics.ruleMetrics)
                            .sort(([, a], [, b]) => b.count - a.count)
                            .slice(0, 5)
                            .map(([name, metrics]) => (Object.assign({ name }, metrics))) }),
                },
                jobs: {
                    queues: {
                        default: {
                            waiting: jobStats.waitingJobs,
                            active: jobStats.activeJobs,
                            completed: jobStats.completedJobs,
                            failed: jobStats.failedJobs,
                            delayed: jobStats.delayedJobs,
                        }
                    },
                    workers: {},
                    performance: {
                        averageProcessingTime: yield this.calculateJobProcessingTime(),
                        throughputPerMinute: yield this.calculateJobThroughput(),
                        errorRate: yield this.calculateJobErrorRate(),
                    },
                },
                auth: authMetrics,
                system: systemMetrics,
            };
        });
    }
    collectAuthMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get auth-related metrics from Redis
                const [activeSessions, totalLogins, failedLogins, blacklistedTokens] = yield Promise.all([
                    this.redis.get('auth:stats:active_sessions'),
                    this.redis.get('auth:stats:total_logins'),
                    this.redis.get('auth:stats:failed_logins'),
                    this.redis.get('auth:stats:blacklisted_tokens'),
                ]);
                return {
                    activeSessions: parseInt(activeSessions || '0'),
                    totalLogins: parseInt(totalLogins || '0'),
                    failedLogins: parseInt(failedLogins || '0'),
                    blacklistedTokens: parseInt(blacklistedTokens || '0'),
                    averageSessionDuration: yield this.calculateAverageSessionDuration(),
                };
            }
            catch (error) {
                console.error('Error collecting auth metrics:', error);
                return {
                    activeSessions: 0,
                    totalLogins: 0,
                    failedLogins: 0,
                    blacklistedTokens: 0,
                    averageSessionDuration: 0,
                };
            }
        });
    }
    collectSystemMetrics() {
        return {
            uptime: process.uptime(),
            nodeVersion: process.version,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
        };
    }
    calculateCommandsPerSecond() {
        return __awaiter(this, void 0, void 0, function* () {
            // This would require tracking commands over time
            // For now, return a placeholder
            return 0;
        });
    }
    calculateAverageResponseTime() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const keys = yield this.redis.keys('metrics:api:*:response_times');
                if (keys.length === 0)
                    return 0;
                let totalTime = 0;
                let totalRequests = 0;
                for (const key of keys.slice(0, 10)) { // Sample first 10 endpoints
                    const times = yield this.redis.lrange(key, 0, -1);
                    const numericTimes = times.map(t => parseInt(t)).filter(t => !isNaN(t));
                    if (numericTimes.length > 0) {
                        totalTime += numericTimes.reduce((sum, time) => sum + time, 0);
                        totalRequests += numericTimes.length;
                    }
                }
                return totalRequests > 0 ? totalTime / totalRequests : 0;
            }
            catch (error) {
                console.error('Error calculating average response time:', error);
                return 0;
            }
        });
    }
    calculateJobProcessingTime() {
        return __awaiter(this, void 0, void 0, function* () {
            // This would require job metrics from BullMQ
            // For now, return a placeholder
            return 0;
        });
    }
    calculateJobThroughput() {
        return __awaiter(this, void 0, void 0, function* () {
            // This would require job completion tracking
            // For now, return a placeholder
            return 0;
        });
    }
    calculateJobErrorRate() {
        return __awaiter(this, void 0, void 0, function* () {
            // This would require job failure tracking
            // For now, return a placeholder
            return 0;
        });
    }
    calculateAverageSessionDuration() {
        return __awaiter(this, void 0, void 0, function* () {
            // This would require session duration tracking
            // For now, return a placeholder
            return 0;
        });
    }
    storeMetrics(metrics) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const key = `metrics:performance:${metrics.timestamp.slice(0, 16)}`; // Minute precision
                yield this.redis.setex(key, 86400 * 7, JSON.stringify(metrics)); // Keep for 7 days
            }
            catch (error) {
                console.error('Error storing metrics:', error);
            }
        });
    }
    checkAlertRules(metrics) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const [ruleName, rule] of this.alertRules) {
                if (!rule.enabled)
                    continue;
                try {
                    // Check optional condition first
                    if (rule.condition && !rule.condition(metrics)) {
                        continue; // Skip this rule if condition is not met
                    }
                    const value = this.getMetricValue(metrics, rule.metric);
                    const shouldAlert = this.evaluateCondition(value, rule.threshold, rule.operator);
                    if (shouldAlert) {
                        yield this.triggerAlert(rule, value);
                    }
                    else {
                        // Check if we should resolve an existing alert
                        const existingAlert = this.activeAlerts.get(ruleName);
                        if (existingAlert && !existingAlert.resolvedAt) {
                            yield this.resolveAlert(ruleName);
                        }
                    }
                }
                catch (error) {
                    console.error(`Error checking alert rule ${ruleName}:`, error);
                }
            }
        });
    }
    getMetricValue(metrics, metricPath) {
        const parts = metricPath.split('.');
        let value = metrics;
        for (const part of parts) {
            value = value === null || value === void 0 ? void 0 : value[part];
        }
        return typeof value === 'number' ? value : 0;
    }
    evaluateCondition(value, threshold, operator) {
        switch (operator) {
            case 'gt': return value > threshold;
            case 'gte': return value >= threshold;
            case 'lt': return value < threshold;
            case 'lte': return value <= threshold;
            case 'eq': return value === threshold;
            default: return false;
        }
    }
    triggerAlert(rule, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingAlert = this.activeAlerts.get(rule.name);
            // Check cooldown period
            if (existingAlert && !existingAlert.resolvedAt) {
                const timeSinceAlert = Date.now() - new Date(existingAlert.timestamp).getTime();
                if (timeSinceAlert < rule.cooldown * 60 * 1000) {
                    return; // Still in cooldown
                }
            }
            const alert = {
                id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                rule: rule.name,
                severity: rule.severity,
                message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`,
                value,
                threshold: rule.threshold,
                timestamp: new Date().toISOString(),
                acknowledged: false,
            };
            this.activeAlerts.set(rule.name, alert);
            // Store alert in Redis
            yield this.redis.lpush('alerts:active', JSON.stringify(alert));
            yield this.redis.ltrim('alerts:active', 0, 99); // Keep last 100 alerts
            console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
            // Here you could integrate with external alerting systems
            // await this.sendToSlack(alert);
            // await this.sendEmail(alert);
        });
    }
    resolveAlert(ruleName) {
        return __awaiter(this, void 0, void 0, function* () {
            const alert = this.activeAlerts.get(ruleName);
            if (alert) {
                alert.resolvedAt = new Date().toISOString();
                // Store resolved alert
                yield this.redis.lpush('alerts:resolved', JSON.stringify(alert));
                yield this.redis.ltrim('alerts:resolved', 0, 99);
                console.log(`✅ RESOLVED: ${alert.message}`);
            }
        });
    }
    // Public API methods
    getCurrentMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.collectMetrics();
        });
    }
    getMetricsHistory() {
        return __awaiter(this, arguments, void 0, function* (hours = 24) {
            const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
            return this.metricsHistory.filter(m => new Date(m.timestamp) >= cutoff);
        });
    }
    getActiveAlerts() {
        return __awaiter(this, void 0, void 0, function* () {
            return Array.from(this.activeAlerts.values()).filter(a => !a.resolvedAt);
        });
    }
    getResolvedAlerts() {
        return __awaiter(this, arguments, void 0, function* (limit = 50) {
            try {
                const alerts = yield this.redis.lrange('alerts:resolved', 0, limit - 1);
                return alerts.map(a => JSON.parse(a));
            }
            catch (error) {
                console.error('Error getting resolved alerts:', error);
                return [];
            }
        });
    }
    acknowledgeAlert(alertId) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const alert of this.activeAlerts.values()) {
                if (alert.id === alertId) {
                    alert.acknowledged = true;
                    break;
                }
            }
        });
    }
    addAlertRule(rule) {
        this.alertRules.set(rule.name, rule);
    }
    removeAlertRule(name) {
        this.alertRules.delete(name);
    }
    getAlertRules() {
        return Array.from(this.alertRules.values());
    }
    getPerformanceSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const metrics = yield this.getCurrentMetrics();
            // Calculate performance scores (0-100)
            const redisScore = this.calculateRedisScore(metrics.redis);
            const cacheScore = this.calculateCacheScore(metrics.cache);
            const jobsScore = this.calculateJobsScore(metrics.jobs);
            const authScore = this.calculateAuthScore(metrics.auth);
            const overallScore = (redisScore + cacheScore + jobsScore + authScore) / 4;
            let overall;
            if (overallScore >= 90)
                overall = 'excellent';
            else if (overallScore >= 75)
                overall = 'good';
            else if (overallScore >= 60)
                overall = 'fair';
            else
                overall = 'poor';
            const recommendations = this.generateRecommendations(metrics);
            return {
                overall,
                scores: {
                    redis: redisScore,
                    cache: cacheScore,
                    jobs: jobsScore,
                    auth: authScore,
                },
                recommendations,
            };
        });
    }
    calculateRedisScore(redis) {
        let score = 100;
        // Deduct points for high memory usage
        if (redis.memory.percentage > 90)
            score -= 30;
        else if (redis.memory.percentage > 80)
            score -= 15;
        else if (redis.memory.percentage > 70)
            score -= 5;
        // Deduct points for connection issues
        if (redis.connections.failed > 0)
            score -= 20;
        // Deduct points for high latency
        if (redis.operations.averageLatency > 100)
            score -= 15;
        else if (redis.operations.averageLatency > 50)
            score -= 5;
        return Math.max(0, score);
    }
    calculateCacheScore(cache) {
        let score = 100;
        // Deduct points for low hit rates
        if (cache.api.hitRate < 50)
            score -= 30;
        else if (cache.api.hitRate < 70)
            score -= 15;
        else if (cache.api.hitRate < 85)
            score -= 5;
        if (cache.query.hitRate < 60)
            score -= 20;
        else if (cache.query.hitRate < 80)
            score -= 10;
        return Math.max(0, score);
    }
    calculateJobsScore(jobs) {
        let score = 100;
        // Deduct points for high error rates
        if (jobs.performance.errorRate > 10)
            score -= 40;
        else if (jobs.performance.errorRate > 5)
            score -= 20;
        else if (jobs.performance.errorRate > 1)
            score -= 10;
        // Deduct points for queue backlogs
        const totalWaiting = Object.values(jobs.queues).reduce((sum, queue) => sum + queue.waiting, 0);
        if (totalWaiting > 100)
            score -= 20;
        else if (totalWaiting > 50)
            score -= 10;
        return Math.max(0, score);
    }
    calculateAuthScore(auth) {
        let score = 100;
        // Deduct points for high failure rates
        const failureRate = auth.totalLogins > 0 ? (auth.failedLogins / auth.totalLogins) * 100 : 0;
        if (failureRate > 20)
            score -= 30;
        else if (failureRate > 10)
            score -= 15;
        else if (failureRate > 5)
            score -= 5;
        return Math.max(0, score);
    }
    generateRecommendations(metrics) {
        const recommendations = [];
        if (metrics.redis.memory.percentage > 80) {
            recommendations.push('Consider increasing Redis memory or implementing more aggressive cache eviction policies');
        }
        if (metrics.cache.api.hitRate < 70) {
            recommendations.push('Review API caching strategies and consider increasing cache TTL for stable endpoints');
        }
        if (metrics.jobs.performance.errorRate > 5) {
            recommendations.push('Investigate job failures and consider implementing better error handling and retry mechanisms');
        }
        if (metrics.auth.failedLogins > metrics.auth.totalLogins * 0.1) {
            recommendations.push('High authentication failure rate detected - consider implementing additional security measures');
        }
        return recommendations;
    }
}
exports.PerformanceDashboard = PerformanceDashboard;
// Export singleton instance
exports.performanceDashboard = new PerformanceDashboard();
