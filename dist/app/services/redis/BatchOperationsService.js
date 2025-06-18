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
exports.batchOperationsService = exports.BatchOperationsService = void 0;
const OptimizedRedisService_1 = require("./OptimizedRedisService");
const FeatureToggleService_1 = require("./FeatureToggleService");
class BatchOperationsService {
    constructor() {
        this.operationQueue = [];
        this.priorityQueue = [];
        this.batchTimer = null;
        this.isProcessing = false;
        this.operationCounter = 0;
        this.config = {
            maxBatchSize: 100,
            batchTimeout: 50, // 50ms
            enableCompression: true,
            priorityQueues: true
        };
        this.redis = OptimizedRedisService_1.optimizedRedisService.getPrimaryClient();
        // Listen to feature changes
        FeatureToggleService_1.featureToggleService.onFeatureChange('performance_monitoring', (enabled) => {
            if (!enabled) {
                // Reduce batch size when monitoring is disabled
                this.config.maxBatchSize = 50;
                this.config.batchTimeout = 100;
            }
        });
    }
    // Add operation to batch queue
    addOperation(operation) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const batchOp = Object.assign(Object.assign({}, operation), { id: `op_${++this.operationCounter}`, resolve,
                    reject });
                // Add to appropriate queue
                if (this.config.priorityQueues && this.isPriorityOperation(operation)) {
                    this.priorityQueue.push(batchOp);
                }
                else {
                    this.operationQueue.push(batchOp);
                }
                // Process batch if size limit reached
                if (this.getTotalQueueSize() >= this.config.maxBatchSize) {
                    this.processBatch();
                }
                else if (!this.batchTimer) {
                    // Set timer for batch processing
                    this.batchTimer = setTimeout(() => {
                        this.processBatch();
                    }, this.config.batchTimeout);
                }
            });
        });
    }
    // Batch get operations
    batchGet(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keys.length === 0)
                return {};
            const operations = keys.map(key => ({
                type: 'get',
                key
            }));
            const results = yield this.executeBatchOperations(operations);
            const output = {};
            keys.forEach((key, index) => {
                const result = results[index];
                if (result && result.result) {
                    try {
                        output[key] = JSON.parse(result.result);
                    }
                    catch (_a) {
                        output[key] = result.result;
                    }
                }
                else {
                    output[key] = null;
                }
            });
            return output;
        });
    }
    // Batch set operations
    batchSet(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = Object.keys(data);
            if (keys.length === 0)
                return;
            const operations = keys.map(key => {
                const { value, ttl } = data[key];
                const serializedValue = JSON.stringify(value);
                return ttl ? {
                    type: 'setex',
                    key,
                    ttl,
                    value: serializedValue
                } : {
                    type: 'set',
                    key,
                    value: serializedValue
                };
            });
            yield this.executeBatchOperations(operations);
            console.log(`📦 Batch set completed for ${keys.length} keys`);
        });
    }
    // Batch delete operations
    batchDelete(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keys.length === 0)
                return 0;
            const operations = keys.map(key => ({
                type: 'del',
                key
            }));
            const results = yield this.executeBatchOperations(operations);
            const deletedCount = results.reduce((sum, result) => sum + (result.result || 0), 0);
            console.log(`🗑️ Batch delete completed: ${deletedCount} keys deleted`);
            return deletedCount;
        });
    }
    // Batch exists operations
    batchExists(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keys.length === 0)
                return {};
            const operations = keys.map(key => ({
                type: 'exists',
                key
            }));
            const results = yield this.executeBatchOperations(operations);
            const output = {};
            keys.forEach((key, index) => {
                var _a;
                output[key] = !!((_a = results[index]) === null || _a === void 0 ? void 0 : _a.result);
            });
            return output;
        });
    }
    // Batch increment operations
    batchIncrement(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = Object.keys(data);
            if (keys.length === 0)
                return {};
            const operations = keys.map(key => ({
                type: data[key] === 1 ? 'incr' : 'incrby',
                key,
                increment: data[key]
            }));
            const results = yield this.executeBatchOperations(operations);
            const output = {};
            keys.forEach((key, index) => {
                var _a;
                output[key] = ((_a = results[index]) === null || _a === void 0 ? void 0 : _a.result) || 0;
            });
            return output;
        });
    }
    // Execute batch operations using pipeline
    executeBatchOperations(operations) {
        return __awaiter(this, void 0, void 0, function* () {
            if (operations.length === 0)
                return [];
            try {
                const pipeline = this.redis.pipeline();
                // Add operations to pipeline
                for (const op of operations) {
                    switch (op.type) {
                        case 'get':
                            pipeline.get(op.key);
                            break;
                        case 'set':
                            pipeline.set(op.key, op.value);
                            break;
                        case 'setex':
                            pipeline.setex(op.key, op.ttl, op.value);
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
                        case 'incr':
                            pipeline.incr(op.key);
                            break;
                        case 'decr':
                            pipeline.decr(op.key);
                            break;
                        case 'sadd':
                            pipeline.sadd(op.key, ...(op.members || []));
                            break;
                        case 'srem':
                            pipeline.srem(op.key, ...(op.members || []));
                            break;
                    }
                }
                // Execute pipeline
                const results = yield pipeline.exec();
                if (!results) {
                    throw new Error('Pipeline execution failed');
                }
                // Process results
                return results.map(([error, result]) => {
                    if (error) {
                        throw error;
                    }
                    return { result };
                });
            }
            catch (error) {
                console.error('Batch operation failed:', error);
                throw error;
            }
        });
    }
    // Process queued operations
    processBatch() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isProcessing)
                return;
            this.isProcessing = true;
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
                this.batchTimer = null;
            }
            try {
                // Get operations to process (priority first)
                const operations = [
                    ...this.priorityQueue.splice(0, this.config.maxBatchSize),
                    ...this.operationQueue.splice(0, this.config.maxBatchSize - this.priorityQueue.length)
                ];
                if (operations.length === 0) {
                    this.isProcessing = false;
                    return;
                }
                console.log(`📦 Processing batch of ${operations.length} operations`);
                // Execute using pipeline
                const pipeline = this.redis.pipeline();
                for (const op of operations) {
                    switch (op.type) {
                        case 'get':
                            pipeline.get(op.key);
                            break;
                        case 'set':
                            pipeline.set(op.key, op.value);
                            break;
                        case 'setex':
                            pipeline.setex(op.key, op.ttl, op.value);
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
                        case 'incr':
                            pipeline.incr(op.key);
                            break;
                        case 'decr':
                            pipeline.decr(op.key);
                            break;
                        case 'sadd':
                            pipeline.sadd(op.key, ...(op.members || []));
                            break;
                        case 'srem':
                            pipeline.srem(op.key, ...(op.members || []));
                            break;
                    }
                }
                const results = yield pipeline.exec();
                // Resolve/reject individual operations
                operations.forEach((op, index) => {
                    var _a, _b, _c;
                    const result = results === null || results === void 0 ? void 0 : results[index];
                    if (result) {
                        const [error, value] = result;
                        if (error) {
                            (_a = op.reject) === null || _a === void 0 ? void 0 : _a.call(op, error);
                        }
                        else {
                            (_b = op.resolve) === null || _b === void 0 ? void 0 : _b.call(op, value);
                        }
                    }
                    else {
                        (_c = op.reject) === null || _c === void 0 ? void 0 : _c.call(op, new Error('No result from pipeline'));
                    }
                });
            }
            catch (error) {
                console.error('Error processing batch:', error);
                // Reject all pending operations
                [...this.priorityQueue, ...this.operationQueue].forEach(op => {
                    var _a;
                    (_a = op.reject) === null || _a === void 0 ? void 0 : _a.call(op, error);
                });
                this.priorityQueue = [];
                this.operationQueue = [];
            }
            finally {
                this.isProcessing = false;
                // Process remaining operations if any
                if (this.getTotalQueueSize() > 0) {
                    setTimeout(() => this.processBatch(), 10);
                }
            }
        });
    }
    // Helper methods
    isPriorityOperation(operation) {
        // Priority operations: auth, OTP, sessions
        return operation.key.includes('jwt:') ||
            operation.key.includes('otp:') ||
            operation.key.includes('session:') ||
            operation.key.includes('auth:');
    }
    getTotalQueueSize() {
        return this.priorityQueue.length + this.operationQueue.length;
    }
    // Configuration methods
    updateConfig(newConfig) {
        this.config = Object.assign(Object.assign({}, this.config), newConfig);
        console.log('🔧 Batch operations config updated:', newConfig);
    }
    getConfig() {
        return Object.assign({}, this.config);
    }
    // Statistics
    getStats() {
        return {
            queueSize: this.getTotalQueueSize(),
            priorityQueueSize: this.priorityQueue.length,
            regularQueueSize: this.operationQueue.length,
            isProcessing: this.isProcessing,
            config: this.config
        };
    }
    // Force process batch (for testing or manual triggers)
    forceProcessBatch() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.processBatch();
        });
    }
    // Clear all queues
    clearQueues() {
        this.priorityQueue = [];
        this.operationQueue = [];
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        console.log('🧹 Batch operation queues cleared');
    }
    // Cleanup
    cleanup() {
        this.clearQueues();
        this.isProcessing = false;
        console.log('🧹 Batch operations service cleaned up');
    }
}
exports.BatchOperationsService = BatchOperationsService;
exports.batchOperationsService = new BatchOperationsService();
