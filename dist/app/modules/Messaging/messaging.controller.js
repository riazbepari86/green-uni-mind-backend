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
exports.MessagingController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const MessagingService_1 = __importDefault(require("../../services/messaging/MessagingService"));
const MessagingValidationService_1 = __importDefault(require("../../services/messaging/MessagingValidationService"));
const messagingService = new MessagingService_1.default();
const validationService = new MessagingValidationService_1.default();
/**
 * Create a new conversation
 */
const createConversation = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { courseId, teacherId, studentId, title, initialMessage } = req.body;
    const user = req.user;
    // Validate user permissions
    if (user.role === 'student' && user.studentId !== studentId) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Students can only create conversations for themselves');
    }
    if (user.role === 'teacher' && user.teacherId !== teacherId) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Teachers can only create conversations for themselves');
    }
    const conversation = yield messagingService.createConversation({
        courseId,
        teacherId,
        studentId,
        title,
        initialMessage,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Conversation created successfully',
        data: conversation,
    });
}));
/**
 * Get conversations for a user
 */
const getConversations = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { courseId, isActive, isArchived, limit = 20, offset = 0, sortBy = 'lastMessageAt', sortOrder = 'desc', search, } = req.query;
    const userType = user.role === 'teacher' ? 'teacher' : 'student';
    const userId = user.role === 'teacher' ? user.teacherId : user.studentId;
    const query = {
        courseId: courseId,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        isArchived: isArchived !== undefined ? isArchived === 'true' : undefined,
        limit: parseInt(limit),
        offset: parseInt(offset),
        sortBy: sortBy,
        sortOrder: sortOrder,
        search: search,
    };
    const result = yield messagingService.getConversations(userId, userType, query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Conversations retrieved successfully',
        data: result,
    });
}));
/**
 * Get messages in a conversation
 */
const getMessages = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { conversationId } = req.params;
    const user = req.user;
    const { messageType, hasAttachments, dateFrom, dateTo, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'asc', search, } = req.query;
    const userType = user.role === 'teacher' ? 'teacher' : 'student';
    const userId = user.role === 'teacher' ? user.teacherId : user.studentId;
    const query = {
        messageType: messageType, // Cast to any to avoid type issues
        hasAttachments: hasAttachments === 'true',
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        limit: parseInt(limit),
        offset: parseInt(offset),
        sortBy: sortBy,
        sortOrder: sortOrder,
        search: search,
    };
    const result = yield messagingService.getMessages(conversationId, userId, userType, query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Messages retrieved successfully',
        data: result,
    });
}));
/**
 * Send a message
 */
const sendMessage = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { conversationId, content, messageType, replyTo } = req.body;
    const user = req.user;
    const files = req.files;
    const userType = user.role === 'teacher' ? 'teacher' : 'student';
    const userId = user.role === 'teacher' ? user.teacherId : user.studentId;
    const message = yield messagingService.sendMessage({
        conversationId,
        content,
        messageType,
        replyTo,
    }, userId, userType, files);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Message sent successfully',
        data: message,
    });
}));
/**
 * Mark messages as read
 */
const markMessagesAsRead = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { conversationId } = req.params;
    const user = req.user;
    const userType = user.role === 'teacher' ? 'teacher' : 'student';
    const userId = user.role === 'teacher' ? user.teacherId : user.studentId;
    yield messagingService.markMessagesAsRead(conversationId, userId, userType);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Messages marked as read successfully',
        data: null,
    });
}));
/**
 * Search messages
 */
const searchMessages = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { searchTerm, courseId } = req.query;
    const user = req.user;
    if (!searchTerm) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Search term is required');
    }
    const userType = user.role === 'teacher' ? 'teacher' : 'student';
    const userId = user.role === 'teacher' ? user.teacherId : user.studentId;
    const messages = yield messagingService.searchMessages(userId, userType, searchTerm, courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Messages searched successfully',
        data: messages,
    });
}));
/**
 * Get messaging eligible courses for a student
 */
const getMessagingEligibleCourses = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (user.role !== 'student') {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Only students can access this endpoint');
    }
    const courses = yield validationService.getMessagingEligibleCourses(user.studentId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Messaging eligible courses retrieved successfully',
        data: courses,
    });
}));
/**
 * Validate conversation permissions
 */
const validateConversationPermissions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId, studentId, courseId } = req.body;
    const user = req.user;
    // Validate user can check these permissions
    if (user.role === 'student' && user.studentId !== studentId) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Students can only check their own permissions');
    }
    if (user.role === 'teacher' && user.teacherId !== teacherId) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Teachers can only check their own permissions');
    }
    const validation = yield validationService.validateStudentEnrollment(studentId, teacherId, courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Conversation permissions validated',
        data: {
            canMessage: validation.isValid,
            courseDetails: validation.isValid ? {
                courseId: validation.courseId,
                courseName: validation.courseName,
                teacherName: validation.teacherName,
                studentName: validation.studentName,
                enrollmentDate: validation.enrollmentDate,
            } : null,
        },
    });
}));
/**
 * Archive/Unarchive conversation
 */
const toggleConversationArchive = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { conversationId } = req.params;
    const { isArchived } = req.body;
    const user = req.user;
    const userId = user.teacherId || user.studentId;
    const userType = user.role;
    const result = yield messagingService.toggleConversationArchive(conversationId, userId, userType, isArchived);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `Conversation ${isArchived ? 'archived' : 'unarchived'} successfully`,
        data: result,
    });
}));
/**
 * Delete conversation (soft delete)
 */
const deleteConversation = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { conversationId } = req.params;
    const user = req.user;
    const userId = user.teacherId || user.studentId;
    const userType = user.role;
    // For now, we'll archive the conversation instead of deleting
    const result = yield messagingService.toggleConversationArchive(conversationId, userId, userType, true);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Conversation deleted successfully',
        data: result,
    });
}));
/**
 * Get conversation details
 */
const getConversationDetails = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { conversationId } = req.params;
    const user = req.user;
    const userId = user.teacherId || user.studentId;
    const userType = user.role;
    const details = yield messagingService.getConversationDetails(conversationId, userId, userType);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Conversation details retrieved successfully',
        data: details,
    });
}));
/**
 * Advanced message search
 */
const searchMessagesAdvanced = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { query, courseId, dateFrom, dateTo, messageType, hasAttachments, limit, offset } = req.query;
    const userType = user.role === 'teacher' ? 'teacher' : 'student';
    const userId = user.role === 'teacher' ? user.teacherId : user.studentId;
    const searchParams = {
        query: query,
        courseId: courseId,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        messageType: messageType,
        hasAttachments: hasAttachments === 'true',
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
    };
    const result = yield messagingService.searchMessagesAdvanced(userId, userType, searchParams);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Advanced message search completed successfully',
        data: result,
    });
}));
/**
 * Get messaging statistics for teacher dashboard
 */
const getMessagingStatistics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period = 'monthly' } = req.query;
    const user = req.user;
    // Validate teacher ID matches authenticated user
    if (user.role === 'teacher' && user.teacherId !== teacherId) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own messaging statistics');
    }
    const statistics = yield messagingService.getMessagingStatistics(teacherId, period);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Messaging statistics retrieved successfully',
        data: statistics,
    });
}));
/**
 * Get conversation details with enhanced information
 */
const getConversationDetailsEnhanced = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { conversationId } = req.params;
    const user = req.user;
    const userType = user.role === 'teacher' ? 'teacher' : 'student';
    const userId = user.role === 'teacher' ? user.teacherId : user.studentId;
    // Get conversation and validate permissions
    const conversation = yield messagingService.getConversationDetails(conversationId, userId, userType);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Enhanced conversation details retrieved successfully',
        data: conversation,
    });
}));
/**
 * Get user message folders (compatibility endpoint)
 */
const getUserMessageFolders = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const user = req.user;
    // Validate user access
    if (user._id !== userId && user.role !== 'admin') {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own message folders');
    }
    // Return default folder structure for new users
    const defaultFolders = [
        { id: 'inbox', name: 'Inbox', type: 'inbox', unreadCount: 0 },
        { id: 'sent', name: 'Sent', type: 'sent', unreadCount: 0 },
        { id: 'archived', name: 'Archived', type: 'archived', unreadCount: 0 },
        { id: 'trash', name: 'Trash', type: 'trash', unreadCount: 0 }
    ];
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Message folders retrieved successfully',
        data: defaultFolders,
    });
}));
/**
 * Get user message stats (compatibility endpoint)
 */
const getUserMessageStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { period = 'week' } = req.query;
    const user = req.user;
    // Validate user access
    if (user._id !== userId && user.role !== 'admin') {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own message stats');
    }
    // Return empty stats for new users
    const emptyStats = {
        totalMessages: 0,
        unreadMessages: 0,
        sentMessages: 0,
        receivedMessages: 0,
        averageResponseTime: 0,
        period: period
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Message statistics retrieved successfully',
        data: emptyStats,
    });
}));
/**
 * Get user message threads (compatibility endpoint)
 */
const getUserMessageThreads = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { page = 1, limit = 20, folderType = 'inbox' } = req.query;
    const user = req.user;
    // Validate user access
    if (user._id !== userId && user.role !== 'admin') {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own message threads');
    }
    // Return empty threads for new users
    const emptyThreads = {
        data: [],
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0
        },
        folderType: folderType
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Message threads retrieved successfully',
        data: emptyThreads,
    });
}));
exports.MessagingController = {
    createConversation,
    getConversations,
    getMessages,
    sendMessage,
    markMessagesAsRead,
    searchMessages,
    getMessagingEligibleCourses,
    validateConversationPermissions,
    toggleConversationArchive,
    deleteConversation,
    getConversationDetails,
    // Enhanced endpoints
    searchMessagesAdvanced,
    getMessagingStatistics,
    getConversationDetailsEnhanced,
    // Compatibility endpoints
    getUserMessageFolders,
    getUserMessageStats,
    getUserMessageThreads,
};
