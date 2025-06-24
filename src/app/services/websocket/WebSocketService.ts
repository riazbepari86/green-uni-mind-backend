import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import config from '../../config';
import { Logger } from '../../config/logger';
import {
  IMessageEvent,
  ITypingIndicator,
} from '../../modules/Messaging/messaging.interface';
import {
  ActivityType,
  ActivityPriority,
} from '../../modules/Analytics/analytics.interface';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userType?: 'student' | 'teacher';
  teacherId?: string;
  studentId?: string;
}

interface SocketUser {
  socketId: string;
  userId: string;
  userType: 'student' | 'teacher';
  teacherId?: string;
  studentId?: string;
  lastSeen: Date;
}

class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private typingUsers: Map<string, Set<string>> = new Map(); // conversationId -> Set of userIds

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin:
          process.env.NODE_ENV === 'production'
            ? [
                'https://green-uni-mind-di79.vercel.app',
                'https://green-uni-mind.pages.dev',
                'https://green-uni-mind-backend-oxpo.onrender.com',
              ]
            : [
                'http://localhost:3000',
                'http://localhost:5173',
                'http://localhost:8080',
                'http://localhost:8081',
                'http://localhost:5000'
              ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    Logger.info('🔌 WebSocket service initialized');
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(
          token,
          config.jwt_access_secret as string,
        ) as any;

        socket.userId = decoded.userId;
        socket.userType = decoded.role === 'teacher' ? 'teacher' : 'student';

        if (decoded.role === 'teacher') {
          socket.teacherId = decoded.teacherId;
        } else {
          socket.studentId = decoded.studentId;
        }

        Logger.info(
          `🔐 Socket authenticated: ${socket.userId} (${socket.userType})`,
        );
        next();
      } catch (error) {
        Logger.error('❌ Socket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
      this.handleDisconnection(socket);
      this.handleMessageEvents(socket);
      this.handleActivityEvents(socket);
      this.handleTypingEvents(socket);
      this.handleRoomEvents(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    const userType = socket.userType!;

    // Store user connection
    const user: SocketUser = {
      socketId: socket.id,
      userId,
      userType,
      teacherId: socket.teacherId,
      studentId: socket.studentId,
      lastSeen: new Date(),
    };

    this.connectedUsers.set(socket.id, user);

    // Track multiple sockets per user
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join type-specific room
    socket.join(`${userType}s`);

    // If teacher, join teacher-specific room
    if (userType === 'teacher' && socket.teacherId) {
      socket.join(`teacher:${socket.teacherId}`);
    }

    // If student, join student-specific room
    if (userType === 'student' && socket.studentId) {
      socket.join(`student:${socket.studentId}`);
    }

    // Emit user online status
    this.broadcastUserStatus(userId, userType, 'online');

    Logger.info(
      `✅ User connected: ${userId} (${userType}) - Socket: ${socket.id}`,
    );

    // Send connection confirmation
    socket.emit('connected', {
      userId,
      userType,
      timestamp: new Date(),
      connectedUsers: this.getConnectedUsersCount(),
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    socket.on('disconnect', (reason) => {
      const user = this.connectedUsers.get(socket.id);
      if (!user) return;

      // Remove from connected users
      this.connectedUsers.delete(socket.id);

      // Remove from user sockets tracking
      const userSockets = this.userSockets.get(user.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.userSockets.delete(user.userId);
          // User is completely offline
          this.broadcastUserStatus(user.userId, user.userType, 'offline');
        }
      }

      // Remove from typing indicators
      this.removeUserFromAllTyping(user.userId);

      Logger.info(
        `❌ User disconnected: ${user.userId} (${user.userType}) - Reason: ${reason}`,
      );
    });
  }

  private handleMessageEvents(socket: AuthenticatedSocket): void {
    // Join conversation room
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      Logger.info(
        `📝 User ${socket.userId} joined conversation: ${conversationId}`,
      );
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      Logger.info(
        `📝 User ${socket.userId} left conversation: ${conversationId}`,
      );
    });

    // Handle message read status
    socket.on(
      'message_read',
      (data: { messageId: string; conversationId: string }) => {
        this.broadcastToConversation(
          data.conversationId,
          'message_read',
          {
            messageId: data.messageId,
            readBy: socket.userId,
            readAt: new Date(),
          },
          socket.id,
        );
      },
    );
  }

  private handleActivityEvents(socket: AuthenticatedSocket): void {
    // Mark activity as read
    socket.on('activity_read', (activityId: string) => {
      socket.emit('activity_read_confirmed', {
        activityId,
        readAt: new Date(),
      });
    });

    // Request activity updates
    socket.on('request_activity_updates', () => {
      // This would trigger fetching latest activities for the user
      socket.emit('activity_updates_requested');
    });
  }

  private handleTypingEvents(socket: AuthenticatedSocket): void {
    socket.on('typing_start', (conversationId: string) => {
      this.handleTyping(socket.userId!, conversationId, true);
      this.broadcastToConversation(
        conversationId,
        'user_typing',
        {
          userId: socket.userId,
          userType: socket.userType,
          isTyping: true,
        },
        socket.id,
      );
    });

    socket.on('typing_stop', (conversationId: string) => {
      this.handleTyping(socket.userId!, conversationId, false);
      this.broadcastToConversation(
        conversationId,
        'user_typing',
        {
          userId: socket.userId,
          userType: socket.userType,
          isTyping: false,
        },
        socket.id,
      );
    });
  }

  private handleRoomEvents(socket: AuthenticatedSocket): void {
    // Join course-specific room for course updates
    socket.on('join_course', (courseId: string) => {
      socket.join(`course:${courseId}`);
      Logger.info(`📚 User ${socket.userId} joined course room: ${courseId}`);
    });

    // Leave course room
    socket.on('leave_course', (courseId: string) => {
      socket.leave(`course:${courseId}`);
      Logger.info(`📚 User ${socket.userId} left course room: ${courseId}`);
    });
  }

  // Public methods for broadcasting events
  public broadcastNewMessage(conversationId: string, messageData: any): void {
    this.io
      .to(`conversation:${conversationId}`)
      .emit('new_message', messageData);
  }

  public broadcastActivityUpdate(teacherId: string, activityData: any): void {
    this.io.to(`teacher:${teacherId}`).emit('new_activity', activityData);
  }

  public broadcastCourseUpdate(courseId: string, updateData: any): void {
    this.io.to(`course:${courseId}`).emit('course_update', updateData);
  }

  public notifyUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public broadcastToTeachers(event: string, data: any): void {
    this.io.to('teachers').emit(event, data);
  }

  public broadcastToStudents(event: string, data: any): void {
    this.io.to('students').emit(event, data);
  }

  /**
   * Enhanced broadcasting methods for analytics and activities
   */
  public broadcastAnalyticsUpdate(teacherId: string, analyticsData: any): void {
    this.io.to(`teacher:${teacherId}`).emit('analytics_update', {
      type: 'analytics',
      data: analyticsData,
      timestamp: new Date(),
    });
  }

  public broadcastEnrollmentUpdate(teacherId: string, enrollmentData: any): void {
    this.io.to(`teacher:${teacherId}`).emit('enrollment_update', {
      type: 'enrollment',
      data: enrollmentData,
      timestamp: new Date(),
    });
  }

  public broadcastRevenueUpdate(teacherId: string, revenueData: any): void {
    this.io.to(`teacher:${teacherId}`).emit('revenue_update', {
      type: 'revenue',
      data: revenueData,
      timestamp: new Date(),
    });
  }

  public broadcastPerformanceUpdate(teacherId: string, performanceData: any): void {
    this.io.to(`teacher:${teacherId}`).emit('performance_update', {
      type: 'performance',
      data: performanceData,
      timestamp: new Date(),
    });
  }

  public broadcastEngagementUpdate(teacherId: string, engagementData: any): void {
    this.io.to(`teacher:${teacherId}`).emit('engagement_update', {
      type: 'engagement',
      data: engagementData,
      timestamp: new Date(),
    });
  }

  public broadcastDashboardUpdate(teacherId: string, dashboardData: any): void {
    this.io.to(`teacher:${teacherId}`).emit('dashboard_update', {
      type: 'dashboard',
      data: dashboardData,
      timestamp: new Date(),
    });
  }

  public broadcastActivityRead(teacherId: string, activityData: any): void {
    this.io.to(`teacher:${teacherId}`).emit('activity_read', {
      type: 'activity_read',
      data: activityData,
      timestamp: new Date(),
    });
  }

  public broadcastBulkActivityRead(teacherId: string, activityIds: string[]): void {
    this.io.to(`teacher:${teacherId}`).emit('bulk_activity_read', {
      type: 'bulk_activity_read',
      data: { activityIds },
      timestamp: new Date(),
    });
  }

  public broadcastMessageStatistics(teacherId: string, statisticsData: any): void {
    this.io.to(`teacher:${teacherId}`).emit('message_statistics_update', {
      type: 'message_statistics',
      data: statisticsData,
      timestamp: new Date(),
    });
  }

  public broadcastConversationUpdate(conversationId: string, updateData: any): void {
    this.io.to(`conversation:${conversationId}`).emit('conversation_update', {
      type: 'conversation_update',
      data: updateData,
      timestamp: new Date(),
    });
  }

  /**
   * Real-time notification system
   */
  public sendNotification(
    userId: string,
    userType: 'student' | 'teacher',
    notification: {
      id: string;
      type: 'info' | 'success' | 'warning' | 'error';
      title: string;
      message: string;
      actionUrl?: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
    }
  ): void {
    this.io.to(`${userType}:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date(),
    });
  }

  public sendSystemAlert(
    userType: 'student' | 'teacher' | 'all',
    alert: {
      id: string;
      type: 'maintenance' | 'update' | 'announcement';
      title: string;
      message: string;
      severity: 'low' | 'medium' | 'high';
      expiresAt?: Date;
    }
  ): void {
    const target = userType === 'all' ? this.io : this.io.to(`${userType}s`);
    target.emit('system_alert', {
      ...alert,
      timestamp: new Date(),
    });
  }

  /**
   * Course-specific broadcasting
   */
  public broadcastToCourse(courseId: string, event: string, data: any): void {
    this.io.to(`course:${courseId}`).emit(event, {
      courseId,
      data,
      timestamp: new Date(),
    });
  }

  public broadcastCourseEnrollment(courseId: string, enrollmentData: any): void {
    this.broadcastToCourse(courseId, 'course_enrollment', enrollmentData);
  }

  public broadcastCourseCompletion(courseId: string, completionData: any): void {
    this.broadcastToCourse(courseId, 'course_completion', completionData);
  }

  public broadcastCourseLectureUpdate(courseId: string, lectureData: any): void {
    this.broadcastToCourse(courseId, 'lecture_update', lectureData);
  }

  // Private helper methods
  private broadcastToConversation(
    conversationId: string,
    event: string,
    data: any,
    excludeSocket?: string,
  ): void {
    const emission = this.io.to(`conversation:${conversationId}`);
    if (excludeSocket) {
      emission.except(excludeSocket);
    }
    emission.emit(event, data);
  }

  private broadcastUserStatus(
    userId: string,
    userType: 'student' | 'teacher',
    status: 'online' | 'offline',
  ): void {
    this.io.emit('user_status_change', {
      userId,
      userType,
      status,
      timestamp: new Date(),
    });
  }

  private handleTyping(
    userId: string,
    conversationId: string,
    isTyping: boolean,
  ): void {
    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Set());
    }

    const typingSet = this.typingUsers.get(conversationId)!;

    if (isTyping) {
      typingSet.add(userId);
    } else {
      typingSet.delete(userId);
    }

    if (typingSet.size === 0) {
      this.typingUsers.delete(conversationId);
    }
  }

  private removeUserFromAllTyping(userId: string): void {
    for (const [conversationId, typingSet] of this.typingUsers.entries()) {
      if (typingSet.has(userId)) {
        typingSet.delete(userId);
        this.broadcastToConversation(conversationId, 'user_typing', {
          userId,
          isTyping: false,
        });

        if (typingSet.size === 0) {
          this.typingUsers.delete(conversationId);
        }
      }
    }
  }

  private getConnectedUsersCount(): {
    total: number;
    teachers: number;
    students: number;
  } {
    let teachers = 0;
    let students = 0;

    for (const user of this.connectedUsers.values()) {
      if (user.userType === 'teacher') teachers++;
      else students++;
    }

    return {
      total: this.connectedUsers.size,
      teachers,
      students,
    };
  }

  // Getter for the io instance
  public getIO(): SocketIOServer {
    return this.io;
  }

  // Get connected users for a specific type
  public getConnectedUsers(userType?: 'student' | 'teacher'): SocketUser[] {
    const users = Array.from(this.connectedUsers.values());
    return userType
      ? users.filter((user) => user.userType === userType)
      : users;
  }

  // Check if user is online
  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }
}

export default WebSocketService;
