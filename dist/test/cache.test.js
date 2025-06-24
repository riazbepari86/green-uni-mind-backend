"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const CacheService_1 = require("../app/services/cache/CacheService");
describe('Cache Service', () => {
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        // Clear cache before each test
        yield CacheService_1.cacheService.clear();
        CacheService_1.cacheService.resetStats();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Clean up after all tests
        yield CacheService_1.cacheService.clear();
    }));
    describe('Basic Cache Operations', () => {
        it('should set and get string values', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-string';
            const value = 'Hello, World!';
            const setResult = yield CacheService_1.cacheService.set(key, value);
            expect(setResult).toBe(true);
            const getValue = yield CacheService_1.cacheService.get(key);
            expect(getValue).toBe(value);
        }));
        it('should set and get object values', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-object';
            const value = { name: 'John', age: 30, active: true };
            const setResult = yield CacheService_1.cacheService.set(key, value);
            expect(setResult).toBe(true);
            const getValue = yield CacheService_1.cacheService.get(key);
            expect(getValue).toEqual(value);
        }));
        it('should set and get array values', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-array';
            const value = [1, 2, 3, 'four', { five: 5 }];
            const setResult = yield CacheService_1.cacheService.set(key, value);
            expect(setResult).toBe(true);
            const getValue = yield CacheService_1.cacheService.get(key);
            expect(getValue).toEqual(value);
        }));
        it('should return null for non-existent keys', () => __awaiter(void 0, void 0, void 0, function* () {
            const getValue = yield CacheService_1.cacheService.get('non-existent-key');
            expect(getValue).toBeNull();
        }));
        it('should delete values', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-delete';
            const value = 'to be deleted';
            yield CacheService_1.cacheService.set(key, value);
            const deleteResult = yield CacheService_1.cacheService.del(key);
            expect(deleteResult).toBe(true);
            const getValue = yield CacheService_1.cacheService.get(key);
            expect(getValue).toBeNull();
        }));
        it('should check if key exists', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-exists';
            const value = 'exists';
            expect(yield CacheService_1.cacheService.exists(key)).toBe(false);
            yield CacheService_1.cacheService.set(key, value);
            expect(yield CacheService_1.cacheService.exists(key)).toBe(true);
            yield CacheService_1.cacheService.del(key);
            expect(yield CacheService_1.cacheService.exists(key)).toBe(false);
        }));
    });
    describe('TTL and Expiration', () => {
        it('should respect TTL settings', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-ttl';
            const value = 'expires soon';
            const ttl = 1; // 1 second
            yield CacheService_1.cacheService.set(key, value, { ttl });
            // Should exist immediately
            expect(yield CacheService_1.cacheService.exists(key)).toBe(true);
            // Wait for expiration
            yield new Promise(resolve => setTimeout(resolve, 1100));
            // Should be expired
            expect(yield CacheService_1.cacheService.exists(key)).toBe(false);
        }));
        it('should set custom expiration', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-expire';
            const value = 'custom expiration';
            yield CacheService_1.cacheService.set(key, value);
            const expireResult = yield CacheService_1.cacheService.expire(key, 1);
            expect(expireResult).toBe(true);
            // Wait for expiration
            yield new Promise(resolve => setTimeout(resolve, 1100));
            expect(yield CacheService_1.cacheService.exists(key)).toBe(false);
        }));
    });
    describe('Increment Operations', () => {
        it('should increment numeric values', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-counter';
            const result1 = yield CacheService_1.cacheService.increment(key);
            expect(result1).toBe(1);
            const result2 = yield CacheService_1.cacheService.increment(key, 5);
            expect(result2).toBe(6);
            const result3 = yield CacheService_1.cacheService.increment(key, -2);
            expect(result3).toBe(4);
        }));
        it('should set TTL for new increment keys', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-increment-ttl';
            yield CacheService_1.cacheService.increment(key, 1, { ttl: 1 });
            expect(yield CacheService_1.cacheService.exists(key)).toBe(true);
            // Wait for expiration
            yield new Promise(resolve => setTimeout(resolve, 1100));
            expect(yield CacheService_1.cacheService.exists(key)).toBe(false);
        }));
    });
    describe('Batch Operations', () => {
        it('should get multiple keys at once', () => __awaiter(void 0, void 0, void 0, function* () {
            const keys = ['key1', 'key2', 'key3'];
            const values = ['value1', 'value2', 'value3'];
            // Set values
            for (let i = 0; i < keys.length; i++) {
                yield CacheService_1.cacheService.set(keys[i], values[i]);
            }
            // Get multiple values
            const results = yield CacheService_1.cacheService.mget(keys);
            expect(results).toEqual(values);
        }));
        it('should handle missing keys in batch get', () => __awaiter(void 0, void 0, void 0, function* () {
            const keys = ['existing-key', 'missing-key', 'another-existing-key'];
            yield CacheService_1.cacheService.set('existing-key', 'value1');
            yield CacheService_1.cacheService.set('another-existing-key', 'value3');
            const results = yield CacheService_1.cacheService.mget(keys);
            expect(results).toEqual(['value1', null, 'value3']);
        }));
    });
    describe('Get or Set Pattern', () => {
        it('should execute function and cache result when key does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-get-or-set';
            let functionCalled = false;
            const fetchFunction = () => __awaiter(void 0, void 0, void 0, function* () {
                functionCalled = true;
                return { data: 'fetched from function' };
            });
            const result = yield CacheService_1.cacheService.getOrSet(key, fetchFunction);
            expect(functionCalled).toBe(true);
            expect(result).toEqual({ data: 'fetched from function' });
            // Verify it's cached
            const cachedResult = yield CacheService_1.cacheService.get(key);
            expect(cachedResult).toEqual({ data: 'fetched from function' });
        }));
        it('should return cached value without executing function when key exists', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-cached-get-or-set';
            const cachedValue = { data: 'cached value' };
            let functionCalled = false;
            yield CacheService_1.cacheService.set(key, cachedValue);
            const fetchFunction = () => __awaiter(void 0, void 0, void 0, function* () {
                functionCalled = true;
                return { data: 'should not be called' };
            });
            const result = yield CacheService_1.cacheService.getOrSet(key, fetchFunction);
            expect(functionCalled).toBe(false);
            expect(result).toEqual(cachedValue);
        }));
    });
    describe('Tag-based Invalidation', () => {
        it('should invalidate cache by tags', () => __awaiter(void 0, void 0, void 0, function* () {
            const keys = ['tagged-key-1', 'tagged-key-2', 'tagged-key-3'];
            const tags = ['user:123', 'analytics'];
            // Set values with tags
            yield CacheService_1.cacheService.set(keys[0], 'value1', { tags: ['user:123'] });
            yield CacheService_1.cacheService.set(keys[1], 'value2', { tags: ['user:123', 'analytics'] });
            yield CacheService_1.cacheService.set(keys[2], 'value3', { tags: ['analytics'] });
            // Verify all keys exist
            for (const key of keys) {
                expect(yield CacheService_1.cacheService.exists(key)).toBe(true);
            }
            // Invalidate by user tag
            const deletedCount = yield CacheService_1.cacheService.invalidateByTags(['user:123']);
            expect(deletedCount).toBeGreaterThan(0);
            // Check which keys were invalidated
            expect(yield CacheService_1.cacheService.exists(keys[0])).toBe(false); // Had user:123 tag
            expect(yield CacheService_1.cacheService.exists(keys[1])).toBe(false); // Had user:123 tag
            expect(yield CacheService_1.cacheService.exists(keys[2])).toBe(true); // Only had analytics tag
        }));
    });
    describe('Cache Statistics', () => {
        it('should track cache statistics', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'stats-test';
            const value = 'test value';
            // Initial stats
            let stats = CacheService_1.cacheService.getStats();
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(stats.sets).toBe(0);
            // Cache miss
            yield CacheService_1.cacheService.get(key);
            stats = CacheService_1.cacheService.getStats();
            expect(stats.misses).toBe(1);
            // Cache set
            yield CacheService_1.cacheService.set(key, value);
            stats = CacheService_1.cacheService.getStats();
            expect(stats.sets).toBe(1);
            // Cache hit
            yield CacheService_1.cacheService.get(key);
            stats = CacheService_1.cacheService.getStats();
            expect(stats.hits).toBe(1);
            // Calculate hit rate
            expect(stats.hitRate).toBe(50); // 1 hit out of 2 total requests
        }));
        it('should reset statistics', () => __awaiter(void 0, void 0, void 0, function* () {
            yield CacheService_1.cacheService.set('test', 'value');
            yield CacheService_1.cacheService.get('test');
            yield CacheService_1.cacheService.get('non-existent');
            let stats = CacheService_1.cacheService.getStats();
            expect(stats.hits).toBeGreaterThan(0);
            expect(stats.misses).toBeGreaterThan(0);
            expect(stats.sets).toBeGreaterThan(0);
            CacheService_1.cacheService.resetStats();
            stats = CacheService_1.cacheService.getStats();
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(stats.sets).toBe(0);
        }));
    });
    describe('Prefix Support', () => {
        it('should use prefixes correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'test-key';
            const value1 = 'value1';
            const value2 = 'value2';
            yield CacheService_1.cacheService.set(key, value1, { prefix: 'prefix1' });
            yield CacheService_1.cacheService.set(key, value2, { prefix: 'prefix2' });
            const result1 = yield CacheService_1.cacheService.get(key, { prefix: 'prefix1' });
            const result2 = yield CacheService_1.cacheService.get(key, { prefix: 'prefix2' });
            expect(result1).toBe(value1);
            expect(result2).toBe(value2);
        }));
    });
    describe('Large Value Handling', () => {
        it('should handle large values gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            const key = 'large-value';
            const largeValue = 'x'.repeat(15 * 1024 * 1024); // 15MB
            const setResult = yield CacheService_1.cacheService.set(key, largeValue);
            expect(setResult).toBe(false); // Should reject large values
        }));
    });
    describe('Analytics Cache Service', () => {
        it('should cache and retrieve teacher analytics', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacherId = 'teacher-123';
            const period = 'monthly';
            const analyticsData = {
                totalRevenue: 1000,
                totalStudents: 50,
                averageRating: 4.5,
            };
            const setResult = yield CacheService_1.analyticsCacheService.setTeacherAnalytics(teacherId, period, analyticsData);
            expect(setResult).toBe(true);
            const cachedData = yield CacheService_1.analyticsCacheService.getTeacherAnalytics(teacherId, period);
            expect(cachedData).toEqual(analyticsData);
        }));
        it('should invalidate teacher analytics cache', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacherId = 'teacher-456';
            const period = 'weekly';
            const analyticsData = { revenue: 500 };
            yield CacheService_1.analyticsCacheService.setTeacherAnalytics(teacherId, period, analyticsData);
            // Verify data is cached
            let cachedData = yield CacheService_1.analyticsCacheService.getTeacherAnalytics(teacherId, period);
            expect(cachedData).toEqual(analyticsData);
            // Invalidate cache
            yield CacheService_1.analyticsCacheService.invalidateTeacher(teacherId);
            // Verify data is no longer cached
            cachedData = yield CacheService_1.analyticsCacheService.getTeacherAnalytics(teacherId, period);
            expect(cachedData).toBeNull();
        }));
    });
    describe('Messaging Cache Service', () => {
        it('should cache and retrieve conversations', () => __awaiter(void 0, void 0, void 0, function* () {
            const userId = 'user-789';
            const userType = 'student';
            const conversationsData = [
                { id: 'conv-1', title: 'Conversation 1' },
                { id: 'conv-2', title: 'Conversation 2' },
            ];
            const setResult = yield CacheService_1.messagingCacheService.setConversations(userId, userType, conversationsData);
            expect(setResult).toBe(true);
            const cachedData = yield CacheService_1.messagingCacheService.getConversations(userId, userType);
            expect(cachedData).toEqual(conversationsData);
        }));
        it('should invalidate user messaging cache', () => __awaiter(void 0, void 0, void 0, function* () {
            const userId = 'user-101';
            const userType = 'teacher';
            const conversationsData = [{ id: 'conv-3', title: 'Conversation 3' }];
            yield CacheService_1.messagingCacheService.setConversations(userId, userType, conversationsData);
            // Verify data is cached
            let cachedData = yield CacheService_1.messagingCacheService.getConversations(userId, userType);
            expect(cachedData).toEqual(conversationsData);
            // Invalidate cache
            yield CacheService_1.messagingCacheService.invalidateUser(userId);
            // Verify data is no longer cached
            cachedData = yield CacheService_1.messagingCacheService.getConversations(userId, userType);
            expect(cachedData).toBeNull();
        }));
    });
    describe('Performance Tests', () => {
        it('should handle concurrent operations', () => __awaiter(void 0, void 0, void 0, function* () {
            const operations = [];
            const numOperations = 100;
            // Create concurrent set operations
            for (let i = 0; i < numOperations; i++) {
                operations.push(CacheService_1.cacheService.set(`concurrent-key-${i}`, `value-${i}`));
            }
            const results = yield Promise.all(operations);
            expect(results.every(result => result === true)).toBe(true);
            // Verify all values were set correctly
            const getOperations = [];
            for (let i = 0; i < numOperations; i++) {
                getOperations.push(CacheService_1.cacheService.get(`concurrent-key-${i}`));
            }
            const values = yield Promise.all(getOperations);
            for (let i = 0; i < numOperations; i++) {
                expect(values[i]).toBe(`value-${i}`);
            }
        }));
        it('should maintain performance under load', () => __awaiter(void 0, void 0, void 0, function* () {
            const startTime = Date.now();
            const operations = [];
            const numOperations = 1000;
            // Mix of set and get operations
            for (let i = 0; i < numOperations; i++) {
                if (i % 2 === 0) {
                    operations.push(CacheService_1.cacheService.set(`perf-key-${i}`, `value-${i}`));
                }
                else {
                    operations.push(CacheService_1.cacheService.get(`perf-key-${i - 1}`));
                }
            }
            yield Promise.all(operations);
            const endTime = Date.now();
            const duration = endTime - startTime;
            // Should complete within reasonable time (adjust threshold as needed)
            expect(duration).toBeLessThan(5000); // 5 seconds
        }));
    });
});
