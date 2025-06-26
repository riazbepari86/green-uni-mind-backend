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
exports.serviceRegistry = void 0;
const logger_1 = require("../config/logger");
/**
 * Service Registry for managing singleton service instances
 * Ensures consistent service instances across the application
 */
class ServiceRegistry {
    constructor() {
        this.services = new Map();
        this.initialized = false;
        // Private constructor for singleton pattern
    }
    /**
     * Get singleton instance of ServiceRegistry
     */
    static getInstance() {
        if (!ServiceRegistry.instance) {
            ServiceRegistry.instance = new ServiceRegistry();
        }
        return ServiceRegistry.instance;
    }
    /**
     * Initialize all services
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.initialized) {
                logger_1.Logger.warn('🔧 ServiceRegistry already initialized');
                return;
            }
            try {
                logger_1.Logger.info('🔧 Initializing ServiceRegistry...');
                // No real-time services to initialize
                // This registry is now available for future non-real-time services
                this.initialized = true;
                logger_1.Logger.info('✅ ServiceRegistry initialization complete');
            }
            catch (error) {
                logger_1.Logger.error('❌ ServiceRegistry initialization failed:', error);
                throw error;
            }
        });
    }
    /**
     * Get service by name
     */
    getService(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            throw new Error(`Service '${serviceName}' not found. Available services: ${Array.from(this.services.keys()).join(', ')}`);
        }
        return service;
    }
    /**
     * Register a custom service
     */
    registerService(name, service) {
        if (this.services.has(name)) {
            logger_1.Logger.warn(`🔧 Service '${name}' already registered, replacing...`);
        }
        this.services.set(name, service);
        logger_1.Logger.info(`🔧 Service '${name}' registered`);
    }
    /**
     * Check if service is registered
     */
    hasService(serviceName) {
        return this.services.has(serviceName);
    }
    /**
     * Get all registered service names
     */
    getServiceNames() {
        return Array.from(this.services.keys());
    }
    /**
     * Get service health status
     */
    getServiceHealth() {
        const health = {};
        this.services.forEach((service, name) => {
            try {
                health[name] = {
                    status: 'healthy',
                    type: typeof service
                };
            }
            catch (error) {
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
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🔧 Shutting down ServiceRegistry...');
            try {
                // Shutdown any services that have shutdown methods
                this.services.forEach((service, name) => {
                    if (service && typeof service.shutdown === 'function') {
                        try {
                            service.shutdown();
                            logger_1.Logger.info(`🔧 Service '${name}' shutdown complete`);
                        }
                        catch (error) {
                            logger_1.Logger.error(`❌ Service '${name}' shutdown failed:`, error);
                        }
                    }
                });
                // Clear all services
                this.services.clear();
                this.initialized = false;
                logger_1.Logger.info('✅ ServiceRegistry shutdown complete');
            }
            catch (error) {
                logger_1.Logger.error('❌ ServiceRegistry shutdown failed:', error);
                throw error;
            }
        });
    }
    /**
     * Reset singleton instance (for testing)
     */
    static reset() {
        if (ServiceRegistry.instance) {
            ServiceRegistry.instance.shutdown().catch(error => {
                logger_1.Logger.error('Error during ServiceRegistry reset:', error);
            });
        }
        ServiceRegistry.instance = null;
    }
}
ServiceRegistry.instance = null;
// Export singleton instance
exports.serviceRegistry = ServiceRegistry.getInstance();
exports.default = ServiceRegistry;
