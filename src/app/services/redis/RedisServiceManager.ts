import { Redis } from 'ioredis';
import { CacheService } from './CacheService';
import { RedisMonitoringService } from './MonitoringService';
import { CircuitBreakerFactory } from './CircuitBreakerService';
import { IRedisConfig } from './interfaces';
import config from '../../config';

export class RedisServiceManager {
  private static instance: RedisServiceManager;
  
  // Redis clients
  public readonly primaryClient: Redis;
  public readonly authClient: Redis;
  public readonly cacheClient: Redis;
  public readonly jobsClient: Redis;
  public readonly sessionsClient: Redis;
  
  // Services
  public readonly monitoring: RedisMonitoringService;
  public readonly cache: CacheService;
  
  // Circuit breakers
  public readonly authCircuitBreaker;
  public readonly cacheCircuitBreaker;
  public readonly jobsCircuitBreaker;
  public readonly sessionsCircuitBreaker;
  
  private constructor() {
    // Redis connection configuration
    const redisConfig = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      family: 4,
      keepAlive: 30000, // Keep alive timeout in milliseconds
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      tls: config.redis.host.includes('upstash.io') ? {} : undefined,
    };

    // Upstash-optimized Redis configuration with graceful degradation
    const upstashConfig = {
      ...redisConfig,
      db: 0,
      enableOfflineQueue: false, // Disable to prevent infinite queuing when disconnected
      maxRetriesPerRequest: 3, // Limit retries to prevent infinite loops
      retryDelayOnFailover: 1000,
      commandTimeout: 5000, // Shorter timeout to fail fast
      lazyConnect: true,
      maxListeners: 20,
      // Add connection retry configuration
      retryDelayOnClusterDown: 1000,
      enableReadyCheck: true,
      // Limit connection attempts
      connectTimeout: 5000,
      // Add reconnection settings with limits
      reconnectOnError: (err: Error) => {
        // Only reconnect for specific errors, not DNS/network issues
        const reconnectableErrors = ['READONLY', 'LOADING', 'MASTERDOWN'];
        return reconnectableErrors.some(error => err.message.includes(error));
      },
    };

    // Initialize Redis clients (all using db: 0 for Upstash compatibility)
    // We'll use key prefixes to separate different data types
    this.primaryClient = new Redis(upstashConfig);
    this.authClient = new Redis({ ...upstashConfig, keyPrefix: 'auth:' });
    this.cacheClient = new Redis({ ...upstashConfig, keyPrefix: 'cache:' });
    // BullMQ configuration for Upstash
    this.jobsClient = new Redis({
      ...upstashConfig,
      maxRetriesPerRequest: null, // Required for BullMQ
      keyPrefix: undefined // BullMQ handles its own prefixing
    });
    this.sessionsClient = new Redis({ ...upstashConfig, keyPrefix: 'sessions:' });

    // Set max listeners to prevent memory leak warnings
    [this.primaryClient, this.authClient, this.cacheClient, this.jobsClient, this.sessionsClient]
      .forEach(client => client.setMaxListeners(20));

    // Setup event handlers
    this.setupEventHandlers();

    // Initialize monitoring
    this.monitoring = new RedisMonitoringService(this.primaryClient);

    // Initialize cache service
    this.cache = new CacheService(this.cacheClient, this.monitoring);

    // Initialize circuit breakers
    this.authCircuitBreaker = CircuitBreakerFactory.getCircuitBreaker('redis-auth', {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      expectedErrorRate: 0.3
    });

    this.cacheCircuitBreaker = CircuitBreakerFactory.getCircuitBreaker('redis-cache', {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      expectedErrorRate: 0.2
    });

    this.jobsCircuitBreaker = CircuitBreakerFactory.getCircuitBreaker('redis-jobs', {
      failureThreshold: 3,
      recoveryTimeout: 45000,
      expectedErrorRate: 0.1
    });

    this.sessionsCircuitBreaker = CircuitBreakerFactory.getCircuitBreaker('redis-sessions', {
      failureThreshold: 4,
      recoveryTimeout: 30000,
      expectedErrorRate: 0.25
    });
  }

  public static getInstance(): RedisServiceManager {
    if (!RedisServiceManager.instance) {
      RedisServiceManager.instance = new RedisServiceManager();
    }
    return RedisServiceManager.instance;
  }

  private setupEventHandlers(): void {
    const clients = [
      { client: this.primaryClient, name: 'primary' },
      { client: this.authClient, name: 'auth' },
      { client: this.cacheClient, name: 'cache' },
      { client: this.jobsClient, name: 'jobs' },
      { client: this.sessionsClient, name: 'sessions' }
    ];

    clients.forEach(({ client, name }) => {
      client.on('connect', () => {
        console.log(`✅ Redis ${name} client connected successfully`);
      });

      client.on('ready', () => {
        console.log(`✅ Redis ${name} client is ready to accept commands`);
      });

      client.on('error', (error) => {
        console.error(`❌ Redis ${name} client error:`, error);

        // Handle specific timeout errors
        if (error.message.includes('Command timed out')) {
          console.log(`⏸️ Redis ${name} client experiencing timeouts - implementing backoff`);
          // The client will automatically retry with exponential backoff
        }

        // Record the error for monitoring
        this.monitoring?.recordOperation('connection_error', 0, false);
      });

      client.on('close', () => {
        console.log(`⚠️ Redis ${name} client connection closed`);
      });

      client.on('reconnecting', () => {
        console.log(`🔄 Redis ${name} client reconnecting...`);
      });
    });
  }

  // Health check for all Redis clients
  async healthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    clients: Record<string, boolean>;
    monitoring: any;
    circuitBreakers: any;
  }> {
    const clients = {
      primary: await this.isClientHealthy(this.primaryClient),
      auth: await this.isClientHealthy(this.authClient),
      cache: await this.isClientHealthy(this.cacheClient),
      jobs: await this.isClientHealthy(this.jobsClient),
      sessions: await this.isClientHealthy(this.sessionsClient)
    };

    const healthyCount = Object.values(clients).filter(Boolean).length;
    const totalCount = Object.keys(clients).length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      overall = 'healthy';
    } else if (healthyCount >= totalCount * 0.6) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    const monitoringHealth = await this.monitoring.healthCheck();
    const circuitBreakerStatus = CircuitBreakerFactory.getHealthStatus();

    return {
      overall,
      clients,
      monitoring: monitoringHealth,
      circuitBreakers: circuitBreakerStatus
    };
  }

  private async isClientHealthy(client: Redis): Promise<boolean> {
    try {
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Redis service manager...');
    
    const clients = [
      this.primaryClient,
      this.authClient,
      this.cacheClient,
      this.jobsClient,
      this.sessionsClient
    ];

    await Promise.all(clients.map(async (client) => {
      try {
        await client.disconnect();
      } catch (error) {
        console.error('Error disconnecting Redis client:', error);
      }
    }));

    console.log('✅ Redis service manager shutdown complete');
  }

  // Get performance metrics
  async getPerformanceMetrics(): Promise<any> {
    return await this.monitoring.getPerformanceReport();
  }

  // Execute operation with circuit breaker protection
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitBreakerName: 'auth' | 'cache' | 'jobs' | 'sessions',
    fallback?: () => Promise<T>
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(circuitBreakerName);
    return circuitBreaker.execute(operation, fallback);
  }

  private getCircuitBreaker(name: 'auth' | 'cache' | 'jobs' | 'sessions') {
    switch (name) {
      case 'auth':
        return this.authCircuitBreaker;
      case 'cache':
        return this.cacheCircuitBreaker;
      case 'jobs':
        return this.jobsCircuitBreaker;
      case 'sessions':
        return this.sessionsCircuitBreaker;
      default:
        throw new Error(`Unknown circuit breaker: ${name}`);
    }
  }

  // Test Redis connection
  async testConnection(): Promise<{
    success: boolean;
    latency: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.primaryClient.ping();
      return {
        success: true,
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get Redis info
  async getRedisInfo(): Promise<{
    version: string;
    memory: any;
    stats: any;
    clients: any;
  }> {
    try {
      const [serverInfo, memoryInfo, statsInfo, clientsInfo] = await Promise.all([
        this.primaryClient.info('server'),
        this.primaryClient.info('memory'),
        this.primaryClient.info('stats'),
        this.primaryClient.info('clients')
      ]);

      return {
        version: this.parseInfoValue(serverInfo, 'redis_version'),
        memory: this.parseMemoryInfo(memoryInfo),
        stats: this.parseStatsInfo(statsInfo),
        clients: this.parseClientsInfo(clientsInfo)
      };
    } catch (error) {
      console.error('Error getting Redis info:', error);
      throw error;
    }
  }

  private parseInfoValue(info: string, key: string): string {
    const lines = info.split('\r\n');
    const line = lines.find(l => l.startsWith(`${key}:`));
    return line ? line.split(':')[1] : 'unknown';
  }

  private parseMemoryInfo(info: string): any {
    const lines = info.split('\r\n');
    const memory: any = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.startsWith('used_memory') || key.startsWith('maxmemory')) {
          memory[key] = parseInt(value) || 0;
        }
      }
    });
    
    return memory;
  }

  private parseStatsInfo(info: string): any {
    const lines = info.split('\r\n');
    const stats: any = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.includes('keyspace') || key.includes('commands') || key.includes('connections')) {
          stats[key] = parseInt(value) || 0;
        }
      }
    });
    
    return stats;
  }

  private parseClientsInfo(info: string): any {
    const lines = info.split('\r\n');
    const clients: any = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.includes('connected') || key.includes('blocked')) {
          clients[key] = parseInt(value) || 0;
        }
      }
    });
    
    return clients;
  }

  // Initialize method for compatibility
  async initialize(): Promise<void> {
    // This method is for compatibility with existing code
    // The actual initialization happens in the constructor
    console.log('✅ RedisServiceManager initialized');
  }

  // Optimize connections method
  async optimizeConnections(): Promise<void> {
    try {
      // Reconnect clients if needed
      const clients = [
        this.primaryClient,
        this.authClient,
        this.cacheClient,
        this.jobsClient,
        this.sessionsClient
      ];

      for (const client of clients) {
        if (client.status !== 'ready') {
          await client.connect();
        }
      }

      console.log('🔧 Redis connections optimized');
    } catch (error) {
      console.error('❌ Error optimizing Redis connections:', error);
    }
  }


}

// Export singleton instance
export const redisServiceManager = RedisServiceManager.getInstance();

// Export individual services for convenience
export const {
  primaryClient: redis,
  authClient: redisAuth,
  cacheClient: redisCache,
  jobsClient: redisJobs,
  sessionsClient: redisSessions,
  monitoring: redisMonitoring,
  cache: cacheService
} = redisServiceManager;
