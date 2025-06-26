import { Logger } from '../../config/logger';
import { EventEmitter } from 'events';

export interface ResourceInfo {
  id: string;
  type: 'sse_connection' | 'polling_subscription' | 'timer' | 'event_listener' | 'database_connection' | 'cache_entry';
  createdAt: Date;
  lastAccessed: Date;
  metadata: Record<string, any>;
  cleanup: () => Promise<void> | void;
  isActive: boolean;
  memoryUsage?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResourceStats {
  totalResources: number;
  resourcesByType: Record<string, number>;
  memoryUsage: number;
  oldestResource: Date | null;
  resourcesCleanedUp: number;
  averageLifetime: number;
}

export interface ResourceManagerConfig {
  maxResources: number;
  maxAge: number; // milliseconds
  cleanupInterval: number; // milliseconds
  memoryThreshold: number; // bytes
  enableAutoCleanup: boolean;
  enableMemoryMonitoring: boolean;
}

class ResourceManagerService extends EventEmitter {
  private resources: Map<string, ResourceInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private memoryMonitorInterval: NodeJS.Timeout | null = null;
  private stats: ResourceStats = {
    totalResources: 0,
    resourcesByType: {},
    memoryUsage: 0,
    oldestResource: null,
    resourcesCleanedUp: 0,
    averageLifetime: 0
  };

  private readonly config: ResourceManagerConfig = {
    maxResources: 10000,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    memoryThreshold: 500 * 1024 * 1024, // 500MB
    enableAutoCleanup: true,
    enableMemoryMonitoring: true
  };

  constructor(config?: Partial<ResourceManagerConfig>) {
    super();
    this.config = { ...this.config, ...config };
    this.startCleanupProcess();
    this.startMemoryMonitoring();
    Logger.info('🧹 Resource Manager Service initialized');
  }

  /**
   * Register a resource for management
   */
  public registerResource(resource: Omit<ResourceInfo, 'id' | 'createdAt' | 'lastAccessed' | 'isActive'>): string {
    const id = this.generateResourceId();
    const resourceInfo: ResourceInfo = {
      ...resource,
      id,
      createdAt: new Date(),
      lastAccessed: new Date(),
      isActive: true
    };

    this.resources.set(id, resourceInfo);
    this.updateStats();

    Logger.debug(`🧹 Resource registered: ${id} (${resource.type})`);
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
  public async unregisterResource(resourceId: string): Promise<boolean> {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return false;
    }

    try {
      // Call cleanup function
      await resource.cleanup();
      
      // Remove from registry
      this.resources.delete(resourceId);
      this.updateStats();

      Logger.debug(`🧹 Resource unregistered: ${resourceId} (${resource.type})`);
      this.emit('resource:unregistered', resource);
      
      return true;
    } catch (error) {
      Logger.error(`❌ Failed to cleanup resource ${resourceId}:`, error);
      this.emit('resource:cleanup_error', { resource, error });
      return false;
    }
  }

  /**
   * Update resource access time
   */
  public touchResource(resourceId: string): boolean {
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
  public deactivateResource(resourceId: string): boolean {
    const resource = this.resources.get(resourceId);
    if (resource) {
      resource.isActive = false;
      Logger.debug(`🧹 Resource deactivated: ${resourceId} (${resource.type})`);
      this.emit('resource:deactivated', resource);
      return true;
    }
    return false;
  }

  /**
   * Get resource information
   */
  public getResource(resourceId: string): ResourceInfo | null {
    return this.resources.get(resourceId) || null;
  }

  /**
   * Get all resources of a specific type
   */
  public getResourcesByType(type: ResourceInfo['type']): ResourceInfo[] {
    return Array.from(this.resources.values()).filter(resource => resource.type === type);
  }

  /**
   * Get resource statistics
   */
  public getStats(): ResourceStats {
    return { ...this.stats };
  }

  /**
   * Force cleanup of all resources
   */
  public async cleanupAll(): Promise<number> {
    const resourceIds = Array.from(this.resources.keys());
    let cleanedUp = 0;

    for (const resourceId of resourceIds) {
      if (await this.unregisterResource(resourceId)) {
        cleanedUp++;
      }
    }

    Logger.info(`🧹 Force cleanup completed: ${cleanedUp} resources cleaned up`);
    this.emit('cleanup:force_complete', { cleanedUp });
    
    return cleanedUp;
  }

  /**
   * Cleanup resources by criteria
   */
  public async cleanupByCriteria(criteria: {
    type?: ResourceInfo['type'];
    olderThan?: Date;
    inactive?: boolean;
    priority?: ResourceInfo['priority'];
  }): Promise<number> {
    const resourcesToCleanup = Array.from(this.resources.values()).filter(resource => {
      if (criteria.type && resource.type !== criteria.type) return false;
      if (criteria.olderThan && resource.createdAt > criteria.olderThan) return false;
      if (criteria.inactive !== undefined && resource.isActive === criteria.inactive) return false;
      if (criteria.priority && resource.priority !== criteria.priority) return false;
      return true;
    });

    let cleanedUp = 0;
    for (const resource of resourcesToCleanup) {
      if (await this.unregisterResource(resource.id)) {
        cleanedUp++;
      }
    }

    Logger.info(`🧹 Criteria cleanup completed: ${cleanedUp} resources cleaned up`);
    this.emit('cleanup:criteria_complete', { criteria, cleanedUp });
    
    return cleanedUp;
  }

  /**
   * Get memory usage estimate
   */
  public getMemoryUsage(): number {
    let totalMemory = 0;
    
    for (const resource of this.resources.values()) {
      if (resource.memoryUsage) {
        totalMemory += resource.memoryUsage;
      } else {
        // Estimate memory usage based on resource type
        totalMemory += this.estimateResourceMemory(resource);
      }
    }

    return totalMemory;
  }

  /**
   * Private helper methods
   */
  private generateResourceId(): string {
    return `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private updateStats(): void {
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
      const totalLifetime = resources.reduce((sum, resource) => 
        sum + (now - resource.createdAt.getTime()), 0);
      this.stats.averageLifetime = totalLifetime / resources.length;
    }
  }

  private estimateResourceMemory(resource: ResourceInfo): number {
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

  private startCleanupProcess(): void {
    if (!this.config.enableAutoCleanup) return;

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  private startMemoryMonitoring(): void {
    if (!this.config.enableMemoryMonitoring) return;

    this.memoryMonitorInterval = setInterval(() => {
      this.monitorMemoryUsage();
    }, 60000); // Check every minute
  }

  private async performCleanup(): Promise<void> {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - this.config.maxAge);
    
    const resourcesToCleanup = Array.from(this.resources.values()).filter(resource => {
      // Cleanup old resources
      if (resource.createdAt < cutoffTime) return true;
      
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
      if (await this.unregisterResource(resource.id)) {
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      this.stats.resourcesCleanedUp += cleanedUp;
      Logger.info(`🧹 Automatic cleanup completed: ${cleanedUp} resources cleaned up`);
      this.emit('cleanup:auto_complete', { cleanedUp });
    }
  }

  private monitorMemoryUsage(): void {
    const memoryUsage = this.getMemoryUsage();
    
    if (memoryUsage > this.config.memoryThreshold) {
      Logger.warn(`⚠️ Memory usage threshold exceeded: ${memoryUsage} bytes`);
      this.emit('memory:threshold_exceeded', { memoryUsage, threshold: this.config.memoryThreshold });
      
      // Trigger aggressive cleanup
      this.cleanupByCriteria({ priority: 'low' });
    }

    this.emit('memory:usage_update', { memoryUsage });
  }

  /**
   * Shutdown the resource manager
   */
  public async shutdown(): Promise<void> {
    Logger.info('🧹 Resource Manager shutting down...');

    // Stop intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }

    // Cleanup all resources
    const cleanedUp = await this.cleanupAll();
    
    Logger.info(`🧹 Resource Manager shutdown complete: ${cleanedUp} resources cleaned up`);
    this.emit('shutdown:complete', { cleanedUp });
  }
}

// Create singleton instance
const resourceManagerService = new ResourceManagerService();

export { resourceManagerService };
export default ResourceManagerService;
