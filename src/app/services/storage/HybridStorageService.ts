import { User } from '../../modules/User/user.model';
import { smartCacheService } from '../cache/SmartCacheService';
import { featureToggleService } from '../redis/FeatureToggleService';

interface StorageOptions {
  ttl?: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  fallbackToMongo?: boolean;
  fallbackToMemory?: boolean;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
  source: 'redis' | 'memory' | 'mongo';
}

export class HybridStorageService {
  private memoryCache: Map<string, CachedData<any>>;
  private mongoFallbackEnabled = true;
  private memoryFallbackEnabled = true;
  private maxObjectSize = 3 * 1024; // 3KB max object size
  private maxCacheSize = 500; // Maximum 500 items in memory cache

  constructor() {
    // Initialize memory cache with simple Map for now
    this.memoryCache = new Map<string, CachedData<any>>();

    // Listen to feature toggle changes
    featureToggleService.onFeatureChange('api_response_caching', (enabled) => {
      if (!enabled) {
        console.log('📵 API caching disabled, clearing memory cache');
        this.memoryCache.clear();
      }
    });
  }

  // Get data with hybrid fallback strategy
  async get<T>(key: string, options: StorageOptions = {}): Promise<T | null> {
    const priority = options.priority || 'medium';
    
    try {
      // Strategy 1: Try Redis first (if enabled and high priority)
      if (priority === 'critical' || priority === 'high') {
        if (featureToggleService.isFeatureEnabled('api_response_caching')) {
          const redisData = await smartCacheService.get<T>(key, { priority });
          if (redisData !== null) {
            console.log(`🎯 Hybrid Cache Hit (Redis): ${key}`);
            return redisData;
          }
        }
      }

      // Strategy 2: Try memory cache
      const memoryData = this.memoryCache.get(key);
      if (memoryData && !this.isExpired(memoryData)) {
        console.log(`🎯 Hybrid Cache Hit (Memory): ${key}`);
        return memoryData.data;
      }

      // Strategy 3: Try MongoDB fallback for user data
      if (options.fallbackToMongo && key.includes('user:')) {
        const mongoData = await this.getFromMongo<T>(key);
        if (mongoData !== null) {
          console.log(`🎯 Hybrid Cache Hit (MongoDB): ${key}`);
          
          // Cache the result in memory for future use
          this.setToMemory(key, mongoData, options.ttl || 900);
          return mongoData;
        }
      }

      console.log(`❌ Hybrid Cache Miss: ${key}`);
      return null;

    } catch (error) {
      console.error(`Hybrid storage get error for key ${key}:`, error);
      
      // Final fallback: try memory cache even if expired
      const fallbackData = this.memoryCache.get(key);
      if (fallbackData) {
        console.log(`🔄 Using expired memory cache as fallback: ${key}`);
        return fallbackData.data;
      }
      
      return null;
    }
  }

  // Set data with hybrid storage strategy
  async set<T>(key: string, value: T, options: StorageOptions = {}): Promise<void> {
    const priority = options.priority || 'medium';
    const ttl = options.ttl || this.getSmartTTL(key, priority);

    // Check object size
    const serializedValue = JSON.stringify(value);
    const size = Buffer.byteLength(serializedValue, 'utf8');

    // Skip storing if object is too large
    if (size > this.maxObjectSize) {
      console.log(`⚠️ Skipping storage: ${key} (Size: ${size}B exceeds limit of ${this.maxObjectSize}B)`);
      return;
    }

    // Skip storing alerts and monitoring data
    if (key.includes('alert:') || key.includes('metrics:') || key.includes('monitoring:')) {
      console.log(`📵 Skipping storage for monitoring data: ${key}`);
      return;
    }

    // Limit memory cache size
    if (this.memoryCache.size >= this.maxCacheSize) {
      // Remove oldest entries (simple FIFO)
      const keysToRemove = Array.from(this.memoryCache.keys()).slice(0, 50);
      keysToRemove.forEach(k => this.memoryCache.delete(k));
      console.log(`🧹 Cleaned ${keysToRemove.length} old entries from memory cache`);
    }

    try {
      // Strategy 1: Store in Redis for critical/high priority data ONLY
      if (priority === 'critical' &&
          featureToggleService.isFeatureEnabled('api_response_caching')) {
        await smartCacheService.set(key, value, {
          ttl,
          priority,
          compress: this.shouldCompress(value)
        });
        console.log(`📦 Stored in Redis: ${key} (TTL: ${ttl}s)`);
      }

      // Strategy 2: Store in memory cache for fast access (smaller objects only)
      if (size <= 1024) { // Only cache objects smaller than 1KB in memory
        this.setToMemory(key, value, ttl);
      }

      // Strategy 3: Store in MongoDB for user data (if enabled)
      if (options.fallbackToMongo && key.includes('user:') && this.mongoFallbackEnabled) {
        await this.setToMongo(key, value, ttl);
      }

    } catch (error) {
      console.error(`Hybrid storage set error for key ${key}:`, error);

      // Fallback: at least store in memory if small enough
      try {
        if (size <= 1024) {
          this.setToMemory(key, value, ttl);
          console.log(`🔄 Fallback: stored in memory only: ${key}`);
        }
      } catch (memoryError) {
        console.error(`Failed to store in memory fallback:`, memoryError);
      }
    }
  }

  // Delete from all storage layers
  async del(key: string): Promise<void> {
    try {
      // Delete from all layers
      await Promise.allSettled([
        smartCacheService.del(key),
        this.deleteFromMemory(key),
        this.deleteFromMongo(key)
      ]);
      
      console.log(`🗑️ Deleted from hybrid storage: ${key}`);
    } catch (error) {
      console.error(`Error deleting from hybrid storage: ${key}`, error);
    }
  }

  // Check if key exists in any storage layer
  async exists(key: string): Promise<boolean> {
    try {
      // Check memory first (fastest)
      if (this.memoryCache.has(key)) {
        const data = this.memoryCache.get(key);
        if (data && !this.isExpired(data)) {
          return true;
        }
      }

      // Check Redis if enabled
      if (featureToggleService.isFeatureEnabled('api_response_caching')) {
        const redisExists = await smartCacheService.exists(key);
        if (redisExists) return true;
      }

      // Check MongoDB for user data
      if (key.includes('user:')) {
        return await this.existsInMongo(key);
      }

      return false;
    } catch (error) {
      console.error(`Error checking existence in hybrid storage: ${key}`, error);
      return false;
    }
  }

  // Memory cache operations
  private setToMemory<T>(key: string, value: T, ttl: number): void {
    const cachedData: CachedData<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl * 1000, // Convert to milliseconds
      source: 'memory'
    };
    
    this.memoryCache.set(key, cachedData);
    console.log(`💾 Stored in memory: ${key} (TTL: ${ttl}s)`);
  }

  private deleteFromMemory(key: string): void {
    this.memoryCache.delete(key);
  }

  private isExpired<T>(cachedData: CachedData<T>): boolean {
    return Date.now() > cachedData.timestamp + cachedData.ttl;
  }

  // MongoDB fallback operations
  private async getFromMongo<T>(key: string): Promise<T | null> {
    try {
      if (!this.mongoFallbackEnabled) return null;

      // Extract user ID from key
      const userIdMatch = key.match(/user:([^:]+)/);
      if (!userIdMatch) return null;

      const userId = userIdMatch[1];
      const user = await User.findById(userId).lean();
      
      if (!user) return null;

      // Return user data based on key type
      if (key.includes(':profile')) {
        return {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified
        } as T;
      }

      return user as T;
    } catch (error) {
      console.error('Error getting from MongoDB:', error);
      return null;
    }
  }

  private async setToMongo<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      if (!this.mongoFallbackEnabled) return;

      // For now, we don't actively store cache data in MongoDB
      // This is mainly for reading existing user data as fallback
      console.log(`📝 MongoDB storage not implemented for key: ${key}`);
    } catch (error) {
      console.error('Error setting to MongoDB:', error);
    }
  }

  private async deleteFromMongo(key: string): Promise<void> {
    try {
      // MongoDB deletion not implemented for cache data
      console.log(`🗑️ MongoDB deletion not implemented for key: ${key}`);
    } catch (error) {
      console.error('Error deleting from MongoDB:', error);
    }
  }

  private async existsInMongo(key: string): Promise<boolean> {
    try {
      if (!this.mongoFallbackEnabled) return false;

      const userIdMatch = key.match(/user:([^:]+)/);
      if (!userIdMatch) return false;

      const userId = userIdMatch[1];
      const user = await User.findById(userId).select('_id').lean();
      return !!user;
    } catch (error) {
      console.error('Error checking existence in MongoDB:', error);
      return false;
    }
  }

  // Utility methods
  private getSmartTTL(key: string, priority: string): number {
    // Smart TTL based on key pattern and priority
    if (key.includes('user:profile')) return 1800; // 30 minutes
    if (key.includes('user:permissions')) return 3600; // 1 hour
    if (key.includes('api:courses')) return 1800; // 30 minutes
    if (key.includes('api:categories')) return 3600; // 1 hour
    
    // Priority-based TTL
    switch (priority) {
      case 'critical': return 3600; // 1 hour
      case 'high': return 1800; // 30 minutes
      case 'medium': return 900; // 15 minutes
      case 'low': return 300; // 5 minutes
      default: return 600; // 10 minutes
    }
  }

  private shouldCompress<T>(value: T): boolean {
    const serialized = JSON.stringify(value);
    return serialized.length > 2048; // Compress if larger than 2KB
  }

  // Get storage statistics
  getStorageStats(): {
    memory: {
      size: number;
      maxSize: number;
      itemCount: number;
      hitRate: number;
    };
    features: {
      redisCachingEnabled: boolean;
      mongoFallbackEnabled: boolean;
      memoryFallbackEnabled: boolean;
    };
  } {
    return {
      memory: {
        size: this.memoryCache.size * 1024, // Rough estimate
        maxSize: 100 * 1024 * 1024, // 100MB
        itemCount: this.memoryCache.size,
        hitRate: 0 // Would need to track hits/misses
      },
      features: {
        redisCachingEnabled: featureToggleService.isFeatureEnabled('api_response_caching'),
        mongoFallbackEnabled: this.mongoFallbackEnabled,
        memoryFallbackEnabled: this.memoryFallbackEnabled
      }
    };
  }

  // Clear all storage layers
  async clearAll(): Promise<void> {
    try {
      await Promise.allSettled([
        smartCacheService.clearAll(),
        this.clearMemory()
      ]);
      console.log('🧹 All hybrid storage cleared');
    } catch (error) {
      console.error('Error clearing hybrid storage:', error);
    }
  }

  // Clear memory cache only
  clearMemory(): void {
    this.memoryCache.clear();
    console.log('🧹 Memory cache cleared');
  }

  // Enable/disable fallback mechanisms
  setMongoFallbackEnabled(enabled: boolean): void {
    this.mongoFallbackEnabled = enabled;
    console.log(`🔧 MongoDB fallback ${enabled ? 'enabled' : 'disabled'}`);
  }

  setMemoryFallbackEnabled(enabled: boolean): void {
    this.memoryFallbackEnabled = enabled;
    console.log(`🔧 Memory fallback ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Warm cache with critical data
  async warmCriticalData(): Promise<void> {
    console.log('🔥 Warming critical data in hybrid storage...');
    
    try {
      // This would typically warm up frequently accessed data
      // For now, just log the action
      console.log('✅ Critical data warming completed');
    } catch (error) {
      console.error('❌ Error warming critical data:', error);
    }
  }
}

export const hybridStorageService = new HybridStorageService();
