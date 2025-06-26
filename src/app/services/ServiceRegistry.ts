import { Logger } from '../config/logger';

/**
 * Service Registry for managing singleton service instances
 * Ensures consistent service instances across the application
 */
class ServiceRegistry {
  private static instance: ServiceRegistry | null = null;
  private services: Map<string, any> = new Map();
  private initialized: boolean = false;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance of ServiceRegistry
   */
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Initialize all services
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      Logger.warn('🔧 ServiceRegistry already initialized');
      return;
    }

    try {
      Logger.info('🔧 Initializing ServiceRegistry...');

      // No real-time services to initialize
      // This registry is now available for future non-real-time services

      this.initialized = true;
      Logger.info('✅ ServiceRegistry initialization complete');
    } catch (error) {
      Logger.error('❌ ServiceRegistry initialization failed:', error);
      throw error;
    }
  }



  /**
   * Get service by name
   */
  public getService<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found. Available services: ${Array.from(this.services.keys()).join(', ')}`);
    }
    return service;
  }

  /**
   * Register a custom service
   */
  public registerService(name: string, service: any): void {
    if (this.services.has(name)) {
      Logger.warn(`🔧 Service '${name}' already registered, replacing...`);
    }
    this.services.set(name, service);
    Logger.info(`🔧 Service '${name}' registered`);
  }

  /**
   * Check if service is registered
   */
  public hasService(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  /**
   * Get all registered service names
   */
  public getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get service health status
   */
  public getServiceHealth(): Record<string, any> {
    const health: Record<string, any> = {};

    this.services.forEach((service, name) => {
      try {
        health[name] = {
          status: 'healthy',
          type: typeof service
        };
      } catch (error) {
        health[name] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return health;
  }

  /**
   * Shutdown all services
   */
  public async shutdown(): Promise<void> {
    Logger.info('🔧 Shutting down ServiceRegistry...');

    try {
      // Shutdown any services that have shutdown methods
      this.services.forEach((service, name) => {
        if (service && typeof service.shutdown === 'function') {
          try {
            service.shutdown();
            Logger.info(`🔧 Service '${name}' shutdown complete`);
          } catch (error) {
            Logger.error(`❌ Service '${name}' shutdown failed:`, error);
          }
        }
      });

      // Clear all services
      this.services.clear();
      this.initialized = false;

      Logger.info('✅ ServiceRegistry shutdown complete');
    } catch (error) {
      Logger.error('❌ ServiceRegistry shutdown failed:', error);
      throw error;
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static reset(): void {
    if (ServiceRegistry.instance) {
      ServiceRegistry.instance.shutdown().catch(error => {
        Logger.error('Error during ServiceRegistry reset:', error);
      });
    }
    ServiceRegistry.instance = null;
  }
}

// Export singleton instance
export const serviceRegistry = ServiceRegistry.getInstance();
export default ServiceRegistry;
