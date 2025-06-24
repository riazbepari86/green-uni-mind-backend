import request from 'supertest';
import { app } from '../app';
import { connectDB, disconnectDB } from './setup/database';
import { createTestUser, createTestTeacher, createTestStudent, createTestCourse } from './helpers/testHelpers';
import { generateToken } from '../app/utils/jwtHelpers';
import { Student } from '../app/modules/Student/student.model';

describe('Messaging API', () => {
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
          progress: 0,
        },
      },
    });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('POST /api/v1/messaging/conversations', () => {
    it('should create a new conversation', async () => {
      const response = await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          courseId,
          teacherId,
          studentId,
          title: 'Test Conversation',
          initialMessage: 'Hello, I have a question about the course.',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('Test Conversation');
      
      conversationId = response.body.data.id;
    });

    it('should prevent duplicate conversations', async () => {
      await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          courseId,
          teacherId,
          studentId,
          title: 'Duplicate Conversation',
        })
        .expect(201); // Should return existing conversation
    });

    it('should validate enrollment before creating conversation', async () => {
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
          courseId,
          teacherId,
          studentId: otherStudent._id.toString(),
          title: 'Unauthorized Conversation',
        })
        .expect(403);
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          courseId,
          teacherId,
          // Missing studentId
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/messaging/conversations', () => {
    it('should get conversations for student', async () => {
      const response = await request(app)
        .get('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('conversations');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data.conversations).toBeInstanceOf(Array);
    });

    it('should get conversations for teacher', async () => {
      const response = await request(app)
        .get('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conversations).toBeInstanceOf(Array);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/messaging/conversations?limit=5&offset=0')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.data.conversations.length).toBeLessThanOrEqual(5);
    });

    it('should support filtering by course', async () => {
      const response = await request(app)
        .get(`/api/v1/messaging/conversations?courseId=${courseId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/messaging/conversations/:conversationId/messages', () => {
    it('should send a text message', async () => {
      const response = await request(app)
        .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          conversationId,
          content: 'This is a test message.',
          messageType: 'text',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.content).toBe('This is a test message.');
    });

    it('should send a message with file attachment', async () => {
      const response = await request(app)
        .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .field('conversationId', conversationId)
        .field('content', 'Here is a document for you.')
        .field('messageType', 'file')
        .attach('attachments', Buffer.from('test file content'), 'test.txt')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.attachments).toBeInstanceOf(Array);
    });

    it('should validate message content length', async () => {
      const longContent = 'a'.repeat(5001);
      
      await request(app)
        .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          conversationId,
          content: longContent,
        })
        .expect(400);
    });

    it('should sanitize message content', async () => {
      const maliciousContent = '<script>alert("xss")</script>Hello';
      
      const response = await request(app)
        .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          conversationId,
          content: maliciousContent,
        })
        .expect(201);

      expect(response.body.data.content).not.toContain('<script>');
      expect(response.body.data.content).toContain('Hello');
    });

    it('should respect rate limiting', async () => {
      const promises = Array(25).fill(null).map((_, index) =>
        request(app)
          .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            conversationId,
            content: `Rate limit test message ${index}`,
          })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/messaging/conversations/:conversationId/messages', () => {
    it('should get messages in conversation', async () => {
      const response = await request(app)
        .get(`/api/v1/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('messages');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data.messages).toBeInstanceOf(Array);
    });

    it('should support message pagination', async () => {
      const response = await request(app)
        .get(`/api/v1/messaging/conversations/${conversationId}/messages?limit=10&offset=0`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.data.messages.length).toBeLessThanOrEqual(10);
    });

    it('should filter messages by type', async () => {
      const response = await request(app)
        .get(`/api/v1/messaging/conversations/${conversationId}/messages?messageType=text`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should prevent access to unauthorized conversations', async () => {
      const otherStudent = await createTestStudent();
      const otherStudentToken = generateToken({
        userId: otherStudent.user.toString(),
        role: 'student',
        studentId: otherStudent._id.toString(),
      });

      await request(app)
        .get(`/api/v1/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .expect(403);
    });
  });

  describe('PATCH /api/v1/messaging/conversations/:conversationId/messages/read', () => {
    it('should mark messages as read', async () => {
      const response = await request(app)
        .patch(`/api/v1/messaging/conversations/${conversationId}/messages/read`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/messaging/messages/search', () => {
    it('should search messages', async () => {
      const response = await request(app)
        .get('/api/v1/messaging/messages/search?searchTerm=test')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should require search term', async () => {
      await request(app)
        .get('/api/v1/messaging/messages/search')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400);
    });

    it('should validate search term length', async () => {
      await request(app)
        .get('/api/v1/messaging/messages/search?searchTerm=')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/messaging/eligible-courses', () => {
    it('should get messaging eligible courses for student', async () => {
      const response = await request(app)
        .get('/api/v1/messaging/eligible-courses')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should not allow teachers to access this endpoint', async () => {
      await request(app)
        .get('/api/v1/messaging/eligible-courses')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    });
  });

  describe('POST /api/v1/messaging/validate-permissions', () => {
    it('should validate conversation permissions', async () => {
      const response = await request(app)
        .post('/api/v1/messaging/validate-permissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          teacherId,
          studentId,
          courseId,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('canMessage');
    });

    it('should return false for non-enrolled student', async () => {
      const otherStudent = await createTestStudent();
      
      const response = await request(app)
        .post('/api/v1/messaging/validate-permissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          teacherId,
          studentId: otherStudent._id.toString(),
          courseId,
        })
        .expect(200);

      expect(response.body.data.canMessage).toBe(false);
    });
  });

  describe('File Upload Validation', () => {
    it('should reject files that are too large', async () => {
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
      
      await request(app)
        .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .field('conversationId', conversationId)
        .field('content', 'Large file test')
        .attach('attachments', largeBuffer, 'large-file.txt')
        .expect(400);
    });

    it('should reject unauthorized file types', async () => {
      await request(app)
        .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .field('conversationId', conversationId)
        .field('content', 'Executable file test')
        .attach('attachments', Buffer.from('fake exe'), 'malware.exe')
        .expect(400);
    });

    it('should limit number of attachments', async () => {
      const formData = request(app)
        .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .field('conversationId', conversationId)
        .field('content', 'Multiple files test');

      // Attach 6 files (limit is 5)
      for (let i = 0; i < 6; i++) {
        formData.attach('attachments', Buffer.from(`file ${i}`), `file${i}.txt`);
      }

      await formData.expect(400);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/messaging/conversations')
        .expect(401);
    });

    it('should allow both students and teachers', async () => {
      await request(app)
        .get('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      await request(app)
        .get('/api/v1/messaging/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid conversation ID', async () => {
      await request(app)
        .get('/api/v1/messaging/conversations/invalid-id/messages')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400);
    });

    it('should handle non-existent conversation', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(`/api/v1/messaging/conversations/${nonExistentId}/messages`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(404);
    });
  });
});
