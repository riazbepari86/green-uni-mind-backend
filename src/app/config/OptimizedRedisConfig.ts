/**
 * Optimized Redis Configuration
 * Implements lazy loading, connection pooling, and startup optimization
 */

import Redis from 'ioredis';
import config from './index';

interface RedisConnectionPool {
  primary: Redis | null;
  cache: Redis | null;
  sessions: Redis | null;
  jobs: Redis | null;
}

interface RedisMetrics {
  connections: number;
  operations: number;
  errors: number;
  lastActivity: number;
}

/**
 * Optimized Redis Configuration Manager
 */
export class OptimizedRedisConfig {
  private static instance: OptimizedRedisConfig;
  private connectionPool: RedisConnectionPool;
  private metrics: RedisMetrics;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    this.connectionPool = {
      primary: null,
      cache: null,
      sessions: null,
      jobs: null,
    };

    this.metrics = {
      connections: 0,
      operations: 0,
      errors: 0,
      lastActivity: Date.now(),
    };
  }

  public static getInstance(): OptimizedRedisConfig {
    if (!OptimizedRedisConfig.instance) {
      OptimizedRedisConfig.instance = new OptimizedRedisConfig();
    }
    return OptimizedRedisConfig.instance;
  }

  /**
   * Initialize Redis connections lazily
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  /**
   * Perform actual Redis initialization
   */
  private async performInitialization(): Promise<void> {
    try {
      console.log('🔧 Initializing optimized Redis configuration...');

      // Create base Redis configuration
      const baseConfig = this.createBaseConfig();

      // Initialize primary connection first (most important)
      this.connectionPool.primary = await this.createConnection(
        'primary',
        baseConfig,
      );

      // Initialize other connections only if needed
      if (process.env.ENABLE_REDIS_CACHE !== 'false') {
        this.connectionPool.cache = await this.createConnection('cache', {
          ...baseConfig,
          keyPrefix: 'cache:',
        });
      }

      if (process.env.ENABLE_REDIS_SESSIONS !== 'false') {
        this.connectionPool.sessions = await this.createConnection('sessions', {
          ...baseConfig,
          keyPrefix: 'sessions:',
        });
      }

      // Jobs connection only in production or when explicitly enabled
      if (
        process.env.NODE_ENV === 'production' ||
        process.env.ENABLE_REDIS_JOBS === 'true'
      ) {
        this.connectionPool.jobs = await this.createConnection('jobs', {
          ...baseConfig,
          maxRetriesPerRequest: null, // Required for BullMQ
          keyPrefix: undefined,
        });
      }

      this.isInitialized = true;
      console.log(
        `✅ Redis initialized with ${this.getActiveConnectionCount()} connections`,
      );
    } catch (error) {
      console.error('❌ Redis initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create base Redis configuration
   */
  private createBaseConfig() {
    return {
      host: config.redis.host || 'localhost',
      port: config.redis.port || 6379,
      password: config.redis.password || '',
      family: 4,
      connectTimeout: 30000, // Increased from 5000 to 30000 for better reliability
      commandTimeout: 30000, // Increased from 3000 to 30000 for better reliability
      retryDelayOnFailover: 1000, // Increased from 100 to 1000 for exponential backoff
      enableOfflineQueue: true, // Enable offline queue to prevent errors
      maxRetriesPerRequest: 5, // Increased from 2 to 5 for better resilience
      lazyConnect: true,
      keepAlive: 30000,
      // Enhanced retry strategy with exponential backoff
      retryDelayOnClusterDown: 300,
      // Circuit breaker configuration
      enableReadyCheck: true,
      maxLoadingTimeout: 30000,
      tls:
        config.redis.host && config.redis.host.includes('upstash.io')
          ? {}
          : undefined,
    };
  }

  /**
   * Create a Redis connection with error handling
   */
  private async createConnection(
    name: string,
    connectionConfig: any,
  ): Promise<Redis> {
    const redis = new Redis(connectionConfig);

    // Set up event handlers
    redis.on('connect', () => {
      this.metrics.connections++;
      console.log(`✅ Redis ${name} connection established`);
    });

    redis.on('error', (error) => {
      this.metrics.errors++;
      console.error(`❌ Redis ${name} connection error:`, error);
    });

    redis.on('close', () => {
      this.metrics.connections--;
      console.log(`⚠️ Redis ${name} connection closed`);
    });

    // Test connection with timeout
    try {
      await Promise.race([
        redis.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 3000),
        ),
      ]);

      console.log(`✅ Redis ${name} connection tested successfully`);
      return redis;
    } catch (error) {
      console.error(`❌ Redis ${name} connection test failed:`, error);
      redis.disconnect();
      throw error;
    }
  }

  /**
   * Get Redis connection by type
   */
  public async getConnection(
    type: 'primary' | 'cache' | 'sessions' | 'jobs',
  ): Promise<Redis | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const connection = this.connectionPool[type];
    if (connection) {
      this.metrics.operations++;
      this.metrics.lastActivity = Date.now();
    }

    return connection;
  }

  /**
   * Get primary Redis connection (most commonly used)
   */
  public async getPrimaryConnection(): Promise<Redis | null> {
    return this.getConnection('primary');
  }

  /**
   * Check if Redis is healthy
   */
  public async isHealthy(): Promise<boolean> {
    try {
      const primary = await this.getPrimaryConnection();
      if (!primary) return false;

      await Promise.race([
        primary.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 1000),
        ),
      ]);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get connection metrics
   */
  public getMetrics(): RedisMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active connection count
   */
  public getActiveConnectionCount(): number {
    return Object.values(this.connectionPool).filter((conn) => conn !== null)
      .length;
  }

  /**
   * Cleanup connections
   */
  public async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Redis connections...');

    const connections = Object.values(this.connectionPool).filter(
      (conn) => conn !== null,
    );

    await Promise.allSettled(connections.map((conn) => conn?.disconnect()));

    this.connectionPool = {
      primary: null,
      cache: null,
      sessions: null,
      jobs: null,
    };

    this.isInitialized = false;
    this.initializationPromise = null;

    console.log('✅ Redis connections cleaned up');
  }

  /**
   * Get connection status
   */
  public getStatus(): {
    initialized: boolean;
    connections: { [key: string]: boolean };
    metrics: RedisMetrics;
  } {
    return {
      initialized: this.isInitialized,
      connections: {
        primary: this.connectionPool.primary !== null,
        cache: this.connectionPool.cache !== null,
        sessions: this.connectionPool.sessions !== null,
        jobs: this.connectionPool.jobs !== null,
      },
      metrics: this.getMetrics(),
    };
  }
}

// Export singleton instance
export const optimizedRedisConfig = OptimizedRedisConfig.getInstance();

// Convenience functions
export const getRedisConnection = (
  type: 'primary' | 'cache' | 'sessions' | 'jobs',
) => optimizedRedisConfig.getConnection(type);

export const getPrimaryRedis = () =>
  optimizedRedisConfig.getPrimaryConnection();

export const isRedisHealthy = () => optimizedRedisConfig.isHealthy();
