import { cacheService, analyticsCacheService, messagingCacheService } from '../app/services/cache/CacheService';
import { redisOperations } from '../app/config/redis';

describe('Cache Service', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await cacheService.clear();
    cacheService.resetStats();
  });

  afterAll(async () => {
    // Clean up after all tests
    await cacheService.clear();
  });

  describe('Basic Cache Operations', () => {
    it('should set and get string values', async () => {
      const key = 'test-string';
      const value = 'Hello, World!';

      const setResult = await cacheService.set(key, value);
      expect(setResult).toBe(true);

      const getValue = await cacheService.get<string>(key);
      expect(getValue).toBe(value);
    });

    it('should set and get object values', async () => {
      const key = 'test-object';
      const value = { name: 'John', age: 30, active: true };

      const setResult = await cacheService.set(key, value);
      expect(setResult).toBe(true);

      const getValue = await cacheService.get<typeof value>(key);
      expect(getValue).toEqual(value);
    });

    it('should set and get array values', async () => {
      const key = 'test-array';
      const value = [1, 2, 3, 'four', { five: 5 }];

      const setResult = await cacheService.set(key, value);
      expect(setResult).toBe(true);

      const getValue = await cacheService.get<typeof value>(key);
      expect(getValue).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const getValue = await cacheService.get('non-existent-key');
      expect(getValue).toBeNull();
    });

    it('should delete values', async () => {
      const key = 'test-delete';
      const value = 'to be deleted';

      await cacheService.set(key, value);
      const deleteResult = await cacheService.del(key);
      expect(deleteResult).toBe(true);

      const getValue = await cacheService.get(key);
      expect(getValue).toBeNull();
    });

    it('should check if key exists', async () => {
      const key = 'test-exists';
      const value = 'exists';

      expect(await cacheService.exists(key)).toBe(false);

      await cacheService.set(key, value);
      expect(await cacheService.exists(key)).toBe(true);

      await cacheService.del(key);
      expect(await cacheService.exists(key)).toBe(false);
    });
  });

  describe('TTL and Expiration', () => {
    it('should respect TTL settings', async () => {
      const key = 'test-ttl';
      const value = 'expires soon';
      const ttl = 1; // 1 second

      await cacheService.set(key, value, { ttl });
      
      // Should exist immediately
      expect(await cacheService.exists(key)).toBe(true);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      expect(await cacheService.exists(key)).toBe(false);
    });

    it('should set custom expiration', async () => {
      const key = 'test-expire';
      const value = 'custom expiration';

      await cacheService.set(key, value);
      
      const expireResult = await cacheService.expire(key, 1);
      expect(expireResult).toBe(true);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(await cacheService.exists(key)).toBe(false);
    });
  });

  describe('Increment Operations', () => {
    it('should increment numeric values', async () => {
      const key = 'test-counter';

      const result1 = await cacheService.increment(key);
      expect(result1).toBe(1);

      const result2 = await cacheService.increment(key, 5);
      expect(result2).toBe(6);

      const result3 = await cacheService.increment(key, -2);
      expect(result3).toBe(4);
    });

    it('should set TTL for new increment keys', async () => {
      const key = 'test-increment-ttl';
      
      await cacheService.increment(key, 1, { ttl: 1 });
      expect(await cacheService.exists(key)).toBe(true);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(await cacheService.exists(key)).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    it('should get multiple keys at once', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = ['value1', 'value2', 'value3'];

      // Set values
      for (let i = 0; i < keys.length; i++) {
        await cacheService.set(keys[i], values[i]);
      }

      // Get multiple values
      const results = await cacheService.mget<string>(keys);
      expect(results).toEqual(values);
    });

    it('should handle missing keys in batch get', async () => {
      const keys = ['existing-key', 'missing-key', 'another-existing-key'];
      
      await cacheService.set('existing-key', 'value1');
      await cacheService.set('another-existing-key', 'value3');

      const results = await cacheService.mget<string>(keys);
      expect(results).toEqual(['value1', null, 'value3']);
    });
  });

  describe('Get or Set Pattern', () => {
    it('should execute function and cache result when key does not exist', async () => {
      const key = 'test-get-or-set';
      let functionCalled = false;

      const fetchFunction = async () => {
        functionCalled = true;
        return { data: 'fetched from function' };
      };

      const result = await cacheService.getOrSet(key, fetchFunction);
      
      expect(functionCalled).toBe(true);
      expect(result).toEqual({ data: 'fetched from function' });
      
      // Verify it's cached
      const cachedResult = await cacheService.get(key);
      expect(cachedResult).toEqual({ data: 'fetched from function' });
    });

    it('should return cached value without executing function when key exists', async () => {
      const key = 'test-cached-get-or-set';
      const cachedValue = { data: 'cached value' };
      let functionCalled = false;

      await cacheService.set(key, cachedValue);

      const fetchFunction = async () => {
        functionCalled = true;
        return { data: 'should not be called' };
      };

      const result = await cacheService.getOrSet(key, fetchFunction);
      
      expect(functionCalled).toBe(false);
      expect(result).toEqual(cachedValue);
    });
  });

  describe('Tag-based Invalidation', () => {
    it('should invalidate cache by tags', async () => {
      const keys = ['tagged-key-1', 'tagged-key-2', 'tagged-key-3'];
      const tags = ['user:123', 'analytics'];

      // Set values with tags
      await cacheService.set(keys[0], 'value1', { tags: ['user:123'] });
      await cacheService.set(keys[1], 'value2', { tags: ['user:123', 'analytics'] });
      await cacheService.set(keys[2], 'value3', { tags: ['analytics'] });

      // Verify all keys exist
      for (const key of keys) {
        expect(await cacheService.exists(key)).toBe(true);
      }

      // Invalidate by user tag
      const deletedCount = await cacheService.invalidateByTags(['user:123']);
      expect(deletedCount).toBeGreaterThan(0);

      // Check which keys were invalidated
      expect(await cacheService.exists(keys[0])).toBe(false); // Had user:123 tag
      expect(await cacheService.exists(keys[1])).toBe(false); // Had user:123 tag
      expect(await cacheService.exists(keys[2])).toBe(true);  // Only had analytics tag
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache statistics', async () => {
      const key = 'stats-test';
      const value = 'test value';

      // Initial stats
      let stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);

      // Cache miss
      await cacheService.get(key);
      stats = cacheService.getStats();
      expect(stats.misses).toBe(1);

      // Cache set
      await cacheService.set(key, value);
      stats = cacheService.getStats();
      expect(stats.sets).toBe(1);

      // Cache hit
      await cacheService.get(key);
      stats = cacheService.getStats();
      expect(stats.hits).toBe(1);

      // Calculate hit rate
      expect(stats.hitRate).toBe(50); // 1 hit out of 2 total requests
    });

    it('should reset statistics', async () => {
      await cacheService.set('test', 'value');
      await cacheService.get('test');
      await cacheService.get('non-existent');

      let stats = cacheService.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.sets).toBeGreaterThan(0);

      cacheService.resetStats();
      stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
    });
  });

  describe('Prefix Support', () => {
    it('should use prefixes correctly', async () => {
      const key = 'test-key';
      const value1 = 'value1';
      const value2 = 'value2';

      await cacheService.set(key, value1, { prefix: 'prefix1' });
      await cacheService.set(key, value2, { prefix: 'prefix2' });

      const result1 = await cacheService.get(key, { prefix: 'prefix1' });
      const result2 = await cacheService.get(key, { prefix: 'prefix2' });

      expect(result1).toBe(value1);
      expect(result2).toBe(value2);
    });
  });

  describe('Large Value Handling', () => {
    it('should handle large values gracefully', async () => {
      const key = 'large-value';
      const largeValue = 'x'.repeat(15 * 1024 * 1024); // 15MB

      const setResult = await cacheService.set(key, largeValue);
      expect(setResult).toBe(false); // Should reject large values
    });
  });

  describe('Analytics Cache Service', () => {
    it('should cache and retrieve teacher analytics', async () => {
      const teacherId = 'teacher-123';
      const period = 'monthly';
      const analyticsData = {
        totalRevenue: 1000,
        totalStudents: 50,
        averageRating: 4.5,
      };

      const setResult = await analyticsCacheService.setTeacherAnalytics(teacherId, period, analyticsData);
      expect(setResult).toBe(true);

      const cachedData = await analyticsCacheService.getTeacherAnalytics(teacherId, period);
      expect(cachedData).toEqual(analyticsData);
    });

    it('should invalidate teacher analytics cache', async () => {
      const teacherId = 'teacher-456';
      const period = 'weekly';
      const analyticsData = { revenue: 500 };

      await analyticsCacheService.setTeacherAnalytics(teacherId, period, analyticsData);
      
      // Verify data is cached
      let cachedData = await analyticsCacheService.getTeacherAnalytics(teacherId, period);
      expect(cachedData).toEqual(analyticsData);

      // Invalidate cache
      await analyticsCacheService.invalidateTeacher(teacherId);

      // Verify data is no longer cached
      cachedData = await analyticsCacheService.getTeacherAnalytics(teacherId, period);
      expect(cachedData).toBeNull();
    });
  });

  describe('Messaging Cache Service', () => {
    it('should cache and retrieve conversations', async () => {
      const userId = 'user-789';
      const userType = 'student';
      const conversationsData = [
        { id: 'conv-1', title: 'Conversation 1' },
        { id: 'conv-2', title: 'Conversation 2' },
      ];

      const setResult = await messagingCacheService.setConversations(userId, userType, conversationsData);
      expect(setResult).toBe(true);

      const cachedData = await messagingCacheService.getConversations(userId, userType);
      expect(cachedData).toEqual(conversationsData);
    });

    it('should invalidate user messaging cache', async () => {
      const userId = 'user-101';
      const userType = 'teacher';
      const conversationsData = [{ id: 'conv-3', title: 'Conversation 3' }];

      await messagingCacheService.setConversations(userId, userType, conversationsData);
      
      // Verify data is cached
      let cachedData = await messagingCacheService.getConversations(userId, userType);
      expect(cachedData).toEqual(conversationsData);

      // Invalidate cache
      await messagingCacheService.invalidateUser(userId);

      // Verify data is no longer cached
      cachedData = await messagingCacheService.getConversations(userId, userType);
      expect(cachedData).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent operations', async () => {
      const operations = [];
      const numOperations = 100;

      // Create concurrent set operations
      for (let i = 0; i < numOperations; i++) {
        operations.push(cacheService.set(`concurrent-key-${i}`, `value-${i}`));
      }

      const results = await Promise.all(operations);
      expect(results.every(result => result === true)).toBe(true);

      // Verify all values were set correctly
      const getOperations = [];
      for (let i = 0; i < numOperations; i++) {
        getOperations.push(cacheService.get(`concurrent-key-${i}`));
      }

      const values = await Promise.all(getOperations);
      for (let i = 0; i < numOperations; i++) {
        expect(values[i]).toBe(`value-${i}`);
      }
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const operations = [];
      const numOperations = 1000;

      // Mix of set and get operations
      for (let i = 0; i < numOperations; i++) {
        if (i % 2 === 0) {
          operations.push(cacheService.set(`perf-key-${i}`, `value-${i}`));
        } else {
          operations.push(cacheService.get(`perf-key-${i - 1}`));
        }
      }

      await Promise.all(operations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });
});
