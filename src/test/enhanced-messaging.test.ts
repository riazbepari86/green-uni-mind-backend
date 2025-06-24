import request from 'supertest';
import app from '../app';
import { connectDB, disconnectDB } from './setup/database';
import { createTestTeacher, createTestCourse, createTestStudent } from './helpers/testHelpers';
import { createToken } from '../app/modules/Auth/auth.utils';
import { Student } from '../app/modules/Student/student.model';
import { Course } from '../app/modules/Course/course.model';
import { Payment } from '../app/modules/Payment/payment.model';

// Mock generateToken function for tests
const generateToken = (payload: any) => {
  return createToken(payload, 'test-secret', '1h');
};

describe('Enhanced Messaging API', () => {
  let teacherToken: string;
  let studentToken: string;
  let teacherId: string;
  let studentId: string;
  let courseId: string;
  let conversationId: string;

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

    // Create test student
    const student = await createTestStudent();
    studentId = student._id.toString();
    studentToken = generateToken({
      userId: student.user.toString(),
      role: 'student',
      studentId: student._id.toString(),
    });

    // Create test course
    const course = await createTestCourse(teacher._id);
    courseId = course._id.toString();

    // Enroll student in course
    await Student.findByIdAndUpdate(studentId, {
      $push: {
        enrolledCourses: {
          courseId: course._id,
          enrolledAt: new Date(),
          completedLectures: []
        }
      }
    });

    // Create payment for paid course
    await new Payment({
      studentId,
      teacherId,
      courseId,
      amount: 99.99,
      teacherShare: 79.99,
      platformFee: 20.00,
      status: 'completed',
      paymentMethod: 'stripe',
      transactionId: 'test_transaction_123'
    }).save();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Enrollment-based Messaging Security', () => {
    it('should allow enrolled student to create conversation', async () => {
      const response = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          teacherId,
          courseId,
          initialMessage: 'Hello, I have a question about the course.'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('conversationId');
      conversationId = response.body.data.conversationId;
    });

    it('should prevent non-enrolled student from creating conversation', async () => {
      // Create another student not enrolled in the course
      const otherStudent = await createTestStudent();
      const otherStudentToken = generateToken({
        userId: otherStudent.user.toString(),
        role: 'student',
        studentId: otherStudent._id.toString(),
      });

      await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({
          teacherId,
          courseId,
          initialMessage: 'Hello, I want to message you.'
        })
        .expect(403);
    });

    it('should validate payment for paid courses', async () => {
      // Create a paid course
      const paidCourse = await new Course({
        title: 'Paid Test Course',
        description: 'A test course that requires payment',
        creator: teacherId,
        price: 199.99,
        isFree: 'paid',
        status: 'published'
      }).save();

      // Try to create conversation without payment
      const unpaidStudent = await createTestStudent();
      const unpaidStudentToken = generateToken({
        userId: unpaidStudent.user.toString(),
        role: 'student',
        studentId: unpaidStudent._id.toString(),
      });

      // Enroll student but without payment
      await Student.findByIdAndUpdate(unpaidStudent._id, {
        $push: {
          enrolledCourses: {
            courseId: paidCourse._id,
            enrolledAt: new Date(),
            completedLectures: []
          }
        }
      });

      await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${unpaidStudentToken}`)
        .send({
          teacherId,
          courseId: paidCourse._id.toString(),
          initialMessage: 'Hello, I have a question.'
        })
        .expect(403);
    });

    it('should enforce rate limiting for conversation creation', async () => {
      // Create multiple rapid conversation attempts
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/v1/messaging/conversations')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            teacherId,
            courseId,
            initialMessage: 'Rapid message test'
          })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/messaging/messages/search-advanced', () => {
    it('should perform advanced message search', async () => {
      const response = await request(app)
        .get('/api/v1/messaging/messages/search-advanced')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({
          query: 'question',
          courseId,
          limit: 10,
          offset: 0
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('messages');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('searchMetadata');
      expect(response.body.data.messages).toBeInstanceOf(Array);
      expect(response.body.data.searchMetadata).toHaveProperty('searchTerm');
      expect(response.body.data.searchMetadata).toHaveProperty('resultsCount');
      expect(response.body.data.searchMetadata).toHaveProperty('searchTime');
    });

    it('should support date range filtering', async () => {
      const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const dateTo = new Date();

      const response = await request(app)
        .get('/api/v1/messaging/messages/search-advanced')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({
          query: 'test',
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should support message type filtering', async () => {
      const response = await request(app)
        .get('/api/v1/messaging/messages/search-advanced')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({
          query: 'test',
          messageType: 'text',
          hasAttachments: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate search parameters', async () => {
      await request(app)
        .get('/api/v1/messaging/messages/search-advanced')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({
          limit: 101 // Exceeds maximum
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/messaging/teachers/:teacherId/statistics', () => {
    it('should get messaging statistics for teacher', async () => {
      const response = await request(app)
        .get(`/api/v1/messaging/teachers/${teacherId}/statistics`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalConversations');
      expect(response.body.data).toHaveProperty('activeConversations');
      expect(response.body.data).toHaveProperty('totalMessages');
      expect(response.body.data).toHaveProperty('unreadMessages');
      expect(response.body.data).toHaveProperty('averageResponseTime');
      expect(response.body.data).toHaveProperty('messagesByType');
      expect(response.body.data).toHaveProperty('conversationsByStatus');
      expect(response.body.data).toHaveProperty('topCoursesByMessages');
    });

    it('should support period filtering', async () => {
      const periods = ['daily', 'weekly', 'monthly'];
      
      for (const period of periods) {
        const response = await request(app)
          .get(`/api/v1/messaging/teachers/${teacherId}/statistics?period=${period}`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });

    it('should validate message type breakdown', async () => {
      const response = await request(app)
        .get(`/api/v1/messaging/teachers/${teacherId}/statistics`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const messagesByType = response.body.data.messagesByType;
      expect(messagesByType).toHaveProperty('text');
      expect(messagesByType).toHaveProperty('file');
      expect(messagesByType).toHaveProperty('image');
      expect(messagesByType).toHaveProperty('video');
      expect(messagesByType).toHaveProperty('audio');
      expect(messagesByType).toHaveProperty('document');
      
      Object.values(messagesByType).forEach((count: any) => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    it('should validate conversation status breakdown', async () => {
      const response = await request(app)
        .get(`/api/v1/messaging/teachers/${teacherId}/statistics`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const conversationsByStatus = response.body.data.conversationsByStatus;
      expect(conversationsByStatus).toHaveProperty('active');
      expect(conversationsByStatus).toHaveProperty('archived');
      expect(conversationsByStatus).toHaveProperty('blocked');
      
      Object.values(conversationsByStatus).forEach((count: any) => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return 403 for unauthorized teacher', async () => {
      const otherTeacher = await createTestTeacher();
      const otherToken = generateToken({
        userId: otherTeacher.user.toString(),
        role: 'teacher',
        teacherId: otherTeacher._id.toString(),
      });

      await request(app)
        .get(`/api/v1/messaging/teachers/${teacherId}/statistics`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });

  describe('GET /api/v1/messaging/conversations/:conversationId/details', () => {
    it('should get enhanced conversation details', async () => {
      const response = await request(app)
        .get(`/api/v1/messaging/conversations/${conversationId}/details`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('conversation');
      expect(response.body.data).toHaveProperty('messageStats');
      expect(response.body.data).toHaveProperty('participants');
      expect(response.body.data).toHaveProperty('courseInfo');
    });

    it('should validate message statistics', async () => {
      const response = await request(app)
        .get(`/api/v1/messaging/conversations/${conversationId}/details`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const messageStats = response.body.data.messageStats;
      expect(messageStats).toHaveProperty('totalMessages');
      expect(messageStats).toHaveProperty('unreadMessages');
      expect(messageStats).toHaveProperty('lastMessageAt');
      expect(messageStats).toHaveProperty('messagesByType');
      expect(typeof messageStats.totalMessages).toBe('number');
      expect(typeof messageStats.unreadMessages).toBe('number');
    });

    it('should validate participant information', async () => {
      const response = await request(app)
        .get(`/api/v1/messaging/conversations/${conversationId}/details`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const participants = response.body.data.participants;
      expect(participants).toHaveProperty('teacher');
      expect(participants).toHaveProperty('student');
      expect(participants.teacher).toHaveProperty('id');
      expect(participants.teacher).toHaveProperty('name');
      expect(participants.teacher).toHaveProperty('email');
      expect(participants.student).toHaveProperty('id');
      expect(participants.student).toHaveProperty('name');
      expect(participants.student).toHaveProperty('email');
    });

    it('should validate course information', async () => {
      const response = await request(app)
        .get(`/api/v1/messaging/conversations/${conversationId}/details`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const courseInfo = response.body.data.courseInfo;
      expect(courseInfo).toHaveProperty('id');
      expect(courseInfo).toHaveProperty('title');
      expect(courseInfo).toHaveProperty('enrollmentDate');
      expect(typeof courseInfo.id).toBe('string');
      expect(typeof courseInfo.title).toBe('string');
    });

    it('should return 403 for non-participant', async () => {
      const otherTeacher = await createTestTeacher();
      const otherToken = generateToken({
        userId: otherTeacher.user.toString(),
        role: 'teacher',
        teacherId: otherTeacher._id.toString(),
      });

      await request(app)
        .get(`/api/v1/messaging/conversations/${conversationId}/details`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });

  describe('Security and Validation', () => {
    it('should validate conversation ID format', async () => {
      await request(app)
        .get('/api/v1/messaging/conversations/invalid-id/details')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(400);
    });

    it('should handle non-existent conversation', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(`/api/v1/messaging/conversations/${nonExistentId}/details`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });

    it('should require authentication for all endpoints', async () => {
      await request(app)
        .get('/api/v1/messaging/messages/search-advanced')
        .expect(401);

      await request(app)
        .get(`/api/v1/messaging/teachers/${teacherId}/statistics`)
        .expect(401);

      await request(app)
        .get(`/api/v1/messaging/conversations/${conversationId}/details`)
        .expect(401);
    });
  });

  describe('Performance and Caching', () => {
    it('should cache messaging statistics', async () => {
      const start = Date.now();
      
      // First request
      await request(app)
        .get(`/api/v1/messaging/teachers/${teacherId}/statistics`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);
      
      const firstRequestTime = Date.now() - start;
      
      // Second request (should be cached)
      const secondStart = Date.now();
      await request(app)
        .get(`/api/v1/messaging/teachers/${teacherId}/statistics`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);
      
      const secondRequestTime = Date.now() - secondStart;
      
      // Cached request should be faster
      expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.8);
    });
  });
});
