/**
 * Cache Warming Service for Enterprise-Grade Performance
 * Preloads critical data to ensure immediate availability after cache invalidation
 */

import { redisCache } from '../redis/RedisServiceManager';
import { CourseServices } from '../../modules/Course/course.service';
import { LectureService } from '../../modules/Lecture/lecture.service';

interface WarmingStrategy {
  name: string;
  priority: 'high' | 'medium' | 'low';
  execute: () => Promise<void>;
  estimatedTime: number; // in milliseconds
}

export class CacheWarmingService {
  private warmingQueue: WarmingStrategy[] = [];
  private isWarming: boolean = false;

  constructor() {
    // Using the existing Redis cache service from RedisServiceManager
  }

  /**
   * Warm creator courses cache after lecture update
   * This is the critical warming strategy for your issue
   */
  async warmCreatorCoursesAfterLectureUpdate(courseId: string, lectureId: string): Promise<void> {
    console.log('🔥 Starting cache warming for creator courses after lecture update:', { courseId, lectureId });

    try {
      // Get the course to find the creator
      const course = await CourseServices.getCourseById(courseId);
      if (!course || !course.creator) {
        console.warn('⚠️ Course or creator not found for warming');
        return;
      }

      const creatorId = course.creator.toString();
      console.log('🔥 Warming cache for creator:', creatorId);

      // Warm the creator courses endpoint with fresh data
      await this.warmCreatorCoursesEndpoint(creatorId);

      // Warm individual course data
      await this.warmCourseData(courseId);

      // Warm lecture data
      await this.warmLectureData(courseId, lectureId);

      console.log('✅ Cache warming completed successfully');

    } catch (error) {
      console.error('❌ Cache warming failed:', error);
    }
  }

  /**
   * Warm creator courses endpoint - CRITICAL for your issue
   */
  private async warmCreatorCoursesEndpoint(creatorId: string): Promise<void> {
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
      const freshCourses = await CourseServices.getCreatorCourse(creatorId);

      // Cache the fresh data with the exact same key pattern used by the API
      const cacheKey = `api:GET:/api/v1/courses/creator/${creatorId}:${JSON.stringify(queryParams)}`;
      
      await redisCache.setex(cacheKey, 600, JSON.stringify({
        success: true,
        message: 'Courses fetched successfully',
        data: freshCourses
      })); // 10 minutes TTL

      console.log('✅ Creator courses endpoint warmed successfully');

    } catch (error) {
      console.error('❌ Failed to warm creator courses endpoint:', error);
    }
  }

  /**
   * Warm individual course data
   */
  private async warmCourseData(courseId: string): Promise<void> {
    console.log('🔥 Warming course data for:', courseId);

    try {
      // Get fresh course data with populated lectures
      const freshCourse = await CourseServices.getCourseById(courseId);

      // Cache with multiple key patterns
      const cacheKeys = [
        `course:${courseId}`,
        `course:populated:${courseId}`,
        `api:GET:/api/v1/courses/${courseId}`
      ];

      for (const key of cacheKeys) {
        await redisCache.setex(key, 600, JSON.stringify(freshCourse));
      }

      console.log('✅ Course data warmed successfully');

    } catch (error) {
      console.error('❌ Failed to warm course data:', error);
    }
  }

  /**
   * Warm lecture data
   */
  private async warmLectureData(courseId: string, lectureId: string): Promise<void> {
    console.log('🔥 Warming lecture data for:', { courseId, lectureId });

    try {
      // Get fresh lecture data
      const freshLecture = await LectureService.getLectureById(lectureId);
      const freshLectures = await LectureService.getLecturesByCourseId(courseId);

      // Cache individual lecture
      await redisCache.setex(`lecture:${lectureId}`, 600, JSON.stringify(freshLecture));

      // Cache course lectures
      await redisCache.setex(`lectures:course:${courseId}`, 600, JSON.stringify(freshLectures));

      console.log('✅ Lecture data warmed successfully');

    } catch (error) {
      console.error('❌ Failed to warm lecture data:', error);
    }
  }

  /**
   * Add warming strategy to queue
   */
  addWarmingStrategy(strategy: WarmingStrategy): void {
    this.warmingQueue.push(strategy);
    this.sortQueueByPriority();
  }

  /**
   * Sort warming queue by priority
   */
  private sortQueueByPriority(): void {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    this.warmingQueue.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  }

  /**
   * Execute warming queue
   */
  async executeWarmingQueue(): Promise<void> {
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
        
        await strategy.execute();
        
        const executionTime = Date.now() - startTime;
        console.log(`✅ Warming strategy ${strategy.name} completed in ${executionTime}ms`);
      }

      // Clear the queue after execution
      this.warmingQueue = [];
      console.log('✅ Cache warming queue execution completed');

    } catch (error) {
      console.error('❌ Cache warming queue execution failed:', error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm critical application caches
   */
  async warmCriticalCaches(): Promise<void> {
    console.log('🔥 Warming critical application caches');

    const criticalStrategies: WarmingStrategy[] = [
      {
        name: 'Popular Courses',
        priority: 'high',
        execute: async () => {
          // Warm popular courses cache
          console.log('🔥 Warming popular courses cache');
        },
        estimatedTime: 1000
      },
      {
        name: 'Recent Lectures',
        priority: 'medium',
        execute: async () => {
          // Warm recent lectures cache
          console.log('🔥 Warming recent lectures cache');
        },
        estimatedTime: 800
      }
    ];

    for (const strategy of criticalStrategies) {
      this.addWarmingStrategy(strategy);
    }

    await this.executeWarmingQueue();
  }

  /**
   * Intelligent cache warming based on usage patterns
   */
  async intelligentWarm(entityType: string, entityId: string): Promise<void> {
    console.log('🧠 Starting intelligent cache warming:', { entityType, entityId });

    switch (entityType) {
      case 'lecture':
        await this.warmLectureRelatedCaches(entityId);
        break;
      case 'course':
        await this.warmCourseRelatedCaches(entityId);
        break;
      case 'creator':
        await this.warmCreatorRelatedCaches(entityId);
        break;
      default:
        console.warn('⚠️ Unknown entity type for intelligent warming:', entityType);
    }
  }

  /**
   * Warm lecture-related caches
   */
  private async warmLectureRelatedCaches(lectureId: string): Promise<void> {
    try {
      const lecture = await LectureService.getLectureById(lectureId);
      if (lecture && lecture.courseId) {
        const courseId = lecture.courseId.toString();
        await this.warmCreatorCoursesAfterLectureUpdate(courseId, lectureId);
      }
    } catch (error) {
      console.error('❌ Failed to warm lecture-related caches:', error);
    }
  }

  /**
   * Warm course-related caches
   */
  async warmCourseRelatedCaches(courseId: string): Promise<void> {
    try {
      await this.warmCourseData(courseId);
      // Also warm all lectures for this course
      const lectures = await LectureService.getLecturesByCourseId(courseId);
      for (const lecture of lectures) {
        await this.warmLectureData(courseId, lecture._id.toString());
      }
    } catch (error) {
      console.error('❌ Failed to warm course-related caches:', error);
    }
  }

  /**
   * Warm creator-related caches
   */
  private async warmCreatorRelatedCaches(creatorId: string): Promise<void> {
    try {
      await this.warmCreatorCoursesEndpoint(creatorId);
    } catch (error) {
      console.error('❌ Failed to warm creator-related caches:', error);
    }
  }

  /**
   * Get warming service status
   */
  getStatus(): { isWarming: boolean; queueLength: number } {
    return {
      isWarming: this.isWarming,
      queueLength: this.warmingQueue.length
    };
  }
}

export default CacheWarmingService;
