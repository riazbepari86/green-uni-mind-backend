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
exports.RedisCircuitBreaker = exports.CircuitBreakerFactory = exports.CircuitBreakerService = void 0;
exports.withCircuitBreaker = withCircuitBreaker;
exports.createResilientRedisOperation = createResilientRedisOperation;
const interfaces_1 = require("./interfaces");
class CircuitBreakerService {
    constructor(config = {}) {
        this.state = 'CLOSED';
        this.metrics = {
            failures: 0,
            successes: 0,
            timeouts: 0
        };
        this.nextAttempt = new Date();
        this.config = {
            failureThreshold: config.failureThreshold || 5,
            recoveryTimeout: config.recoveryTimeout || 60000, // 1 minute
            monitoringPeriod: config.monitoringPeriod || 300000, // 5 minutes
            expectedErrorRate: config.expectedErrorRate || 0.5 // 50%
        };
    }
    execute(operation, fallback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === 'OPEN') {
                if (Date.now() < this.nextAttempt.getTime()) {
                    if (fallback) {
                        console.log('Circuit breaker OPEN - executing fallback');
                        return yield fallback();
                    }
                    throw new interfaces_1.CircuitBreakerOpenError('Circuit breaker is open');
                }
                else {
                    this.state = 'HALF_OPEN';
                    console.log('Circuit breaker transitioning to HALF_OPEN');
                }
            }
            try {
                const result = yield this.executeWithTimeout(operation);
                this.onSuccess();
                return result;
            }
            catch (error) {
                this.onFailure();
                if (fallback) {
                    console.log('Circuit breaker OPEN after failure - executing fallback');
                    return yield fallback();
                }
                throw error;
            }
        });
    }
    executeWithTimeout(operation_1) {
        return __awaiter(this, arguments, void 0, function* (operation, timeoutMs = 10000) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    this.metrics.timeouts++;
                    reject(new Error('Operation timeout'));
                }, timeoutMs);
                operation()
                    .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                    .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
            });
        });
    }
    onSuccess() {
        this.metrics.successes++;
        this.metrics.lastSuccessTime = new Date();
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            this.resetMetrics();
            console.log('Circuit breaker transitioning to CLOSED after successful operation');
        }
    }
    onFailure() {
        this.metrics.failures++;
        this.metrics.lastFailureTime = new Date();
        if (this.shouldOpenCircuit()) {
            this.state = 'OPEN';
            this.nextAttempt = new Date(Date.now() + this.config.recoveryTimeout);
            console.log(`Circuit breaker OPEN - next attempt at ${this.nextAttempt.toISOString()}`);
        }
    }
    shouldOpenCircuit() {
        const totalRequests = this.metrics.failures + this.metrics.successes;
        if (totalRequests < this.config.failureThreshold) {
            return false;
        }
        const errorRate = this.metrics.failures / totalRequests;
        return errorRate >= this.config.expectedErrorRate;
    }
    resetMetrics() {
        this.metrics = {
            failures: 0,
            successes: 0,
            timeouts: 0
        };
    }
    getState() {
        return this.state;
    }
    getMetrics() {
        return Object.assign({}, this.metrics);
    }
    // Manual control methods
    forceOpen() {
        this.state = 'OPEN';
        this.nextAttempt = new Date(Date.now() + this.config.recoveryTimeout);
        console.log('Circuit breaker manually forced OPEN');
    }
    forceClose() {
        this.state = 'CLOSED';
        this.resetMetrics();
        console.log('Circuit breaker manually forced CLOSED');
    }
    // Health check method
    isHealthy() {
        return this.state === 'CLOSED';
    }
    // Get configuration
    getConfig() {
        return Object.assign({}, this.config);
    }
    // Update configuration
    updateConfig(newConfig) {
        this.config = Object.assign(Object.assign({}, this.config), newConfig);
        console.log('Circuit breaker configuration updated:', this.config);
    }
}
exports.CircuitBreakerService = CircuitBreakerService;
// Factory for creating circuit breakers with different configurations
class CircuitBreakerFactory {
    static getCircuitBreaker(name, config) {
        if (!this.instances.has(name)) {
            this.instances.set(name, new CircuitBreakerService(config));
        }
        return this.instances.get(name);
    }
    static removeCircuitBreaker(name) {
        return this.instances.delete(name);
    }
    static getAllCircuitBreakers() {
        return new Map(this.instances);
    }
    static getHealthStatus() {
        const status = {};
        this.instances.forEach((breaker, name) => {
            status[name] = {
                state: breaker.getState(),
                metrics: breaker.getMetrics(),
                isHealthy: breaker.isHealthy()
            };
        });
        return status;
    }
}
exports.CircuitBreakerFactory = CircuitBreakerFactory;
CircuitBreakerFactory.instances = new Map();
// Decorator for automatic circuit breaker integration
function withCircuitBreaker(circuitBreakerName, config) {
    return function (_target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = function (...args) {
            return __awaiter(this, void 0, void 0, function* () {
                const circuitBreaker = CircuitBreakerFactory.getCircuitBreaker(circuitBreakerName, config);
                return circuitBreaker.execute(() => method.apply(this, args), 
                // Optional: provide a fallback method if it exists
                typeof this[`${propertyName}Fallback`] === 'function' ?
                    () => this[`${propertyName}Fallback`](...args) :
                    undefined);
            });
        };
        return descriptor;
    };
}
// Redis-specific circuit breaker with predefined configuration
class RedisCircuitBreaker extends CircuitBreakerService {
    constructor(config = {}) {
        const redisConfig = Object.assign({ failureThreshold: 3, recoveryTimeout: 30000, monitoringPeriod: 60000, expectedErrorRate: 0.3 }, config);
        super(redisConfig);
    }
}
exports.RedisCircuitBreaker = RedisCircuitBreaker;
// Utility function to create a Redis operation with circuit breaker
function createResilientRedisOperation(operation, fallback, circuitBreakerName = 'redis-default') {
    const circuitBreaker = CircuitBreakerFactory.getCircuitBreaker(circuitBreakerName, {
        failureThreshold: 3,
        recoveryTimeout: 30000,
        monitoringPeriod: 60000,
        expectedErrorRate: 0.3
    });
    return () => circuitBreaker.execute(operation, fallback);
}
