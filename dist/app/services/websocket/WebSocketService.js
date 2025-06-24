"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../../config"));
const logger_1 = require("../../config/logger");
class WebSocketService {
    constructor(server) {
        this.connectedUsers = new Map();
        this.userSockets = new Map(); // userId -> Set of socketIds
        this.typingUsers = new Map(); // conversationId -> Set of userIds
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: process.env.NODE_ENV === 'production'
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
        logger_1.Logger.info('🔌 WebSocket service initialized');
    }
    setupMiddleware() {
        // Authentication middleware
        this.io.use((socket, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const token = socket.handshake.auth.token ||
                    ((_a = socket.handshake.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1]);
                if (!token) {
                    return next(new Error('Authentication token required'));
                }
                const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
                socket.userId = decoded.userId;
                socket.userType = decoded.role === 'teacher' ? 'teacher' : 'student';
                if (decoded.role === 'teacher') {
                    socket.teacherId = decoded.teacherId;
                }
                else {
                    socket.studentId = decoded.studentId;
                }
                logger_1.Logger.info(`🔐 Socket authenticated: ${socket.userId} (${socket.userType})`);
                next();
            }
            catch (error) {
                logger_1.Logger.error('❌ Socket authentication failed:', error);
                next(new Error('Authentication failed'));
            }
        }));
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
            this.handleDisconnection(socket);
            this.handleMessageEvents(socket);
            this.handleActivityEvents(socket);
            this.handleTypingEvents(socket);
            this.handleRoomEvents(socket);
        });
    }
    handleConnection(socket) {
        const userId = socket.userId;
        const userType = socket.userType;
        // Store user connection
        const user = {
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
        this.userSockets.get(userId).add(socket.id);
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
        logger_1.Logger.info(`✅ User connected: ${userId} (${userType}) - Socket: ${socket.id}`);
        // Send connection confirmation
        socket.emit('connected', {
            userId,
            userType,
            timestamp: new Date(),
            connectedUsers: this.getConnectedUsersCount(),
        });
    }
    handleDisconnection(socket) {
        socket.on('disconnect', (reason) => {
            const user = this.connectedUsers.get(socket.id);
            if (!user)
                return;
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
            logger_1.Logger.info(`❌ User disconnected: ${user.userId} (${user.userType}) - Reason: ${reason}`);
        });
    }
    handleMessageEvents(socket) {
        // Join conversation room
        socket.on('join_conversation', (conversationId) => {
            socket.join(`conversation:${conversationId}`);
            logger_1.Logger.info(`📝 User ${socket.userId} joined conversation: ${conversationId}`);
        });
        // Leave conversation room
        socket.on('leave_conversation', (conversationId) => {
            socket.leave(`conversation:${conversationId}`);
            logger_1.Logger.info(`📝 User ${socket.userId} left conversation: ${conversationId}`);
        });
        // Handle message read status
        socket.on('message_read', (data) => {
            this.broadcastToConversation(data.conversationId, 'message_read', {
                messageId: data.messageId,
                readBy: socket.userId,
                readAt: new Date(),
            }, socket.id);
        });
    }
    handleActivityEvents(socket) {
        // Mark activity as read
        socket.on('activity_read', (activityId) => {
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
    handleTypingEvents(socket) {
        socket.on('typing_start', (conversationId) => {
            this.handleTyping(socket.userId, conversationId, true);
            this.broadcastToConversation(conversationId, 'user_typing', {
                userId: socket.userId,
                userType: socket.userType,
                isTyping: true,
            }, socket.id);
        });
        socket.on('typing_stop', (conversationId) => {
            this.handleTyping(socket.userId, conversationId, false);
            this.broadcastToConversation(conversationId, 'user_typing', {
                userId: socket.userId,
                userType: socket.userType,
                isTyping: false,
            }, socket.id);
        });
    }
    handleRoomEvents(socket) {
        // Join course-specific room for course updates
        socket.on('join_course', (courseId) => {
            socket.join(`course:${courseId}`);
            logger_1.Logger.info(`📚 User ${socket.userId} joined course room: ${courseId}`);
        });
        // Leave course room
        socket.on('leave_course', (courseId) => {
            socket.leave(`course:${courseId}`);
            logger_1.Logger.info(`📚 User ${socket.userId} left course room: ${courseId}`);
        });
    }
    // Public methods for broadcasting events
    broadcastNewMessage(conversationId, messageData) {
        this.io
            .to(`conversation:${conversationId}`)
            .emit('new_message', messageData);
    }
    broadcastActivityUpdate(teacherId, activityData) {
        this.io.to(`teacher:${teacherId}`).emit('new_activity', activityData);
    }
    broadcastCourseUpdate(courseId, updateData) {
        this.io.to(`course:${courseId}`).emit('course_update', updateData);
    }
    notifyUser(userId, event, data) {
        this.io.to(`user:${userId}`).emit(event, data);
    }
    broadcastToTeachers(event, data) {
        this.io.to('teachers').emit(event, data);
    }
    broadcastToStudents(event, data) {
        this.io.to('students').emit(event, data);
    }
    /**
     * Enhanced broadcasting methods for analytics and activities
     */
    broadcastAnalyticsUpdate(teacherId, analyticsData) {
        this.io.to(`teacher:${teacherId}`).emit('analytics_update', {
            type: 'analytics',
            data: analyticsData,
            timestamp: new Date(),
        });
    }
    broadcastEnrollmentUpdate(teacherId, enrollmentData) {
        this.io.to(`teacher:${teacherId}`).emit('enrollment_update', {
            type: 'enrollment',
            data: enrollmentData,
            timestamp: new Date(),
        });
    }
    broadcastRevenueUpdate(teacherId, revenueData) {
        this.io.to(`teacher:${teacherId}`).emit('revenue_update', {
            type: 'revenue',
            data: revenueData,
            timestamp: new Date(),
        });
    }
    broadcastPerformanceUpdate(teacherId, performanceData) {
        this.io.to(`teacher:${teacherId}`).emit('performance_update', {
            type: 'performance',
            data: performanceData,
            timestamp: new Date(),
        });
    }
    broadcastEngagementUpdate(teacherId, engagementData) {
        this.io.to(`teacher:${teacherId}`).emit('engagement_update', {
            type: 'engagement',
            data: engagementData,
            timestamp: new Date(),
        });
    }
    broadcastDashboardUpdate(teacherId, dashboardData) {
        this.io.to(`teacher:${teacherId}`).emit('dashboard_update', {
            type: 'dashboard',
            data: dashboardData,
            timestamp: new Date(),
        });
    }
    broadcastActivityRead(teacherId, activityData) {
        this.io.to(`teacher:${teacherId}`).emit('activity_read', {
            type: 'activity_read',
            data: activityData,
            timestamp: new Date(),
        });
    }
    broadcastBulkActivityRead(teacherId, activityIds) {
        this.io.to(`teacher:${teacherId}`).emit('bulk_activity_read', {
            type: 'bulk_activity_read',
            data: { activityIds },
            timestamp: new Date(),
        });
    }
    broadcastMessageStatistics(teacherId, statisticsData) {
        this.io.to(`teacher:${teacherId}`).emit('message_statistics_update', {
            type: 'message_statistics',
            data: statisticsData,
            timestamp: new Date(),
        });
    }
    broadcastConversationUpdate(conversationId, updateData) {
        this.io.to(`conversation:${conversationId}`).emit('conversation_update', {
            type: 'conversation_update',
            data: updateData,
            timestamp: new Date(),
        });
    }
    /**
     * Real-time notification system
     */
    sendNotification(userId, userType, notification) {
        this.io.to(`${userType}:${userId}`).emit('notification', Object.assign(Object.assign({}, notification), { timestamp: new Date() }));
    }
    sendSystemAlert(userType, alert) {
        const target = userType === 'all' ? this.io : this.io.to(`${userType}s`);
        target.emit('system_alert', Object.assign(Object.assign({}, alert), { timestamp: new Date() }));
    }
    /**
     * Course-specific broadcasting
     */
    broadcastToCourse(courseId, event, data) {
        this.io.to(`course:${courseId}`).emit(event, {
            courseId,
            data,
            timestamp: new Date(),
        });
    }
    broadcastCourseEnrollment(courseId, enrollmentData) {
        this.broadcastToCourse(courseId, 'course_enrollment', enrollmentData);
    }
    broadcastCourseCompletion(courseId, completionData) {
        this.broadcastToCourse(courseId, 'course_completion', completionData);
    }
    broadcastCourseLectureUpdate(courseId, lectureData) {
        this.broadcastToCourse(courseId, 'lecture_update', lectureData);
    }
    // Private helper methods
    broadcastToConversation(conversationId, event, data, excludeSocket) {
        const emission = this.io.to(`conversation:${conversationId}`);
        if (excludeSocket) {
            emission.except(excludeSocket);
        }
        emission.emit(event, data);
    }
    broadcastUserStatus(userId, userType, status) {
        this.io.emit('user_status_change', {
            userId,
            userType,
            status,
            timestamp: new Date(),
        });
    }
    handleTyping(userId, conversationId, isTyping) {
        if (!this.typingUsers.has(conversationId)) {
            this.typingUsers.set(conversationId, new Set());
        }
        const typingSet = this.typingUsers.get(conversationId);
        if (isTyping) {
            typingSet.add(userId);
        }
        else {
            typingSet.delete(userId);
        }
        if (typingSet.size === 0) {
            this.typingUsers.delete(conversationId);
        }
    }
    removeUserFromAllTyping(userId) {
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
    getConnectedUsersCount() {
        let teachers = 0;
        let students = 0;
        for (const user of this.connectedUsers.values()) {
            if (user.userType === 'teacher')
                teachers++;
            else
                students++;
        }
        return {
            total: this.connectedUsers.size,
            teachers,
            students,
        };
    }
    // Getter for the io instance
    getIO() {
        return this.io;
    }
    // Get connected users for a specific type
    getConnectedUsers(userType) {
        const users = Array.from(this.connectedUsers.values());
        return userType
            ? users.filter((user) => user.userType === userType)
            : users;
    }
    // Check if user is online
    isUserOnline(userId) {
        return this.userSockets.has(userId);
    }
}
exports.default = WebSocketService;
