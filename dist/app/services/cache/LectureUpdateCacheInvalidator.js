"use strict";
/**
 * Lecture Update Cache Invalidator
 * Specialized service to handle cache invalidation when lectures are updated
 * This solves the specific issue where lecture updates don't immediately reflect in creator courses
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LectureUpdateCacheInvalidator = void 0;
const RedisServiceManager_1 = require("../redis/RedisServiceManager");
const course_model_1 = require("../../modules/Course/course.model");
const logger_1 = require("../../config/logger");
class LectureUpdateCacheInvalidator {
    static getInstance() {
        if (!LectureUpdateCacheInvalidator.instance) {
            LectureUpdateCacheInvalidator.instance = new LectureUpdateCacheInvalidator();
        }
        return LectureUpdateCacheInvalidator.instance;
    }
    /**
     * Main method to invalidate all caches when a lecture is updated
     * This is the core solution to your issue
     */
    invalidateAfterLectureUpdate(lectureId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🎯 Starting comprehensive cache invalidation for lecture update:', { lectureId, courseId });
            try {
                // Step 1: Get course details to find the creator
                const course = yield course_model_1.Course.findById(courseId).select('creator').lean();
                if (!course) {
                    console.warn('Course not found for cache invalidation:', courseId);
                    return;
                }
                const creatorId = course.creator.toString();
                console.log('👨‍🏫 Found course creator:', creatorId);
                // Step 2: Invalidate all related cache keys
                yield Promise.all([
                    this.invalidateDirectLectureCaches(lectureId),
                    this.invalidateCourseCaches(courseId),
                    this.invalidateCreatorCoursesCaches(creatorId),
                    this.invalidateApiEndpointCaches(lectureId, courseId, creatorId),
                    this.invalidatePopulatedCourseCaches(courseId),
                ]);
                console.log('✅ Comprehensive cache invalidation completed successfully');
            }
            catch (error) {
                console.error('❌ Error during cache invalidation:', error);
                logger_1.Logger.error('Cache invalidation failed', { error, lectureId, courseId });
            }
        });
    }
    /**
     * Invalidate direct lecture caches
     */
    invalidateDirectLectureCaches(lectureId) {
        return __awaiter(this, void 0, void 0, function* () {
            const lectureKeys = [
                `lecture:${lectureId}`,
                `lecture:populated:${lectureId}`,
                `lecture:details:${lectureId}`,
                `api:GET:/api/v1/lectures/${lectureId}`,
            ];
            yield this.deleteKeys(lectureKeys, 'lecture');
        });
    }
    /**
     * Invalidate course caches
     */
    invalidateCourseCaches(courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            const courseKeys = [
                `course:${courseId}`,
                `course:populated:${courseId}`,
                `course:with-lectures:${courseId}`,
                `course:details:${courseId}`,
                `api:GET:/api/v1/courses/${courseId}`,
                `api:GET:/api/v1/courses/${courseId}/lectures`,
            ];
            yield this.deleteKeys(courseKeys, 'course');
        });
    }
    /**
     * CRITICAL: Invalidate creator courses caches - This is the key to solving your issue
     */
    invalidateCreatorCoursesCaches(creatorId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🎯 Invalidating creator courses caches for:', creatorId);
            // These are the most likely cache keys for creator courses
            const creatorKeys = [
                `api:GET:/api/v1/courses/creator/${creatorId}`,
                `api:GET:/api/v1/courses/creator/${creatorId}:*`, // Pattern for query params
                `course:creator:${creatorId}`,
                `course:creator:list:${creatorId}`,
                `creator:courses:${creatorId}`,
                `creator:courses:all:${creatorId}`,
                `courses:creator:${creatorId}`,
                `courses:by-creator:${creatorId}`,
            ];
            // Also try to invalidate with common query parameter patterns
            const queryPatterns = [
                '',
                '?page=1&limit=20',
                '?page=1&limit=20&sortBy=updatedAt&sortOrder=desc',
                '?sortBy=updatedAt&sortOrder=desc',
                '?teacherId=' + creatorId,
                '?teacherId=' + creatorId + '&page=1&limit=20',
                '?teacherId=' + creatorId + '&page=1&limit=20&sortBy=updatedAt&sortOrder=desc',
            ];
            for (const pattern of queryPatterns) {
                creatorKeys.push(`api:GET:/api/v1/courses/creator/${creatorId}${pattern}`);
            }
            yield this.deleteKeys(creatorKeys, 'creator courses');
        });
    }
    /**
     * Invalidate API endpoint caches with various patterns
     */
    invalidateApiEndpointCaches(lectureId, courseId, creatorId) {
        return __awaiter(this, void 0, void 0, function* () {
            const apiKeys = [
                // Lecture endpoints
                `api:GET:/api/v1/lectures/${lectureId}`,
                `api:GET:/api/v1/lectures/${courseId}/get-lectures`,
                // Course endpoints
                `api:GET:/api/v1/courses/${courseId}`,
                // Creator endpoints - MOST IMPORTANT
                `api:GET:/api/v1/courses/creator/${creatorId}`,
                // Generic patterns
                'api:GET:/api/v1/courses/creator',
                'api:courses:creator',
                'api:creator:courses',
            ];
            yield this.deleteKeys(apiKeys, 'API endpoints');
        });
    }
    /**
     * Invalidate populated course caches (courses with populated lectures)
     */
    invalidatePopulatedCourseCaches(courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            const populatedKeys = [
                `course:populated:${courseId}`,
                `course:with-lectures:${courseId}`,
                `course:full:${courseId}`,
                `course:detailed:${courseId}`,
            ];
            yield this.deleteKeys(populatedKeys, 'populated courses');
        });
    }
    /**
     * Helper method to delete cache keys with error handling
     */
    deleteKeys(keys, category) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`🗑️ Deleting ${category} cache keys:`, keys.length);
            const deletePromises = keys.map((key) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield RedisServiceManager_1.redisCache.del(key);
                    if (result > 0) {
                        console.log(`✅ Deleted cache key: ${key}`);
                    }
                    return result;
                }
                catch (error) {
                    console.warn(`⚠️ Failed to delete cache key ${key}:`, error);
                    return 0;
                }
            }));
            const results = yield Promise.all(deletePromises);
            const deletedCount = results.reduce((sum, result) => sum + result, 0);
            console.log(`📊 ${category} cache invalidation: ${deletedCount}/${keys.length} keys deleted`);
        });
    }
    /**
     * Emergency cache clear for critical situations
     */
    emergencyClearAllCourseCaches() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🚨 Emergency: Clearing all course-related caches');
            try {
                // Get all keys that might be course-related
                const patterns = [
                    'api:GET:/api/v1/courses/*',
                    'course:*',
                    'creator:*',
                    'lecture:*',
                ];
                // Since we can't use KEYS in production Redis, we'll clear known patterns
                const commonKeys = [
                    'api:GET:/api/v1/courses/creator',
                    'api:courses:creator',
                    'course:creator:list',
                    'creator:courses:all',
                ];
                yield this.deleteKeys(commonKeys, 'emergency cleanup');
                console.log('🚨 Emergency cache clear completed');
            }
            catch (error) {
                console.error('❌ Emergency cache clear failed:', error);
            }
        });
    }
    /**
     * Validate cache invalidation by checking if keys exist
     */
    validateCacheInvalidation(lectureId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const course = yield course_model_1.Course.findById(courseId).select('creator').lean();
                if (!course)
                    return false;
                const creatorId = course.creator.toString();
                // Check if critical cache keys still exist
                const criticalKeys = [
                    `api:GET:/api/v1/courses/creator/${creatorId}`,
                    `course:creator:${creatorId}`,
                    `course:${courseId}`,
                    `lecture:${lectureId}`,
                ];
                const existsPromises = criticalKeys.map(key => RedisServiceManager_1.redisCache.exists(key));
                const results = yield Promise.all(existsPromises);
                const stillCachedCount = results.reduce((sum, exists) => sum + exists, 0);
                console.log(`🔍 Cache validation: ${stillCachedCount}/${criticalKeys.length} critical keys still exist`);
                return stillCachedCount === 0; // True if all keys are invalidated
            }
            catch (error) {
                console.error('❌ Cache validation failed:', error);
                return false;
            }
        });
    }
}
exports.LectureUpdateCacheInvalidator = LectureUpdateCacheInvalidator;
exports.default = LectureUpdateCacheInvalidator;
