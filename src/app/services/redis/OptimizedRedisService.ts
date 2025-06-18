import { Redis } from 'ioredis';
import config from '../../config';
import { redisOptimizationService } from './RedisOptimizationService';
import { smartCacheService } from '../cache/SmartCacheService';
import { featureToggleService } from './FeatureToggleService';

interface PrefixedRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<'OK'>;
  setex(key: string, seconds: number, value: string): Promise<'OK'>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  decrby(key: string, decrement: number): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  lpush(key: string, ...values: string[]): Promise<number>;
  rpush(key: string, ...values: string[]): Promise<number>;
  lpop(key: string): Promise<string | null>;
  rpop(key: string): Promise<string | null>;
  llen(key: string): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<'OK'>;
  pipeline(): any;
  ping(): Promise<'PONG'>;
}

export class OptimizedRedisService {
  private static instance: OptimizedRedisService;
  private primaryClient: Redis;
  private connectionCount = 0;
  private maxConnections = 2; // Limit to 2 connections total (primary + jobs)

  // Prefixed clients using the same connection
  public readonly authClient: PrefixedRedisClient;
  public readonly cacheClient: PrefixedRedisClient;
  public readonly sessionsClient: PrefixedRedisClient;
  public readonly jobsClient: Redis; // Jobs need a separate client for BullMQ

  private constructor() {
    console.log('🔧 Initializing Optimized Redis Service...');
    
    // Single optimized Redis configuration
    const redisConfig = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      family: 4,
      keepAlive: 60000, // 60 seconds keep alive
      connectTimeout: 15000,
      commandTimeout: 10000,
      retryDelayOnFailover: 500,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 2, // Reduced retries
      lazyConnect: true,
      tls: config.redis.host.includes('upstash.io') ? {} : undefined,
      // Connection pooling
      enableReadyCheck: true,
      maxLoadingTimeout: 5000,
    };

    // Primary client (connection 1)
    this.primaryClient = new Redis(redisConfig);
    this.connectionCount++;

    // Jobs client (connection 2) - Required for BullMQ
    this.jobsClient = new Redis({
      ...redisConfig,
      maxRetriesPerRequest: null, // Required for BullMQ
      keyPrefix: 'jobs:',
    });
    this.connectionCount++;

    // Create prefixed clients using the same primary connection
    this.authClient = this.createPrefixedClient('auth:');
    this.cacheClient = this.createPrefixedClient('cache:');
    this.sessionsClient = this.createPrefixedClient('sessions:');

    this.setupEventHandlers();
    this.setupOptimizations();

    console.log(`✅ Optimized Redis Service initialized with ${this.connectionCount} connections`);
  }

  public static getInstance(): OptimizedRedisService {
    if (!OptimizedRedisService.instance) {
      OptimizedRedisService.instance = new OptimizedRedisService();
    }
    return OptimizedRedisService.instance;
  }

  private createPrefixedClient(prefix: string): PrefixedRedisClient {
    const client = this.primaryClient;
    
    return {
      async get(key: string) {
        return redisOptimizationService.optimizedGet(prefix + key);
      },
      
      async set(key: string, value: string) {
        await redisOptimizationService.optimizedSet(prefix + key, value);
        return 'OK' as const;
      },
      
      async setex(key: string, seconds: number, value: string) {
        await redisOptimizationService.optimizedSet(prefix + key, value, seconds);
        return 'OK' as const;
      },
      
      async del(key: string) {
        return client.del(prefix + key);
      },
      
      async exists(key: string) {
        return client.exists(prefix + key);
      },
      
      async expire(key: string, seconds: number) {
        return client.expire(prefix + key, seconds);
      },
      
      async ttl(key: string) {
        return client.ttl(prefix + key);
      },
      
      async incr(key: string) {
        return client.incr(prefix + key);
      },
      
      async decr(key: string) {
        return client.decr(prefix + key);
      },
      
      async incrby(key: string, increment: number) {
        return client.incrby(prefix + key, increment);
      },
      
      async decrby(key: string, decrement: number) {
        return client.decrby(prefix + key, decrement);
      },
      
      async sadd(key: string, ...members: string[]) {
        return client.sadd(prefix + key, ...members);
      },
      
      async srem(key: string, ...members: string[]) {
        return client.srem(prefix + key, ...members);
      },
      
      async smembers(key: string) {
        return client.smembers(prefix + key);
      },
      
      async lpush(key: string, ...values: string[]) {
        return client.lpush(prefix + key, ...values);
      },
      
      async rpush(key: string, ...values: string[]) {
        return client.rpush(prefix + key, ...values);
      },
      
      async lpop(key: string) {
        return client.lpop(prefix + key);
      },
      
      async rpop(key: string) {
        return client.rpop(prefix + key);
      },
      
      async llen(key: string) {
        return client.llen(prefix + key);
      },
      
      async ltrim(key: string, start: number, stop: number) {
        return client.ltrim(prefix + key, start, stop);
      },
      
      pipeline() {
        // For now, return the basic pipeline without proxy
        // The prefix will need to be added manually when using pipeline
        return client.pipeline();
      },
      
      async ping() {
        return client.ping();
      }
    };
  }

  private setupEventHandlers(): void {
    this.primaryClient.on('connect', () => {
      console.log('✅ Primary Redis client connected');
    });

    this.primaryClient.on('ready', () => {
      console.log('✅ Primary Redis client ready');
    });

    this.primaryClient.on('error', (error) => {
      console.error('❌ Primary Redis client error:', error);
      
      // Auto-optimize on connection errors
      if (error.message.includes('timeout') || error.message.includes('connection')) {
        this.handleConnectionError();
      }
    });

    this.jobsClient.on('connect', () => {
      console.log('✅ Jobs Redis client connected');
    });

    this.jobsClient.on('error', (error) => {
      console.error('❌ Jobs Redis client error:', error);
    });
  }

  private setupOptimizations(): void {
    // Monitor Redis usage and auto-optimize
    setInterval(async () => {
      try {
        const info = await this.primaryClient.info('memory');
        const usedMatch = info.match(/used_memory:(\d+)/);
        const used = usedMatch ? parseInt(usedMatch[1]) : 0;
        const freeLimit = 256 * 1024 * 1024; // 256MB
        const percentage = (used / freeLimit) * 100;
        
        // Auto-optimize features based on usage
        featureToggleService.autoOptimizeBasedOnUsage(percentage);
        
        if (percentage > 80) {
          console.log('🚨 High Redis usage detected, enabling aggressive optimization');
          await this.enableAggressiveOptimization();
        }
      } catch (error) {
        console.error('Error in auto-optimization:', error);
      }
    }, 60000); // Check every minute
  }

  private handleConnectionError(): void {
    console.log('🔧 Handling Redis connection error with optimization');
    
    // Enable conservative mode
    featureToggleService.setOptimizationMode('conservative');
    
    // Clear non-critical caches
    smartCacheService.clearL1();
  }

  private async enableAggressiveOptimization(): Promise<void> {
    // Enable aggressive mode
    featureToggleService.setOptimizationMode('aggressive');
    
    // Clear L1 cache to free memory
    smartCacheService.clearL1();
    
    // Update optimization config for more aggressive settings
    redisOptimizationService.updateConfig({
      batchSize: 100, // Larger batches
      batchTimeout: 50, // Faster batching
      enableCompression: true,
      compressionThreshold: 512 // Compress smaller values
    });
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    connections: number;
    maxConnections: number;
    primaryClient: boolean;
    jobsClient: boolean;
  }> {
    try {
      const [primaryPing, jobsPing] = await Promise.allSettled([
        this.primaryClient.ping(),
        this.jobsClient.ping()
      ]);

      const primaryHealthy = primaryPing.status === 'fulfilled';
      const jobsHealthy = jobsPing.status === 'fulfilled';

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (primaryHealthy && jobsHealthy) {
        status = 'healthy';
      } else if (primaryHealthy) {
        status = 'degraded'; // Primary is healthy, jobs might be down
      } else {
        status = 'unhealthy';
      }

      return {
        status,
        connections: this.connectionCount,
        maxConnections: this.maxConnections,
        primaryClient: primaryHealthy,
        jobsClient: jobsHealthy
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connections: this.connectionCount,
        maxConnections: this.maxConnections,
        primaryClient: false,
        jobsClient: false
      };
    }
  }

  // Get the primary client for direct access when needed
  getPrimaryClient(): Redis {
    return this.primaryClient;
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Optimized Redis Service...');
    
    try {
      await Promise.all([
        this.primaryClient.disconnect(),
        this.jobsClient.disconnect()
      ]);
      console.log('✅ Optimized Redis Service shutdown complete');
    } catch (error) {
      console.error('❌ Error during Redis shutdown:', error);
    }
  }
}

export const optimizedRedisService = OptimizedRedisService.getInstance();
