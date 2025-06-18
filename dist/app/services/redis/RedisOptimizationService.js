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
exports.redisOptimizationService = exports.RedisOptimizationService = void 0;
const RedisServiceManager_1 = require("./RedisServiceManager");
class RedisOptimizationService {
    constructor() {
        this.circuitBreakers = new Map();
        this.batchQueue = [];
        this.batchTimer = null;
        this.redis = RedisServiceManager_1.redisServiceManager.primaryClient;
        this.config = {
            circuitBreakerThreshold: 5, // 5 failures before opening circuit
            circuitBreakerTimeout: 30000, // 30 seconds
            batchSize: 50, // Process 50 operations at once
            batchTimeout: 100, // 100ms batch timeout
            enableCompression: true,
            compressionThreshold: 1024 // 1KB
        };
    }
    // Circuit breaker wrapper for Redis operations
    executeWithCircuitBreaker(operation_1) {
        return __awaiter(this, arguments, void 0, function* (operation, serviceName = 'redis', fallback) {
            const breaker = this.getCircuitBreaker(serviceName);
            // Check if circuit is open
            if (breaker.state === 'open') {
                if (Date.now() < breaker.nextAttempt) {
                    console.log(`🚫 Circuit breaker OPEN for ${serviceName}, using fallback`);
                    if (fallback) {
                        return yield fallback();
                    }
                    throw new Error(`Circuit breaker is OPEN for ${serviceName}`);
                }
                else {
                    // Try to close circuit (half-open state)
                    breaker.state = 'half-open';
                    console.log(`🔄 Circuit breaker HALF-OPEN for ${serviceName}`);
                }
            }
            try {
                const result = yield operation();
                // Success - reset circuit breaker
                if (breaker.state === 'half-open') {
                    breaker.state = 'closed';
                    breaker.failures = 0;
                    console.log(`✅ Circuit breaker CLOSED for ${serviceName}`);
                }
                return result;
            }
            catch (error) {
                // Failure - increment failure count
                breaker.failures++;
                breaker.lastFailureTime = Date.now();
                if (breaker.failures >= this.config.circuitBreakerThreshold) {
                    breaker.state = 'open';
                    breaker.nextAttempt = Date.now() + this.config.circuitBreakerTimeout;
                    console.log(`🔴 Circuit breaker OPENED for ${serviceName} after ${breaker.failures} failures`);
                }
                if (fallback) {
                    console.log(`🔄 Using fallback for ${serviceName}`);
                    return yield fallback();
                }
                throw error;
            }
        });
    }
    getCircuitBreaker(serviceName) {
        if (!this.circuitBreakers.has(serviceName)) {
            this.circuitBreakers.set(serviceName, {
                failures: 0,
                lastFailureTime: 0,
                state: 'closed',
                nextAttempt: 0
            });
        }
        return this.circuitBreakers.get(serviceName);
    }
    // Batch operations to reduce Redis calls
    batchOperation(operation) {
        return __awaiter(this, void 0, void 0, function* () {
            this.batchQueue.push(operation);
            // Process batch if it reaches the size limit
            if (this.batchQueue.length >= this.config.batchSize) {
                yield this.processBatch();
            }
            else if (!this.batchTimer) {
                // Set timer to process batch after timeout
                this.batchTimer = setTimeout(() => {
                    this.processBatch();
                }, this.config.batchTimeout);
            }
        });
    }
    processBatch() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.batchQueue.length === 0)
                return;
            const operations = [...this.batchQueue];
            this.batchQueue = [];
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
                this.batchTimer = null;
            }
            try {
                yield this.executeWithCircuitBreaker(() => __awaiter(this, void 0, void 0, function* () {
                    const pipeline = this.redis.pipeline();
                    for (const op of operations) {
                        switch (op.type) {
                            case 'get':
                                pipeline.get(op.key);
                                break;
                            case 'set':
                                if (op.ttl) {
                                    pipeline.setex(op.key, op.ttl, JSON.stringify(op.value));
                                }
                                else {
                                    pipeline.set(op.key, JSON.stringify(op.value));
                                }
                                break;
                            case 'del':
                                pipeline.del(op.key);
                                break;
                            case 'exists':
                                pipeline.exists(op.key);
                                break;
                            case 'expire':
                                pipeline.expire(op.key, op.ttl);
                                break;
                        }
                    }
                    const results = yield pipeline.exec();
                    console.log(`📦 Processed batch of ${operations.length} Redis operations`);
                    return results;
                }), 'batch_operations');
            }
            catch (error) {
                console.error('Batch operation failed:', error);
            }
        });
    }
    // Optimized get with compression support
    optimizedGet(key, fallback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithCircuitBreaker(() => __awaiter(this, void 0, void 0, function* () {
                const data = yield this.redis.get(key);
                if (!data)
                    return null;
                try {
                    const parsed = JSON.parse(data);
                    // Handle compressed data
                    if (parsed.__compressed) {
                        // In a real implementation, you'd decompress here
                        return parsed.data;
                    }
                    return parsed;
                }
                catch (error) {
                    console.error(`Error parsing cached data for key ${key}:`, error);
                    return null;
                }
            }), 'get', fallback);
        });
    }
    // Optimized set with compression
    optimizedSet(key_1, value_1, ttl_1) {
        return __awaiter(this, arguments, void 0, function* (key, value, ttl, options = {}) {
            return this.executeWithCircuitBreaker(() => __awaiter(this, void 0, void 0, function* () {
                let dataToStore = value;
                const serialized = JSON.stringify(value);
                // Compress if enabled and data is large enough
                if ((options.compress || this.config.enableCompression) &&
                    serialized.length > this.config.compressionThreshold) {
                    // In a real implementation, you'd use actual compression
                    dataToStore = { __compressed: true, data: value };
                }
                if (ttl) {
                    yield this.redis.setex(key, ttl, JSON.stringify(dataToStore));
                }
                else {
                    yield this.redis.set(key, JSON.stringify(dataToStore));
                }
            }), 'set');
        });
    }
    // Optimized multi-get operation
    multiGet(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keys.length === 0)
                return {};
            return this.executeWithCircuitBreaker(() => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.redis.pipeline();
                keys.forEach(key => pipeline.get(key));
                const results = yield pipeline.exec();
                const output = {};
                keys.forEach((key, index) => {
                    const result = results === null || results === void 0 ? void 0 : results[index];
                    if (result && result[1]) {
                        try {
                            const parsed = JSON.parse(result[1]);
                            output[key] = parsed.__compressed ? parsed.data : parsed;
                        }
                        catch (error) {
                            console.error(`Error parsing data for key ${key}:`, error);
                            output[key] = null;
                        }
                    }
                    else {
                        output[key] = null;
                    }
                });
                return output;
            }), 'multi_get', () => __awaiter(this, void 0, void 0, function* () {
                // Fallback: return empty results
                const fallbackResult = {};
                keys.forEach(key => fallbackResult[key] = null);
                return fallbackResult;
            }));
        });
    }
    // Optimized multi-set operation
    multiSet(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = Object.keys(data);
            if (keys.length === 0)
                return;
            return this.executeWithCircuitBreaker(() => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.redis.pipeline();
                for (const key of keys) {
                    const { value, ttl } = data[key];
                    let dataToStore = value;
                    const serialized = JSON.stringify(value);
                    // Compress large values
                    if (this.config.enableCompression && serialized.length > this.config.compressionThreshold) {
                        dataToStore = { __compressed: true, data: value };
                    }
                    if (ttl) {
                        pipeline.setex(key, ttl, JSON.stringify(dataToStore));
                    }
                    else {
                        pipeline.set(key, JSON.stringify(dataToStore));
                    }
                }
                yield pipeline.exec();
                console.log(`📦 Multi-set completed for ${keys.length} keys`);
            }), 'multi_set');
        });
    }
    // Get circuit breaker status
    getCircuitBreakerStatus() {
        const status = {};
        this.circuitBreakers.forEach((state, name) => {
            status[name] = Object.assign({}, state);
        });
        return status;
    }
    // Reset circuit breaker
    resetCircuitBreaker(serviceName) {
        const breaker = this.circuitBreakers.get(serviceName);
        if (breaker) {
            breaker.failures = 0;
            breaker.state = 'closed';
            breaker.nextAttempt = 0;
            console.log(`🔄 Circuit breaker reset for ${serviceName}`);
        }
    }
    // Get optimization stats
    getOptimizationStats() {
        return {
            circuitBreakers: this.getCircuitBreakerStatus(),
            batchQueueSize: this.batchQueue.length,
            config: Object.assign({}, this.config)
        };
    }
    // Update configuration
    updateConfig(newConfig) {
        this.config = Object.assign(Object.assign({}, this.config), newConfig);
        console.log('🔧 Redis optimization config updated:', newConfig);
    }
}
exports.RedisOptimizationService = RedisOptimizationService;
exports.redisOptimizationService = new RedisOptimizationService();
