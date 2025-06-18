import { Redis } from 'ioredis';
import { redisServiceManager } from './RedisServiceManager';

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  nextAttempt: number;
}

interface BatchOperation {
  type: 'get' | 'set' | 'del' | 'exists' | 'expire';
  key: string;
  value?: any;
  ttl?: number;
}

interface OptimizationConfig {
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  batchSize: number;
  batchTimeout: number;
  enableCompression: boolean;
  compressionThreshold: number;
}

export class RedisOptimizationService {
  private redis: Redis;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private batchQueue: BatchOperation[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private config: OptimizationConfig;

  constructor() {
    this.redis = redisServiceManager.primaryClient;
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
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    serviceName: string = 'redis',
    fallback?: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(serviceName);
    
    // Check if circuit is open
    if (breaker.state === 'open') {
      if (Date.now() < breaker.nextAttempt) {
        console.log(`🚫 Circuit breaker OPEN for ${serviceName}, using fallback`);
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Circuit breaker is OPEN for ${serviceName}`);
      } else {
        // Try to close circuit (half-open state)
        breaker.state = 'half-open';
        console.log(`🔄 Circuit breaker HALF-OPEN for ${serviceName}`);
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit breaker
      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
        breaker.failures = 0;
        console.log(`✅ Circuit breaker CLOSED for ${serviceName}`);
      }
      
      return result;
    } catch (error) {
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
        return await fallback();
      }
      
      throw error;
    }
  }

  private getCircuitBreaker(serviceName: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, {
        failures: 0,
        lastFailureTime: 0,
        state: 'closed',
        nextAttempt: 0
      });
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  // Batch operations to reduce Redis calls
  async batchOperation(operation: BatchOperation): Promise<void> {
    this.batchQueue.push(operation);
    
    // Process batch if it reaches the size limit
    if (this.batchQueue.length >= this.config.batchSize) {
      await this.processBatch();
    } else if (!this.batchTimer) {
      // Set timer to process batch after timeout
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.config.batchTimeout);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;
    
    const operations = [...this.batchQueue];
    this.batchQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      await this.executeWithCircuitBreaker(async () => {
        const pipeline = this.redis.pipeline();
        
        for (const op of operations) {
          switch (op.type) {
            case 'get':
              pipeline.get(op.key);
              break;
            case 'set':
              if (op.ttl) {
                pipeline.setex(op.key, op.ttl, JSON.stringify(op.value));
              } else {
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
              pipeline.expire(op.key, op.ttl!);
              break;
          }
        }
        
        const results = await pipeline.exec();
        console.log(`📦 Processed batch of ${operations.length} Redis operations`);
        return results;
      }, 'batch_operations');
    } catch (error) {
      console.error('Batch operation failed:', error);
    }
  }

  // Optimized get with compression support
  async optimizedGet<T>(key: string, fallback?: () => Promise<T>): Promise<T | null> {
    return this.executeWithCircuitBreaker(async () => {
      const data = await this.redis.get(key);
      if (!data) return null;
      
      try {
        const parsed = JSON.parse(data);
        
        // Handle compressed data
        if (parsed.__compressed) {
          // In a real implementation, you'd decompress here
          return parsed.data;
        }
        
        return parsed;
      } catch (error) {
        console.error(`Error parsing cached data for key ${key}:`, error);
        return null;
      }
    }, 'get', fallback);
  }

  // Optimized set with compression
  async optimizedSet<T>(
    key: string, 
    value: T, 
    ttl?: number, 
    options: { compress?: boolean; priority?: string } = {}
  ): Promise<void> {
    return this.executeWithCircuitBreaker(async () => {
      let dataToStore = value;
      const serialized = JSON.stringify(value);
      
      // Compress if enabled and data is large enough
      if ((options.compress || this.config.enableCompression) && 
          serialized.length > this.config.compressionThreshold) {
        // In a real implementation, you'd use actual compression
        dataToStore = { __compressed: true, data: value } as any;
      }
      
      if (ttl) {
        await this.redis.setex(key, ttl, JSON.stringify(dataToStore));
      } else {
        await this.redis.set(key, JSON.stringify(dataToStore));
      }
    }, 'set');
  }

  // Optimized multi-get operation
  async multiGet<T>(keys: string[]): Promise<Record<string, T | null>> {
    if (keys.length === 0) return {};
    
    return this.executeWithCircuitBreaker(async () => {
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.get(key));
      
      const results = await pipeline.exec();
      const output: Record<string, T | null> = {};
      
      keys.forEach((key, index) => {
        const result = results?.[index];
        if (result && result[1]) {
          try {
            const parsed = JSON.parse(result[1] as string);
            output[key] = parsed.__compressed ? parsed.data : parsed;
          } catch (error) {
            console.error(`Error parsing data for key ${key}:`, error);
            output[key] = null;
          }
        } else {
          output[key] = null;
        }
      });
      
      return output;
    }, 'multi_get', async () => {
      // Fallback: return empty results
      const fallbackResult: Record<string, T | null> = {};
      keys.forEach(key => fallbackResult[key] = null);
      return fallbackResult;
    });
  }

  // Optimized multi-set operation
  async multiSet<T>(data: Record<string, { value: T; ttl?: number }>): Promise<void> {
    const keys = Object.keys(data);
    if (keys.length === 0) return;
    
    return this.executeWithCircuitBreaker(async () => {
      const pipeline = this.redis.pipeline();
      
      for (const key of keys) {
        const { value, ttl } = data[key];
        let dataToStore = value;
        const serialized = JSON.stringify(value);
        
        // Compress large values
        if (this.config.enableCompression && serialized.length > this.config.compressionThreshold) {
          dataToStore = { __compressed: true, data: value } as any;
        }
        
        if (ttl) {
          pipeline.setex(key, ttl, JSON.stringify(dataToStore));
        } else {
          pipeline.set(key, JSON.stringify(dataToStore));
        }
      }
      
      await pipeline.exec();
      console.log(`📦 Multi-set completed for ${keys.length} keys`);
    }, 'multi_set');
  }

  // Get circuit breaker status
  getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    const status: Record<string, CircuitBreakerState> = {};
    this.circuitBreakers.forEach((state, name) => {
      status[name] = { ...state };
    });
    return status;
  }

  // Reset circuit breaker
  resetCircuitBreaker(serviceName: string): void {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
      breaker.nextAttempt = 0;
      console.log(`🔄 Circuit breaker reset for ${serviceName}`);
    }
  }

  // Get optimization stats
  getOptimizationStats(): {
    circuitBreakers: Record<string, CircuitBreakerState>;
    batchQueueSize: number;
    config: OptimizationConfig;
  } {
    return {
      circuitBreakers: this.getCircuitBreakerStatus(),
      batchQueueSize: this.batchQueue.length,
      config: { ...this.config }
    };
  }

  // Update configuration
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Redis optimization config updated:', newConfig);
  }
}

export const redisOptimizationService = new RedisOptimizationService();
