import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import rateLimit from 'express-rate-limit';
import { USER_ROLE } from '../User/user.constant';
import { MessagingController } from './messaging.controller';
import { MessagingValidation } from './messaging.validation';
import EnhancedRateLimitService from '../../services/rateLimit/EnhancedRateLimitService';
import FileUploadService from '../../services/messaging/FileUploadService';

const router = Router();
const fileUploadService = new FileUploadService();

// Rate limiting for messaging endpoints
const messagingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes
  message: {
    error: 'Too Many Requests',
    message: 'Too many messaging requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const sendMessageRateLimit = rateLimit({
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
router.post(
  '/conversations',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  validateRequest(MessagingValidation.createConversation),
  MessagingController.createConversation
);

router.get(
  '/conversations',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  validateRequest(MessagingValidation.getConversations),
  MessagingController.getConversations
);

router.get(
  '/conversations/:conversationId',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  validateRequest(MessagingValidation.getConversationDetails),
  MessagingController.getConversationDetails
);

router.patch(
  '/conversations/:conversationId/archive',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  validateRequest(MessagingValidation.toggleConversationArchive),
  MessagingController.toggleConversationArchive
);

router.delete(
  '/conversations/:conversationId',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  validateRequest(MessagingValidation.deleteConversation),
  MessagingController.deleteConversation
);

// Message Routes
router.get(
  '/conversations/:conversationId/messages',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  validateRequest(MessagingValidation.getMessages),
  MessagingController.getMessages
);

router.post(
  '/conversations/:conversationId/messages',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  sendMessageRateLimit,
  fileUploadService.getUploadMiddleware(),
  validateRequest(MessagingValidation.sendMessage),
  MessagingController.sendMessage
);

router.patch(
  '/conversations/:conversationId/messages/read',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  validateRequest(MessagingValidation.markMessagesAsRead),
  MessagingController.markMessagesAsRead
);

// Search Routes
router.get(
  '/messages/search',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  validateRequest(MessagingValidation.searchMessages),
  MessagingController.searchMessages
);

// Utility Routes
router.get(
  '/eligible-courses',
  auth(USER_ROLE.student),
  MessagingController.getMessagingEligibleCourses
);

router.post(
  '/validate-permissions',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  validateRequest(MessagingValidation.validateConversationPermissions),
  MessagingController.validateConversationPermissions
);

// Enhanced messaging routes with rate limiting
router.get(
  '/messages/search-advanced',
  EnhancedRateLimitService.createRateLimit('search'),
  auth(USER_ROLE.student, USER_ROLE.teacher),
  MessagingController.searchMessagesAdvanced
);

router.get(
  '/teachers/:teacherId/statistics',
  EnhancedRateLimitService.createRateLimit('messaging'),
  auth(USER_ROLE.teacher),
  MessagingController.getMessagingStatistics
);

router.get(
  '/conversations/:conversationId/details',
  EnhancedRateLimitService.createRateLimit('messaging'),
  auth(USER_ROLE.student, USER_ROLE.teacher),
  MessagingController.getConversationDetailsEnhanced
);

// User-specific messaging routes (for compatibility with frontend API calls)
router.get(
  '/users/:userId/folders',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  MessagingController.getUserMessageFolders
);

router.get(
  '/users/:userId/stats',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  MessagingController.getUserMessageStats
);

router.get(
  '/users/:userId/threads',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  MessagingController.getUserMessageThreads
);

export const MessagingRoutes = router;
