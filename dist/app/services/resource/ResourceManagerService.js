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
exports.resourceManagerService = void 0;
const logger_1 = require("../../config/logger");
const events_1 = require("events");
class ResourceManagerService extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.resources = new Map();
        this.cleanupInterval = null;
        this.memoryMonitorInterval = null;
        this.stats = {
            totalResources: 0,
            resourcesByType: {},
            memoryUsage: 0,
            oldestResource: null,
            resourcesCleanedUp: 0,
            averageLifetime: 0
        };
        this.config = {
            maxResources: 10000,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            cleanupInterval: 5 * 60 * 1000, // 5 minutes
            memoryThreshold: 500 * 1024 * 1024, // 500MB
            enableAutoCleanup: true,
            enableMemoryMonitoring: true
        };
        this.config = Object.assign(Object.assign({}, this.config), config);
        this.startCleanupProcess();
        this.startMemoryMonitoring();
        logger_1.Logger.info('🧹 Resource Manager Service initialized');
    }
    /**
     * Register a resource for management
     */
    registerResource(resource) {
        const id = this.generateResourceId();
        const resourceInfo = Object.assign(Object.assign({}, resource), { id, createdAt: new Date(), lastAccessed: new Date(), isActive: true });
        this.resources.set(id, resourceInfo);
        this.updateStats();
        logger_1.Logger.debug(`🧹 Resource registered: ${id} (${resource.type})`);
        this.emit('resource:registered', resourceInfo);
        // Check if we need immediate cleanup
        if (this.resources.size > this.config.maxResources) {
            this.performCleanup();
        }
        return id;
    }
    /**
     * Unregister a resource
     */
    unregisterResource(resourceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const resource = this.resources.get(resourceId);
            if (!resource) {
                return false;
            }
            try {
                // Call cleanup function
                yield resource.cleanup();
                // Remove from registry
                this.resources.delete(resourceId);
                this.updateStats();
                logger_1.Logger.debug(`🧹 Resource unregistered: ${resourceId} (${resource.type})`);
                this.emit('resource:unregistered', resource);
                return true;
            }
            catch (error) {
                logger_1.Logger.error(`❌ Failed to cleanup resource ${resourceId}:`, error);
                this.emit('resource:cleanup_error', { resource, error });
                return false;
            }
        });
    }
    /**
     * Update resource access time
     */
    touchResource(resourceId) {
        const resource = this.resources.get(resourceId);
        if (resource) {
            resource.lastAccessed = new Date();
            return true;
        }
        return false;
    }
    /**
     * Mark resource as inactive
     */
    deactivateResource(resourceId) {
        const resource = this.resources.get(resourceId);
        if (resource) {
            resource.isActive = false;
            logger_1.Logger.debug(`🧹 Resource deactivated: ${resourceId} (${resource.type})`);
            this.emit('resource:deactivated', resource);
            return true;
        }
        return false;
    }
    /**
     * Get resource information
     */
    getResource(resourceId) {
        return this.resources.get(resourceId) || null;
    }
    /**
     * Get all resources of a specific type
     */
    getResourcesByType(type) {
        return Array.from(this.resources.values()).filter(resource => resource.type === type);
    }
    /**
     * Get resource statistics
     */
    getStats() {
        return Object.assign({}, this.stats);
    }
    /**
     * Force cleanup of all resources
     */
    cleanupAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const resourceIds = Array.from(this.resources.keys());
            let cleanedUp = 0;
            for (const resourceId of resourceIds) {
                if (yield this.unregisterResource(resourceId)) {
                    cleanedUp++;
                }
            }
            logger_1.Logger.info(`🧹 Force cleanup completed: ${cleanedUp} resources cleaned up`);
            this.emit('cleanup:force_complete', { cleanedUp });
            return cleanedUp;
        });
    }
    /**
     * Cleanup resources by criteria
     */
    cleanupByCriteria(criteria) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourcesToCleanup = Array.from(this.resources.values()).filter(resource => {
                if (criteria.type && resource.type !== criteria.type)
                    return false;
                if (criteria.olderThan && resource.createdAt > criteria.olderThan)
                    return false;
                if (criteria.inactive !== undefined && resource.isActive === criteria.inactive)
                    return false;
                if (criteria.priority && resource.priority !== criteria.priority)
                    return false;
                return true;
            });
            let cleanedUp = 0;
            for (const resource of resourcesToCleanup) {
                if (yield this.unregisterResource(resource.id)) {
                    cleanedUp++;
                }
            }
            logger_1.Logger.info(`🧹 Criteria cleanup completed: ${cleanedUp} resources cleaned up`);
            this.emit('cleanup:criteria_complete', { criteria, cleanedUp });
            return cleanedUp;
        });
    }
    /**
     * Get memory usage estimate
     */
    getMemoryUsage() {
        let totalMemory = 0;
        for (const resource of this.resources.values()) {
            if (resource.memoryUsage) {
                totalMemory += resource.memoryUsage;
            }
            else {
                // Estimate memory usage based on resource type
                totalMemory += this.estimateResourceMemory(resource);
            }
        }
        return totalMemory;
    }
    /**
     * Private helper methods
     */
    generateResourceId() {
        return `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    updateStats() {
        const resources = Array.from(this.resources.values());
        this.stats.totalResources = resources.length;
        this.stats.memoryUsage = this.getMemoryUsage();
        // Update resource counts by type
        this.stats.resourcesByType = {};
        for (const resource of resources) {
            this.stats.resourcesByType[resource.type] =
                (this.stats.resourcesByType[resource.type] || 0) + 1;
        }
        // Find oldest resource
        this.stats.oldestResource = resources.length > 0
            ? new Date(Math.min(...resources.map(r => r.createdAt.getTime())))
            : null;
        // Calculate average lifetime
        if (resources.length > 0) {
            const now = Date.now();
            const totalLifetime = resources.reduce((sum, resource) => sum + (now - resource.createdAt.getTime()), 0);
            this.stats.averageLifetime = totalLifetime / resources.length;
        }
    }
    estimateResourceMemory(resource) {
        // Rough estimates in bytes
        switch (resource.type) {
            case 'sse_connection':
                return 1024; // 1KB per SSE connection
            case 'polling_subscription':
                return 512; // 512B per polling subscription
            case 'timer':
                return 256; // 256B per timer
            case 'event_listener':
                return 128; // 128B per event listener
            case 'database_connection':
                return 4096; // 4KB per database connection
            case 'cache_entry':
                return JSON.stringify(resource.metadata).length * 2; // Estimate based on metadata
            default:
                return 512; // Default estimate
        }
    }
    startCleanupProcess() {
        if (!this.config.enableAutoCleanup)
            return;
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, this.config.cleanupInterval);
    }
    startMemoryMonitoring() {
        if (!this.config.enableMemoryMonitoring)
            return;
        this.memoryMonitorInterval = setInterval(() => {
            this.monitorMemoryUsage();
        }, 60000); // Check every minute
    }
    performCleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const cutoffTime = new Date(now.getTime() - this.config.maxAge);
            const resourcesToCleanup = Array.from(this.resources.values()).filter(resource => {
                // Cleanup old resources
                if (resource.createdAt < cutoffTime)
                    return true;
                // Cleanup inactive resources older than 1 hour
                if (!resource.isActive &&
                    resource.lastAccessed < new Date(now.getTime() - 60 * 60 * 1000)) {
                    return true;
                }
                return false;
            });
            // Sort by priority (cleanup low priority first)
            resourcesToCleanup.sort((a, b) => {
                const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
            let cleanedUp = 0;
            for (const resource of resourcesToCleanup) {
                if (yield this.unregisterResource(resource.id)) {
                    cleanedUp++;
                }
            }
            if (cleanedUp > 0) {
                this.stats.resourcesCleanedUp += cleanedUp;
                logger_1.Logger.info(`🧹 Automatic cleanup completed: ${cleanedUp} resources cleaned up`);
                this.emit('cleanup:auto_complete', { cleanedUp });
            }
        });
    }
    monitorMemoryUsage() {
        const memoryUsage = this.getMemoryUsage();
        if (memoryUsage > this.config.memoryThreshold) {
            logger_1.Logger.warn(`⚠️ Memory usage threshold exceeded: ${memoryUsage} bytes`);
            this.emit('memory:threshold_exceeded', { memoryUsage, threshold: this.config.memoryThreshold });
            // Trigger aggressive cleanup
            this.cleanupByCriteria({ priority: 'low' });
        }
        this.emit('memory:usage_update', { memoryUsage });
    }
    /**
     * Shutdown the resource manager
     */
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🧹 Resource Manager shutting down...');
            // Stop intervals
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }
            if (this.memoryMonitorInterval) {
                clearInterval(this.memoryMonitorInterval);
            }
            // Cleanup all resources
            const cleanedUp = yield this.cleanupAll();
            logger_1.Logger.info(`🧹 Resource Manager shutdown complete: ${cleanedUp} resources cleaned up`);
            this.emit('shutdown:complete', { cleanedUp });
        });
    }
}
// Create singleton instance
const resourceManagerService = new ResourceManagerService();
exports.resourceManagerService = resourceManagerService;
exports.default = ResourceManagerService;
