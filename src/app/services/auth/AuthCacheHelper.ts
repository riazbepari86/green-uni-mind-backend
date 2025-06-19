import { redisServiceManager } from '../redis/RedisServiceManager';

/**
 * Centralized authentication caching helper to eliminate code duplication
 * across auth controllers and services
 */
export class AuthCacheHelper {
  /**
   * Cache user data with standardized TTL and error handling
   */
  static async cacheUserData(email: string, userData: any, ttlSeconds: number = 900): Promise<void> {
    try {
      await redisServiceManager.executeWithCircuitBreaker(
        () => redisServiceManager.cache.set(`user:${email}`, userData, ttlSeconds),
        'cache'
      );
    } catch (error) {
      console.warn('Failed to cache user data:', error);
      // Don't throw - caching failures shouldn't break auth flow
    }
  }

  /**
   * Get cached user data
   */
  static async getCachedUserData(email: string): Promise<any | null> {
    try {
      return await redisServiceManager.executeWithCircuitBreaker(
        () => redisServiceManager.cache.get(`user:${email}`),
        'cache',
        () => Promise.resolve(null)
      );
    } catch (error) {
      console.warn('Failed to get cached user data:', error);
      return null;
    }
  }

  /**
   * Clear cached user data
   */
  static async clearCachedUserData(email: string): Promise<void> {
    try {
      await redisServiceManager.executeWithCircuitBreaker(
        () => redisServiceManager.cache.del(`user:${email}`),
        'cache'
      );
    } catch (error) {
      console.warn('Failed to clear cached user data:', error);
    }
  }

  /**
   * Cache authentication session data
   */
  static async cacheAuthSession(userId: string, sessionData: any, ttlSeconds: number = 1800): Promise<void> {
    try {
      await redisServiceManager.executeWithCircuitBreaker(
        () => redisServiceManager.cache.set(`auth_session:${userId}`, sessionData, ttlSeconds),
        'cache'
      );
    } catch (error) {
      console.warn('Failed to cache auth session:', error);
    }
  }

  /**
   * Get cached authentication session
   */
  static async getCachedAuthSession(userId: string): Promise<any | null> {
    try {
      return await redisServiceManager.executeWithCircuitBreaker(
        () => redisServiceManager.cache.get(`auth_session:${userId}`),
        'cache',
        () => Promise.resolve(null)
      );
    } catch (error) {
      console.warn('Failed to get cached auth session:', error);
      return null;
    }
  }

  /**
   * Clear authentication session
   */
  static async clearAuthSession(userId: string): Promise<void> {
    try {
      await redisServiceManager.executeWithCircuitBreaker(
        () => redisServiceManager.cache.del(`auth_session:${userId}`),
        'cache'
      );
    } catch (error) {
      console.warn('Failed to clear auth session:', error);
    }
  }

  /**
   * Cache OAuth provider data
   */
  static async cacheOAuthData(providerId: string, providerData: any, ttlSeconds: number = 600): Promise<void> {
    try {
      await redisServiceManager.executeWithCircuitBreaker(
        () => redisServiceManager.cache.set(`oauth:${providerId}`, providerData, ttlSeconds),
        'cache'
      );
    } catch (error) {
      console.warn('Failed to cache OAuth data:', error);
    }
  }

  /**
   * Get cached OAuth provider data
   */
  static async getCachedOAuthData(providerId: string): Promise<any | null> {
    try {
      return await redisServiceManager.executeWithCircuitBreaker(
        () => redisServiceManager.cache.get(`oauth:${providerId}`),
        'cache',
        () => Promise.resolve(null)
      );
    } catch (error) {
      console.warn('Failed to get cached OAuth data:', error);
      return null;
    }
  }

  /**
   * Batch cache multiple auth-related data items
   */
  static async batchCacheAuthData(items: Array<{
    key: string;
    value: any;
    ttl?: number;
  }>): Promise<void> {
    try {
      const cacheItems = items.map(item => ({
        key: item.key,
        value: item.value,
        ttl: item.ttl || 900
      }));

      await redisServiceManager.executeWithCircuitBreaker(
        () => redisServiceManager.cache.batchSet(cacheItems),
        'cache'
      );
    } catch (error) {
      console.warn('Failed to batch cache auth data:', error);
    }
  }

  /**
   * Clear all auth-related cache for a user
   */
  static async clearAllUserAuthCache(userId: string, email: string): Promise<void> {
    try {
      const keysToDelete = [
        `user:${email}`,
        `auth_session:${userId}`,
        `oauth:${userId}`
      ];

      await redisServiceManager.executeWithCircuitBreaker(
        () => redisServiceManager.cache.batchDelete(keysToDelete),
        'cache'
      );
    } catch (error) {
      console.warn('Failed to clear all user auth cache:', error);
    }
  }
}
