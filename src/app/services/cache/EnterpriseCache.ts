/**
 * Simplified Enterprise Cache Invalidation Service
 * Focuses on the core functionality needed to solve the lecture update issue
 */

import { redisCache } from '../redis/RedisServiceManager';
import CacheWarmingService from './CacheWarmingService';
import CacheVersioningService from './CacheVersioningService';

export class EnterpriseCacheService {
  private cacheWarmingService: CacheWarmingService;
  private cacheVersioningService: CacheVersioningService;

  constructor() {
    this.cacheWarmingService = new CacheWarmingService();
    this.cacheVersioningService = new CacheVersioningService();
    console.log('🏢 Simplified Enterprise Cache Service initialized');
  }

  /**
   * Simplified cache invalidation for lecture updates
   * This is the core method that solves your issue
   */
  async invalidateLectureUpdate(lectureId: string, courseId: string, updatedFields: string[] = []): Promise<void> {
    console.log('🏢 Starting simplified cache invalidation:', { lectureId, courseId, updatedFields });

    try {
      // 1. Invalidate direct lecture caches
      await this.invalidateDirectCaches('lecture', lectureId);

      // 2. CRITICAL: Invalidate course caches that contain this lecture
      await this.invalidateCourseWithPopulatedLectures(courseId, lectureId);

      // 3. Invalidate creator course caches (most important for your issue)
      await this.invalidateCreatorCourseCaches(courseId);

      // 4. Update cache versions
      this.cacheVersioningService.handleLectureUpdate(lectureId, courseId, updatedFields);

      // 5. Trigger cache warming
      await this.warmCriticalCaches(courseId);

      console.log('✅ Simplified cache invalidation completed');

    } catch (error) {
      console.error('❌ Cache invalidation failed:', error);
      // Don't throw to prevent breaking the main request
    }
  }

  /**
   * Invalidate direct entity caches
   */
  private async invalidateDirectCaches(entityType: string, entityId: string): Promise<void> {
    const cacheKeys = [
      `${entityType}:${entityId}`,
      `${entityType}:populated:${entityId}`,
      `api:GET:/api/v1/${entityType}s/${entityId}`,
    ];

    for (const key of cacheKeys) {
      try {
        await redisCache.del(key);
        console.log(`🗑️ Deleted cache key: ${key}`);
      } catch (error) {
        console.warn(`Failed to delete cache key ${key}:`, error);
      }
    }

    console.log(`✅ Invalidated direct caches for ${entityType}:${entityId}`);
  }

  /**
   * CRITICAL: Invalidate course caches that contain populated lectures
   * This is the key to solving your issue
   */
  private async invalidateCourseWithPopulatedLectures(courseId: string, lectureId: string): Promise<void> {
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
        await redisCache.del(key);
      } catch (error) {
        console.warn(`Failed to delete course cache key ${key}:`, error);
      }
    }

    console.log('✅ Course populated lecture caches invalidated');
  }

  /**
   * Invalidate creator course caches - CRITICAL for your specific issue
   */
  private async invalidateCreatorCourseCaches(courseId: string): Promise<void> {
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
          await redisCache.del(key);
        } catch (error) {
          console.warn(`Failed to delete creator cache key ${key}:`, error);
        }
      }

      console.log('✅ Creator course caches invalidated');
    } catch (error) {
      console.error('❌ Failed to invalidate creator caches:', error);
    }
  }

  /**
   * Invalidate API endpoint caches (simplified)
   */
  private async invalidateApiEndpointCaches(lectureId: string, courseId: string): Promise<void> {
    const apiKeys = [
      `api:GET:/api/v1/lectures/${lectureId}`,
      `api:GET:/api/v1/courses/${courseId}`,
      `api:GET:/api/v1/courses/creator`,
    ];

    for (const key of apiKeys) {
      try {
        await redisCache.del(key);
        console.log(`🌐 Deleted API cache key: ${key}`);
      } catch (error) {
        console.warn(`Failed to delete API cache key ${key}:`, error);
      }
    }

    console.log('✅ API endpoint caches invalidated');
  }

  /**
   * Warm critical caches after invalidation
   */
  private async warmCriticalCaches(courseId: string): Promise<void> {
    console.log('🔥 Warming critical caches for courseId:', courseId);

    try {
      // Use the cache warming service to warm critical caches
      await this.cacheWarmingService.warmCourseRelatedCaches(courseId);
      console.log('✅ Critical caches warmed successfully');
    } catch (error) {
      console.error('❌ Failed to warm critical caches:', error);
    }
  }

  /**
   * Emergency cache clear for critical situations
   */
  async emergencyCacheClear(): Promise<void> {
    console.log('🚨 Emergency cache clear initiated (simplified)');

    // Clear common cache keys
    const commonKeys = [
      'api:GET:/api/v1/courses/creator',
      'course:creator:list',
      'creator:courses:all',
    ];

    for (const key of commonKeys) {
      try {
        await redisCache.del(key);
      } catch (error) {
        console.warn(`Failed to delete key ${key}:`, error);
      }
    }

    console.log('🚨 Emergency cache clear completed');
  }
}

export default EnterpriseCacheService;
