import { Redis } from 'ioredis';
import { IRedisService, RedisServiceError, IRedisMonitoringService } from './interfaces';

export abstract class BaseRedisService implements IRedisService {
  protected monitoring?: IRedisMonitoringService;
  
  constructor(
    public client: Redis,
    monitoring?: IRedisMonitoringService
  ) {
    this.monitoring = monitoring;
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.client.on('error', (error) => {
      console.error(`Redis error in ${this.constructor.name}:`, error);
      this.monitoring?.recordOperation('connection_error', 0, false);
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      const start = Date.now();
      await this.client.ping();
      const duration = Date.now() - start;
      this.monitoring?.recordOperation('health_check', duration, true);
      return true;
    } catch (error) {
      this.monitoring?.recordOperation('health_check', 0, false);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.client.disconnect();
    } catch (error) {
      console.error(`Error disconnecting Redis client in ${this.constructor.name}:`, error);
    }
  }

  protected async executeWithMonitoring<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.monitoring?.recordOperation(operation, duration, true);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.monitoring?.recordOperation(operation, duration, false);
      throw new RedisServiceError(
        `Redis operation '${operation}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        operation,
        error instanceof Error ? error : undefined
      );
    }
  }

  protected async safeExecute<T>(
    operation: () => Promise<T>,
    fallback?: T,
    errorMessage?: string
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      console.error(errorMessage || 'Redis operation failed:', error);
      return fallback;
    }
  }

  protected serializeValue<T>(value: T): string {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  }

  protected deserializeValue<T>(value: string | null): T | null {
    if (value === null) {
      return null;
    }
    
    try {
      return JSON.parse(value);
    } catch {
      // If parsing fails, return as string (for backward compatibility)
      return value as unknown as T;
    }
  }

  protected generateKey(prefix: string, ...parts: string[]): string {
    return [prefix, ...parts].join(':');
  }

  protected async getMultipleKeys<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.executeWithMonitoring('mget', async () => {
      const values = await this.client.mget(...keys);
      return values.map(value => this.deserializeValue<T>(value));
    });
  }

  protected async setMultipleKeys<T>(
    keyValuePairs: Record<string, T>,
    ttlSeconds?: number
  ): Promise<void> {
    const keys = Object.keys(keyValuePairs);
    if (keys.length === 0) {
      return;
    }

    return this.executeWithMonitoring('mset', async () => {
      const pipeline = this.client.pipeline();
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = this.serializeValue(value);
        if (ttlSeconds) {
          pipeline.setex(key, ttlSeconds, serializedValue);
        } else {
          pipeline.set(key, serializedValue);
        }
      }
      
      await pipeline.exec();
    });
  }

  protected async deletePattern(pattern: string): Promise<number> {
    return this.executeWithMonitoring('delete_pattern', async () => {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      return await this.client.del(...keys);
    });
  }

  protected async existsMultiple(keys: string[]): Promise<boolean[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.executeWithMonitoring('exists_multiple', async () => {
      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.exists(key));
      const results = await pipeline.exec();
      return results?.map(result => result[1] === 1) || [];
    });
  }

  protected async incrementCounter(key: string, increment: number = 1): Promise<number> {
    return this.executeWithMonitoring('increment', async () => {
      return await this.client.incrby(key, increment);
    });
  }

  protected async decrementCounter(key: string, decrement: number = 1): Promise<number> {
    return this.executeWithMonitoring('decrement', async () => {
      return await this.client.decrby(key, decrement);
    });
  }

  protected async addToSet(key: string, ...members: string[]): Promise<number> {
    return this.executeWithMonitoring('sadd', async () => {
      return await this.client.sadd(key, ...members);
    });
  }

  protected async removeFromSet(key: string, ...members: string[]): Promise<number> {
    return this.executeWithMonitoring('srem', async () => {
      return await this.client.srem(key, ...members);
    });
  }

  protected async getSetMembers(key: string): Promise<string[]> {
    return this.executeWithMonitoring('smembers', async () => {
      return await this.client.smembers(key);
    });
  }

  protected async isSetMember(key: string, member: string): Promise<boolean> {
    return this.executeWithMonitoring('sismember', async () => {
      const result = await this.client.sismember(key, member);
      return result === 1;
    });
  }

  protected async addToSortedSet(
    key: string,
    score: number,
    member: string
  ): Promise<number> {
    return this.executeWithMonitoring('zadd', async () => {
      return await this.client.zadd(key, score, member);
    });
  }

  protected async getSortedSetRange(
    key: string,
    start: number = 0,
    stop: number = -1,
    withScores: boolean = false
  ): Promise<string[]> {
    return this.executeWithMonitoring('zrange', async () => {
      if (withScores) {
        return await this.client.zrange(key, start, stop, 'WITHSCORES');
      }
      return await this.client.zrange(key, start, stop);
    });
  }

  protected async removeFromSortedSet(key: string, ...members: string[]): Promise<number> {
    return this.executeWithMonitoring('zrem', async () => {
      return await this.client.zrem(key, ...members);
    });
  }

  protected async pushToList(key: string, ...values: string[]): Promise<number> {
    return this.executeWithMonitoring('lpush', async () => {
      return await this.client.lpush(key, ...values);
    });
  }

  protected async popFromList(key: string): Promise<string | null> {
    return this.executeWithMonitoring('lpop', async () => {
      return await this.client.lpop(key);
    });
  }

  protected async getListRange(
    key: string,
    start: number = 0,
    stop: number = -1
  ): Promise<string[]> {
    return this.executeWithMonitoring('lrange', async () => {
      return await this.client.lrange(key, start, stop);
    });
  }

  protected async trimList(key: string, start: number, stop: number): Promise<void> {
    return this.executeWithMonitoring('ltrim', async () => {
      await this.client.ltrim(key, start, stop);
    });
  }

  protected async setHashField(key: string, field: string, value: string): Promise<void> {
    return this.executeWithMonitoring('hset', async () => {
      await this.client.hset(key, field, value);
    });
  }

  protected async getHashField(key: string, field: string): Promise<string | null> {
    return this.executeWithMonitoring('hget', async () => {
      return await this.client.hget(key, field);
    });
  }

  protected async getAllHashFields(key: string): Promise<Record<string, string>> {
    return this.executeWithMonitoring('hgetall', async () => {
      return await this.client.hgetall(key);
    });
  }

  protected async deleteHashField(key: string, ...fields: string[]): Promise<number> {
    return this.executeWithMonitoring('hdel', async () => {
      return await this.client.hdel(key, ...fields);
    });
  }

  protected async setExpiration(key: string, ttlSeconds: number): Promise<boolean> {
    return this.executeWithMonitoring('expire', async () => {
      const result = await this.client.expire(key, ttlSeconds);
      return result === 1;
    });
  }

  protected async getTTL(key: string): Promise<number> {
    return this.executeWithMonitoring('ttl', async () => {
      return await this.client.ttl(key);
    });
  }
}
