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
exports.retryService = void 0;
const logger_1 = require("../../config/logger");
const CircuitBreakerService_1 = require("./CircuitBreakerService");
class RetryService {
    constructor() {
        this.stats = {
            totalRetries: 0,
            successfulRetries: 0,
            failedRetries: 0,
            averageAttempts: 0,
            averageSuccessTime: 0,
            mostCommonErrors: {}
        };
        this.DEFAULT_CONFIG = {
            maxAttempts: 3,
            baseDelay: 1000,
            maxDelay: 30000,
            backoffMultiplier: 2,
            jitter: true,
            retryableErrors: ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT']
        };
        logger_1.Logger.info('🔄 Retry Service initialized');
    }
    /**
     * Execute a function with retry logic
     */
    executeWithRetry(fn_1) {
        return __awaiter(this, arguments, void 0, function* (fn, config = {}) {
            var _a;
            const finalConfig = Object.assign(Object.assign({}, this.DEFAULT_CONFIG), config);
            const startTime = Date.now();
            const attempts = [];
            this.stats.totalRetries++;
            // Use circuit breaker if specified
            const circuitBreaker = finalConfig.circuitBreakerName
                ? CircuitBreakerService_1.circuitBreakerService.getCircuitBreaker({
                    name: finalConfig.circuitBreakerName,
                    failureThreshold: 5,
                    recoveryTimeout: 60000,
                    monitoringPeriod: 30000,
                    halfOpenMaxCalls: 3
                })
                : null;
            for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
                const attemptStart = Date.now();
                try {
                    let result;
                    if (circuitBreaker) {
                        result = yield circuitBreaker.execute(fn);
                    }
                    else {
                        result = yield fn();
                    }
                    // Success
                    const attemptTime = Date.now() - attemptStart;
                    attempts.push({
                        attemptNumber: attempt,
                        delay: 0,
                        timestamp: new Date()
                    });
                    this.updateSuccessStats(attempts.length, Date.now() - startTime);
                    return {
                        success: true,
                        result,
                        attempts,
                        totalTime: Date.now() - startTime,
                        finalAttempt: attempt
                    };
                }
                catch (error) {
                    const attemptTime = Date.now() - attemptStart;
                    const err = error;
                    attempts.push({
                        attemptNumber: attempt,
                        delay: 0,
                        error: err,
                        timestamp: new Date()
                    });
                    // Check if error is retryable
                    if (!this.isRetryableError(err, finalConfig.retryableErrors)) {
                        this.updateFailureStats(err.message);
                        return {
                            success: false,
                            error: err,
                            attempts,
                            totalTime: Date.now() - startTime,
                            finalAttempt: attempt
                        };
                    }
                    // If this was the last attempt, fail
                    if (attempt === finalConfig.maxAttempts) {
                        this.updateFailureStats(err.message);
                        return {
                            success: false,
                            error: err,
                            attempts,
                            totalTime: Date.now() - startTime,
                            finalAttempt: attempt
                        };
                    }
                    // Calculate delay for next attempt
                    const delay = this.calculateDelay(attempt, finalConfig);
                    attempts[attempts.length - 1].delay = delay;
                    logger_1.Logger.warn(`🔄 Retry attempt ${attempt}/${finalConfig.maxAttempts} failed, retrying in ${delay}ms:`, {
                        error: err.message,
                        attempt,
                        delay
                    });
                    // Wait before next attempt
                    yield this.sleep(delay);
                }
            }
            // This should never be reached, but TypeScript requires it
            const lastError = ((_a = attempts[attempts.length - 1]) === null || _a === void 0 ? void 0 : _a.error) || new Error('Unknown error');
            this.updateFailureStats(lastError.message);
            return {
                success: false,
                error: lastError,
                attempts,
                totalTime: Date.now() - startTime,
                finalAttempt: finalConfig.maxAttempts
            };
        });
    }
    /**
     * Execute with simple retry (convenience method)
     */
    retry(fn_1) {
        return __awaiter(this, arguments, void 0, function* (fn, maxAttempts = 3, baseDelay = 1000) {
            const result = yield this.executeWithRetry(fn, { maxAttempts, baseDelay });
            if (result.success) {
                return result.result;
            }
            else {
                throw result.error;
            }
        });
    }
    /**
     * Execute with exponential backoff
     */
    retryWithExponentialBackoff(fn_1) {
        return __awaiter(this, arguments, void 0, function* (fn, maxAttempts = 5, baseDelay = 1000, maxDelay = 30000) {
            const result = yield this.executeWithRetry(fn, {
                maxAttempts,
                baseDelay,
                maxDelay,
                backoffMultiplier: 2,
                jitter: true
            });
            if (result.success) {
                return result.result;
            }
            else {
                throw result.error;
            }
        });
    }
    /**
     * Execute with circuit breaker protection
     */
    retryWithCircuitBreaker(fn_1, circuitBreakerName_1) {
        return __awaiter(this, arguments, void 0, function* (fn, circuitBreakerName, config = {}) {
            const result = yield this.executeWithRetry(fn, Object.assign(Object.assign({}, config), { circuitBreakerName }));
            if (result.success) {
                return result.result;
            }
            else {
                throw result.error;
            }
        });
    }
    /**
     * Batch retry operations
     */
    retryBatch(operations_1) {
        return __awaiter(this, arguments, void 0, function* (operations, config = {}) {
            const results = yield Promise.allSettled(operations.map(op => this.executeWithRetry(op, config)));
            return results.map(result => result.status === 'fulfilled' ? result.value : {
                success: false,
                error: result.reason,
                attempts: [],
                totalTime: 0,
                finalAttempt: 0
            });
        });
    }
    /**
     * Get retry statistics
     */
    getStats() {
        return Object.assign({}, this.stats);
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRetries: 0,
            successfulRetries: 0,
            failedRetries: 0,
            averageAttempts: 0,
            averageSuccessTime: 0,
            mostCommonErrors: {}
        };
        logger_1.Logger.info('🔄 Retry statistics reset');
    }
    /**
     * Private helper methods
     */
    calculateDelay(attempt, config) {
        let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
        // Apply maximum delay limit
        delay = Math.min(delay, config.maxDelay);
        // Apply jitter to prevent thundering herd
        if (config.jitter) {
            const jitterAmount = delay * 0.1; // 10% jitter
            delay += (Math.random() - 0.5) * 2 * jitterAmount;
        }
        return Math.max(delay, 0);
    }
    isRetryableError(error, retryableErrors) {
        if (!retryableErrors || retryableErrors.length === 0) {
            return true; // Retry all errors if no specific errors specified
        }
        const errorMessage = error.message.toLowerCase();
        const errorCode = error.code;
        return retryableErrors.some(retryableError => errorMessage.includes(retryableError.toLowerCase()) ||
            errorCode === retryableError);
    }
    sleep(ms) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(resolve => setTimeout(resolve, ms));
        });
    }
    updateSuccessStats(attempts, totalTime) {
        this.stats.successfulRetries++;
        this.stats.averageAttempts = ((this.stats.averageAttempts * (this.stats.successfulRetries - 1) + attempts) /
            this.stats.successfulRetries);
        this.stats.averageSuccessTime = ((this.stats.averageSuccessTime * (this.stats.successfulRetries - 1) + totalTime) /
            this.stats.successfulRetries);
    }
    updateFailureStats(errorMessage) {
        this.stats.failedRetries++;
        // Track common errors
        const errorKey = errorMessage.substring(0, 50); // Truncate for grouping
        this.stats.mostCommonErrors[errorKey] = (this.stats.mostCommonErrors[errorKey] || 0) + 1;
    }
    /**
     * Create a retryable function wrapper
     */
    createRetryableFunction(fn, config = {}) {
        return (...args) => __awaiter(this, void 0, void 0, function* () {
            return this.retry(() => fn(...args), config.maxAttempts, config.baseDelay);
        });
    }
    /**
     * Decorator for retryable methods
     */
    retryable(config = {}) {
        return (target, propertyKey, descriptor) => {
            const originalMethod = descriptor.value;
            descriptor.value = function (...args) {
                return __awaiter(this, void 0, void 0, function* () {
                    const retryService = new RetryService();
                    return retryService.retry(() => originalMethod.apply(this, args), config.maxAttempts, config.baseDelay);
                });
            };
            return descriptor;
        };
    }
}
// Create singleton instance
const retryService = new RetryService();
exports.retryService = retryService;
exports.default = RetryService;
