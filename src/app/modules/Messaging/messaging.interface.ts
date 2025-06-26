import { Document, Types } from 'mongoose';

// Message Status Enum
export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

// Message Type Enum
export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document'
}

// Conversation Type Enum
export enum ConversationType {
  STUDENT_TEACHER = 'student_teacher',
  GROUP = 'group',
  ANNOUNCEMENT = 'announcement'
}

// File Attachment Interface
export interface IFileAttachment {
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  publicId?: string; // For Cloudinary
  uploadedAt: Date;
}

// Message Interface
export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderType: 'student' | 'teacher';
  receiverId: Types.ObjectId;
  receiverType: 'student' | 'teacher';
  courseId: Types.ObjectId;
  messageType: MessageType;
  content: string;
  attachments: IFileAttachment[];
  status: MessageStatus;
  isEdited: boolean;
  editedAt?: Date;
  replyTo?: Types.ObjectId; // Reference to another message
  metadata: {
    deviceInfo?: string;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: any;
  };
  readAt?: Date;
  deliveredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Conversation Interface
export interface IConversation extends Document {
  courseId: Types.ObjectId;
  teacherId: Types.ObjectId;
  studentId: Types.ObjectId;
  type: ConversationType;
  title: string;
  lastMessage?: Types.ObjectId;
  lastMessageAt?: Date;
  unreadCount: {
    teacher: number;
    student: number;
  };
  isActive: boolean;
  isArchived: boolean;
  participants: {
    userId: Types.ObjectId;
    userType: 'student' | 'teacher';
    joinedAt: Date;
    lastSeenAt?: Date;
    role?: 'admin' | 'member';
  }[];
  settings: {
    allowFileSharing: boolean;
    allowNotifications: boolean;
    autoArchiveAfterDays?: number;
  };
  metadata: {
    totalMessages: number;
    totalFiles: number;
    createdBy: Types.ObjectId;
    tags?: string[];
    priority?: 'low' | 'medium' | 'high';
  };
  createdAt?: Date;
  updatedAt?: Date;
}

// Message Thread Interface (for organizing related messages)
export interface IMessageThread extends Document {
  conversationId: Types.ObjectId;
  parentMessageId: Types.ObjectId;
  messages: Types.ObjectId[];
  title?: string;
  isResolved: boolean;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  createdAt?: Date;
  updatedAt?: Date;
}

// Notification Interface for messaging
export interface IMessageNotification extends Document {
  userId: Types.ObjectId;
  userType: 'student' | 'teacher';
  messageId: Types.ObjectId;
  conversationId: Types.ObjectId;
  type: 'new_message' | 'message_read' | 'conversation_created';
  title: string;
  content: string;
  isRead: boolean;
  readAt?: Date;
  actionUrl?: string;
  metadata: {
    senderName: string;
    courseName: string;
    [key: string]: any;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

// Message Search Index Interface
export interface IMessageSearchIndex extends Document {
  messageId: Types.ObjectId;
  conversationId: Types.ObjectId;
  courseId: Types.ObjectId;
  teacherId: Types.ObjectId;
  studentId: Types.ObjectId;
  content: string;
  searchableContent: string; // Processed content for search
  attachmentNames: string[];
  tags: string[];
  createdAt: Date;
}

// Query Interfaces
export interface IConversationQuery {
  teacherId?: string;
  studentId?: string;
  courseId?: string;
  type?: ConversationType;
  isActive?: boolean;
  isArchived?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'lastMessageAt' | 'createdAt' | 'unreadCount';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface IMessageQuery {
  conversationId?: string;
  senderId?: string;
  receiverId?: string;
  courseId?: string;
  messageType?: MessageType;
  status?: MessageStatus;
  hasAttachments?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// DTO Interfaces for API requests/responses
export interface ICreateConversationDTO {
  courseId: string;
  teacherId: string;
  studentId: string;
  title?: string;
  initialMessage?: string;
}

export interface ISendMessageDTO {
  conversationId: string;
  content: string;
  messageType?: MessageType;
  replyTo?: string;
  attachments?: any[];
}

export interface IConversationResponseDTO {
  id: string;
  courseId: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  title: string;
  lastMessage?: {
    id: string;
    content: string;
    senderName: string;
    createdAt: Date;
  };
  unreadCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageResponseDTO {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderType: 'student' | 'teacher';
  content: string;
  messageType: MessageType;
  attachments: IFileAttachment[];
  status: MessageStatus;
  isEdited: boolean;
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Validation Interfaces
export interface IMessageValidation {
  maxContentLength: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  maxAttachmentsPerMessage: number;
  rateLimitPerMinute: number;
}

// Real-time Event Interfaces
export interface IMessageEvent {
  type: 'message_sent' | 'message_read' | 'typing_start' | 'typing_stop' | 'user_online' | 'user_offline';
  conversationId: string;
  userId: string;
  userType: 'student' | 'teacher';
  data?: any;
  timestamp: Date;
}

export interface ITypingIndicator {
  conversationId: string;
  userId: string;
  userType: 'student' | 'teacher';
  isTyping: boolean;
  timestamp: Date;
}
