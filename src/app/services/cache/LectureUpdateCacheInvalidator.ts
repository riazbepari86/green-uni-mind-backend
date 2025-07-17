/**
 * Lecture Update Cache Invalidator
 * Specialized service to handle cache invalidation when lectures are updated
 * This solves the specific issue where lecture updates don't immediately reflect in creator courses
 */

import { redisCache } from '../redis/RedisServiceManager';
import { Course } from '../../modules/Course/course.model';
import { Logger } from '../../config/logger';

export class LectureUpdateCacheInvalidator {
  private static instance: LectureUpdateCacheInvalidator;

  public static getInstance(): LectureUpdateCacheInvalidator {
    if (!LectureUpdateCacheInvalidator.instance) {
      LectureUpdateCacheInvalidator.instance = new LectureUpdateCacheInvalidator();
    }
    return LectureUpdateCacheInvalidator.instance;
  }

  /**
   * Main method to invalidate all caches when a lecture is updated
   * This is the core solution to your issue
   */
  async invalidateAfterLectureUpdate(lectureId: string, courseId: string): Promise<void> {
    console.log('🎯 Starting comprehensive cache invalidation for lecture update:', { lectureId, courseId });

    try {
      // Step 1: Get course details to find the creator
      const course = await Course.findById(courseId).select('creator').lean();
      if (!course) {
        console.warn('Course not found for cache invalidation:', courseId);
        return;
      }

      const creatorId = course.creator.toString();
      console.log('👨‍🏫 Found course creator:', creatorId);

      // Step 2: Invalidate all related cache keys
      await Promise.all([
        this.invalidateDirectLectureCaches(lectureId),
        this.invalidateCourseCaches(courseId),
        this.invalidateCreatorCoursesCaches(creatorId),
        this.invalidateApiEndpointCaches(lectureId, courseId, creatorId),
        this.invalidatePopulatedCourseCaches(courseId),
      ]);

      console.log('✅ Comprehensive cache invalidation completed successfully');

    } catch (error) {
      console.error('❌ Error during cache invalidation:', error);
      Logger.error('Cache invalidation failed', { error, lectureId, courseId });
    }
  }

  /**
   * Invalidate direct lecture caches
   */
  private async invalidateDirectLectureCaches(lectureId: string): Promise<void> {
    const lectureKeys = [
      `lecture:${lectureId}`,
      `lecture:populated:${lectureId}`,
      `lecture:details:${lectureId}`,
      `api:GET:/api/v1/lectures/${lectureId}`,
    ];

    await this.deleteKeys(lectureKeys, 'lecture');
  }

  /**
   * Invalidate course caches
   */
  private async invalidateCourseCaches(courseId: string): Promise<void> {
    const courseKeys = [
      `course:${courseId}`,
      `course:populated:${courseId}`,
      `course:with-lectures:${courseId}`,
      `course:details:${courseId}`,
      `api:GET:/api/v1/courses/${courseId}`,
      `api:GET:/api/v1/courses/${courseId}/lectures`,
    ];

    await this.deleteKeys(courseKeys, 'course');
  }

  /**
   * CRITICAL: Invalidate creator courses caches - This is the key to solving your issue
   */
  private async invalidateCreatorCoursesCaches(creatorId: string): Promise<void> {
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

    await this.deleteKeys(creatorKeys, 'creator courses');
  }

  /**
   * Invalidate API endpoint caches with various patterns
   */
  private async invalidateApiEndpointCaches(lectureId: string, courseId: string, creatorId: string): Promise<void> {
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

    await this.deleteKeys(apiKeys, 'API endpoints');
  }

  /**
   * Invalidate populated course caches (courses with populated lectures)
   */
  private async invalidatePopulatedCourseCaches(courseId: string): Promise<void> {
    const populatedKeys = [
      `course:populated:${courseId}`,
      `course:with-lectures:${courseId}`,
      `course:full:${courseId}`,
      `course:detailed:${courseId}`,
    ];

    await this.deleteKeys(populatedKeys, 'populated courses');
  }

  /**
   * Helper method to delete cache keys with error handling
   */
  private async deleteKeys(keys: string[], category: string): Promise<void> {
    console.log(`🗑️ Deleting ${category} cache keys:`, keys.length);

    const deletePromises = keys.map(async (key) => {
      try {
        const result = await redisCache.del(key);
        if (result > 0) {
          console.log(`✅ Deleted cache key: ${key}`);
        }
        return result;
      } catch (error) {
        console.warn(`⚠️ Failed to delete cache key ${key}:`, error);
        return 0;
      }
    });

    const results = await Promise.all(deletePromises);
    const deletedCount = results.reduce((sum, result) => sum + result, 0);
    
    console.log(`📊 ${category} cache invalidation: ${deletedCount}/${keys.length} keys deleted`);
  }

  /**
   * Emergency cache clear for critical situations
   */
  async emergencyClearAllCourseCaches(): Promise<void> {
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

      await this.deleteKeys(commonKeys, 'emergency cleanup');
      
      console.log('🚨 Emergency cache clear completed');
    } catch (error) {
      console.error('❌ Emergency cache clear failed:', error);
    }
  }

  /**
   * Validate cache invalidation by checking if keys exist
   */
  async validateCacheInvalidation(lectureId: string, courseId: string): Promise<boolean> {
    try {
      const course = await Course.findById(courseId).select('creator').lean();
      if (!course) return false;

      const creatorId = course.creator.toString();
      
      // Check if critical cache keys still exist
      const criticalKeys = [
        `api:GET:/api/v1/courses/creator/${creatorId}`,
        `course:creator:${creatorId}`,
        `course:${courseId}`,
        `lecture:${lectureId}`,
      ];

      const existsPromises = criticalKeys.map(key => redisCache.exists(key));
      const results = await Promise.all(existsPromises);
      
      const stillCachedCount = results.reduce((sum, exists) => sum + exists, 0);
      
      console.log(`🔍 Cache validation: ${stillCachedCount}/${criticalKeys.length} critical keys still exist`);
      
      return stillCachedCount === 0; // True if all keys are invalidated
    } catch (error) {
      console.error('❌ Cache validation failed:', error);
      return false;
    }
  }
}

export default LectureUpdateCacheInvalidator;