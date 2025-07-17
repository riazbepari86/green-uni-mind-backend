"use strict";
/**
 * Simplified Enterprise Cache Invalidation Service
 * Focuses on the core functionality needed to solve the lecture update issue
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnterpriseCacheService = void 0;
const RedisServiceManager_1 = require("../redis/RedisServiceManager");
const CacheWarmingService_1 = __importDefault(require("./CacheWarmingService"));
const CacheVersioningService_1 = __importDefault(require("./CacheVersioningService"));
class EnterpriseCacheService {
    constructor() {
        this.cacheWarmingService = new CacheWarmingService_1.default();
        this.cacheVersioningService = new CacheVersioningService_1.default();
        console.log('🏢 Simplified Enterprise Cache Service initialized');
    }
    /**
     * Simplified cache invalidation for lecture updates
     * This is the core method that solves your issue
     */
    invalidateLectureUpdate(lectureId_1, courseId_1) {
        return __awaiter(this, arguments, void 0, function* (lectureId, courseId, updatedFields = []) {
            console.log('🏢 Starting simplified cache invalidation:', { lectureId, courseId, updatedFields });
            try {
                // 1. Invalidate direct lecture caches
                yield this.invalidateDirectCaches('lecture', lectureId);
                // 2. CRITICAL: Invalidate course caches that contain this lecture
                yield this.invalidateCourseWithPopulatedLectures(courseId, lectureId);
                // 3. Invalidate creator course caches (most important for your issue)
                yield this.invalidateCreatorCourseCaches(courseId);
                // 4. Update cache versions
                this.cacheVersioningService.handleLectureUpdate(lectureId, courseId, updatedFields);
                // 5. Trigger cache warming
                yield this.warmCriticalCaches(courseId);
                console.log('✅ Simplified cache invalidation completed');
            }
            catch (error) {
                console.error('❌ Cache invalidation failed:', error);
                // Don't throw to prevent breaking the main request
            }
        });
    }
    /**
     * Invalidate direct entity caches
     */
    invalidateDirectCaches(entityType, entityId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKeys = [
                `${entityType}:${entityId}`,
                `${entityType}:populated:${entityId}`,
                `api:GET:/api/v1/${entityType}s/${entityId}`,
            ];
            for (const key of cacheKeys) {
                try {
                    yield RedisServiceManager_1.redisCache.del(key);
                    console.log(`🗑️ Deleted cache key: ${key}`);
                }
                catch (error) {
                    console.warn(`Failed to delete cache key ${key}:`, error);
                }
            }
            console.log(`✅ Invalidated direct caches for ${entityType}:${entityId}`);
        });
    }
    /**
     * CRITICAL: Invalidate course caches that contain populated lectures
     * This is the key to solving your issue
     */
    invalidateCourseWithPopulatedLectures(courseId, lectureId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🎯 Invalidating course caches with populated lectures:', { courseId, lectureId });
            // Specific cache keys for course caches that might contain populated lecture data
            const courseKeys = [
                `course:${courseId}`,
                `course:populated:${courseId}`,
                `course:with-lectures:${courseId}`,
                `api:GET:/api/v1/courses/${courseId}`,
                `api:GET:/api/v1/courses/${courseId}/lectures`,
            ];
            for (const key of courseKeys) {
                try {
                    yield RedisServiceManager_1.redisCache.del(key);
                }
                catch (error) {
                    console.warn(`Failed to delete course cache key ${key}:`, error);
                }
            }
            console.log('✅ Course populated lecture caches invalidated');
        });
    }
    /**
     * Invalidate creator course caches - CRITICAL for your specific issue
     */
    invalidateCreatorCourseCaches(courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('👨‍🏫 Invalidating creator course caches for courseId:', courseId);
            try {
                // Since we can't use pattern matching, we'll invalidate common creator cache keys
                // This is a simplified approach that targets the most likely cache keys
                const creatorKeys = [
                    'api:GET:/api/v1/courses/creator',
                    'course:creator:list',
                    'creator:courses:all',
                    `course:creator:${courseId}`,
                ];
                for (const key of creatorKeys) {
                    try {
                        yield RedisServiceManager_1.redisCache.del(key);
                    }
                    catch (error) {
                        console.warn(`Failed to delete creator cache key ${key}:`, error);
                    }
                }
                console.log('✅ Creator course caches invalidated');
            }
            catch (error) {
                console.error('❌ Failed to invalidate creator caches:', error);
            }
        });
    }
    /**
     * Invalidate API endpoint caches (simplified)
     */
    invalidateApiEndpointCaches(lectureId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            const apiKeys = [
                `api:GET:/api/v1/lectures/${lectureId}`,
                `api:GET:/api/v1/courses/${courseId}`,
                `api:GET:/api/v1/courses/creator`,
            ];
            for (const key of apiKeys) {
                try {
                    yield RedisServiceManager_1.redisCache.del(key);
                    console.log(`🌐 Deleted API cache key: ${key}`);
                }
                catch (error) {
                    console.warn(`Failed to delete API cache key ${key}:`, error);
                }
            }
            console.log('✅ API endpoint caches invalidated');
        });
    }
    /**
     * Warm critical caches after invalidation
     */
    warmCriticalCaches(courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔥 Warming critical caches for courseId:', courseId);
            try {
                // Use the cache warming service to warm critical caches
                yield this.cacheWarmingService.warmCourseRelatedCaches(courseId);
                console.log('✅ Critical caches warmed successfully');
            }
            catch (error) {
                console.error('❌ Failed to warm critical caches:', error);
            }
        });
    }
    /**
     * Emergency cache clear for critical situations
     */
    emergencyCacheClear() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🚨 Emergency cache clear initiated (simplified)');
            // Clear common cache keys
            const commonKeys = [
                'api:GET:/api/v1/courses/creator',
                'course:creator:list',
                'creator:courses:all',
            ];
            for (const key of commonKeys) {
                try {
                    yield RedisServiceManager_1.redisCache.del(key);
                }
                catch (error) {
                    console.warn(`Failed to delete key ${key}:`, error);
                }
            }
            console.log('🚨 Emergency cache clear completed');
        });
    }
}
exports.EnterpriseCacheService = EnterpriseCacheService;
exports.default = EnterpriseCacheService;
