import { z } from 'zod';
import { MessageType } from './messaging.interface';

// Common validation schemas
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

const paginationSchema = z.object({
  limit: z.string().optional().transform((val) => val ? parseInt(val) : 20).refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  offset: z.string().optional().transform((val) => val ? parseInt(val) : 0).refine((val) => val >= 0, 'Offset must be non-negative'),
});

const dateSchema = z.string().refine((date) => {
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}, 'Invalid date format');

// Create conversation validation
export const createConversationValidation = z.object({
  body: z.object({
    courseId: objectIdSchema,
    teacherId: objectIdSchema,
    studentId: objectIdSchema,
    title: z.string().min(1).max(200).optional(),
    initialMessage: z.string().min(1).max(5000).optional(),
  }),
});

// Get conversations validation
export const getConversationsValidation = z.object({
  query: z.object({
    ...paginationSchema.shape,
    courseId: objectIdSchema.optional(),
    isActive: z.string().optional().transform((val) => val === 'true'),
    isArchived: z.string().optional().transform((val) => val === 'true'),
    sortBy: z.enum(['lastMessageAt', 'createdAt']).optional().default('lastMessageAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    search: z.string().optional(),
  }),
});

// Get messages validation
export const getMessagesValidation = z.object({
  params: z.object({
    conversationId: objectIdSchema,
  }),
  query: z.object({
    ...paginationSchema.shape,
    messageType: z.nativeEnum(MessageType).optional(),
    hasAttachments: z.string().optional().transform((val) => val === 'true'),
    dateFrom: dateSchema.optional(),
    dateTo: dateSchema.optional(),
    sortBy: z.enum(['createdAt', 'status']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
    search: z.string().optional(),
  }).refine((data) => {
    // If dateFrom is provided, dateTo must also be provided
    if (data.dateFrom && !data.dateTo) {
      return false;
    }
    if (data.dateTo && !data.dateFrom) {
      return false;
    }
    // If both dates are provided, dateFrom must be before dateTo
    if (data.dateFrom && data.dateTo) {
      return new Date(data.dateFrom) < new Date(data.dateTo);
    }
    return true;
  }, 'Invalid date range: dateFrom must be before dateTo, and both must be provided together'),
});

// Send message validation
export const sendMessageValidation = z.object({
  body: z.object({
    conversationId: objectIdSchema,
    content: z.string().min(1).max(5000),
    messageType: z.nativeEnum(MessageType).optional().default(MessageType.TEXT),
    replyTo: objectIdSchema.optional(),
  }),
});

// Mark messages as read validation
export const markMessagesAsReadValidation = z.object({
  params: z.object({
    conversationId: objectIdSchema,
  }),
});

// Search messages validation
export const searchMessagesValidation = z.object({
  query: z.object({
    searchTerm: z.string().min(1).max(100),
    courseId: objectIdSchema.optional(),
  }),
});

// Validate conversation permissions
export const validateConversationPermissionsValidation = z.object({
  body: z.object({
    teacherId: objectIdSchema,
    studentId: objectIdSchema,
    courseId: objectIdSchema,
  }),
});

// Toggle conversation archive validation
export const toggleConversationArchiveValidation = z.object({
  params: z.object({
    conversationId: objectIdSchema,
  }),
  body: z.object({
    isArchived: z.boolean(),
  }),
});

// Delete conversation validation
export const deleteConversationValidation = z.object({
  params: z.object({
    conversationId: objectIdSchema,
  }),
});

// Get conversation details validation
export const getConversationDetailsValidation = z.object({
  params: z.object({
    conversationId: objectIdSchema,
  }),
});

// File upload validation (for middleware)
export const fileUploadValidation = z.object({
  files: z.array(z.object({
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z.string(),
    size: z.number().max(50 * 1024 * 1024, 'File size must be less than 50MB'),
    buffer: z.instanceof(Buffer),
  })).max(5, 'Maximum 5 files allowed per message').optional(),
});

// Message content sanitization
export const sanitizeMessageContent = (content: string): string => {
  // Remove potentially harmful content
  let sanitized = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();

  // Limit length
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000) + '...';
  }

  return sanitized;
};

// Validate file types
export const validateFileType = (mimeType: string, userType: 'student' | 'teacher'): boolean => {
  const allowedTypes = {
    student: [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
    ],
    teacher: [
      // All student types plus additional
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      // Audio/Video
      'audio/mpeg',
      'audio/wav',
      'video/mp4',
      'video/webm',
    ],
  };

  return allowedTypes[userType].includes(mimeType);
};

// Validate file size
export const validateFileSize = (fileSize: number, userType: 'student' | 'teacher'): boolean => {
  const maxSizes = {
    student: 10 * 1024 * 1024, // 10MB
    teacher: 50 * 1024 * 1024, // 50MB
  };

  return fileSize <= maxSizes[userType];
};

// Conversation query validation
export const conversationQueryValidation = z.object({
  teacherId: objectIdSchema.optional(),
  studentId: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
  isActive: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
  sortBy: z.enum(['lastMessageAt', 'createdAt']).optional().default('lastMessageAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
});

// Message query validation
export const messageQueryValidation = z.object({
  conversationId: objectIdSchema.optional(),
  senderId: objectIdSchema.optional(),
  receiverId: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
  messageType: z.nativeEnum(MessageType).optional(),
  hasAttachments: z.boolean().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
  sortBy: z.enum(['createdAt', 'status']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  search: z.string().optional(),
});

// Bulk operations validation
export const bulkMarkMessagesAsReadValidation = z.object({
  body: z.object({
    messageIds: z.array(objectIdSchema).min(1).max(50),
  }),
});

export const bulkDeleteMessagesValidation = z.object({
  body: z.object({
    messageIds: z.array(objectIdSchema).min(1).max(50),
  }),
});

// Real-time events validation
export const typingIndicatorValidation = z.object({
  conversationId: objectIdSchema,
  isTyping: z.boolean(),
});

export const joinConversationValidation = z.object({
  conversationId: objectIdSchema,
});

// Export all validation schemas
export const MessagingValidation = {
  createConversation: createConversationValidation,
  getConversations: getConversationsValidation,
  getMessages: getMessagesValidation,
  sendMessage: sendMessageValidation,
  markMessagesAsRead: markMessagesAsReadValidation,
  searchMessages: searchMessagesValidation,
  validateConversationPermissions: validateConversationPermissionsValidation,
  toggleConversationArchive: toggleConversationArchiveValidation,
  deleteConversation: deleteConversationValidation,
  getConversationDetails: getConversationDetailsValidation,
  fileUpload: fileUploadValidation,
  conversationQuery: conversationQueryValidation,
  messageQuery: messageQueryValidation,
  bulkMarkMessagesAsRead: bulkMarkMessagesAsReadValidation,
  bulkDeleteMessages: bulkDeleteMessagesValidation,
  typingIndicator: typingIndicatorValidation,
  joinConversation: joinConversationValidation,
};
