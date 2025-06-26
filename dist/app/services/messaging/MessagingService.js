"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const mongoose_1 = require("mongoose");
const messaging_model_1 = require("../../modules/Messaging/messaging.model");
const messaging_interface_1 = require("../../modules/Messaging/messaging.interface");
const student_model_1 = require("../../modules/Student/student.model");
const teacher_model_1 = require("../../modules/Teacher/teacher.model");
const course_model_1 = require("../../modules/Course/course.model");
const logger_1 = require("../../config/logger");
const MessagingValidationService_1 = __importDefault(require("./MessagingValidationService"));
const FileUploadService_1 = __importDefault(require("./FileUploadService"));
const redis_1 = require("../../config/redis");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
class MessagingService {
    constructor() {
        // WebSocket service removed - real-time messaging will be handled by SSE/Polling
        this.activityTrackingService = null;
        this.validationService = new MessagingValidationService_1.default();
        this.fileUploadService = new FileUploadService_1.default();
    }
    // WebSocket service setter removed - real-time messaging handled by SSE/Polling
    setActivityTrackingService(activityTrackingService) {
        this.activityTrackingService = activityTrackingService;
    }
    /**
     * Create a new conversation between student and teacher
     */
    createConversation(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Enhanced enrollment validation
                const enrollmentValidation = yield this.validateStudentEnrollment(data.studentId, data.teacherId, data.courseId);
                if (!enrollmentValidation.isValid) {
                    throw new AppError_1.default(http_status_1.default.FORBIDDEN, `Cannot create conversation: ${enrollmentValidation.reason}`);
                }
                // Additional security checks
                yield this.performSecurityChecks(data.studentId, data.teacherId, data.courseId);
                // Check if conversation already exists
                const existingConversation = yield messaging_model_1.Conversation.findOne({
                    teacherId: new mongoose_1.Types.ObjectId(data.teacherId),
                    studentId: new mongoose_1.Types.ObjectId(data.studentId),
                    courseId: new mongoose_1.Types.ObjectId(data.courseId),
                });
                if (existingConversation) {
                    return this.formatConversationResponse(existingConversation);
                }
                // Get course and participant details
                const [course, teacher, student] = yield Promise.all([
                    course_model_1.Course.findById(data.courseId).select('title'),
                    teacher_model_1.Teacher.findById(data.teacherId).populate('user', 'email'),
                    student_model_1.Student.findById(data.studentId).populate('user', 'email'),
                ]);
                if (!course || !teacher || !student) {
                    throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Course, teacher, or student not found');
                }
                // Create conversation
                const conversation = new messaging_model_1.Conversation({
                    courseId: new mongoose_1.Types.ObjectId(data.courseId),
                    teacherId: new mongoose_1.Types.ObjectId(data.teacherId),
                    studentId: new mongoose_1.Types.ObjectId(data.studentId),
                    title: data.title || `${course.title} - Discussion`,
                    participants: [
                        {
                            userId: new mongoose_1.Types.ObjectId(data.teacherId),
                            userType: 'teacher',
                            joinedAt: new Date(),
                            role: 'admin',
                        },
                        {
                            userId: new mongoose_1.Types.ObjectId(data.studentId),
                            userType: 'student',
                            joinedAt: new Date(),
                            role: 'member',
                        },
                    ],
                    metadata: {
                        totalMessages: 0,
                        totalFiles: 0,
                        createdBy: new mongoose_1.Types.ObjectId(data.studentId),
                    },
                });
                const savedConversation = yield conversation.save();
                // Send initial message if provided
                if (data.initialMessage) {
                    yield this.sendMessage({
                        conversationId: savedConversation._id.toString(),
                        content: data.initialMessage,
                        messageType: messaging_interface_1.MessageType.TEXT,
                    }, data.studentId, 'student');
                }
                // Track activity
                if (this.activityTrackingService) {
                    yield this.activityTrackingService.trackMessage(data.teacherId, data.courseId, data.studentId, { conversationId: savedConversation._id.toString() });
                }
                logger_1.Logger.info(`💬 Conversation created: ${savedConversation._id}`);
                return this.formatConversationResponse(savedConversation);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to create conversation:', error);
                throw error;
            }
        });
    }
    /**
     * Send a message in a conversation
     */
    sendMessage(data, senderId, senderType, files) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get conversation and validate permissions
                const conversation = yield messaging_model_1.Conversation.findById(data.conversationId);
                if (!conversation) {
                    throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Conversation not found');
                }
                // Validate sender is part of conversation
                const isParticipant = conversation.participants.some(p => p.userId.toString() === senderId && p.userType === senderType);
                if (!isParticipant) {
                    throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You are not a participant in this conversation');
                }
                // Validate enrollment if sender is student
                if (senderType === 'student') {
                    const validation = yield this.validationService.validateStudentEnrollment(senderId, conversation.teacherId.toString(), conversation.courseId.toString());
                    if (!validation.isValid) {
                        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Student is not enrolled in this course');
                    }
                }
                // Check rate limiting
                const canSend = yield this.validationService.checkRateLimit(senderId, senderType);
                if (!canSend) {
                    throw new AppError_1.default(http_status_1.default.TOO_MANY_REQUESTS, 'Rate limit exceeded');
                }
                // Process file attachments
                const attachments = files ? yield this.fileUploadService.processUploadedFiles(files, senderType, data.conversationId) : [];
                // Sanitize message content
                const sanitizedContent = this.validationService.sanitizeMessageContent(data.content);
                // Determine receiver
                const receiverId = senderType === 'student'
                    ? conversation.teacherId
                    : conversation.studentId;
                const receiverType = senderType === 'student' ? 'teacher' : 'student';
                // Create message
                const message = new messaging_model_1.Message({
                    conversationId: new mongoose_1.Types.ObjectId(data.conversationId),
                    senderId: new mongoose_1.Types.ObjectId(senderId),
                    senderType,
                    receiverId,
                    receiverType,
                    courseId: conversation.courseId,
                    messageType: data.messageType || messaging_interface_1.MessageType.TEXT,
                    content: sanitizedContent,
                    attachments,
                    status: messaging_interface_1.MessageStatus.SENT,
                    replyTo: data.replyTo ? new mongoose_1.Types.ObjectId(data.replyTo) : undefined,
                    metadata: {
                        deviceInfo: 'web', // TODO: Get from request headers
                        ipAddress: '127.0.0.1', // TODO: Get from request
                    },
                });
                const savedMessage = yield message.save();
                // Update conversation
                yield messaging_model_1.Conversation.findByIdAndUpdate(data.conversationId, {
                    lastMessage: savedMessage._id,
                    lastMessageAt: new Date(),
                    $inc: {
                        [`unreadCount.${receiverType}`]: 1,
                        'metadata.totalMessages': 1,
                        'metadata.totalFiles': attachments.length,
                    },
                });
                // Create search index
                yield this.createMessageSearchIndex(savedMessage);
                // Create notification
                yield this.createMessageNotification(savedMessage, conversation);
                logger_1.Logger.info(`📨 Message sent: ${savedMessage._id} in conversation ${data.conversationId}`);
                return this.formatMessageResponse(savedMessage);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to send message:', error);
                throw error;
            }
        });
    }
    /**
     * Get conversations for a user
     */
    getConversations(userId, userType, query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filter = {
                    [`${userType}Id`]: new mongoose_1.Types.ObjectId(userId),
                    isActive: query.isActive !== undefined ? query.isActive : true,
                };
                if (query.courseId) {
                    filter.courseId = new mongoose_1.Types.ObjectId(query.courseId);
                }
                if (query.isArchived !== undefined) {
                    filter.isArchived = query.isArchived;
                }
                const sortField = query.sortBy || 'lastMessageAt';
                const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
                const [conversations, total] = yield Promise.all([
                    messaging_model_1.Conversation.find(filter)
                        .populate('courseId', 'title')
                        .populate('teacherId', 'name email')
                        .populate('studentId', 'name email')
                        .populate('lastMessage', 'content createdAt')
                        .sort({ [sortField]: sortOrder })
                        .limit(query.limit || 20)
                        .skip(query.offset || 0),
                    messaging_model_1.Conversation.countDocuments(filter),
                ]);
                const formattedConversations = conversations.map(conv => this.formatConversationResponse(conv));
                return { conversations: formattedConversations, total };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get conversations:', error);
                throw error;
            }
        });
    }
    /**
     * Get messages in a conversation
     */
    getMessages(conversationId, userId, userType, query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate user is part of conversation
                const conversation = yield messaging_model_1.Conversation.findById(conversationId);
                if (!conversation) {
                    throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Conversation not found');
                }
                const isParticipant = conversation.participants.some(p => p.userId.toString() === userId && p.userType === userType);
                if (!isParticipant) {
                    throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You are not a participant in this conversation');
                }
                const filter = { conversationId: new mongoose_1.Types.ObjectId(conversationId) };
                if (query.messageType) {
                    filter.messageType = query.messageType;
                }
                if (query.hasAttachments) {
                    filter['attachments.0'] = { $exists: true };
                }
                if (query.dateFrom || query.dateTo) {
                    filter.createdAt = {};
                    if (query.dateFrom)
                        filter.createdAt.$gte = query.dateFrom;
                    if (query.dateTo)
                        filter.createdAt.$lte = query.dateTo;
                }
                const sortField = query.sortBy || 'createdAt';
                const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
                const [messages, total] = yield Promise.all([
                    messaging_model_1.Message.find(filter)
                        .populate('replyTo', 'content senderId senderType')
                        .sort({ [sortField]: sortOrder })
                        .limit(query.limit || 50)
                        .skip(query.offset || 0),
                    messaging_model_1.Message.countDocuments(filter),
                ]);
                // Mark messages as read
                yield this.markMessagesAsRead(conversationId, userId, userType);
                const formattedMessages = yield Promise.all(messages.map(msg => this.formatMessageResponse(msg)));
                return { messages: formattedMessages, total };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get messages:', error);
                throw error;
            }
        });
    }
    /**
     * Mark messages as read
     */
    markMessagesAsRead(conversationId, userId, userType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get unread messages before updating
                const unreadMessages = yield messaging_model_1.Message.find({
                    conversationId: new mongoose_1.Types.ObjectId(conversationId),
                    receiverId: new mongoose_1.Types.ObjectId(userId),
                    receiverType: userType,
                    status: { $ne: messaging_interface_1.MessageStatus.READ },
                }).select('_id');
                // Update unread messages to read
                yield messaging_model_1.Message.updateMany({
                    conversationId: new mongoose_1.Types.ObjectId(conversationId),
                    receiverId: new mongoose_1.Types.ObjectId(userId),
                    receiverType: userType,
                    status: { $ne: messaging_interface_1.MessageStatus.READ },
                }, {
                    status: messaging_interface_1.MessageStatus.READ,
                    readAt: new Date(),
                });
                // Reset unread count for user
                yield messaging_model_1.Conversation.findByIdAndUpdate(conversationId, {
                    [`unreadCount.${userType}`]: 0,
                });
                logger_1.Logger.info(`📖 Messages marked as read in conversation ${conversationId} by ${userType} ${userId}`);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to mark messages as read:', error);
                throw error;
            }
        });
    }
    /**
     * Search messages
     */
    searchMessages(userId, userType, searchTerm, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filter = {
                    [`${userType}Id`]: new mongoose_1.Types.ObjectId(userId),
                    $text: { $search: searchTerm },
                };
                if (courseId) {
                    filter.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                const searchResults = yield messaging_model_1.MessageSearchIndex.find(filter)
                    .limit(50)
                    .sort({ createdAt: -1 });
                const messageIds = searchResults.map(result => result.messageId);
                const messages = yield messaging_model_1.Message.find({ _id: { $in: messageIds } })
                    .populate('replyTo', 'content senderId senderType')
                    .sort({ createdAt: -1 });
                return Promise.all(messages.map(msg => this.formatMessageResponse(msg)));
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to search messages:', error);
                return [];
            }
        });
    }
    // Private helper methods
    createMessageSearchIndex(message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const searchIndex = new messaging_model_1.MessageSearchIndex({
                    messageId: message._id,
                    conversationId: message.conversationId,
                    courseId: message.courseId,
                    teacherId: message.senderType === 'teacher' ? message.senderId : message.receiverId,
                    studentId: message.senderType === 'student' ? message.senderId : message.receiverId,
                    content: message.content,
                    searchableContent: message.content.toLowerCase(),
                    attachmentNames: message.attachments.map(att => att.originalName),
                    tags: [], // TODO: Extract tags from content
                    createdAt: message.createdAt || new Date(),
                });
                yield searchIndex.save();
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to create message search index:', error);
            }
        });
    }
    createMessageNotification(message, conversation) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get sender and receiver details
                const [sender, receiver] = yield Promise.all([
                    message.senderType === 'teacher'
                        ? teacher_model_1.Teacher.findById(message.senderId).select('name')
                        : student_model_1.Student.findById(message.senderId).select('name'),
                    message.receiverType === 'teacher'
                        ? teacher_model_1.Teacher.findById(message.receiverId).select('name')
                        : student_model_1.Student.findById(message.receiverId).select('name'),
                ]);
                const course = yield course_model_1.Course.findById(conversation.courseId).select('title');
                if (!sender || !receiver || !course)
                    return;
                const senderName = `${sender.name.firstName} ${sender.name.lastName}`;
                const courseName = course.title;
                const notification = new messaging_model_1.MessageNotification({
                    userId: message.receiverId,
                    userType: message.receiverType,
                    messageId: message._id,
                    conversationId: message.conversationId,
                    type: 'new_message',
                    title: `New message from ${senderName}`,
                    content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
                    actionUrl: `/messages/${conversation._id}`,
                    metadata: {
                        senderName,
                        courseName,
                    },
                });
                yield notification.save();
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to create message notification:', error);
            }
        });
    }
    formatConversationResponse(conversation) {
        var _a, _b, _c, _d, _e, _f;
        return {
            id: conversation._id.toString(),
            courseId: ((_a = conversation.courseId._id) === null || _a === void 0 ? void 0 : _a.toString()) || conversation.courseId.toString(),
            courseName: conversation.courseId.title || 'Unknown Course',
            teacherId: ((_b = conversation.teacherId._id) === null || _b === void 0 ? void 0 : _b.toString()) || conversation.teacherId.toString(),
            teacherName: conversation.teacherId.name
                ? `${conversation.teacherId.name.firstName} ${conversation.teacherId.name.lastName}`
                : 'Unknown Teacher',
            studentId: ((_c = conversation.studentId._id) === null || _c === void 0 ? void 0 : _c.toString()) || conversation.studentId.toString(),
            studentName: conversation.studentId.name
                ? `${conversation.studentId.name.firstName} ${conversation.studentId.name.lastName}`
                : 'Unknown Student',
            title: conversation.title,
            lastMessage: conversation.lastMessage ? {
                id: ((_d = conversation.lastMessage._id) === null || _d === void 0 ? void 0 : _d.toString()) || conversation.lastMessage.toString(),
                content: conversation.lastMessage.content || '',
                senderName: 'Unknown',
                createdAt: conversation.lastMessage.createdAt || new Date(),
            } : undefined,
            unreadCount: ((_e = conversation.unreadCount) === null || _e === void 0 ? void 0 : _e.teacher) || ((_f = conversation.unreadCount) === null || _f === void 0 ? void 0 : _f.student) || 0,
            isActive: conversation.isActive,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
        };
    }
    formatMessageResponse(message) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Get sender details
            const sender = message.senderType === 'teacher'
                ? yield teacher_model_1.Teacher.findById(message.senderId).select('name')
                : yield student_model_1.Student.findById(message.senderId).select('name');
            const senderName = sender
                ? `${sender.name.firstName} ${sender.name.lastName}`
                : 'Unknown User';
            return {
                id: message._id.toString(),
                conversationId: message.conversationId.toString(),
                senderId: message.senderId.toString(),
                senderName,
                senderType: message.senderType,
                content: message.content,
                messageType: message.messageType,
                attachments: message.attachments || [],
                status: message.status,
                isEdited: message.isEdited || false,
                replyTo: message.replyTo ? {
                    id: ((_a = message.replyTo._id) === null || _a === void 0 ? void 0 : _a.toString()) || message.replyTo.toString(),
                    content: message.replyTo.content || '',
                    senderName: 'Unknown',
                } : undefined,
                readAt: message.readAt,
                createdAt: message.createdAt,
                updatedAt: message.updatedAt,
            };
        });
    }
    /**
     * Enhanced enrollment validation with detailed checks
     */
    validateStudentEnrollment(studentId, teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Check if student exists and is active
                const student = yield student_model_1.Student.findById(studentId).populate('user');
                if (!student || student.isDeleted) {
                    return { isValid: false, reason: 'Student not found or inactive' };
                }
                // Check if teacher exists and owns the course
                const course = yield course_model_1.Course.findById(courseId);
                if (!course) {
                    return { isValid: false, reason: 'Course not found' };
                }
                if (course.creator.toString() !== teacherId) {
                    return { isValid: false, reason: 'Teacher does not own this course' };
                }
                // Check if course is published and active
                if (course.status !== 'published') {
                    return { isValid: false, reason: 'Course is not published' };
                }
                // Check if student is enrolled in the course
                const enrollment = student.enrolledCourses.find(enrollment => enrollment.courseId.toString() === courseId);
                if (!enrollment) {
                    return { isValid: false, reason: 'Student is not enrolled in this course' };
                }
                // Check enrollment status and payment (for paid courses)
                if (course.isFree === 'paid') {
                    const { Payment } = yield Promise.resolve().then(() => __importStar(require('../../modules/Payment/payment.model')));
                    const payment = yield Payment.findOne({
                        studentId,
                        courseId,
                        teacherId,
                        status: 'completed'
                    });
                    if (!payment) {
                        return { isValid: false, reason: 'Payment not found for paid course' };
                    }
                }
                return {
                    isValid: true,
                    enrollmentDetails: {
                        enrolledAt: enrollment.enrolledAt,
                        progress: enrollment.completedLectures.length,
                        totalLectures: ((_a = course.lectures) === null || _a === void 0 ? void 0 : _a.length) || 0,
                        courseTitle: course.title,
                        isPaid: course.isFree === 'paid'
                    }
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to validate student enrollment:', error);
                return { isValid: false, reason: 'Validation error occurred' };
            }
        });
    }
    /**
     * Perform additional security checks
     */
    performSecurityChecks(studentId, teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check for any existing restrictions or blocks
                const restrictions = yield this.checkUserRestrictions(studentId, teacherId);
                if (restrictions.isRestricted) {
                    throw new AppError_1.default(http_status_1.default.FORBIDDEN, `Messaging restricted: ${restrictions.reason}`);
                }
                // Check rate limiting for conversation creation
                const rateLimitKey = `conversation_creation:${studentId}:${teacherId}`;
                const recentCreations = yield redis_1.redisOperations.get(rateLimitKey);
                if (recentCreations && parseInt(recentCreations) >= 3) {
                    throw new AppError_1.default(http_status_1.default.TOO_MANY_REQUESTS, 'Too many conversation creation attempts. Please wait before trying again.');
                }
                // Set rate limit (3 conversations per hour)
                yield redis_1.redisOperations.setex(rateLimitKey, 3600, (parseInt(recentCreations || '0') + 1).toString());
                // Log security event
                logger_1.Logger.info(`🔒 Security check passed for conversation creation: Student ${studentId} -> Teacher ${teacherId} for course ${courseId}`);
            }
            catch (error) {
                logger_1.Logger.error('❌ Security check failed:', error);
                throw error;
            }
        });
    }
    /**
     * Check for user restrictions or blocks
     */
    checkUserRestrictions(studentId, teacherId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if student user account is verified
                const student = yield student_model_1.Student.findById(studentId).populate('user');
                if (!(student === null || student === void 0 ? void 0 : student.user) || !student.user.isVerified) {
                    return { isRestricted: true, reason: 'Student account not verified' };
                }
                // Check if teacher user account is active
                const teacher = yield teacher_model_1.Teacher.findById(teacherId).populate('user');
                if (!(teacher === null || teacher === void 0 ? void 0 : teacher.user) || teacher.user.status !== 'active') {
                    return { isRestricted: true, reason: 'Teacher account not active' };
                }
                // TODO: Add more sophisticated restriction checks
                // - Check for reported users
                // - Check for suspended accounts
                // - Check for blocked relationships
                return { isRestricted: false };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to check user restrictions:', error);
                return { isRestricted: true, reason: 'Unable to verify user status' };
            }
        });
    }
    /**
     * Enhanced message search with better filtering and security
     */
    searchMessagesAdvanced(userId, userType, searchParams) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                // Build search filter
                const filter = {
                    [`${userType}Id`]: new mongoose_1.Types.ObjectId(userId),
                };
                // Add text search
                if (searchParams.query) {
                    filter.$text = { $search: searchParams.query };
                }
                if (searchParams.courseId) {
                    filter.courseId = new mongoose_1.Types.ObjectId(searchParams.courseId);
                }
                if (searchParams.dateFrom || searchParams.dateTo) {
                    filter.createdAt = {};
                    if (searchParams.dateFrom)
                        filter.createdAt.$gte = searchParams.dateFrom;
                    if (searchParams.dateTo)
                        filter.createdAt.$lte = searchParams.dateTo;
                }
                if (searchParams.messageType) {
                    filter.messageType = searchParams.messageType;
                }
                if (searchParams.hasAttachments) {
                    filter.hasAttachments = true;
                }
                // Execute search
                const [searchResults, total] = yield Promise.all([
                    messaging_model_1.MessageSearchIndex.find(filter)
                        .limit(searchParams.limit || 50)
                        .skip(searchParams.offset || 0)
                        .sort({ createdAt: -1 }),
                    messaging_model_1.MessageSearchIndex.countDocuments(filter)
                ]);
                const messageIds = searchResults.map(result => result.messageId);
                const messages = yield messaging_model_1.Message.find({ _id: { $in: messageIds } })
                    .populate('replyTo', 'content senderId senderType')
                    .sort({ createdAt: -1 });
                const formattedMessages = yield Promise.all(messages.map(msg => this.formatMessageResponse(msg)));
                const searchTime = Date.now() - startTime;
                return {
                    messages: formattedMessages,
                    total,
                    searchMetadata: {
                        searchTerm: searchParams.query || '',
                        resultsCount: formattedMessages.length,
                        searchTime
                    }
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to perform advanced message search:', error);
                throw error;
            }
        });
    }
    /**
     * Get messaging statistics for teacher dashboard
     */
    getMessagingStatistics(teacherId_1) {
        return __awaiter(this, arguments, void 0, function* (teacherId, period = 'monthly') {
            try {
                const cacheKey = `messaging_stats:${teacherId}:${period}`;
                const cached = yield redis_1.redisOperations.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
                const dateRange = this.getDateRangeForPeriod(period);
                // Get basic conversation stats
                const [totalConversations, activeConversations] = yield Promise.all([
                    messaging_model_1.Conversation.countDocuments({ teacherId: new mongoose_1.Types.ObjectId(teacherId) }),
                    messaging_model_1.Conversation.countDocuments({
                        teacherId: new mongoose_1.Types.ObjectId(teacherId),
                        isActive: true,
                        lastMessageAt: { $gte: dateRange.startDate }
                    })
                ]);
                // Get message stats
                const messageFilter = {
                    receiverId: new mongoose_1.Types.ObjectId(teacherId),
                    receiverType: 'teacher',
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
                };
                const [totalMessages, unreadMessages] = yield Promise.all([
                    messaging_model_1.Message.countDocuments(messageFilter),
                    messaging_model_1.Message.countDocuments(Object.assign(Object.assign({}, messageFilter), { status: { $ne: messaging_interface_1.MessageStatus.READ } }))
                ]);
                // Get message type breakdown
                const messageTypeStats = yield messaging_model_1.Message.aggregate([
                    { $match: messageFilter },
                    { $group: { _id: '$messageType', count: { $sum: 1 } } }
                ]);
                const messagesByType = {
                    [messaging_interface_1.MessageType.TEXT]: 0,
                    [messaging_interface_1.MessageType.FILE]: 0,
                    [messaging_interface_1.MessageType.IMAGE]: 0,
                    [messaging_interface_1.MessageType.VIDEO]: 0,
                    [messaging_interface_1.MessageType.AUDIO]: 0,
                    [messaging_interface_1.MessageType.DOCUMENT]: 0
                };
                messageTypeStats.forEach(stat => {
                    messagesByType[stat._id] = stat.count;
                });
                // Get conversation status breakdown
                const conversationStats = yield messaging_model_1.Conversation.aggregate([
                    { $match: { teacherId: new mongoose_1.Types.ObjectId(teacherId) } },
                    {
                        $group: {
                            _id: {
                                $cond: [
                                    { $eq: ['$isArchived', true] }, 'archived',
                                    { $cond: [{ $eq: ['$isActive', false] }, 'blocked', 'active'] }
                                ]
                            },
                            count: { $sum: 1 }
                        }
                    }
                ]);
                const conversationsByStatus = {
                    active: 0,
                    archived: 0,
                    blocked: 0
                };
                conversationStats.forEach(stat => {
                    conversationsByStatus[stat._id] = stat.count;
                });
                // Calculate average response time
                const averageResponseTime = yield this.calculateAverageResponseTime(teacherId, dateRange);
                // Get top courses by message count
                const topCoursesByMessages = yield this.getTopCoursesByMessages(teacherId, dateRange);
                const result = {
                    totalConversations,
                    activeConversations,
                    totalMessages,
                    unreadMessages,
                    averageResponseTime,
                    messagesByType,
                    conversationsByStatus,
                    topCoursesByMessages
                };
                // Cache for 30 minutes
                yield redis_1.redisOperations.setex(cacheKey, 1800, JSON.stringify(result));
                return result;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get messaging statistics:', error);
                throw error;
            }
        });
    }
    getDateRangeForPeriod(period) {
        const now = new Date();
        let startDate;
        switch (period) {
            case 'daily':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case 'weekly':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'monthly':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        return { startDate, endDate: now };
    }
    calculateAverageResponseTime(teacherId, dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get teacher's messages and their response times
                const teacherMessages = yield messaging_model_1.Message.find({
                    senderId: new mongoose_1.Types.ObjectId(teacherId),
                    senderType: 'teacher',
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
                }).sort({ createdAt: 1 });
                if (teacherMessages.length === 0)
                    return 0;
                let totalResponseTime = 0;
                let responseCount = 0;
                for (const message of teacherMessages) {
                    // Find the previous student message in the same conversation
                    const previousStudentMessage = yield messaging_model_1.Message.findOne({
                        conversationId: message.conversationId,
                        senderType: 'student',
                        createdAt: { $lt: message.createdAt }
                    }).sort({ createdAt: -1 });
                    if (previousStudentMessage) {
                        const responseTime = message.createdAt.getTime() - previousStudentMessage.createdAt.getTime();
                        totalResponseTime += responseTime;
                        responseCount++;
                    }
                }
                // Return average response time in hours
                return responseCount > 0 ? totalResponseTime / responseCount / (1000 * 60 * 60) : 0;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to calculate average response time:', error);
                return 0;
            }
        });
    }
    getTopCoursesByMessages(teacherId, dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const topCourses = yield messaging_model_1.Message.aggregate([
                    {
                        $match: {
                            $or: [
                                { senderId: new mongoose_1.Types.ObjectId(teacherId), senderType: 'teacher' },
                                { receiverId: new mongoose_1.Types.ObjectId(teacherId), receiverType: 'teacher' }
                            ],
                            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
                        }
                    },
                    { $group: { _id: '$courseId', messageCount: { $sum: 1 } } },
                    { $sort: { messageCount: -1 } },
                    { $limit: 5 },
                    {
                        $lookup: {
                            from: 'courses',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'course'
                        }
                    }
                ]);
                return topCourses.map(item => {
                    var _a;
                    return ({
                        courseId: item._id.toString(),
                        courseName: ((_a = item.course[0]) === null || _a === void 0 ? void 0 : _a.title) || 'Unknown Course',
                        messageCount: item.messageCount
                    });
                });
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get top courses by messages:', error);
                return [];
            }
        });
    }
    /**
     * Get enhanced conversation details
     */
    getConversationDetails(conversationId, userId, userType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get conversation and validate permissions
                const conversation = yield messaging_model_1.Conversation.findById(conversationId)
                    .populate('courseId', 'title courseThumbnail')
                    .populate('teacherId', 'name email profileImg')
                    .populate('studentId', 'name email profileImg')
                    .populate('lastMessage', 'content createdAt');
                if (!conversation) {
                    throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Conversation not found');
                }
                // Validate user is participant
                const isParticipant = conversation.participants.some(p => p.userId.toString() === userId && p.userType === userType);
                if (!isParticipant) {
                    throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You are not a participant in this conversation');
                }
                // Get message statistics
                const messageStats = yield this.getConversationMessageStats(conversationId, userId, userType);
                // Get participant details
                const teacher = conversation.teacherId;
                const student = conversation.studentId;
                const participants = {
                    teacher: {
                        id: teacher._id.toString(),
                        name: `${teacher.name.firstName} ${teacher.name.lastName}`,
                        email: teacher.email,
                        profileImg: teacher.profileImg
                    },
                    student: {
                        id: student._id.toString(),
                        name: `${student.name.firstName} ${student.name.lastName}`,
                        email: student.email,
                        profileImg: student.profileImg
                    }
                };
                // Get course info and enrollment date
                const course = conversation.courseId;
                const enrollmentInfo = yield student_model_1.Student.findById(student._id)
                    .select('enrolledCourses');
                const enrollment = enrollmentInfo === null || enrollmentInfo === void 0 ? void 0 : enrollmentInfo.enrolledCourses.find(e => e.courseId.toString() === course._id.toString());
                const courseInfo = {
                    id: course._id.toString(),
                    title: course.title,
                    thumbnail: course.courseThumbnail,
                    enrollmentDate: (enrollment === null || enrollment === void 0 ? void 0 : enrollment.enrolledAt) || new Date()
                };
                return {
                    conversation: this.formatConversationResponse(conversation),
                    messageStats,
                    participants,
                    courseInfo
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get conversation details:', error);
                throw error;
            }
        });
    }
    getConversationMessageStats(conversationId, userId, userType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const conversationFilter = { conversationId: new mongoose_1.Types.ObjectId(conversationId) };
                const unreadFilter = Object.assign(Object.assign({}, conversationFilter), { receiverId: new mongoose_1.Types.ObjectId(userId), receiverType: userType, status: { $ne: messaging_interface_1.MessageStatus.READ } });
                // Get basic stats
                const [totalMessages, unreadMessages, lastMessage] = yield Promise.all([
                    messaging_model_1.Message.countDocuments(conversationFilter),
                    messaging_model_1.Message.countDocuments(unreadFilter),
                    messaging_model_1.Message.findOne(conversationFilter).sort({ createdAt: -1 }).select('createdAt')
                ]);
                // Get message type breakdown
                const messageTypeStats = yield messaging_model_1.Message.aggregate([
                    { $match: conversationFilter },
                    { $group: { _id: '$messageType', count: { $sum: 1 } } }
                ]);
                const messagesByType = {
                    [messaging_interface_1.MessageType.TEXT]: 0,
                    [messaging_interface_1.MessageType.FILE]: 0,
                    [messaging_interface_1.MessageType.IMAGE]: 0,
                    [messaging_interface_1.MessageType.VIDEO]: 0,
                    [messaging_interface_1.MessageType.AUDIO]: 0,
                    [messaging_interface_1.MessageType.DOCUMENT]: 0
                };
                messageTypeStats.forEach(stat => {
                    messagesByType[stat._id] = stat.count;
                });
                return {
                    totalMessages,
                    unreadMessages,
                    lastMessageAt: (lastMessage === null || lastMessage === void 0 ? void 0 : lastMessage.createdAt) || null,
                    messagesByType
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get conversation message stats:', error);
                return {
                    totalMessages: 0,
                    unreadMessages: 0,
                    lastMessageAt: null,
                    messagesByType: {
                        [messaging_interface_1.MessageType.TEXT]: 0,
                        [messaging_interface_1.MessageType.FILE]: 0,
                        [messaging_interface_1.MessageType.IMAGE]: 0,
                        [messaging_interface_1.MessageType.VIDEO]: 0,
                        [messaging_interface_1.MessageType.AUDIO]: 0,
                        [messaging_interface_1.MessageType.DOCUMENT]: 0
                    }
                };
            }
        });
    }
    /**
     * Toggle conversation archive status
     */
    toggleConversationArchive(conversationId, userId, userType, isArchived) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const conversation = yield messaging_model_1.Conversation.findById(conversationId);
                if (!conversation) {
                    throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Conversation not found');
                }
                // Verify user is participant
                const isParticipant = userType === 'teacher'
                    ? conversation.teacherId.toString() === userId
                    : conversation.studentId.toString() === userId;
                if (!isParticipant) {
                    throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Access denied to this conversation');
                }
                // Update archive status
                conversation.isArchived = isArchived;
                yield conversation.save();
                logger_1.Logger.info(`📁 Conversation ${isArchived ? 'archived' : 'unarchived'}: ${conversationId}`);
                return conversation;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to toggle conversation archive:', error);
                throw error;
            }
        });
    }
    /**
     * Get enhanced conversation details (alias for getConversationDetails)
     */
    getConversationDetailsEnhanced(conversationId, userId, userType) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getConversationDetails(conversationId, userId, userType);
        });
    }
}
exports.default = MessagingService;
