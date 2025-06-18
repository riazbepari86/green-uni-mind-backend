import { Redis } from 'ioredis';
import { optimizedRedisService } from './OptimizedRedisService';
import { featureToggleService } from './FeatureToggleService';

interface BatchOperation {
  id: string;
  type: 'get' | 'set' | 'setex' | 'del' | 'exists' | 'expire' | 'incr' | 'incrby' | 'decr' | 'sadd' | 'srem';
  key: string;
  value?: any;
  ttl?: number;
  members?: string[];
  increment?: number;
  resolve?: (result: any) => void;
  reject?: (error: any) => void;
}

interface BatchConfig {
  maxBatchSize: number;
  batchTimeout: number;
  enableCompression: boolean;
  priorityQueues: boolean;
}

export class BatchOperationsService {
  private redis: Redis;
  private operationQueue: BatchOperation[] = [];
  private priorityQueue: BatchOperation[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private operationCounter = 0;

  private config: BatchConfig = {
    maxBatchSize: 25, // Reduced from 100 to 25 to minimize Redis operations
    batchTimeout: 200, // Increased from 50ms to 200ms to batch more efficiently
    enableCompression: true,
    priorityQueues: true
  };

  constructor() {
    this.redis = optimizedRedisService.getPrimaryClient();
    
    // Listen to feature changes
    featureToggleService.onFeatureChange('performance_monitoring', (enabled) => {
      if (!enabled) {
        // Reduce batch size when monitoring is disabled
        this.config.maxBatchSize = 50;
        this.config.batchTimeout = 100;
      }
    });
  }

  // Add operation to batch queue
  async addOperation(operation: Omit<BatchOperation, 'id' | 'resolve' | 'reject'>): Promise<any> {
    return new Promise((resolve, reject) => {
      const batchOp: BatchOperation = {
        ...operation,
        id: `op_${++this.operationCounter}`,
        resolve,
        reject
      };

      // Add to appropriate queue
      if (this.config.priorityQueues && this.isPriorityOperation(operation)) {
        this.priorityQueue.push(batchOp);
      } else {
        this.operationQueue.push(batchOp);
      }

      // Process batch if size limit reached
      if (this.getTotalQueueSize() >= this.config.maxBatchSize) {
        this.processBatch();
      } else if (!this.batchTimer) {
        // Set timer for batch processing
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.config.batchTimeout);
      }
    });
  }

  // Batch get operations
  async batchGet(keys: string[]): Promise<Record<string, any>> {
    if (keys.length === 0) return {};

    const operations = keys.map(key => ({
      type: 'get' as const,
      key
    }));

    const results = await this.executeBatchOperations(operations);
    const output: Record<string, any> = {};

    keys.forEach((key, index) => {
      const result = results[index];
      if (result && result.result) {
        try {
          output[key] = JSON.parse(result.result);
        } catch {
          output[key] = result.result;
        }
      } else {
        output[key] = null;
      }
    });

    return output;
  }

  // Batch set operations
  async batchSet(data: Record<string, { value: any; ttl?: number }>): Promise<void> {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const operations = keys.map(key => {
      const { value, ttl } = data[key];
      const serializedValue = JSON.stringify(value);
      
      return ttl ? {
        type: 'setex' as const,
        key,
        ttl,
        value: serializedValue
      } : {
        type: 'set' as const,
        key,
        value: serializedValue
      };
    });

    await this.executeBatchOperations(operations);
    console.log(`📦 Batch set completed for ${keys.length} keys`);
  }

  // Batch delete operations
  async batchDelete(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    const operations = keys.map(key => ({
      type: 'del' as const,
      key
    }));

    const results = await this.executeBatchOperations(operations);
    const deletedCount = results.reduce((sum, result) => sum + (result.result || 0), 0);
    
    console.log(`🗑️ Batch delete completed: ${deletedCount} keys deleted`);
    return deletedCount;
  }

  // Batch exists operations
  async batchExists(keys: string[]): Promise<Record<string, boolean>> {
    if (keys.length === 0) return {};

    const operations = keys.map(key => ({
      type: 'exists' as const,
      key
    }));

    const results = await this.executeBatchOperations(operations);
    const output: Record<string, boolean> = {};

    keys.forEach((key, index) => {
      output[key] = !!(results[index]?.result);
    });

    return output;
  }

  // Batch increment operations
  async batchIncrement(data: Record<string, number>): Promise<Record<string, number>> {
    const keys = Object.keys(data);
    if (keys.length === 0) return {};

    const operations = keys.map(key => ({
      type: data[key] === 1 ? 'incr' as const : 'incrby' as const,
      key,
      increment: data[key]
    }));

    const results = await this.executeBatchOperations(operations);
    const output: Record<string, number> = {};

    keys.forEach((key, index) => {
      output[key] = results[index]?.result || 0;
    });

    return output;
  }

  // Execute batch operations using pipeline
  private async executeBatchOperations(operations: Omit<BatchOperation, 'id' | 'resolve' | 'reject'>[]): Promise<any[]> {
    if (operations.length === 0) return [];

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
            pipeline.setex(op.key, op.ttl!, op.value);
            break;
          case 'del':
            pipeline.del(op.key);
            break;
          case 'exists':
            pipeline.exists(op.key);
            break;
          case 'expire':
            pipeline.expire(op.key, op.ttl!);
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
      const results = await pipeline.exec();
      
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

    } catch (error) {
      console.error('Batch operation failed:', error);
      throw error;
    }
  }

  // Process queued operations
  private async processBatch(): Promise<void> {
    if (this.isProcessing) return;

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
            pipeline.setex(op.key, op.ttl!, op.value);
            break;
          case 'del':
            pipeline.del(op.key);
            break;
          case 'exists':
            pipeline.exists(op.key);
            break;
          case 'expire':
            pipeline.expire(op.key, op.ttl!);
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

      const results = await pipeline.exec();

      // Resolve/reject individual operations
      operations.forEach((op, index) => {
        const result = results?.[index];
        if (result) {
          const [error, value] = result;
          if (error) {
            op.reject?.(error);
          } else {
            op.resolve?.(value);
          }
        } else {
          op.reject?.(new Error('No result from pipeline'));
        }
      });

    } catch (error) {
      console.error('Error processing batch:', error);
      
      // Reject all pending operations
      [...this.priorityQueue, ...this.operationQueue].forEach(op => {
        op.reject?.(error);
      });
      
      this.priorityQueue = [];
      this.operationQueue = [];
    } finally {
      this.isProcessing = false;
      
      // Process remaining operations if any
      if (this.getTotalQueueSize() > 0) {
        setTimeout(() => this.processBatch(), 10);
      }
    }
  }

  // Helper methods
  private isPriorityOperation(operation: Omit<BatchOperation, 'id' | 'resolve' | 'reject'>): boolean {
    // Priority operations: auth, OTP, sessions
    return operation.key.includes('jwt:') || 
           operation.key.includes('otp:') || 
           operation.key.includes('session:') ||
           operation.key.includes('auth:');
  }

  private getTotalQueueSize(): number {
    return this.priorityQueue.length + this.operationQueue.length;
  }

  // Configuration methods
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Batch operations config updated:', newConfig);
  }

  getConfig(): BatchConfig {
    return { ...this.config };
  }

  // Statistics
  getStats(): {
    queueSize: number;
    priorityQueueSize: number;
    regularQueueSize: number;
    isProcessing: boolean;
    config: BatchConfig;
  } {
    return {
      queueSize: this.getTotalQueueSize(),
      priorityQueueSize: this.priorityQueue.length,
      regularQueueSize: this.operationQueue.length,
      isProcessing: this.isProcessing,
      config: this.config
    };
  }

  // Force process batch (for testing or manual triggers)
  async forceProcessBatch(): Promise<void> {
    await this.processBatch();
  }

  // Clear all queues
  clearQueues(): void {
    this.priorityQueue = [];
    this.operationQueue = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    console.log('🧹 Batch operation queues cleared');
  }

  // Cleanup
  cleanup(): void {
    this.clearQueues();
    this.isProcessing = false;
    console.log('🧹 Batch operations service cleaned up');
  }
}

export const batchOperationsService = new BatchOperationsService();
