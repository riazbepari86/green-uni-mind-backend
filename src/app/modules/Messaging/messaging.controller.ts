import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import AppError from '../../errors/AppError';
import MessagingService from '../../services/messaging/MessagingService';
import MessagingValidationService from '../../services/messaging/MessagingValidationService';

const messagingService = new MessagingService();
const validationService = new MessagingValidationService();

/**
 * Create a new conversation
 */
const createConversation = catchAsync(async (req: Request, res: Response) => {
  const { courseId, teacherId, studentId, title, initialMessage } = req.body;
  const user = (req as any).user;

  // Validate user permissions
  if (user.role === 'student' && user.studentId !== studentId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Students can only create conversations for themselves');
  }

  if (user.role === 'teacher' && user.teacherId !== teacherId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Teachers can only create conversations for themselves');
  }

  const conversation = await messagingService.createConversation({
    courseId,
    teacherId,
    studentId,
    title,
    initialMessage,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Conversation created successfully',
    data: conversation,
  });
});

/**
 * Get conversations for a user
 */
const getConversations = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const {
    courseId,
    isActive,
    isArchived,
    limit = 20,
    offset = 0,
    sortBy = 'lastMessageAt',
    sortOrder = 'desc',
    search,
  } = req.query;

  const userType = user.role === 'teacher' ? 'teacher' : 'student';
  const userId = user.role === 'teacher' ? user.teacherId : user.studentId;

  const query = {
    courseId: courseId as string,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    isArchived: isArchived !== undefined ? isArchived === 'true' : undefined,
    limit: parseInt(limit as string),
    offset: parseInt(offset as string),
    sortBy: sortBy as 'lastMessageAt' | 'createdAt',
    sortOrder: sortOrder as 'asc' | 'desc',
    search: search as string,
  };

  const result = await messagingService.getConversations(userId, userType, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Conversations retrieved successfully',
    data: result,
  });
});

/**
 * Get messages in a conversation
 */
const getMessages = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const user = (req as any).user;
  const {
    messageType,
    hasAttachments,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'asc',
    search,
  } = req.query;

  const userType = user.role === 'teacher' ? 'teacher' : 'student';
  const userId = user.role === 'teacher' ? user.teacherId : user.studentId;

  const query = {
    messageType: messageType as any, // Cast to any to avoid type issues
    hasAttachments: hasAttachments === 'true',
    dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
    dateTo: dateTo ? new Date(dateTo as string) : undefined,
    limit: parseInt(limit as string),
    offset: parseInt(offset as string),
    sortBy: sortBy as 'createdAt' | 'status',
    sortOrder: sortOrder as 'asc' | 'desc',
    search: search as string,
  };

  const result = await messagingService.getMessages(conversationId, userId, userType, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Messages retrieved successfully',
    data: result,
  });
});

/**
 * Send a message
 */
const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const { conversationId, content, messageType, replyTo } = req.body;
  const user = (req as any).user;
  const files = req.files as Express.Multer.File[];

  const userType = user.role === 'teacher' ? 'teacher' : 'student';
  const userId = user.role === 'teacher' ? user.teacherId : user.studentId;

  const message = await messagingService.sendMessage(
    {
      conversationId,
      content,
      messageType,
      replyTo,
    },
    userId,
    userType,
    files
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Message sent successfully',
    data: message,
  });
});

/**
 * Mark messages as read
 */
const markMessagesAsRead = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const user = (req as any).user;

  const userType = user.role === 'teacher' ? 'teacher' : 'student';
  const userId = user.role === 'teacher' ? user.teacherId : user.studentId;

  await messagingService.markMessagesAsRead(conversationId, userId, userType);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Messages marked as read successfully',
    data: null,
  });
});

/**
 * Search messages
 */
const searchMessages = catchAsync(async (req: Request, res: Response) => {
  const { searchTerm, courseId } = req.query;
  const user = (req as any).user;

  if (!searchTerm) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Search term is required');
  }

  const userType = user.role === 'teacher' ? 'teacher' : 'student';
  const userId = user.role === 'teacher' ? user.teacherId : user.studentId;

  const messages = await messagingService.searchMessages(
    userId,
    userType,
    searchTerm as string,
    courseId as string
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Messages searched successfully',
    data: messages,
  });
});

/**
 * Get messaging eligible courses for a student
 */
const getMessagingEligibleCourses = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.role !== 'student') {
    throw new AppError(httpStatus.FORBIDDEN, 'Only students can access this endpoint');
  }

  const courses = await validationService.getMessagingEligibleCourses(user.studentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Messaging eligible courses retrieved successfully',
    data: courses,
  });
});

/**
 * Validate conversation permissions
 */
const validateConversationPermissions = catchAsync(async (req: Request, res: Response) => {
  const { teacherId, studentId, courseId } = req.body;
  const user = (req as any).user;

  // Validate user can check these permissions
  if (user.role === 'student' && user.studentId !== studentId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Students can only check their own permissions');
  }

  if (user.role === 'teacher' && user.teacherId !== teacherId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Teachers can only check their own permissions');
  }

  const validation = await validationService.validateStudentEnrollment(
    studentId,
    teacherId,
    courseId
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
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
});

/**
 * Archive/Unarchive conversation
 */
const toggleConversationArchive = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { isArchived } = req.body;
  const user = (req as any).user;
  const userId = user.teacherId || user.studentId;
  const userType = user.role;

  const result = await messagingService.toggleConversationArchive(
    conversationId,
    userId,
    userType,
    isArchived
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Conversation ${isArchived ? 'archived' : 'unarchived'} successfully`,
    data: result,
  });
});

/**
 * Delete conversation (soft delete)
 */
const deleteConversation = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const user = (req as any).user;
  const userId = user.teacherId || user.studentId;
  const userType = user.role;

  // For now, we'll archive the conversation instead of deleting
  const result = await messagingService.toggleConversationArchive(
    conversationId,
    userId,
    userType,
    true
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Conversation deleted successfully',
    data: result,
  });
});

/**
 * Get conversation details
 */
const getConversationDetails = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const user = (req as any).user;
  const userId = user.teacherId || user.studentId;
  const userType = user.role;

  const details = await messagingService.getConversationDetails(
    conversationId,
    userId,
    userType
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Conversation details retrieved successfully',
    data: details,
  });
});

/**
 * Advanced message search
 */
const searchMessagesAdvanced = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const {
    query,
    courseId,
    dateFrom,
    dateTo,
    messageType,
    hasAttachments,
    limit,
    offset
  } = req.query;

  const userType = user.role === 'teacher' ? 'teacher' : 'student';
  const userId = user.role === 'teacher' ? user.teacherId : user.studentId;

  const searchParams = {
    query: query as string,
    courseId: courseId as string,
    dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
    dateTo: dateTo ? new Date(dateTo as string) : undefined,
    messageType: messageType as any,
    hasAttachments: hasAttachments === 'true',
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  };

  const result = await messagingService.searchMessagesAdvanced(userId, userType, searchParams);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Advanced message search completed successfully',
    data: result,
  });
});

/**
 * Get messaging statistics for teacher dashboard
 */
const getMessagingStatistics = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { period = 'monthly' } = req.query;
  const user = (req as any).user;

  // Validate teacher ID matches authenticated user
  if (user.role === 'teacher' && user.teacherId !== teacherId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You can only access your own messaging statistics');
  }

  const statistics = await messagingService.getMessagingStatistics(
    teacherId,
    period as 'daily' | 'weekly' | 'monthly'
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Messaging statistics retrieved successfully',
    data: statistics,
  });
});

/**
 * Get conversation details with enhanced information
 */
const getConversationDetailsEnhanced = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const user = (req as any).user;

  const userType = user.role === 'teacher' ? 'teacher' : 'student';
  const userId = user.role === 'teacher' ? user.teacherId : user.studentId;

  // Get conversation and validate permissions
  const conversation = await messagingService.getConversationDetails(conversationId, userId, userType);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Enhanced conversation details retrieved successfully',
    data: conversation,
  });
});

/**
 * Get user message folders (compatibility endpoint)
 */
const getUserMessageFolders = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = (req as any).user;

  console.log('🔍 getUserMessageFolders Debug Info:');
  console.log('- Requested userId:', userId);
  console.log('- Authenticated user._id:', user._id);
  console.log('- Authenticated user.role:', user.role);

  // Enhanced user access validation
  // Allow access if:
  // 1. User is admin
  // 2. User._id matches requested userId (direct match)
  // 3. For teachers: check if the requested userId is their User._id
  let hasAccess = false;

  if (user.role === 'admin') {
    hasAccess = true;
    console.log('✅ Access granted: Admin user');
  } else if (user._id === userId) {
    hasAccess = true;
    console.log('✅ Access granted: Direct user ID match');
  } else {
    // For teachers, the frontend might be using their User._id
    // but the authenticated user._id is also the User._id, so this should match
    console.log('❌ Access denied: User ID mismatch');
    console.log('- This might indicate the frontend is using wrong user ID');
    console.log('- Expected: user._id should match requested userId');
  }

  if (!hasAccess) {
    throw new AppError(httpStatus.FORBIDDEN, 'You can only access your own message folders');
  }

  // Return default folder structure for new users
  const defaultFolders = [
    { id: 'inbox', name: 'Inbox', type: 'inbox', unreadCount: 0 },
    { id: 'sent', name: 'Sent', type: 'sent', unreadCount: 0 },
    { id: 'archived', name: 'Archived', type: 'archived', unreadCount: 0 },
    { id: 'trash', name: 'Trash', type: 'trash', unreadCount: 0 }
  ];

  console.log('✅ Returning default folders for user:', userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Message folders retrieved successfully',
    data: defaultFolders,
  });
});

/**
 * Get user message stats (compatibility endpoint)
 */
const getUserMessageStats = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { period = 'week' } = req.query;
  const user = (req as any).user;

  console.log('🔍 getUserMessageStats Debug Info:');
  console.log('- Requested userId:', userId);
  console.log('- Authenticated user._id:', user._id);
  console.log('- Authenticated user.role:', user.role);
  console.log('- Period:', period);

  // Enhanced user access validation (same logic as folders)
  let hasAccess = false;

  if (user.role === 'admin') {
    hasAccess = true;
    console.log('✅ Access granted: Admin user');
  } else if (user._id === userId) {
    hasAccess = true;
    console.log('✅ Access granted: Direct user ID match');
  } else {
    console.log('❌ Access denied: User ID mismatch');
  }

  if (!hasAccess) {
    throw new AppError(httpStatus.FORBIDDEN, 'You can only access your own message stats');
  }

  // Return empty stats for new users
  const emptyStats = {
    totalMessages: 0,
    unreadMessages: 0,
    sentMessages: 0,
    receivedMessages: 0,
    averageResponseTime: 0,
    period: period as string
  };

  console.log('✅ Returning empty stats for user:', userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Message statistics retrieved successfully',
    data: emptyStats,
  });
});

/**
 * Get user message threads (compatibility endpoint)
 */
const getUserMessageThreads = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { page = 1, limit = 20, folderType = 'inbox' } = req.query;
  const user = (req as any).user;

  console.log('🔍 getUserMessageThreads Debug Info:');
  console.log('- Requested userId:', userId);
  console.log('- Authenticated user._id:', user._id);
  console.log('- Authenticated user.role:', user.role);
  console.log('- Folder type:', folderType);
  console.log('- Page:', page, 'Limit:', limit);

  // Enhanced user access validation (same logic as folders and stats)
  let hasAccess = false;

  if (user.role === 'admin') {
    hasAccess = true;
    console.log('✅ Access granted: Admin user');
  } else if (user._id === userId) {
    hasAccess = true;
    console.log('✅ Access granted: Direct user ID match');
  } else {
    console.log('❌ Access denied: User ID mismatch');
  }

  if (!hasAccess) {
    throw new AppError(httpStatus.FORBIDDEN, 'You can only access your own message threads');
  }

  // Return empty threads for new users
  const emptyThreads = {
    data: [],
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total: 0,
      totalPages: 0
    },
    folderType: folderType as string
  };

  console.log('✅ Returning empty threads for user:', userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Message threads retrieved successfully',
    data: emptyThreads,
  });
});

export const MessagingController = {
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
