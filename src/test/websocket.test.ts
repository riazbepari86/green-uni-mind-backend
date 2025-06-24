import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { app } from '../app';
import { connectDB, disconnectDB } from './setup/database';
import { createTestTeacher, createTestStudent, createTestCourse, enrollStudentInCourse } from './helpers/testHelpers';
import { generateToken } from '../app/utils/jwtHelpers';
import WebSocketService from '../app/services/websocket/WebSocketService';

describe('WebSocket Service', () => {
  let httpServer: HTTPServer;
  let webSocketService: WebSocketService;
  let teacherToken: string;
  let studentToken: string;
  let teacherId: string;
  let studentId: string;
  let courseId: string;
  let conversationId: string;

  beforeAll(async () => {
    await connectDB();

    // Create HTTP server
    httpServer = new HTTPServer(app);
    
    // Initialize WebSocket service
    webSocketService = new WebSocketService(httpServer);

    // Create test users
    const teacher = await createTestTeacher();
    teacherId = teacher._id.toString();
    teacherToken = generateToken({
      userId: teacher.user.toString(),
      role: 'teacher',
      teacherId: teacher._id.toString(),
    });

    const student = await createTestStudent();
    studentId = student._id.toString();
    studentToken = generateToken({
      userId: student.user.toString(),
      role: 'student',
      studentId: student._id.toString(),
    });

    // Create test course and enroll student
    const course = await createTestCourse(teacher._id);
    courseId = course._id.toString();
    await enrollStudentInCourse(student._id, course._id);

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(0, resolve);
    });
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
    await disconnectDB();
  });

  describe('Connection Authentication', () => {
    it('should authenticate teacher connection', (done) => {
      const port = (httpServer.address() as any)?.port;
      const teacherClient = Client(`http://localhost:${port}`, {
        auth: { token: teacherToken },
        transports: ['websocket'],
      });

      teacherClient.on('connect', () => {
        expect(teacherClient.connected).toBe(true);
        teacherClient.disconnect();
        done();
      });

      teacherClient.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should authenticate student connection', (done) => {
      const port = (httpServer.address() as any)?.port;
      const studentClient = Client(`http://localhost:${port}`, {
        auth: { token: studentToken },
        transports: ['websocket'],
      });

      studentClient.on('connect', () => {
        expect(studentClient.connected).toBe(true);
        studentClient.disconnect();
        done();
      });

      studentClient.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should reject connection without token', (done) => {
      const port = (httpServer.address() as any)?.port;
      const unauthenticatedClient = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
      });

      unauthenticatedClient.on('connect', () => {
        done(new Error('Should not connect without token'));
      });

      unauthenticatedClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication');
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      const port = (httpServer.address() as any)?.port;
      const invalidClient = Client(`http://localhost:${port}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
      });

      invalidClient.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });

      invalidClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication');
        done();
      });
    });
  });

  describe('Room Management', () => {
    let teacherClient: ClientSocket;
    let studentClient: ClientSocket;

    beforeEach((done) => {
      const port = (httpServer.address() as any)?.port;
      let connectionsCount = 0;

      const checkConnections = () => {
        connectionsCount++;
        if (connectionsCount === 2) {
          done();
        }
      };

      teacherClient = Client(`http://localhost:${port}`, {
        auth: { token: teacherToken },
        transports: ['websocket'],
      });

      studentClient = Client(`http://localhost:${port}`, {
        auth: { token: studentToken },
        transports: ['websocket'],
      });

      teacherClient.on('connect', checkConnections);
      studentClient.on('connect', checkConnections);
    });

    afterEach(() => {
      if (teacherClient) teacherClient.disconnect();
      if (studentClient) studentClient.disconnect();
    });

    it('should join conversation room', (done) => {
      const testConversationId = 'test-conversation-123';
      
      teacherClient.emit('join_conversation', testConversationId);
      
      // Wait a bit for the room join to process
      setTimeout(() => {
        // Test that the client is in the room by sending a message to the room
        webSocketService.broadcastToConversation(testConversationId, 'test_event', { message: 'test' });
        done();
      }, 100);
    });

    it('should join course room', (done) => {
      studentClient.emit('join_course', courseId);
      
      setTimeout(() => {
        webSocketService.broadcastCourseUpdate(courseId, { update: 'test' });
        done();
      }, 100);
    });

    it('should leave conversation room', (done) => {
      const testConversationId = 'test-conversation-456';
      
      teacherClient.emit('join_conversation', testConversationId);
      
      setTimeout(() => {
        teacherClient.emit('leave_conversation', testConversationId);
        done();
      }, 100);
    });
  });

  describe('Real-time Messaging', () => {
    let teacherClient: ClientSocket;
    let studentClient: ClientSocket;

    beforeEach((done) => {
      const port = (httpServer.address() as any)?.port;
      let connectionsCount = 0;

      const checkConnections = () => {
        connectionsCount++;
        if (connectionsCount === 2) {
          done();
        }
      };

      teacherClient = Client(`http://localhost:${port}`, {
        auth: { token: teacherToken },
        transports: ['websocket'],
      });

      studentClient = Client(`http://localhost:${port}`, {
        auth: { token: studentToken },
        transports: ['websocket'],
      });

      teacherClient.on('connect', checkConnections);
      studentClient.on('connect', checkConnections);
    });

    afterEach(() => {
      if (teacherClient) teacherClient.disconnect();
      if (studentClient) studentClient.disconnect();
    });

    it('should broadcast new message to conversation participants', (done) => {
      const testConversationId = 'test-conversation-789';
      const messageData = {
        id: 'msg-123',
        content: 'Hello from test',
        senderId: studentId,
        senderType: 'student',
        createdAt: new Date(),
      };

      // Both clients join the conversation
      teacherClient.emit('join_conversation', testConversationId);
      studentClient.emit('join_conversation', testConversationId);

      // Teacher listens for new messages
      teacherClient.on('new_message', (data) => {
        expect(data.content).toBe('Hello from test');
        expect(data.senderId).toBe(studentId);
        done();
      });

      // Simulate message broadcast
      setTimeout(() => {
        webSocketService.broadcastNewMessage(testConversationId, messageData);
      }, 100);
    });

    it('should handle typing indicators', (done) => {
      const testConversationId = 'test-conversation-typing';
      
      teacherClient.emit('join_conversation', testConversationId);
      studentClient.emit('join_conversation', testConversationId);

      teacherClient.on('user_typing', (data) => {
        expect(data.userId).toBe(studentId);
        expect(data.isTyping).toBe(true);
        done();
      });

      setTimeout(() => {
        studentClient.emit('typing_start', testConversationId);
      }, 100);
    });

    it('should handle message read status', (done) => {
      const testConversationId = 'test-conversation-read';
      const messageId = 'msg-456';

      teacherClient.emit('join_conversation', testConversationId);
      studentClient.emit('join_conversation', testConversationId);

      teacherClient.on('message_read', (data) => {
        expect(data.messageId).toBe(messageId);
        expect(data.readBy).toBe(studentId);
        done();
      });

      setTimeout(() => {
        studentClient.emit('message_read', { messageId, conversationId: testConversationId });
      }, 100);
    });
  });

  describe('Activity Broadcasting', () => {
    let teacherClient: ClientSocket;

    beforeEach((done) => {
      const port = (httpServer.address() as any)?.port;
      
      teacherClient = Client(`http://localhost:${port}`, {
        auth: { token: teacherToken },
        transports: ['websocket'],
      });

      teacherClient.on('connect', () => done());
    });

    afterEach(() => {
      if (teacherClient) teacherClient.disconnect();
    });

    it('should broadcast activity updates to teacher', (done) => {
      const activityData = {
        id: 'activity-123',
        type: 'enrollment',
        title: 'New Student Enrollment',
        description: 'A new student enrolled in your course',
        createdAt: new Date(),
      };

      teacherClient.on('new_activity', (data) => {
        expect(data.type).toBe('enrollment');
        expect(data.title).toBe('New Student Enrollment');
        done();
      });

      setTimeout(() => {
        webSocketService.broadcastActivityUpdate(teacherId, activityData);
      }, 100);
    });

    it('should handle activity read confirmation', (done) => {
      const activityId = 'activity-456';

      teacherClient.on('activity_read_confirmed', (data) => {
        expect(data.activityId).toBe(activityId);
        expect(data.readAt).toBeDefined();
        done();
      });

      setTimeout(() => {
        teacherClient.emit('activity_read', activityId);
      }, 100);
    });
  });

  describe('User Status Management', () => {
    let teacherClient: ClientSocket;
    let studentClient: ClientSocket;

    beforeEach((done) => {
      const port = (httpServer.address() as any)?.port;
      let connectionsCount = 0;

      const checkConnections = () => {
        connectionsCount++;
        if (connectionsCount === 2) {
          done();
        }
      };

      teacherClient = Client(`http://localhost:${port}`, {
        auth: { token: teacherToken },
        transports: ['websocket'],
      });

      studentClient = Client(`http://localhost:${port}`, {
        auth: { token: studentToken },
        transports: ['websocket'],
      });

      teacherClient.on('connect', checkConnections);
      studentClient.on('connect', checkConnections);
    });

    afterEach(() => {
      if (teacherClient) teacherClient.disconnect();
      if (studentClient) studentClient.disconnect();
    });

    it('should broadcast user online status', (done) => {
      teacherClient.on('user_status_change', (data) => {
        if (data.userId === studentId && data.status === 'online') {
          expect(data.userType).toBe('student');
          done();
        }
      });

      // Student connection should trigger online status
      // This is already handled in beforeEach, so we just wait
      setTimeout(() => {
        // If we reach here without the event, the test will timeout and fail
      }, 500);
    });

    it('should track connected users', () => {
      const connectedUsers = webSocketService.getConnectedUsers();
      expect(connectedUsers.length).toBeGreaterThanOrEqual(2);
      
      const teacherConnected = connectedUsers.some(user => user.userId === teacherId);
      const studentConnected = connectedUsers.some(user => user.userId === studentId);
      
      expect(teacherConnected).toBe(true);
      expect(studentConnected).toBe(true);
    });

    it('should check if user is online', () => {
      expect(webSocketService.isUserOnline(teacherId)).toBe(true);
      expect(webSocketService.isUserOnline(studentId)).toBe(true);
      expect(webSocketService.isUserOnline('non-existent-user')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', (done) => {
      const port = (httpServer.address() as any)?.port;
      
      // Try to connect to wrong port
      const errorClient = Client(`http://localhost:${port + 1}`, {
        auth: { token: teacherToken },
        transports: ['websocket'],
        timeout: 1000,
      });

      errorClient.on('connect_error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      errorClient.on('connect', () => {
        done(new Error('Should not connect to wrong port'));
      });
    });

    it('should handle malformed events', (done) => {
      const port = (httpServer.address() as any)?.port;
      const client = Client(`http://localhost:${port}`, {
        auth: { token: teacherToken },
        transports: ['websocket'],
      });

      client.on('connect', () => {
        // Send malformed data
        client.emit('join_conversation', null);
        client.emit('typing_start', undefined);
        client.emit('message_read', 'invalid-data');
        
        // If no errors occur, test passes
        setTimeout(() => {
          client.disconnect();
          done();
        }, 100);
      });
    });
  });
});
