"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const user_constant_1 = require("../User/user.constant");
const messaging_controller_1 = require("./messaging.controller");
const messaging_validation_1 = require("./messaging.validation");
const EnhancedRateLimitService_1 = __importDefault(require("../../services/rateLimit/EnhancedRateLimitService"));
const FileUploadService_1 = __importDefault(require("../../services/messaging/FileUploadService"));
const router = (0, express_1.Router)();
const fileUploadService = new FileUploadService_1.default();
// Rate limiting for messaging endpoints
const messagingRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per 15 minutes
    message: {
        error: 'Too Many Requests',
        message: 'Too many messaging requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const sendMessageRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 messages per minute
    message: {
        error: 'Too Many Requests',
        message: 'Too many messages sent. Please slow down.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Apply rate limiting to all messaging routes
router.use(messagingRateLimit);
// Conversation Routes
router.post('/conversations', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(messaging_validation_1.MessagingValidation.createConversation), messaging_controller_1.MessagingController.createConversation);
router.get('/conversations', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(messaging_validation_1.MessagingValidation.getConversations), messaging_controller_1.MessagingController.getConversations);
router.get('/conversations/:conversationId', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(messaging_validation_1.MessagingValidation.getConversationDetails), messaging_controller_1.MessagingController.getConversationDetails);
router.patch('/conversations/:conversationId/archive', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(messaging_validation_1.MessagingValidation.toggleConversationArchive), messaging_controller_1.MessagingController.toggleConversationArchive);
router.delete('/conversations/:conversationId', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(messaging_validation_1.MessagingValidation.deleteConversation), messaging_controller_1.MessagingController.deleteConversation);
// Message Routes
router.get('/conversations/:conversationId/messages', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(messaging_validation_1.MessagingValidation.getMessages), messaging_controller_1.MessagingController.getMessages);
router.post('/conversations/:conversationId/messages', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), sendMessageRateLimit, fileUploadService.getUploadMiddleware(), (0, validateRequest_1.default)(messaging_validation_1.MessagingValidation.sendMessage), messaging_controller_1.MessagingController.sendMessage);
router.patch('/conversations/:conversationId/messages/read', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(messaging_validation_1.MessagingValidation.markMessagesAsRead), messaging_controller_1.MessagingController.markMessagesAsRead);
// Search Routes
router.get('/messages/search', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(messaging_validation_1.MessagingValidation.searchMessages), messaging_controller_1.MessagingController.searchMessages);
// Utility Routes
router.get('/eligible-courses', (0, auth_1.default)(user_constant_1.USER_ROLE.student), messaging_controller_1.MessagingController.getMessagingEligibleCourses);
router.post('/validate-permissions', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(messaging_validation_1.MessagingValidation.validateConversationPermissions), messaging_controller_1.MessagingController.validateConversationPermissions);
// Enhanced messaging routes with rate limiting
router.get('/messages/search-advanced', EnhancedRateLimitService_1.default.createRateLimit('search'), (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), messaging_controller_1.MessagingController.searchMessagesAdvanced);
router.get('/teachers/:teacherId/statistics', EnhancedRateLimitService_1.default.createRateLimit('messaging'), (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), messaging_controller_1.MessagingController.getMessagingStatistics);
router.get('/conversations/:conversationId/details', EnhancedRateLimitService_1.default.createRateLimit('messaging'), (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), messaging_controller_1.MessagingController.getConversationDetailsEnhanced);
// User-specific messaging routes (for compatibility with frontend API calls)
router.get('/users/:userId/folders', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), messaging_controller_1.MessagingController.getUserMessageFolders);
router.get('/users/:userId/stats', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), messaging_controller_1.MessagingController.getUserMessageStats);
router.get('/users/:userId/threads', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), messaging_controller_1.MessagingController.getUserMessageThreads);
exports.MessagingRoutes = router;
