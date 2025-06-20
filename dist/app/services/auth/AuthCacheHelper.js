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
exports.AuthCacheHelper = void 0;
const RedisServiceManager_1 = require("../redis/RedisServiceManager");
/**
 * Centralized authentication caching helper to eliminate code duplication
 * across auth controllers and services
 */
class AuthCacheHelper {
    /**
     * Cache user data with standardized TTL and error handling
     */
    static cacheUserData(email_1, userData_1) {
        return __awaiter(this, arguments, void 0, function* (email, userData, ttlSeconds = 900) {
            try {
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.set(`user:${email}`, userData, ttlSeconds), 'cache');
            }
            catch (error) {
                console.warn('Failed to cache user data:', error);
                // Don't throw - caching failures shouldn't break auth flow
            }
        });
    }
    /**
     * Get cached user data
     */
    static getCachedUserData(email) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.get(`user:${email}`), 'cache', () => Promise.resolve(null));
            }
            catch (error) {
                console.warn('Failed to get cached user data:', error);
                return null;
            }
        });
    }
    /**
     * Clear cached user data
     */
    static clearCachedUserData(email) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.del(`user:${email}`), 'cache');
            }
            catch (error) {
                console.warn('Failed to clear cached user data:', error);
            }
        });
    }
    /**
     * Cache authentication session data
     */
    static cacheAuthSession(userId_1, sessionData_1) {
        return __awaiter(this, arguments, void 0, function* (userId, sessionData, ttlSeconds = 1800) {
            try {
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.set(`auth_session:${userId}`, sessionData, ttlSeconds), 'cache');
            }
            catch (error) {
                console.warn('Failed to cache auth session:', error);
            }
        });
    }
    /**
     * Get cached authentication session
     */
    static getCachedAuthSession(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.get(`auth_session:${userId}`), 'cache', () => Promise.resolve(null));
            }
            catch (error) {
                console.warn('Failed to get cached auth session:', error);
                return null;
            }
        });
    }
    /**
     * Clear authentication session
     */
    static clearAuthSession(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.del(`auth_session:${userId}`), 'cache');
            }
            catch (error) {
                console.warn('Failed to clear auth session:', error);
            }
        });
    }
    /**
     * Cache OAuth provider data
     */
    static cacheOAuthData(providerId_1, providerData_1) {
        return __awaiter(this, arguments, void 0, function* (providerId, providerData, ttlSeconds = 600) {
            try {
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.set(`oauth:${providerId}`, providerData, ttlSeconds), 'cache');
            }
            catch (error) {
                console.warn('Failed to cache OAuth data:', error);
            }
        });
    }
    /**
     * Get cached OAuth provider data
     */
    static getCachedOAuthData(providerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.get(`oauth:${providerId}`), 'cache', () => Promise.resolve(null));
            }
            catch (error) {
                console.warn('Failed to get cached OAuth data:', error);
                return null;
            }
        });
    }
    /**
     * Batch cache multiple auth-related data items
     */
    static batchCacheAuthData(items) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheItems = items.map(item => ({
                    key: item.key,
                    value: item.value,
                    ttl: item.ttl || 900
                }));
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.batchSet(cacheItems), 'cache');
            }
            catch (error) {
                console.warn('Failed to batch cache auth data:', error);
            }
        });
    }
    /**
     * Clear all auth-related cache for a user
     */
    static clearAllUserAuthCache(userId, email) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const keysToDelete = [
                    `user:${email}`,
                    `auth_session:${userId}`,
                    `oauth:${userId}`
                ];
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => RedisServiceManager_1.redisServiceManager.cache.batchDelete(keysToDelete), 'cache');
            }
            catch (error) {
                console.warn('Failed to clear all user auth cache:', error);
            }
        });
    }
}
exports.AuthCacheHelper = AuthCacheHelper;
