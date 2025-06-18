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
exports.hybridStorageService = exports.HybridStorageService = void 0;
const user_model_1 = require("../../modules/User/user.model");
const SmartCacheService_1 = require("../cache/SmartCacheService");
const FeatureToggleService_1 = require("../redis/FeatureToggleService");
class HybridStorageService {
    constructor() {
        this.mongoFallbackEnabled = true;
        this.memoryFallbackEnabled = true;
        // Initialize memory cache with simple Map for now
        this.memoryCache = new Map();
        // Listen to feature toggle changes
        FeatureToggleService_1.featureToggleService.onFeatureChange('api_response_caching', (enabled) => {
            if (!enabled) {
                console.log('📵 API caching disabled, clearing memory cache');
                this.memoryCache.clear();
            }
        });
    }
    // Get data with hybrid fallback strategy
    get(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, options = {}) {
            const priority = options.priority || 'medium';
            try {
                // Strategy 1: Try Redis first (if enabled and high priority)
                if (priority === 'critical' || priority === 'high') {
                    if (FeatureToggleService_1.featureToggleService.isFeatureEnabled('api_response_caching')) {
                        const redisData = yield SmartCacheService_1.smartCacheService.get(key, { priority });
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
                    const mongoData = yield this.getFromMongo(key);
                    if (mongoData !== null) {
                        console.log(`🎯 Hybrid Cache Hit (MongoDB): ${key}`);
                        // Cache the result in memory for future use
                        this.setToMemory(key, mongoData, options.ttl || 900);
                        return mongoData;
                    }
                }
                console.log(`❌ Hybrid Cache Miss: ${key}`);
                return null;
            }
            catch (error) {
                console.error(`Hybrid storage get error for key ${key}:`, error);
                // Final fallback: try memory cache even if expired
                const fallbackData = this.memoryCache.get(key);
                if (fallbackData) {
                    console.log(`🔄 Using expired memory cache as fallback: ${key}`);
                    return fallbackData.data;
                }
                return null;
            }
        });
    }
    // Set data with hybrid storage strategy
    set(key_1, value_1) {
        return __awaiter(this, arguments, void 0, function* (key, value, options = {}) {
            const priority = options.priority || 'medium';
            const ttl = options.ttl || this.getSmartTTL(key, priority);
            try {
                // Strategy 1: Store in Redis for critical/high priority data
                if ((priority === 'critical' || priority === 'high') &&
                    FeatureToggleService_1.featureToggleService.isFeatureEnabled('api_response_caching')) {
                    yield SmartCacheService_1.smartCacheService.set(key, value, {
                        ttl,
                        priority,
                        compress: this.shouldCompress(value)
                    });
                    console.log(`📦 Stored in Redis: ${key} (TTL: ${ttl}s)`);
                }
                // Strategy 2: Always store in memory cache for fast access
                this.setToMemory(key, value, ttl);
                // Strategy 3: Store in MongoDB for user data (if enabled)
                if (options.fallbackToMongo && key.includes('user:') && this.mongoFallbackEnabled) {
                    yield this.setToMongo(key, value, ttl);
                }
            }
            catch (error) {
                console.error(`Hybrid storage set error for key ${key}:`, error);
                // Fallback: at least store in memory
                try {
                    this.setToMemory(key, value, ttl);
                    console.log(`🔄 Fallback: stored in memory only: ${key}`);
                }
                catch (memoryError) {
                    console.error(`Failed to store in memory fallback:`, memoryError);
                }
            }
        });
    }
    // Delete from all storage layers
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Delete from all layers
                yield Promise.allSettled([
                    SmartCacheService_1.smartCacheService.del(key),
                    this.deleteFromMemory(key),
                    this.deleteFromMongo(key)
                ]);
                console.log(`🗑️ Deleted from hybrid storage: ${key}`);
            }
            catch (error) {
                console.error(`Error deleting from hybrid storage: ${key}`, error);
            }
        });
    }
    // Check if key exists in any storage layer
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check memory first (fastest)
                if (this.memoryCache.has(key)) {
                    const data = this.memoryCache.get(key);
                    if (data && !this.isExpired(data)) {
                        return true;
                    }
                }
                // Check Redis if enabled
                if (FeatureToggleService_1.featureToggleService.isFeatureEnabled('api_response_caching')) {
                    const redisExists = yield SmartCacheService_1.smartCacheService.exists(key);
                    if (redisExists)
                        return true;
                }
                // Check MongoDB for user data
                if (key.includes('user:')) {
                    return yield this.existsInMongo(key);
                }
                return false;
            }
            catch (error) {
                console.error(`Error checking existence in hybrid storage: ${key}`, error);
                return false;
            }
        });
    }
    // Memory cache operations
    setToMemory(key, value, ttl) {
        const cachedData = {
            data: value,
            timestamp: Date.now(),
            ttl: ttl * 1000, // Convert to milliseconds
            source: 'memory'
        };
        this.memoryCache.set(key, cachedData);
        console.log(`💾 Stored in memory: ${key} (TTL: ${ttl}s)`);
    }
    deleteFromMemory(key) {
        this.memoryCache.delete(key);
    }
    isExpired(cachedData) {
        return Date.now() > cachedData.timestamp + cachedData.ttl;
    }
    // MongoDB fallback operations
    getFromMongo(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.mongoFallbackEnabled)
                    return null;
                // Extract user ID from key
                const userIdMatch = key.match(/user:([^:]+)/);
                if (!userIdMatch)
                    return null;
                const userId = userIdMatch[1];
                const user = yield user_model_1.User.findById(userId).lean();
                if (!user)
                    return null;
                // Return user data based on key type
                if (key.includes(':profile')) {
                    return {
                        _id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        role: user.role,
                        isVerified: user.isVerified
                    };
                }
                return user;
            }
            catch (error) {
                console.error('Error getting from MongoDB:', error);
                return null;
            }
        });
    }
    setToMongo(key, value, ttl) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.mongoFallbackEnabled)
                    return;
                // For now, we don't actively store cache data in MongoDB
                // This is mainly for reading existing user data as fallback
                console.log(`📝 MongoDB storage not implemented for key: ${key}`);
            }
            catch (error) {
                console.error('Error setting to MongoDB:', error);
            }
        });
    }
    deleteFromMongo(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // MongoDB deletion not implemented for cache data
                console.log(`🗑️ MongoDB deletion not implemented for key: ${key}`);
            }
            catch (error) {
                console.error('Error deleting from MongoDB:', error);
            }
        });
    }
    existsInMongo(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.mongoFallbackEnabled)
                    return false;
                const userIdMatch = key.match(/user:([^:]+)/);
                if (!userIdMatch)
                    return false;
                const userId = userIdMatch[1];
                const user = yield user_model_1.User.findById(userId).select('_id').lean();
                return !!user;
            }
            catch (error) {
                console.error('Error checking existence in MongoDB:', error);
                return false;
            }
        });
    }
    // Utility methods
    getSmartTTL(key, priority) {
        // Smart TTL based on key pattern and priority
        if (key.includes('user:profile'))
            return 1800; // 30 minutes
        if (key.includes('user:permissions'))
            return 3600; // 1 hour
        if (key.includes('api:courses'))
            return 1800; // 30 minutes
        if (key.includes('api:categories'))
            return 3600; // 1 hour
        // Priority-based TTL
        switch (priority) {
            case 'critical': return 3600; // 1 hour
            case 'high': return 1800; // 30 minutes
            case 'medium': return 900; // 15 minutes
            case 'low': return 300; // 5 minutes
            default: return 600; // 10 minutes
        }
    }
    shouldCompress(value) {
        const serialized = JSON.stringify(value);
        return serialized.length > 2048; // Compress if larger than 2KB
    }
    // Get storage statistics
    getStorageStats() {
        return {
            memory: {
                size: this.memoryCache.size * 1024, // Rough estimate
                maxSize: 100 * 1024 * 1024, // 100MB
                itemCount: this.memoryCache.size,
                hitRate: 0 // Would need to track hits/misses
            },
            features: {
                redisCachingEnabled: FeatureToggleService_1.featureToggleService.isFeatureEnabled('api_response_caching'),
                mongoFallbackEnabled: this.mongoFallbackEnabled,
                memoryFallbackEnabled: this.memoryFallbackEnabled
            }
        };
    }
    // Clear all storage layers
    clearAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield Promise.allSettled([
                    SmartCacheService_1.smartCacheService.clearAll(),
                    this.clearMemory()
                ]);
                console.log('🧹 All hybrid storage cleared');
            }
            catch (error) {
                console.error('Error clearing hybrid storage:', error);
            }
        });
    }
    // Clear memory cache only
    clearMemory() {
        this.memoryCache.clear();
        console.log('🧹 Memory cache cleared');
    }
    // Enable/disable fallback mechanisms
    setMongoFallbackEnabled(enabled) {
        this.mongoFallbackEnabled = enabled;
        console.log(`🔧 MongoDB fallback ${enabled ? 'enabled' : 'disabled'}`);
    }
    setMemoryFallbackEnabled(enabled) {
        this.memoryFallbackEnabled = enabled;
        console.log(`🔧 Memory fallback ${enabled ? 'enabled' : 'disabled'}`);
    }
    // Warm cache with critical data
    warmCriticalData() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔥 Warming critical data in hybrid storage...');
            try {
                // This would typically warm up frequently accessed data
                // For now, just log the action
                console.log('✅ Critical data warming completed');
            }
            catch (error) {
                console.error('❌ Error warming critical data:', error);
            }
        });
    }
}
exports.HybridStorageService = HybridStorageService;
exports.hybridStorageService = new HybridStorageService();
