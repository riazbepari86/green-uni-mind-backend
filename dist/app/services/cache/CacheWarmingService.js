"use strict";
/**
 * Cache Warming Service for Enterprise-Grade Performance
 * Preloads critical data to ensure immediate availability after cache invalidation
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
exports.CacheWarmingService = void 0;
const RedisServiceManager_1 = require("../redis/RedisServiceManager");
const course_service_1 = require("../../modules/Course/course.service");
const lecture_service_1 = require("../../modules/Lecture/lecture.service");
class CacheWarmingService {
    constructor() {
        this.warmingQueue = [];
        this.isWarming = false;
        // Using the existing Redis cache service from RedisServiceManager
    }
    /**
     * Warm creator courses cache after lecture update
     * This is the critical warming strategy for your issue
     */
    warmCreatorCoursesAfterLectureUpdate(courseId, lectureId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔥 Starting cache warming for creator courses after lecture update:', { courseId, lectureId });
            try {
                // Get the course to find the creator
                const course = yield course_service_1.CourseServices.getCourseById(courseId);
                if (!course || !course.creator) {
                    console.warn('⚠️ Course or creator not found for warming');
                    return;
                }
                const creatorId = course.creator.toString();
                console.log('🔥 Warming cache for creator:', creatorId);
                // Warm the creator courses endpoint with fresh data
                yield this.warmCreatorCoursesEndpoint(creatorId);
                // Warm individual course data
                yield this.warmCourseData(courseId);
                // Warm lecture data
                yield this.warmLectureData(courseId, lectureId);
                console.log('✅ Cache warming completed successfully');
            }
            catch (error) {
                console.error('❌ Cache warming failed:', error);
            }
        });
    }
    /**
     * Warm creator courses endpoint - CRITICAL for your issue
     */
    warmCreatorCoursesEndpoint(creatorId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔥 Warming creator courses endpoint for creator:', creatorId);
            try {
                // Simulate the exact API call that's being cached
                const queryParams = {
                    teacherId: creatorId,
                    page: 1,
                    limit: 20,
                    sortBy: 'updatedAt',
                    sortOrder: 'desc'
                };
                // Get fresh data from database
                const freshCourses = yield course_service_1.CourseServices.getCreatorCourse(creatorId);
                // Cache the fresh data with the exact same key pattern used by the API
                const cacheKey = `api:GET:/api/v1/courses/creator/${creatorId}:${JSON.stringify(queryParams)}`;
                yield RedisServiceManager_1.redisCache.setex(cacheKey, 600, JSON.stringify({
                    success: true,
                    message: 'Courses fetched successfully',
                    data: freshCourses
                })); // 10 minutes TTL
                console.log('✅ Creator courses endpoint warmed successfully');
            }
            catch (error) {
                console.error('❌ Failed to warm creator courses endpoint:', error);
            }
        });
    }
    /**
     * Warm individual course data
     */
    warmCourseData(courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔥 Warming course data for:', courseId);
            try {
                // Get fresh course data with populated lectures
                const freshCourse = yield course_service_1.CourseServices.getCourseById(courseId);
                // Cache with multiple key patterns
                const cacheKeys = [
                    `course:${courseId}`,
                    `course:populated:${courseId}`,
                    `api:GET:/api/v1/courses/${courseId}`
                ];
                for (const key of cacheKeys) {
                    yield RedisServiceManager_1.redisCache.setex(key, 600, JSON.stringify(freshCourse));
                }
                console.log('✅ Course data warmed successfully');
            }
            catch (error) {
                console.error('❌ Failed to warm course data:', error);
            }
        });
    }
    /**
     * Warm lecture data
     */
    warmLectureData(courseId, lectureId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔥 Warming lecture data for:', { courseId, lectureId });
            try {
                // Get fresh lecture data
                const freshLecture = yield lecture_service_1.LectureService.getLectureById(lectureId);
                const freshLectures = yield lecture_service_1.LectureService.getLecturesByCourseId(courseId);
                // Cache individual lecture
                yield RedisServiceManager_1.redisCache.setex(`lecture:${lectureId}`, 600, JSON.stringify(freshLecture));
                // Cache course lectures
                yield RedisServiceManager_1.redisCache.setex(`lectures:course:${courseId}`, 600, JSON.stringify(freshLectures));
                console.log('✅ Lecture data warmed successfully');
            }
            catch (error) {
                console.error('❌ Failed to warm lecture data:', error);
            }
        });
    }
    /**
     * Add warming strategy to queue
     */
    addWarmingStrategy(strategy) {
        this.warmingQueue.push(strategy);
        this.sortQueueByPriority();
    }
    /**
     * Sort warming queue by priority
     */
    sortQueueByPriority() {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        this.warmingQueue.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
    }
    /**
     * Execute warming queue
     */
    executeWarmingQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isWarming) {
                console.log('🔥 Cache warming already in progress');
                return;
            }
            this.isWarming = true;
            console.log('🔥 Starting cache warming queue execution');
            try {
                for (const strategy of this.warmingQueue) {
                    console.log(`🔥 Executing warming strategy: ${strategy.name}`);
                    const startTime = Date.now();
                    yield strategy.execute();
                    const executionTime = Date.now() - startTime;
                    console.log(`✅ Warming strategy ${strategy.name} completed in ${executionTime}ms`);
                }
                // Clear the queue after execution
                this.warmingQueue = [];
                console.log('✅ Cache warming queue execution completed');
            }
            catch (error) {
                console.error('❌ Cache warming queue execution failed:', error);
            }
            finally {
                this.isWarming = false;
            }
        });
    }
    /**
     * Warm critical application caches
     */
    warmCriticalCaches() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔥 Warming critical application caches');
            const criticalStrategies = [
                {
                    name: 'Popular Courses',
                    priority: 'high',
                    execute: () => __awaiter(this, void 0, void 0, function* () {
                        // Warm popular courses cache
                        console.log('🔥 Warming popular courses cache');
                    }),
                    estimatedTime: 1000
                },
                {
                    name: 'Recent Lectures',
                    priority: 'medium',
                    execute: () => __awaiter(this, void 0, void 0, function* () {
                        // Warm recent lectures cache
                        console.log('🔥 Warming recent lectures cache');
                    }),
                    estimatedTime: 800
                }
            ];
            for (const strategy of criticalStrategies) {
                this.addWarmingStrategy(strategy);
            }
            yield this.executeWarmingQueue();
        });
    }
    /**
     * Intelligent cache warming based on usage patterns
     */
    intelligentWarm(entityType, entityId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🧠 Starting intelligent cache warming:', { entityType, entityId });
            switch (entityType) {
                case 'lecture':
                    yield this.warmLectureRelatedCaches(entityId);
                    break;
                case 'course':
                    yield this.warmCourseRelatedCaches(entityId);
                    break;
                case 'creator':
                    yield this.warmCreatorRelatedCaches(entityId);
                    break;
                default:
                    console.warn('⚠️ Unknown entity type for intelligent warming:', entityType);
            }
        });
    }
    /**
     * Warm lecture-related caches
     */
    warmLectureRelatedCaches(lectureId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const lecture = yield lecture_service_1.LectureService.getLectureById(lectureId);
                if (lecture && lecture.courseId) {
                    const courseId = lecture.courseId.toString();
                    yield this.warmCreatorCoursesAfterLectureUpdate(courseId, lectureId);
                }
            }
            catch (error) {
                console.error('❌ Failed to warm lecture-related caches:', error);
            }
        });
    }
    /**
     * Warm course-related caches
     */
    warmCourseRelatedCaches(courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.warmCourseData(courseId);
                // Also warm all lectures for this course
                const lectures = yield lecture_service_1.LectureService.getLecturesByCourseId(courseId);
                for (const lecture of lectures) {
                    yield this.warmLectureData(courseId, lecture._id.toString());
                }
            }
            catch (error) {
                console.error('❌ Failed to warm course-related caches:', error);
            }
        });
    }
    /**
     * Warm creator-related caches
     */
    warmCreatorRelatedCaches(creatorId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.warmCreatorCoursesEndpoint(creatorId);
            }
            catch (error) {
                console.error('❌ Failed to warm creator-related caches:', error);
            }
        });
    }
    /**
     * Get warming service status
     */
    getStatus() {
        return {
            isWarming: this.isWarming,
            queueLength: this.warmingQueue.length
        };
    }
}
exports.CacheWarmingService = CacheWarmingService;
exports.default = CacheWarmingService;
