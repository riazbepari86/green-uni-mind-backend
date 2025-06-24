import request from 'supertest';
import { app } from '../app';
import { connectDB, disconnectDB } from './setup/database';
import { createTestUser, createTestTeacher, createTestCourse } from './helpers/testHelpers';
import { generateToken } from '../app/utils/jwtHelpers';

describe('Analytics API', () => {
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
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/overview', () => {
    it('should get teacher analytics overview', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/overview`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('teacherId');
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('courseAnalytics');
      expect(response.body.data).toHaveProperty('revenueAnalytics');
      expect(response.body.data).toHaveProperty('performanceMetrics');
      expect(response.body.data).toHaveProperty('studentEngagement');
    });

    it('should return 403 for unauthorized teacher', async () => {
      const otherTeacher = await createTestTeacher();
      const otherToken = generateToken({
        userId: otherTeacher.user.toString(),
        role: 'teacher',
        teacherId: otherTeacher._id.toString(),
      });

      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/overview`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should validate period parameter', async () => {
      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/overview?period=invalid`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(400);
    });

    it('should validate date range parameters', async () => {
      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/overview?startDate=2023-01-01`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/dashboard', () => {
    it('should get dashboard summary', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/dashboard`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('recentActivities');
      expect(response.body.data).toHaveProperty('topPerformingCourses');
      expect(response.body.data).toHaveProperty('insights');
    });

    it('should respect rate limiting', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(35).fill(null).map(() =>
        request(app)
          .get(`/api/v1/analytics/teachers/${teacherId}/dashboard`)
          .set('Authorization', `Bearer ${teacherToken}`)
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/courses/:courseId', () => {
    it('should get course-specific analytics', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should validate ObjectId format', async () => {
      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/courses/invalid-id`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/revenue', () => {
    it('should get revenue analytics', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/revenue`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data).toHaveProperty('revenueByPeriod');
    });

    it('should filter by course when courseId provided', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/revenue?courseId=${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/performance', () => {
    it('should get performance metrics', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/performance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('averageRating');
      expect(response.body.data).toHaveProperty('totalReviews');
      expect(response.body.data).toHaveProperty('courseCompletionRate');
    });
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/engagement', () => {
    it('should get student engagement data', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/engagement`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalActiveStudents');
      expect(response.body.data).toHaveProperty('averageEngagementScore');
      expect(response.body.data).toHaveProperty('retentionRate');
    });
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/activities', () => {
    it('should get activity feed', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/activities`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('activities');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.activities).toBeInstanceOf(Array);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/activities?limit=5&offset=0`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.data.pagination.limit).toBe(5);
      expect(response.body.data.pagination.offset).toBe(0);
    });

    it('should validate pagination parameters', async () => {
      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/activities?limit=101`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(400);
    });
  });

  describe('PATCH /api/v1/analytics/teachers/:teacherId/activities/:activityId/read', () => {
    it('should mark activity as read', async () => {
      // First create an activity (this would normally be done by the system)
      // For testing, we'll use a mock activity ID
      const mockActivityId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .patch(`/api/v1/analytics/teachers/${teacherId}/activities/${mockActivityId}/read`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate activity ID format', async () => {
      await request(app)
        .patch(`/api/v1/analytics/teachers/${teacherId}/activities/invalid-id/read`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/analytics/teachers/:teacherId/export', () => {
    it('should export analytics data as JSON', async () => {
      const response = await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/export?format=json`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('teacherId');
    });

    it('should return 501 for CSV export (not implemented)', async () => {
      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/export?format=csv`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(501);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/overview`)
        .expect(401);
    });

    it('should require teacher role', async () => {
      const student = await createTestUser('student');
      const studentToken = generateToken({
        userId: student._id.toString(),
        role: 'student',
        studentId: student._id.toString(),
      });

      await request(app)
        .get(`/api/v1/analytics/teachers/${teacherId}/overview`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid teacher ID', async () => {
      await request(app)
        .get('/api/v1/analytics/teachers/invalid-id/overview')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(400);
    });

    it('should handle non-existent teacher ID', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(`/api/v1/analytics/teachers/${nonExistentId}/overview`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    });
  });
});
