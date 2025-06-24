import { connectDB, disconnectDB } from './setup/database';
import { createTestTeacher, createTestCourse, createTestStudent } from './helpers/testHelpers';
import { createToken } from '../app/modules/Auth/auth.utils';
import ActivityTrackingService from '../app/services/activity/ActivityTrackingService';
import { ActivityType, ActivityPriority } from '../app/modules/Analytics/analytics.interface';

// Mock generateToken function for tests
const generateToken = (payload: any) => {
  return createToken(payload, 'test-secret', '1h');
};

describe('Enhanced Activity Tracking', () => {
  let teacherId: string;
  let courseId: string;
  let studentId: string;
  let activityTrackingService: ActivityTrackingService;

  beforeAll(async () => {
    await connectDB();

    // Create test teacher
    const teacher = await createTestTeacher();
    teacherId = teacher._id.toString();

    // Create test course
    const course = await createTestCourse(teacher._id);
    courseId = course._id.toString();

    // Create test student
    const student = await createTestStudent();
    studentId = student._id.toString();

    // Initialize services
    activityTrackingService = new ActivityTrackingService();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Activity Tracking Service', () => {
    it('should track enrollment activity', async () => {
      const activity = await activityTrackingService.trackEnrollment(
        teacherId,
        courseId,
        studentId,
        { enrollmentSource: 'direct' }
      );

      expect(activity).toBeDefined();
      expect(activity.type).toBe(ActivityType.ENROLLMENT);
      expect(activity.teacherId.toString()).toBe(teacherId);
      expect(activity.courseId?.toString()).toBe(courseId);
      expect(activity.studentId?.toString()).toBe(studentId);
      expect(activity.priority).toBe(ActivityPriority.MEDIUM);
      expect(activity.actionRequired).toBe(false);
    });

    it('should track completion activity', async () => {
      const activity = await activityTrackingService.trackCompletion(
        teacherId,
        courseId,
        studentId,
        { completionRate: 100 }
      );

      expect(activity).toBeDefined();
      expect(activity.type).toBe(ActivityType.COMPLETION);
      expect(activity.priority).toBe(ActivityPriority.HIGH);
      expect(activity.metadata.completionRate).toBe(100);
    });

    it('should track payment activity', async () => {
      const amount = 99.99;
      const activity = await activityTrackingService.trackPayment(
        teacherId,
        courseId,
        studentId,
        amount,
        { paymentMethod: 'stripe' }
      );

      expect(activity).toBeDefined();
      expect(activity.type).toBe(ActivityType.PAYMENT);
      expect(activity.priority).toBe(ActivityPriority.HIGH);
      expect(activity.metadata.amount).toBe(amount);
      expect(activity.description).toContain(`$${amount}`);
    });

    it('should track review activity with appropriate priority', async () => {
      // High rating review
      const highRatingActivity = await activityTrackingService.trackReview(
        teacherId,
        courseId,
        studentId,
        5,
        { reviewText: 'Excellent course!' }
      );

      expect(highRatingActivity.priority).toBe(ActivityPriority.MEDIUM);
      expect(highRatingActivity.actionRequired).toBe(false);

      // Low rating review
      const lowRatingActivity = await activityTrackingService.trackReview(
        teacherId,
        courseId,
        studentId,
        2,
        { reviewText: 'Needs improvement' }
      );

      expect(lowRatingActivity.priority).toBe(ActivityPriority.HIGH);
      expect(lowRatingActivity.actionRequired).toBe(true);
    });

    it('should track question activity with action required', async () => {
      const activity = await activityTrackingService.trackQuestion(
        teacherId,
        courseId,
        studentId,
        'How do I access the course materials?',
        { questionId: 'q123' }
      );

      expect(activity).toBeDefined();
      expect(activity.type).toBe(ActivityType.QUESTION);
      expect(activity.priority).toBe(ActivityPriority.HIGH);
      expect(activity.actionRequired).toBe(true);
      expect(activity.actionUrl).toContain('/questions/');
    });

    it('should track message activity', async () => {
      const activity = await activityTrackingService.trackMessage(
        teacherId,
        courseId,
        studentId,
        { conversationId: 'conv123' }
      );

      expect(activity).toBeDefined();
      expect(activity.type).toBe(ActivityType.MESSAGE);
      expect(activity.priority).toBe(ActivityPriority.MEDIUM);
      expect(activity.actionRequired).toBe(true);
      expect(activity.actionUrl).toContain('/messages/');
    });

    it('should track refund activity', async () => {
      const amount = 99.99;
      const activity = await activityTrackingService.trackRefund(
        teacherId,
        courseId,
        studentId,
        amount,
        { reason: 'Student request', paymentId: 'pay123' }
      );

      expect(activity).toBeDefined();
      expect(activity.type).toBe(ActivityType.REFUND);
      expect(activity.priority).toBe(ActivityPriority.HIGH);
      expect(activity.actionRequired).toBe(true);
      expect(activity.metadata.amount).toBe(amount);
      expect(activity.metadata.reason).toBe('Student request');
    });
  });

  describe('Activity Filtering and Pagination', () => {
    beforeEach(async () => {
      // Create some test activities
      await Promise.all([
        activityTrackingService.trackEnrollment(teacherId, courseId, studentId),
        activityTrackingService.trackCompletion(teacherId, courseId, studentId),
        activityTrackingService.trackPayment(teacherId, courseId, studentId, 99.99),
        activityTrackingService.trackReview(teacherId, courseId, studentId, 5),
        activityTrackingService.trackQuestion(teacherId, courseId, studentId, 'Test question'),
      ]);
    });

    it('should get activities with filters', async () => {
      const result = await activityTrackingService.getActivitiesWithFilters(teacherId, {
        type: ActivityType.ENROLLMENT,
        limit: 10,
        offset: 0
      });

      expect(result).toHaveProperty('activities');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('unreadCount');
      expect(result).toHaveProperty('priorityBreakdown');
      expect(result).toHaveProperty('typeBreakdown');
      expect(result.activities).toBeInstanceOf(Array);
    });

    it('should filter by priority', async () => {
      const result = await activityTrackingService.getActivitiesWithFilters(teacherId, {
        priority: ActivityPriority.HIGH,
        limit: 10,
        offset: 0
      });

      expect(result.activities.every(activity => activity.priority === ActivityPriority.HIGH)).toBe(true);
    });

    it('should filter by read status', async () => {
      const result = await activityTrackingService.getActivitiesWithFilters(teacherId, {
        isRead: false,
        limit: 10,
        offset: 0
      });

      expect(result.activities.every(activity => !activity.isRead)).toBe(true);
    });

    it('should filter by course', async () => {
      const result = await activityTrackingService.getActivitiesWithFilters(teacherId, {
        courseId,
        limit: 10,
        offset: 0
      });

      expect(result.activities.every(activity => 
        activity.courseId?.toString() === courseId
      )).toBe(true);
    });

    it('should filter by date range', async () => {
      const dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const dateTo = new Date();

      const result = await activityTrackingService.getActivitiesWithFilters(teacherId, {
        dateFrom,
        dateTo,
        limit: 10,
        offset: 0
      });

      expect(result.activities.every(activity => 
        activity.createdAt && 
        activity.createdAt >= dateFrom && 
        activity.createdAt <= dateTo
      )).toBe(true);
    });

    it('should support sorting', async () => {
      const result = await activityTrackingService.getActivitiesWithFilters(teacherId, {
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 10,
        offset: 0
      });

      // Check if activities are sorted by creation date (descending)
      for (let i = 1; i < result.activities.length; i++) {
        const current = new Date(result.activities[i].createdAt!);
        const previous = new Date(result.activities[i - 1].createdAt!);
        expect(current.getTime()).toBeLessThanOrEqual(previous.getTime());
      }
    });

    it('should provide priority breakdown', async () => {
      const result = await activityTrackingService.getActivitiesWithFilters(teacherId, {
        limit: 100,
        offset: 0
      });

      const priorityBreakdown = result.priorityBreakdown;
      expect(priorityBreakdown).toHaveProperty(ActivityPriority.LOW);
      expect(priorityBreakdown).toHaveProperty(ActivityPriority.MEDIUM);
      expect(priorityBreakdown).toHaveProperty(ActivityPriority.HIGH);
      expect(priorityBreakdown).toHaveProperty(ActivityPriority.URGENT);

      Object.values(priorityBreakdown).forEach(count => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    it('should provide type breakdown', async () => {
      const result = await activityTrackingService.getActivitiesWithFilters(teacherId, {
        limit: 100,
        offset: 0
      });

      const typeBreakdown = result.typeBreakdown;
      expect(typeBreakdown).toHaveProperty(ActivityType.ENROLLMENT);
      expect(typeBreakdown).toHaveProperty(ActivityType.COMPLETION);
      expect(typeBreakdown).toHaveProperty(ActivityType.PAYMENT);
      expect(typeBreakdown).toHaveProperty(ActivityType.REVIEW);
      expect(typeBreakdown).toHaveProperty(ActivityType.QUESTION);

      Object.values(typeBreakdown).forEach(count => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Activity Statistics', () => {
    it('should get activity statistics', async () => {
      const stats = await activityTrackingService.getActivityStatistics(teacherId, 'weekly');

      expect(stats).toHaveProperty('totalActivities');
      expect(stats).toHaveProperty('unreadActivities');
      expect(stats).toHaveProperty('actionRequiredActivities');
      expect(stats).toHaveProperty('activityTrends');
      expect(stats).toHaveProperty('topActivityTypes');
      expect(stats).toHaveProperty('averageResponseTime');

      expect(typeof stats.totalActivities).toBe('number');
      expect(typeof stats.unreadActivities).toBe('number');
      expect(typeof stats.actionRequiredActivities).toBe('number');
      expect(typeof stats.averageResponseTime).toBe('number');
      expect(stats.activityTrends).toBeInstanceOf(Array);
      expect(stats.topActivityTypes).toBeInstanceOf(Array);
    });

    it('should validate activity trends structure', async () => {
      const stats = await activityTrackingService.getActivityStatistics(teacherId, 'daily');

      stats.activityTrends.forEach(trend => {
        expect(trend).toHaveProperty('date');
        expect(trend).toHaveProperty('count');
        expect(trend).toHaveProperty('unreadCount');
        expect(typeof trend.date).toBe('string');
        expect(typeof trend.count).toBe('number');
        expect(typeof trend.unreadCount).toBe('number');
      });
    });

    it('should validate top activity types structure', async () => {
      const stats = await activityTrackingService.getActivityStatistics(teacherId, 'monthly');

      stats.topActivityTypes.forEach(typeData => {
        expect(typeData).toHaveProperty('type');
        expect(typeData).toHaveProperty('count');
        expect(Object.values(ActivityType)).toContain(typeData.type);
        expect(typeof typeData.count).toBe('number');
        expect(typeData.count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Activity Management', () => {
    let activityId: string;

    beforeEach(async () => {
      const activity = await activityTrackingService.trackEnrollment(teacherId, courseId, studentId);
      activityId = (activity as any)._id.toString();
    });

    it('should mark activity as read', async () => {
      await activityTrackingService.markActivityAsRead(activityId, teacherId);
      
      // Verify activity is marked as read
      const activities = await activityTrackingService.getRecentActivities(teacherId, 10, 0);
      const markedActivity = activities.find(a => (a as any)._id.toString() === activityId);
      expect(markedActivity?.isRead).toBe(true);
    });

    it('should bulk mark activities as read', async () => {
      // Create multiple activities
      const activities = await Promise.all([
        activityTrackingService.trackEnrollment(teacherId, courseId, studentId),
        activityTrackingService.trackCompletion(teacherId, courseId, studentId),
        activityTrackingService.trackPayment(teacherId, courseId, studentId, 99.99)
      ]);

      const activityIds = activities.map(a => (a as any)._id.toString());

      await activityTrackingService.bulkMarkActivitiesAsRead(activityIds, teacherId);

      // Verify all activities are marked as read
      const recentActivities = await activityTrackingService.getRecentActivities(teacherId, 20, 0);
      const markedActivities = recentActivities.filter(a => activityIds.includes((a as any)._id.toString()));
      
      expect(markedActivities.every(a => a.isRead)).toBe(true);
    });
  });

  // WebSocket Integration tests removed since WebSocket service is not initialized in tests

  describe('Error Handling', () => {
    it('should handle invalid teacher ID', async () => {
      await expect(
        activityTrackingService.trackEnrollment('invalid-id', courseId, studentId)
      ).rejects.toThrow();
    });

    it('should handle missing required fields', async () => {
      await expect(
        activityTrackingService.trackActivity({
          teacherId: '',
          type: ActivityType.ENROLLMENT,
          title: '',
          description: '',
          relatedEntity: {
            entityType: 'student',
            entityId: studentId
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance and Caching', () => {
    it('should cache recent activities', async () => {
      const start = Date.now();
      
      // First request
      await activityTrackingService.getRecentActivities(teacherId, 20, 0);
      const firstRequestTime = Date.now() - start;
      
      // Second request (should be cached)
      const secondStart = Date.now();
      await activityTrackingService.getRecentActivities(teacherId, 20, 0);
      const secondRequestTime = Date.now() - secondStart;
      
      // Cached request should be faster
      expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5);
    });

    it('should cache activity statistics', async () => {
      const start = Date.now();
      
      // First request
      await activityTrackingService.getActivityStatistics(teacherId, 'weekly');
      const firstRequestTime = Date.now() - start;
      
      // Second request (should be cached)
      const secondStart = Date.now();
      await activityTrackingService.getActivityStatistics(teacherId, 'weekly');
      const secondRequestTime = Date.now() - secondStart;
      
      // Cached request should be faster
      expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5);
    });
  });
});
