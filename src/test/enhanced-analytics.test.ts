import request from 'supertest';
import app from '../app';
import { connectDB, disconnectDB } from './setup/database';
import { createTestTeacher, createTestCourse, createTestStudent } from './helpers/testHelpers';
import { createToken } from '../app/modules/Auth/auth.utils';

// Mock generateToken function for tests
const generateToken = (payload: any) => {
  return createToken(payload, 'test-secret', '1h');
};

describe('Enhanced Analytics API', () => {
  let teacherToken: string;
  let teacherId: string;
  let courseId: string;

  beforeAll(async () => {
    await connectDB();

    // Create test teacher
    const teacher = await createTestTeacher();
    teacherId = teacher._id.toString();
    teacherToken = generateToken({
      userId: teacher.user.toString(),
      role: 'teacher',
      teacherId: teacher._id.toString(),
    });

    // Create test course
    const course = await createTestCourse(teacher._id);
    courseId = course._id.toString();

    // Create test student
    await createTestStudent();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/enrollment-statistics', () => {
    it('should get comprehensive enrollment statistics', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalEnrollments');
      expect(response.body.data).toHaveProperty('newEnrollments');
      expect(response.body.data).toHaveProperty('enrollmentTrend');
      expect(response.body.data).toHaveProperty('topCourses');
      expect(response.body.data).toHaveProperty('growthRate');
      expect(response.body.data.enrollmentTrend).toBeInstanceOf(Array);
      expect(response.body.data.topCourses).toBeInstanceOf(Array);
    });

    it('should support period filtering', async () => {
      const periods = ['daily', 'weekly', 'monthly', 'yearly'];
      
      for (const period of periods) {
        const response = await request(app)
          .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics?period=${period}`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalEnrollments');
      }
    });

    it('should support course filtering', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics?courseId=${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 403 for unauthorized teacher', async () => {
      const otherTeacher = await createTestTeacher();
      const otherToken = generateToken({
        userId: otherTeacher.user.toString(),
        role: 'teacher',
        teacherId: otherTeacher._id.toString(),
      });

      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/engagement-metrics', () => {
    it('should get student engagement metrics', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/engagement-metrics`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalActiveStudents');
      expect(response.body.data).toHaveProperty('averageEngagementScore');
      expect(response.body.data).toHaveProperty('completionRates');
      expect(response.body.data).toHaveProperty('timeSpentTrends');
      expect(response.body.data).toHaveProperty('activityPatterns');
      expect(response.body.data).toHaveProperty('retentionRate');
      expect(response.body.data.completionRates).toBeInstanceOf(Array);
      expect(response.body.data.timeSpentTrends).toBeInstanceOf(Array);
      expect(response.body.data.activityPatterns).toBeInstanceOf(Array);
    });

    it('should validate activity patterns structure', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/engagement-metrics`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const activityPatterns = response.body.data.activityPatterns;
      expect(activityPatterns).toHaveLength(24); // 24 hours
      
      activityPatterns.forEach((pattern: any) => {
        expect(pattern).toHaveProperty('hour');
        expect(pattern).toHaveProperty('activity');
        expect(pattern.hour).toBeGreaterThanOrEqual(0);
        expect(pattern.hour).toBeLessThan(24);
        expect(pattern.activity).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/revenue-detailed', () => {
    it('should get detailed revenue analytics', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/revenue-detailed`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data).toHaveProperty('revenueGrowth');
      expect(response.body.data).toHaveProperty('averageOrderValue');
      expect(response.body.data).toHaveProperty('paymentTrends');
      expect(response.body.data).toHaveProperty('topEarningCourses');
      expect(response.body.data).toHaveProperty('revenueByPeriod');
      expect(response.body.data).toHaveProperty('conversionRate');
      expect(response.body.data).toHaveProperty('refundRate');
      expect(response.body.data.paymentTrends).toBeInstanceOf(Array);
      expect(response.body.data.topEarningCourses).toBeInstanceOf(Array);
    });

    it('should validate revenue by period structure', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/revenue-detailed`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const revenueByPeriod = response.body.data.revenueByPeriod;
      expect(revenueByPeriod).toHaveProperty('daily');
      expect(revenueByPeriod).toHaveProperty('weekly');
      expect(revenueByPeriod).toHaveProperty('monthly');
      expect(revenueByPeriod).toHaveProperty('yearly');
      expect(typeof revenueByPeriod.daily).toBe('number');
      expect(typeof revenueByPeriod.weekly).toBe('number');
      expect(typeof revenueByPeriod.monthly).toBe('number');
      expect(typeof revenueByPeriod.yearly).toBe('number');
    });
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/performance-detailed', () => {
    it('should get detailed performance metrics', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/performance-detailed`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('averageRating');
      expect(response.body.data).toHaveProperty('totalReviews');
      expect(response.body.data).toHaveProperty('ratingDistribution');
      expect(response.body.data).toHaveProperty('ratingTrends');
      expect(response.body.data).toHaveProperty('studentSatisfactionScore');
      expect(response.body.data).toHaveProperty('courseCompletionRate');
      expect(response.body.data).toHaveProperty('studentRetentionRate');
      expect(response.body.data).toHaveProperty('qualityMetrics');
      expect(response.body.data).toHaveProperty('competitiveMetrics');
      expect(response.body.data).toHaveProperty('improvementSuggestions');
    });

    it('should validate quality metrics structure', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/performance-detailed`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const qualityMetrics = response.body.data.qualityMetrics;
      expect(qualityMetrics).toHaveProperty('contentQuality');
      expect(qualityMetrics).toHaveProperty('instructorRating');
      expect(qualityMetrics).toHaveProperty('courseStructure');
      expect(qualityMetrics).toHaveProperty('valueForMoney');
      
      Object.values(qualityMetrics).forEach((value: any) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });

    it('should validate improvement suggestions', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/performance-detailed`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const suggestions = response.body.data.improvementSuggestions;
      expect(suggestions).toBeInstanceOf(Array);
      suggestions.forEach((suggestion: any) => {
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PATCH /api/v1/analytics/teachers/:teacherId/activities/bulk-read', () => {
    it('should bulk mark activities as read', async () => {
      const activityIds = [
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        '507f1f77bcf86cd799439013'
      ];

      const response = await request(app)
        .patch(`/api/v1/analytics/teachers/${teacherId}/activities/bulk-read`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ activityIds })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate activity IDs array', async () => {
      await request(app)
        .patch(`/api/v1/analytics/teachers/${teacherId}/activities/bulk-read`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ activityIds: [] })
        .expect(400);
    });

    it('should validate activity ID format', async () => {
      await request(app)
        .patch(`/api/v1/analytics/teachers/${teacherId}/activities/bulk-read`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ activityIds: ['invalid-id'] })
        .expect(400);
    });
  });

  describe('Caching and Performance', () => {
    it('should cache enrollment statistics', async () => {
      const start = Date.now();
      
      // First request
      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);
      
      const firstRequestTime = Date.now() - start;
      
      // Second request (should be cached)
      const secondStart = Date.now();
      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);
      
      const secondRequestTime = Date.now() - secondStart;
      
      // Cached request should be significantly faster
      expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid period parameter', async () => {
      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics?period=invalid`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(400);
    });

    it('should handle invalid course ID', async () => {
      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/engagement-metrics?courseId=invalid`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(400);
    });
  });
});
