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
exports.CircuitBreakerService = exports.CircuitBreaker = exports.circuitBreakerService = void 0;
const logger_1 = require("../../config/logger");
const redis_1 = require("../../config/redis");
class CircuitBreaker {
    constructor(config) {
        this.config = config;
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.totalCalls = 0;
        this.lastFailureTime = null;
        this.lastSuccessTime = null;
        this.nextAttemptTime = null;
        this.halfOpenCalls = 0;
        this.recentErrors = [];
        this.responseTimes = [];
        logger_1.Logger.info(`🔧 Circuit breaker initialized: ${config.name}`);
    }
    /**
     * Execute a function with circuit breaker protection
     */
    execute(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            this.totalCalls++;
            // Check if circuit is open
            if (this.state === 'OPEN') {
                if (this.shouldAttemptReset()) {
                    this.state = 'HALF_OPEN';
                    this.halfOpenCalls = 0;
                    logger_1.Logger.info(`🔧 Circuit breaker ${this.config.name} transitioning to HALF_OPEN`);
                }
                else {
                    throw new Error(`Circuit breaker ${this.config.name} is OPEN`);
                }
            }
            try {
                const result = yield fn();
                const responseTime = Date.now() - startTime;
                this.onSuccess(responseTime);
                return result;
            }
            catch (error) {
                const responseTime = Date.now() - startTime;
                this.onFailure(error, responseTime);
                throw error;
            }
        });
    }
    /**
     * Handle successful execution
     */
    onSuccess(responseTime) {
        this.successCount++;
        this.lastSuccessTime = new Date();
        this.recordResponseTime(responseTime);
        if (this.state === 'HALF_OPEN') {
            this.halfOpenCalls++;
            if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
                this.reset();
            }
        }
        else if (this.state === 'CLOSED') {
            // Reset failure count on success in closed state
            this.failureCount = 0;
        }
    }
    /**
     * Handle failed execution
     */
    onFailure(error, responseTime) {
        this.failureCount++;
        this.lastFailureTime = new Date();
        this.recordResponseTime(responseTime);
        this.recordError(error.message);
        if (this.state === 'HALF_OPEN') {
            this.open();
        }
        else if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
            this.open();
        }
    }
    /**
     * Open the circuit breaker
     */
    open() {
        this.state = 'OPEN';
        this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
        logger_1.Logger.warn(`⚠️ Circuit breaker ${this.config.name} opened due to failures`);
        // Store state in Redis for persistence
        this.persistState();
    }
    /**
     * Reset the circuit breaker to closed state
     */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.halfOpenCalls = 0;
        this.nextAttemptTime = null;
        logger_1.Logger.info(`✅ Circuit breaker ${this.config.name} reset to CLOSED`);
        // Store state in Redis
        this.persistState();
    }
    /**
     * Check if we should attempt to reset the circuit breaker
     */
    shouldAttemptReset() {
        return this.nextAttemptTime !== null && new Date() >= this.nextAttemptTime;
    }
    /**
     * Record response time for performance metrics
     */
    recordResponseTime(responseTime) {
        this.responseTimes.push(responseTime);
        // Keep only recent response times (last 100)
        if (this.responseTimes.length > 100) {
            this.responseTimes.shift();
        }
    }
    /**
     * Record error for debugging
     */
    recordError(errorMessage) {
        this.recentErrors.push(`${new Date().toISOString()}: ${errorMessage}`);
        // Keep only recent errors (last 10)
        if (this.recentErrors.length > 10) {
            this.recentErrors.shift();
        }
    }
    /**
     * Get current statistics
     */
    getStats() {
        const errorRate = this.totalCalls > 0 ? (this.failureCount / this.totalCalls) * 100 : 0;
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            totalCalls: this.totalCalls,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            nextAttemptTime: this.nextAttemptTime,
            errorRate
        };
    }
    /**
     * Get detailed metrics
     */
    getMetrics() {
        const stats = this.getStats();
        const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
        const averageResponseTime = this.responseTimes.length > 0
            ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
            : 0;
        const p95Index = Math.floor(sortedTimes.length * 0.95);
        const p99Index = Math.floor(sortedTimes.length * 0.99);
        return {
            name: this.config.name,
            stats,
            recentErrors: [...this.recentErrors],
            performanceMetrics: {
                averageResponseTime,
                p95ResponseTime: sortedTimes[p95Index] || 0,
                p99ResponseTime: sortedTimes[p99Index] || 0
            }
        };
    }
    /**
     * Persist circuit breaker state to Redis
     */
    persistState() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const state = {
                    state: this.state,
                    failureCount: this.failureCount,
                    successCount: this.successCount,
                    totalCalls: this.totalCalls,
                    lastFailureTime: this.lastFailureTime,
                    lastSuccessTime: this.lastSuccessTime,
                    nextAttemptTime: this.nextAttemptTime
                };
                yield redis_1.redisOperations.setex(`circuit_breaker:${this.config.name}`, 3600, // 1 hour
                JSON.stringify(state));
            }
            catch (error) {
                logger_1.Logger.error(`Failed to persist circuit breaker state for ${this.config.name}:`, error);
            }
        });
    }
    /**
     * Load circuit breaker state from Redis
     */
    loadState() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const stateData = yield redis_1.redisOperations.get(`circuit_breaker:${this.config.name}`);
                if (stateData) {
                    const state = JSON.parse(stateData);
                    this.state = state.state;
                    this.failureCount = state.failureCount || 0;
                    this.successCount = state.successCount || 0;
                    this.totalCalls = state.totalCalls || 0;
                    this.lastFailureTime = state.lastFailureTime ? new Date(state.lastFailureTime) : null;
                    this.lastSuccessTime = state.lastSuccessTime ? new Date(state.lastSuccessTime) : null;
                    this.nextAttemptTime = state.nextAttemptTime ? new Date(state.nextAttemptTime) : null;
                    logger_1.Logger.info(`🔧 Circuit breaker ${this.config.name} state loaded from Redis`);
                }
            }
            catch (error) {
                logger_1.Logger.error(`Failed to load circuit breaker state for ${this.config.name}:`, error);
            }
        });
    }
    /**
     * Force reset the circuit breaker
     */
    forceReset() {
        this.reset();
        logger_1.Logger.info(`🔧 Circuit breaker ${this.config.name} force reset`);
    }
    /**
     * Force open the circuit breaker
     */
    forceOpen() {
        this.open();
        logger_1.Logger.warn(`⚠️ Circuit breaker ${this.config.name} force opened`);
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Circuit Breaker Service for managing multiple circuit breakers
 */
class CircuitBreakerService {
    constructor() {
        this.circuitBreakers = new Map();
        this.monitoringInterval = null;
        this.startMonitoring();
        logger_1.Logger.info('🔧 Circuit Breaker Service initialized');
    }
    /**
     * Create or get a circuit breaker
     */
    getCircuitBreaker(config) {
        if (!this.circuitBreakers.has(config.name)) {
            const circuitBreaker = new CircuitBreaker(config);
            this.circuitBreakers.set(config.name, circuitBreaker);
            // Load persisted state
            circuitBreaker.loadState();
        }
        return this.circuitBreakers.get(config.name);
    }
    /**
     * Get all circuit breaker metrics
     */
    getAllMetrics() {
        return Array.from(this.circuitBreakers.values()).map(cb => cb.getMetrics());
    }
    /**
     * Get specific circuit breaker metrics
     */
    getMetrics(name) {
        const circuitBreaker = this.circuitBreakers.get(name);
        return circuitBreaker ? circuitBreaker.getMetrics() : null;
    }
    /**
     * Reset all circuit breakers
     */
    resetAll() {
        for (const circuitBreaker of this.circuitBreakers.values()) {
            circuitBreaker.forceReset();
        }
        logger_1.Logger.info('🔧 All circuit breakers reset');
    }
    /**
     * Reset specific circuit breaker
     */
    reset(name) {
        const circuitBreaker = this.circuitBreakers.get(name);
        if (circuitBreaker) {
            circuitBreaker.forceReset();
            return true;
        }
        return false;
    }
    /**
     * Start monitoring circuit breakers
     */
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.logMetrics();
        }, 60000); // Log metrics every minute
    }
    /**
     * Log circuit breaker metrics
     */
    logMetrics() {
        const metrics = this.getAllMetrics();
        for (const metric of metrics) {
            if (metric.stats.state !== 'CLOSED' || metric.stats.errorRate > 10) {
                logger_1.Logger.warn(`🔧 Circuit breaker ${metric.name} metrics:`, {
                    state: metric.stats.state,
                    errorRate: metric.stats.errorRate,
                    totalCalls: metric.stats.totalCalls,
                    averageResponseTime: metric.performanceMetrics.averageResponseTime
                });
            }
        }
    }
    /**
     * Shutdown service
     */
    shutdown() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.circuitBreakers.clear();
        logger_1.Logger.info('🔧 Circuit Breaker Service shutdown complete');
    }
}
exports.CircuitBreakerService = CircuitBreakerService;
// Create singleton instance
const circuitBreakerService = new CircuitBreakerService();
exports.circuitBreakerService = circuitBreakerService;
exports.default = circuitBreakerService;
