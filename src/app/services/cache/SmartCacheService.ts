import { Redis } from 'ioredis';
import { redisServiceManager } from '../redis/RedisServiceManager';

interface CacheOptions {
  ttl?: number;
  l1Only?: boolean; // Only use L1 cache (in-memory)
  l2Only?: boolean; // Only use L2 cache (Redis)
  compress?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  compressed?: boolean;
  hits: number;
  size: number;
}

interface CacheStats {
  l1: {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
    hitRate: number;
  };
  l2: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  total: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

export class SmartCacheService {
  private l1Cache: Map<string, CacheEntry<any>>;
  private redis: Redis;
  private stats: CacheStats;
  private compressionThreshold = 512; // 512B - smaller threshold
  private maxL1Size = 200; // Reduced to 200 items max
  private maxL1Memory = 10 * 1024 * 1024; // Reduced to 10MB max for L1 cache
  private maxObjectSize = 5 * 1024; // 5KB max object size - reject larger objects

  constructor() {
    this.redis = redisServiceManager.cacheClient;

    // Initialize L1 cache with simple Map for now
    this.l1Cache = new Map<string, CacheEntry<any>>();

    this.stats = {
      l1: { hits: 0, misses: 0, size: 0, maxSize: this.maxL1Size, hitRate: 0 },
      l2: { hits: 0, misses: 0, hitRate: 0 },
      total: { hits: 0, misses: 0, hitRate: 0 }
    };

    // Update stats periodically
    setInterval(() => this.updateStats(), 60000); // Every minute
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // Try L1 cache first (unless l2Only is specified)
      if (!options.l2Only) {
        const l1Result = this.getFromL1<T>(key);
        if (l1Result !== null) {
          this.stats.l1.hits++;
          this.stats.total.hits++;
          console.log(`🎯 L1 Cache Hit: ${key} (${Date.now() - startTime}ms)`);
          return l1Result;
        }
        this.stats.l1.misses++;
      }

      // Try L2 cache (Redis) if not l1Only
      if (!options.l1Only) {
        const l2Result = await this.getFromL2<T>(key);
        if (l2Result !== null) {
          this.stats.l2.hits++;
          this.stats.total.hits++;
          
          // Promote to L1 cache if it's high priority
          if (this.shouldPromoteToL1(options.priority)) {
            this.setToL1(key, l2Result, options.ttl || 900); // 15 minutes default
          }
          
          console.log(`🎯 L2 Cache Hit: ${key} (${Date.now() - startTime}ms)`);
          return l2Result;
        }
        this.stats.l2.misses++;
      }

      this.stats.total.misses++;
      console.log(`❌ Cache Miss: ${key} (${Date.now() - startTime}ms)`);
      return null;

    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || this.getSmartTTL(key, options.priority);
    const serializedValue = JSON.stringify(value);
    const size = Buffer.byteLength(serializedValue, 'utf8');

    // Skip caching if object is too large
    if (size > this.maxObjectSize) {
      console.log(`⚠️ Skipping cache: ${key} (Size: ${size}B exceeds limit of ${this.maxObjectSize}B)`);
      return;
    }

    // Skip caching alerts and monitoring data to reduce Redis usage
    if (key.includes('alert:') || key.includes('metrics:') || key.includes('monitoring:')) {
      console.log(`📵 Skipping cache for monitoring data: ${key}`);
      return;
    }

    try {
      // Determine caching strategy based on options and value characteristics
      const strategy = this.determineCachingStrategy(key, size, options);

      if (strategy.useL1) {
        this.setToL1(key, value, ttl, size);
      }

      if (strategy.useL2) {
        await this.setToL2(key, value, ttl, options.compress);
      }

      console.log(`📦 Cached: ${key} (L1: ${strategy.useL1}, L2: ${strategy.useL2}, TTL: ${ttl}s, Size: ${size}B)`);

    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      // Remove from both caches
      this.l1Cache.delete(key);
      await this.redis.del(key);
      console.log(`🗑️ Cache deleted: ${key}`);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return this.l1Cache.has(key) || (await this.redis.exists(key)) === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  private getFromL1<T>(key: string): T | null {
    const entry = this.l1Cache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl * 1000) {
      this.l1Cache.delete(key);
      return null;
    }
    
    entry.hits++;
    return entry.value;
  }

  private async getFromL2<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      
      // Handle compressed data
      if (parsed.__compressed) {
        // In a real implementation, you'd decompress here
        return parsed.data;
      }
      
      return parsed;
    } catch (error) {
      console.error(`L2 cache get error for key ${key}:`, error);
      return null;
    }
  }

  private setToL1<T>(key: string, value: T, ttl: number, size?: number): void {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size: size || Buffer.byteLength(JSON.stringify(value), 'utf8')
    };
    
    this.l1Cache.set(key, entry);
  }

  private async setToL2<T>(key: string, value: T, ttl: number, compress?: boolean): Promise<void> {
    try {
      let dataToStore = value;
      
      // Compress large values
      if (compress || (JSON.stringify(value).length > this.compressionThreshold)) {
        // In a real implementation, you'd use actual compression
        dataToStore = { __compressed: true, data: value } as any;
      }
      
      await this.redis.setex(key, ttl, JSON.stringify(dataToStore));
    } catch (error) {
      console.error(`L2 cache set error for key ${key}:`, error);
    }
  }

  private determineCachingStrategy(key: string, size: number, options: CacheOptions): { useL1: boolean; useL2: boolean } {
    // Force L1 or L2 only if specified
    if (options.l1Only) return { useL1: true, useL2: false };
    if (options.l2Only) return { useL1: false, useL2: true };
    
    // Critical data goes to both caches
    if (options.priority === 'critical') {
      return { useL1: true, useL2: true };
    }
    
    // Large values (>100KB) go to L2 only to save L1 memory
    if (size > 100 * 1024) {
      return { useL1: false, useL2: true };
    }
    
    // High priority or small values go to L1
    if (options.priority === 'high' || size < 10 * 1024) {
      return { useL1: true, useL2: true };
    }
    
    // Medium priority goes to L2 only
    if (options.priority === 'medium') {
      return { useL1: false, useL2: true };
    }
    
    // Low priority might not be cached at all if memory is tight
    if (options.priority === 'low' && this.isMemoryTight()) {
      return { useL1: false, useL2: false };
    }
    
    // Default: use both caches
    return { useL1: true, useL2: true };
  }

  private shouldPromoteToL1(priority?: string): boolean {
    return priority === 'critical' || priority === 'high';
  }

  private getSmartTTL(key: string, priority?: string): number {
    // Smart TTL based on key pattern and priority
    if (key.includes('jwt') || key.includes('session')) return 3600; // 1 hour
    if (key.includes('otp')) return 300; // 5 minutes
    if (key.includes('user')) return 900; // 15 minutes
    if (key.includes('cache:query')) return 1800; // 30 minutes
    if (key.includes('api:cache')) return 600; // 10 minutes
    
    // Priority-based TTL
    switch (priority) {
      case 'critical': return 3600; // 1 hour
      case 'high': return 1800; // 30 minutes
      case 'medium': return 900; // 15 minutes
      case 'low': return 300; // 5 minutes
      default: return 600; // 10 minutes
    }
  }

  private isMemoryTight(): boolean {
    return this.l1Cache.size > this.maxL1Size * 0.8; // 80% of max items
  }

  private updateStats(): void {
    this.stats.l1.size = this.l1Cache.size;
    this.stats.l1.hitRate = this.stats.l1.hits / (this.stats.l1.hits + this.stats.l1.misses) * 100;
    this.stats.l2.hitRate = this.stats.l2.hits / (this.stats.l2.hits + this.stats.l2.misses) * 100;
    this.stats.total.hitRate = this.stats.total.hits / (this.stats.total.hits + this.stats.total.misses) * 100;
  }

  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  // Clear L1 cache
  clearL1(): void {
    this.l1Cache.clear();
    console.log('🧹 L1 cache cleared');
  }

  // Clear L2 cache (Redis)
  async clearL2(): Promise<void> {
    try {
      await this.redis.flushdb();
      console.log('🧹 L2 cache cleared');
    } catch (error) {
      console.error('Error clearing L2 cache:', error);
    }
  }

  // Clear both caches
  async clearAll(): Promise<void> {
    this.clearL1();
    await this.clearL2();
    console.log('🧹 All caches cleared');
  }
}

export const smartCacheService = new SmartCacheService();
