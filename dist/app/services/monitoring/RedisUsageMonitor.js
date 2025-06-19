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
exports.redisUsageMonitor = exports.RedisUsageMonitor = void 0;
const RedisUsageAuditor_1 = require("../redis/RedisUsageAuditor");
const FeatureToggleService_1 = require("../redis/FeatureToggleService");
const HybridStorageService_1 = require("../storage/HybridStorageService");
const SmartCacheService_1 = require("../cache/SmartCacheService");
class RedisUsageMonitor {
    constructor() {
        this.alerts = new Map();
        this.monitoringInterval = null;
        this.isMonitoring = false;
        this.lastOperationCount = 0;
        this.operationHistory = [];
        this.thresholds = {
            memory: {
                warning: 60, // 60% of free tier limit
                critical: 80 // 80% of free tier limit
            },
            keys: {
                warning: 8000, // 8K keys
                critical: 12000 // 12K keys
            },
            connections: {
                warning: 8, // 8 connections
                critical: 10 // 10 connections (close to typical limits)
            },
            operationsPerMinute: {
                warning: 1000, // 1K ops/min
                critical: 2000 // 2K ops/min
            }
        };
        // DISABLED: Excessive Redis monitoring causing 121K+ ops/min
        console.log('📵 RedisUsageMonitor disabled to prevent excessive Redis operations');
        // Don't start monitoring automatically
        // this.startMonitoring();
        // Listen to feature toggle changes
        FeatureToggleService_1.featureToggleService.onFeatureChange('performance_monitoring', (enabled) => {
            if (enabled) {
                console.log('⚠️ Performance monitoring requested but disabled to prevent Redis overload');
                // this.startMonitoring();
            }
            else {
                this.stopMonitoring();
            }
        });
    }
    startMonitoring() {
        if (this.isMonitoring)
            return;
        console.log('📊 Starting Redis usage monitoring...');
        this.isMonitoring = true;
        // Monitor every 2 minutes to reduce Redis operations
        this.monitoringInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            yield this.checkUsage();
        }), 120000); // 2 minutes instead of 30 seconds
        // Initial check after 10 seconds to let Redis connections stabilize
        setTimeout(() => {
            this.checkUsage();
        }, 10000);
    }
    stopMonitoring() {
        if (!this.isMonitoring)
            return;
        console.log('📊 Stopping Redis usage monitoring...');
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }
    checkUsage() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get current usage metrics
                const healthCheck = yield RedisUsageAuditor_1.redisUsageAuditor.quickHealthCheck();
                const auditMetrics = yield RedisUsageAuditor_1.redisUsageAuditor.auditRedisUsage();
                // Check memory usage
                this.checkMemoryUsage(auditMetrics.memoryUsage.percentage);
                // Check key count
                this.checkKeyCount(auditMetrics.totalKeys);
                // Check connection count
                this.checkConnectionCount(auditMetrics.connectionStats.activeConnections);
                // Check operation rate
                this.checkOperationRate(auditMetrics.operationCounts.total_commands_processed || 0);
                // Auto-resolve alerts if conditions improve
                this.autoResolveAlerts(auditMetrics);
                // Trigger automatic optimizations if needed
                yield this.triggerAutoOptimizations(healthCheck, auditMetrics);
            }
            catch (error) {
                console.error('Error in Redis usage monitoring:', error);
                // Create alert for monitoring failure
                this.createAlert({
                    type: 'operations',
                    severity: 'warning',
                    message: 'Redis monitoring failed - connection issues possible',
                    threshold: 0,
                    currentValue: 0
                });
            }
        });
    }
    checkMemoryUsage(percentage) {
        const alertId = 'memory-usage';
        if (percentage >= this.thresholds.memory.critical) {
            this.createAlert({
                type: 'memory',
                severity: 'critical',
                message: `Critical Redis memory usage: ${percentage.toFixed(1)}%`,
                threshold: this.thresholds.memory.critical,
                currentValue: percentage
            }, alertId);
        }
        else if (percentage >= this.thresholds.memory.warning) {
            this.createAlert({
                type: 'memory',
                severity: 'warning',
                message: `High Redis memory usage: ${percentage.toFixed(1)}%`,
                threshold: this.thresholds.memory.warning,
                currentValue: percentage
            }, alertId);
        }
        else {
            this.resolveAlert(alertId);
        }
    }
    checkKeyCount(keyCount) {
        const alertId = 'key-count';
        if (keyCount >= this.thresholds.keys.critical) {
            this.createAlert({
                type: 'keys',
                severity: 'critical',
                message: `Critical Redis key count: ${keyCount.toLocaleString()}`,
                threshold: this.thresholds.keys.critical,
                currentValue: keyCount
            }, alertId);
        }
        else if (keyCount >= this.thresholds.keys.warning) {
            this.createAlert({
                type: 'keys',
                severity: 'warning',
                message: `High Redis key count: ${keyCount.toLocaleString()}`,
                threshold: this.thresholds.keys.warning,
                currentValue: keyCount
            }, alertId);
        }
        else {
            this.resolveAlert(alertId);
        }
    }
    checkConnectionCount(connectionCount) {
        const alertId = 'connection-count';
        if (connectionCount >= this.thresholds.connections.critical) {
            this.createAlert({
                type: 'connections',
                severity: 'critical',
                message: `Critical Redis connection count: ${connectionCount}`,
                threshold: this.thresholds.connections.critical,
                currentValue: connectionCount
            }, alertId);
        }
        else if (connectionCount >= this.thresholds.connections.warning) {
            this.createAlert({
                type: 'connections',
                severity: 'warning',
                message: `High Redis connection count: ${connectionCount}`,
                threshold: this.thresholds.connections.warning,
                currentValue: connectionCount
            }, alertId);
        }
        else {
            this.resolveAlert(alertId);
        }
    }
    checkOperationRate(totalOperations) {
        const alertId = 'operation-rate';
        // Calculate operations per minute
        const currentOps = totalOperations - this.lastOperationCount;
        this.operationHistory.push(currentOps);
        // Keep only last 2 minutes of data (4 samples at 30s intervals)
        if (this.operationHistory.length > 4) {
            this.operationHistory.shift();
        }
        // Calculate average operations per minute
        const avgOpsPerMinute = this.operationHistory.length > 0
            ? (this.operationHistory.reduce((a, b) => a + b, 0) / this.operationHistory.length) * 2 // *2 for per minute
            : 0;
        this.lastOperationCount = totalOperations;
        if (avgOpsPerMinute >= this.thresholds.operationsPerMinute.critical) {
            this.createAlert({
                type: 'operations',
                severity: 'critical',
                message: `Critical Redis operation rate: ${avgOpsPerMinute.toFixed(0)} ops/min`,
                threshold: this.thresholds.operationsPerMinute.critical,
                currentValue: avgOpsPerMinute
            }, alertId);
        }
        else if (avgOpsPerMinute >= this.thresholds.operationsPerMinute.warning) {
            this.createAlert({
                type: 'operations',
                severity: 'warning',
                message: `High Redis operation rate: ${avgOpsPerMinute.toFixed(0)} ops/min`,
                threshold: this.thresholds.operationsPerMinute.warning,
                currentValue: avgOpsPerMinute
            }, alertId);
        }
        else {
            this.resolveAlert(alertId);
        }
    }
    createAlert(alertData, customId) {
        const alertId = customId || `${alertData.type}-${Date.now()}`;
        // Don't create duplicate alerts
        if (this.alerts.has(alertId)) {
            const existing = this.alerts.get(alertId);
            existing.currentValue = alertData.currentValue;
            existing.timestamp = new Date();
            return;
        }
        const alert = Object.assign(Object.assign({ id: alertId }, alertData), { timestamp: new Date(), acknowledged: false, autoResolved: false });
        this.alerts.set(alertId, alert);
        console.log(`🚨 Redis Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
        // Don't store alerts in Redis to reduce usage - keep in memory only
        // hybridStorageService.set(
        //   `alert:${alertId}`,
        //   alert,
        //   { ttl: 86400, priority: 'high' } // 24 hours
        // ).catch(error => {
        //   console.error('Error storing alert:', error);
        // });
    }
    resolveAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert && !alert.autoResolved) {
            alert.autoResolved = true;
            alert.timestamp = new Date();
            console.log(`✅ Redis Alert Resolved: ${alert.message}`);
            // Remove from active alerts after a delay
            setTimeout(() => {
                this.alerts.delete(alertId);
            }, 60000); // Remove after 1 minute
        }
    }
    autoResolveAlerts(metrics) {
        // Auto-resolve alerts when conditions improve
        for (const [alertId, alert] of this.alerts) {
            if (alert.autoResolved)
                continue;
            switch (alert.type) {
                case 'memory':
                    if (metrics.memoryUsage.percentage < this.thresholds.memory.warning) {
                        this.resolveAlert(alertId);
                    }
                    break;
                case 'keys':
                    if (metrics.totalKeys < this.thresholds.keys.warning) {
                        this.resolveAlert(alertId);
                    }
                    break;
                case 'connections':
                    if (metrics.connectionStats.activeConnections < this.thresholds.connections.warning) {
                        this.resolveAlert(alertId);
                    }
                    break;
            }
        }
    }
    triggerAutoOptimizations(healthCheck, metrics) {
        return __awaiter(this, void 0, void 0, function* () {
            // Trigger automatic optimizations based on usage
            if (healthCheck.status === 'critical') {
                console.log('🚨 Triggering emergency optimizations');
                // Enable aggressive mode
                FeatureToggleService_1.featureToggleService.setOptimizationMode('aggressive');
                // Clear non-critical caches
                yield SmartCacheService_1.smartCacheService.clearL1();
                // Clear memory cache
                HybridStorageService_1.hybridStorageService.clearMemory();
            }
            else if (healthCheck.status === 'warning') {
                console.log('⚠️ Triggering conservative optimizations');
                // Enable conservative mode
                FeatureToggleService_1.featureToggleService.setOptimizationMode('conservative');
            }
        });
    }
    // Public methods
    getActiveAlerts() {
        return Array.from(this.alerts.values()).filter(alert => !alert.autoResolved);
    }
    getResolvedAlerts() {
        return Array.from(this.alerts.values()).filter(alert => alert.autoResolved);
    }
    acknowledgeAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.acknowledged = true;
            console.log(`✅ Alert acknowledged: ${alertId}`);
            return true;
        }
        return false;
    }
    updateThresholds(newThresholds) {
        this.thresholds = Object.assign(Object.assign({}, this.thresholds), newThresholds);
        console.log('🔧 Redis usage thresholds updated:', newThresholds);
    }
    getThresholds() {
        return Object.assign({}, this.thresholds);
    }
    generateUsageReport() {
        return __awaiter(this, void 0, void 0, function* () {
            const currentUsage = yield RedisUsageAuditor_1.redisUsageAuditor.auditRedisUsage();
            const activeAlerts = this.getActiveAlerts();
            const resolvedAlerts = this.getResolvedAlerts();
            const alertCounts = {
                active: activeAlerts.length,
                resolved: resolvedAlerts.length,
                critical: activeAlerts.filter(a => a.severity === 'critical').length,
                warning: activeAlerts.filter(a => a.severity === 'warning').length
            };
            const recommendations = [
                ...currentUsage.recommendations,
                ...(alertCounts.critical > 0 ? ['🚨 Critical alerts detected - immediate action required'] : []),
                ...(alertCounts.warning > 2 ? ['⚠️ Multiple warnings - consider optimization'] : [])
            ];
            return {
                currentUsage,
                alerts: alertCounts,
                recommendations,
                optimizationStatus: FeatureToggleService_1.featureToggleService.generateOptimizationReport().currentMode
            };
        });
    }
    // Cleanup method
    cleanup() {
        this.stopMonitoring();
        this.alerts.clear();
        console.log('🧹 Redis usage monitor cleaned up');
    }
}
exports.RedisUsageMonitor = RedisUsageMonitor;
exports.redisUsageMonitor = new RedisUsageMonitor();
