"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingValidation = exports.joinConversationValidation = exports.typingIndicatorValidation = exports.bulkDeleteMessagesValidation = exports.bulkMarkMessagesAsReadValidation = exports.messageQueryValidation = exports.conversationQueryValidation = exports.validateFileSize = exports.validateFileType = exports.sanitizeMessageContent = exports.fileUploadValidation = exports.getConversationDetailsValidation = exports.deleteConversationValidation = exports.toggleConversationArchiveValidation = exports.validateConversationPermissionsValidation = exports.searchMessagesValidation = exports.markMessagesAsReadValidation = exports.sendMessageValidation = exports.getMessagesValidation = exports.getConversationsValidation = exports.createConversationValidation = void 0;
const zod_1 = require("zod");
const messaging_interface_1 = require("./messaging.interface");
// Common validation schemas
const objectIdSchema = zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');
const paginationSchema = zod_1.z.object({
    limit: zod_1.z.string().optional().transform((val) => val ? parseInt(val) : 20).refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
    offset: zod_1.z.string().optional().transform((val) => val ? parseInt(val) : 0).refine((val) => val >= 0, 'Offset must be non-negative'),
});
const dateSchema = zod_1.z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
}, 'Invalid date format');
// Create conversation validation
exports.createConversationValidation = zod_1.z.object({
    body: zod_1.z.object({
        courseId: objectIdSchema,
        teacherId: objectIdSchema,
        studentId: objectIdSchema,
        title: zod_1.z.string().min(1).max(200).optional(),
        initialMessage: zod_1.z.string().min(1).max(5000).optional(),
    }),
});
// Get conversations validation
exports.getConversationsValidation = zod_1.z.object({
    query: zod_1.z.object(Object.assign(Object.assign({}, paginationSchema.shape), { courseId: objectIdSchema.optional(), isActive: zod_1.z.string().optional().transform((val) => val === 'true'), isArchived: zod_1.z.string().optional().transform((val) => val === 'true'), sortBy: zod_1.z.enum(['lastMessageAt', 'createdAt']).optional().default('lastMessageAt'), sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'), search: zod_1.z.string().optional() })),
});
// Get messages validation
exports.getMessagesValidation = zod_1.z.object({
    params: zod_1.z.object({
        conversationId: objectIdSchema,
    }),
    query: zod_1.z.object(Object.assign(Object.assign({}, paginationSchema.shape), { messageType: zod_1.z.nativeEnum(messaging_interface_1.MessageType).optional(), hasAttachments: zod_1.z.string().optional().transform((val) => val === 'true'), dateFrom: dateSchema.optional(), dateTo: dateSchema.optional(), sortBy: zod_1.z.enum(['createdAt', 'status']).optional().default('createdAt'), sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('asc'), search: zod_1.z.string().optional() })).refine((data) => {
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
exports.sendMessageValidation = zod_1.z.object({
    body: zod_1.z.object({
        conversationId: objectIdSchema,
        content: zod_1.z.string().min(1).max(5000),
        messageType: zod_1.z.nativeEnum(messaging_interface_1.MessageType).optional().default(messaging_interface_1.MessageType.TEXT),
        replyTo: objectIdSchema.optional(),
    }),
});
// Mark messages as read validation
exports.markMessagesAsReadValidation = zod_1.z.object({
    params: zod_1.z.object({
        conversationId: objectIdSchema,
    }),
});
// Search messages validation
exports.searchMessagesValidation = zod_1.z.object({
    query: zod_1.z.object({
        searchTerm: zod_1.z.string().min(1).max(100),
        courseId: objectIdSchema.optional(),
    }),
});
// Validate conversation permissions
exports.validateConversationPermissionsValidation = zod_1.z.object({
    body: zod_1.z.object({
        teacherId: objectIdSchema,
        studentId: objectIdSchema,
        courseId: objectIdSchema,
    }),
});
// Toggle conversation archive validation
exports.toggleConversationArchiveValidation = zod_1.z.object({
    params: zod_1.z.object({
        conversationId: objectIdSchema,
    }),
    body: zod_1.z.object({
        isArchived: zod_1.z.boolean(),
    }),
});
// Delete conversation validation
exports.deleteConversationValidation = zod_1.z.object({
    params: zod_1.z.object({
        conversationId: objectIdSchema,
    }),
});
// Get conversation details validation
exports.getConversationDetailsValidation = zod_1.z.object({
    params: zod_1.z.object({
        conversationId: objectIdSchema,
    }),
});
// File upload validation (for middleware)
exports.fileUploadValidation = zod_1.z.object({
    files: zod_1.z.array(zod_1.z.object({
        fieldname: zod_1.z.string(),
        originalname: zod_1.z.string(),
        encoding: zod_1.z.string(),
        mimetype: zod_1.z.string(),
        size: zod_1.z.number().max(50 * 1024 * 1024, 'File size must be less than 50MB'),
        buffer: zod_1.z.instanceof(Buffer),
    })).max(5, 'Maximum 5 files allowed per message').optional(),
});
// Message content sanitization
const sanitizeMessageContent = (content) => {
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
exports.sanitizeMessageContent = sanitizeMessageContent;
// Validate file types
const validateFileType = (mimeType, userType) => {
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
exports.validateFileType = validateFileType;
// Validate file size
const validateFileSize = (fileSize, userType) => {
    const maxSizes = {
        student: 10 * 1024 * 1024, // 10MB
        teacher: 50 * 1024 * 1024, // 50MB
    };
    return fileSize <= maxSizes[userType];
};
exports.validateFileSize = validateFileSize;
// Conversation query validation
exports.conversationQueryValidation = zod_1.z.object({
    teacherId: objectIdSchema.optional(),
    studentId: objectIdSchema.optional(),
    courseId: objectIdSchema.optional(),
    isActive: zod_1.z.boolean().optional(),
    isArchived: zod_1.z.boolean().optional(),
    limit: zod_1.z.number().min(1).max(100).optional().default(20),
    offset: zod_1.z.number().min(0).optional().default(0),
    sortBy: zod_1.z.enum(['lastMessageAt', 'createdAt']).optional().default('lastMessageAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
    search: zod_1.z.string().optional(),
});
// Message query validation
exports.messageQueryValidation = zod_1.z.object({
    conversationId: objectIdSchema.optional(),
    senderId: objectIdSchema.optional(),
    receiverId: objectIdSchema.optional(),
    courseId: objectIdSchema.optional(),
    messageType: zod_1.z.nativeEnum(messaging_interface_1.MessageType).optional(),
    hasAttachments: zod_1.z.boolean().optional(),
    dateFrom: zod_1.z.date().optional(),
    dateTo: zod_1.z.date().optional(),
    limit: zod_1.z.number().min(1).max(100).optional().default(50),
    offset: zod_1.z.number().min(0).optional().default(0),
    sortBy: zod_1.z.enum(['createdAt', 'status']).optional().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('asc'),
    search: zod_1.z.string().optional(),
});
// Bulk operations validation
exports.bulkMarkMessagesAsReadValidation = zod_1.z.object({
    body: zod_1.z.object({
        messageIds: zod_1.z.array(objectIdSchema).min(1).max(50),
    }),
});
exports.bulkDeleteMessagesValidation = zod_1.z.object({
    body: zod_1.z.object({
        messageIds: zod_1.z.array(objectIdSchema).min(1).max(50),
    }),
});
// Real-time events validation
exports.typingIndicatorValidation = zod_1.z.object({
    conversationId: objectIdSchema,
    isTyping: zod_1.z.boolean(),
});
exports.joinConversationValidation = zod_1.z.object({
    conversationId: objectIdSchema,
});
// Export all validation schemas
exports.MessagingValidation = {
    createConversation: exports.createConversationValidation,
    getConversations: exports.getConversationsValidation,
    getMessages: exports.getMessagesValidation,
    sendMessage: exports.sendMessageValidation,
    markMessagesAsRead: exports.markMessagesAsReadValidation,
    searchMessages: exports.searchMessagesValidation,
    validateConversationPermissions: exports.validateConversationPermissionsValidation,
    toggleConversationArchive: exports.toggleConversationArchiveValidation,
    deleteConversation: exports.deleteConversationValidation,
    getConversationDetails: exports.getConversationDetailsValidation,
    fileUpload: exports.fileUploadValidation,
    conversationQuery: exports.conversationQueryValidation,
    messageQuery: exports.messageQueryValidation,
    bulkMarkMessagesAsRead: exports.bulkMarkMessagesAsReadValidation,
    bulkDeleteMessages: exports.bulkDeleteMessagesValidation,
    typingIndicator: exports.typingIndicatorValidation,
    joinConversation: exports.joinConversationValidation,
};
