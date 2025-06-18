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
exports.redisOptimizationManager = exports.RedisOptimizationManager = void 0;
const RedisUsageAuditor_1 = require("./RedisUsageAuditor");
const RedisUsageMonitor_1 = require("../monitoring/RedisUsageMonitor");
const FeatureToggleService_1 = require("./FeatureToggleService");
const SmartCacheService_1 = require("../cache/SmartCacheService");
const HybridStorageService_1 = require("../storage/HybridStorageService");
const OptimizedAuthCacheService_1 = require("../auth/OptimizedAuthCacheService");
const BatchOperationsService_1 = require("./BatchOperationsService");
const RedisOptimizationService_1 = require("./RedisOptimizationService");
const OptimizedRedisService_1 = require("./OptimizedRedisService");
class RedisOptimizationManager {
    constructor() {
        this.isInitialized = false;
        this.optimizationInterval = null;
    }
    static getInstance() {
        if (!RedisOptimizationManager.instance) {
            RedisOptimizationManager.instance = new RedisOptimizationManager();
        }
        return RedisOptimizationManager.instance;
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isInitialized)
                return;
            console.log('🚀 Initializing Redis Optimization Manager...');
            try {
                // Initialize all services
                yield this.initializeServices();
                // Start monitoring and optimization
                this.startOptimizationLoop();
                // Perform initial optimization
                yield this.performInitialOptimization();
                this.isInitialized = true;
                console.log('✅ Redis Optimization Manager initialized successfully');
            }
            catch (error) {
                console.error('❌ Failed to initialize Redis Optimization Manager:', error);
                throw error;
            }
        });
    }
    initializeServices() {
        return __awaiter(this, void 0, void 0, function* () {
            // Services are already initialized via their constructors
            // This method can be used for any additional setup
            console.log('🔧 All optimization services initialized');
        });
    }
    startOptimizationLoop() {
        // Run optimization checks every 2 minutes
        this.optimizationInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            yield this.performOptimizationCheck();
        }), 120000);
        console.log('📊 Optimization monitoring loop started');
    }
    performInitialOptimization() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔧 Performing initial Redis optimization...');
            try {
                // Get current usage
                const healthCheck = yield RedisUsageAuditor_1.redisUsageAuditor.quickHealthCheck();
                // Set initial optimization mode based on current usage
                if (healthCheck.memoryPercentage > 70) {
                    FeatureToggleService_1.featureToggleService.setOptimizationMode('conservative');
                    console.log('⚠️ High initial Redis usage - starting in conservative mode');
                }
                else if (healthCheck.memoryPercentage > 85) {
                    FeatureToggleService_1.featureToggleService.setOptimizationMode('aggressive');
                    console.log('🚨 Critical initial Redis usage - starting in aggressive mode');
                }
                else {
                    FeatureToggleService_1.featureToggleService.setOptimizationMode('normal');
                    console.log('✅ Normal initial Redis usage - starting in normal mode');
                }
                // Warm critical caches
                yield HybridStorageService_1.hybridStorageService.warmCriticalData();
                // Configure batch operations for optimal performance
                BatchOperationsService_1.batchOperationsService.updateConfig({
                    maxBatchSize: healthCheck.memoryPercentage > 70 ? 50 : 100,
                    batchTimeout: healthCheck.memoryPercentage > 70 ? 100 : 50,
                    enableCompression: true,
                    priorityQueues: true
                });
            }
            catch (error) {
                console.error('❌ Error in initial optimization:', error);
            }
        });
    }
    performOptimizationCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get current metrics
                const healthCheck = yield RedisUsageAuditor_1.redisUsageAuditor.quickHealthCheck();
                const activeAlerts = RedisUsageMonitor_1.redisUsageMonitor.getActiveAlerts();
                // Auto-optimize based on current state
                yield this.autoOptimize(healthCheck, activeAlerts);
                // Log optimization status
                console.log(`📊 Optimization check: ${healthCheck.status} (${healthCheck.memoryPercentage.toFixed(1)}% memory, ${activeAlerts.length} alerts)`);
            }
            catch (error) {
                console.error('❌ Error in optimization check:', error);
            }
        });
    }
    autoOptimize(healthCheck, alerts) {
        return __awaiter(this, void 0, void 0, function* () {
            const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
            const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
            // Determine optimization strategy
            if (healthCheck.status === 'critical' || criticalAlerts > 0) {
                yield this.enableEmergencyOptimization();
            }
            else if (healthCheck.status === 'warning' || warningAlerts > 2) {
                yield this.enableConservativeOptimization();
            }
            else if (healthCheck.memoryPercentage < 40 && alerts.length === 0) {
                yield this.enableNormalOptimization();
            }
        });
    }
    enableEmergencyOptimization() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🚨 Enabling emergency optimization');
            // Set aggressive mode
            FeatureToggleService_1.featureToggleService.setOptimizationMode('aggressive');
            // Clear non-critical caches
            yield SmartCacheService_1.smartCacheService.clearL1();
            HybridStorageService_1.hybridStorageService.clearMemory();
            // Reduce batch sizes
            BatchOperationsService_1.batchOperationsService.updateConfig({
                maxBatchSize: 25,
                batchTimeout: 200,
                enableCompression: true
            });
            // Update circuit breaker settings for faster failure
            RedisOptimizationService_1.redisOptimizationService.updateConfig({
                circuitBreakerThreshold: 3,
                circuitBreakerTimeout: 60000
            });
        });
    }
    enableConservativeOptimization() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('⚠️ Enabling conservative optimization');
            // Set conservative mode
            FeatureToggleService_1.featureToggleService.setOptimizationMode('conservative');
            // Optimize batch operations
            BatchOperationsService_1.batchOperationsService.updateConfig({
                maxBatchSize: 50,
                batchTimeout: 100,
                enableCompression: true
            });
        });
    }
    enableNormalOptimization() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('✅ Enabling normal optimization');
            // Set normal mode
            FeatureToggleService_1.featureToggleService.setOptimizationMode('normal');
            // Optimize batch operations for performance
            BatchOperationsService_1.batchOperationsService.updateConfig({
                maxBatchSize: 100,
                batchTimeout: 50,
                enableCompression: false
            });
        });
    }
    // Generate comprehensive optimization report
    generateOptimizationReport() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [healthCheck, usageMetrics, activeAlerts, featureReport, cacheStats, batchStats, authStats] = yield Promise.all([
                    RedisUsageAuditor_1.redisUsageAuditor.quickHealthCheck(),
                    RedisUsageAuditor_1.redisUsageAuditor.auditRedisUsage(),
                    RedisUsageMonitor_1.redisUsageMonitor.getActiveAlerts(),
                    FeatureToggleService_1.featureToggleService.generateOptimizationReport(),
                    SmartCacheService_1.smartCacheService.getStats(),
                    BatchOperationsService_1.batchOperationsService.getStats(),
                    OptimizedAuthCacheService_1.optimizedAuthCacheService.getStats()
                ]);
                const report = {
                    timestamp: new Date().toISOString(),
                    redisUsage: {
                        memoryPercentage: healthCheck.memoryPercentage,
                        totalKeys: healthCheck.totalKeys,
                        connectionCount: usageMetrics.connectionStats.activeConnections,
                        status: healthCheck.status
                    },
                    optimizations: {
                        mode: featureReport.currentMode,
                        enabledFeatures: featureReport.enabledFeatures,
                        disabledFeatures: featureReport.disabledFeatures,
                        cacheHitRate: cacheStats.total.hitRate,
                        batchOperationsQueued: batchStats.queueSize
                    },
                    recommendations: [
                        ...usageMetrics.recommendations,
                        ...featureReport.recommendations,
                        ...(healthCheck.status === 'critical' ? ['🚨 Immediate action required - Redis usage critical'] : []),
                        ...(activeAlerts.length > 3 ? ['⚠️ Multiple alerts active - review optimization settings'] : [])
                    ],
                    alerts: {
                        active: activeAlerts.length,
                        critical: activeAlerts.filter(a => a.severity === 'critical').length,
                        warning: activeAlerts.filter(a => a.severity === 'warning').length
                    },
                    performance: {
                        connectionOptimization: 'Single client with prefixes (2 connections total)',
                        cachingStrategy: 'L1 (Memory) + L2 (Redis) hybrid with smart TTL',
                        storageStrategy: 'Redis + Memory + MongoDB fallback'
                    }
                };
                return report;
            }
            catch (error) {
                console.error('❌ Error generating optimization report:', error);
                throw error;
            }
        });
    }
    // Manual optimization trigger
    triggerOptimization(mode) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`🔧 Manually triggering ${mode} optimization`);
            switch (mode) {
                case 'aggressive':
                    yield this.enableEmergencyOptimization();
                    break;
                case 'conservative':
                    yield this.enableConservativeOptimization();
                    break;
                case 'normal':
                    yield this.enableNormalOptimization();
                    break;
            }
        });
    }
    // Get optimization status
    getOptimizationStatus() {
        return {
            initialized: this.isInitialized,
            mode: FeatureToggleService_1.featureToggleService.generateOptimizationReport().currentMode,
            monitoring: !!this.optimizationInterval,
            services: {
                redisOptimization: true,
                smartCache: true,
                hybridStorage: true,
                batchOperations: true,
                usageMonitoring: true
            }
        };
    }
    // Cleanup and shutdown
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Shutting down Redis Optimization Manager...');
            try {
                // Stop optimization loop
                if (this.optimizationInterval) {
                    clearInterval(this.optimizationInterval);
                    this.optimizationInterval = null;
                }
                // Cleanup services
                RedisUsageMonitor_1.redisUsageMonitor.cleanup();
                BatchOperationsService_1.batchOperationsService.cleanup();
                yield HybridStorageService_1.hybridStorageService.clearAll();
                yield OptimizedRedisService_1.optimizedRedisService.shutdown();
                this.isInitialized = false;
                console.log('✅ Redis Optimization Manager shutdown complete');
            }
            catch (error) {
                console.error('❌ Error during shutdown:', error);
            }
        });
    }
    // Health check for the optimization manager itself
    healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const redisHealth = yield OptimizedRedisService_1.optimizedRedisService.healthCheck();
                return {
                    status: redisHealth.status,
                    services: {
                        redisOptimization: redisHealth.primaryClient,
                        smartCache: true,
                        hybridStorage: true,
                        batchOperations: BatchOperationsService_1.batchOperationsService.getStats().queueSize < 1000,
                        usageMonitoring: RedisUsageMonitor_1.redisUsageMonitor.getActiveAlerts().length < 5
                    },
                    lastOptimization: new Date().toISOString()
                };
            }
            catch (error) {
                return {
                    status: 'unhealthy',
                    services: {
                        redisOptimization: false,
                        smartCache: false,
                        hybridStorage: false,
                        batchOperations: false,
                        usageMonitoring: false
                    },
                    lastOptimization: 'unknown'
                };
            }
        });
    }
}
exports.RedisOptimizationManager = RedisOptimizationManager;
exports.redisOptimizationManager = RedisOptimizationManager.getInstance();
