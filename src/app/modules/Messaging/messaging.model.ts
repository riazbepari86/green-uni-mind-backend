import { model, Schema } from 'mongoose';
import {
  IMessage,
  IConversation,
  IMessageThread,
  IMessageNotification,
  IMessageSearchIndex,
  MessageStatus,
  MessageType,
  ConversationType,
  IFileAttachment
} from './messaging.interface';

// File Attachment Schema
const fileAttachmentSchema = new Schema<IFileAttachment>({
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  originalName: {
    type: String,
    required: true,
    trim: true,
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0,
  },
  mimeType: {
    type: String,
    required: true,
    trim: true,
  },
  fileUrl: {
    type: String,
    required: true,
    trim: true,
  },
  publicId: {
    type: String,
    trim: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

// Message Schema
const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    senderType: {
      type: String,
      enum: ['student', 'teacher'],
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    receiverType: {
      type: String,
      enum: ['student', 'teacher'],
      required: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    messageType: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.TEXT,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    attachments: [fileAttachmentSchema],
    status: {
      type: String,
      enum: Object.values(MessageStatus),
      default: MessageStatus.SENT,
      index: true,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Conversation Schema
const conversationSchema = new Schema<IConversation>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(ConversationType),
      default: ConversationType.STUDENT_TEACHER,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    lastMessageAt: {
      type: Date,
      index: true,
    },
    unreadCount: {
      teacher: { type: Number, default: 0, min: 0 },
      student: { type: Number, default: 0, min: 0 },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    participants: [{
      userId: {
        type: Schema.Types.ObjectId,
        required: true,
      },
      userType: {
        type: String,
        enum: ['student', 'teacher'],
        required: true,
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      lastSeenAt: {
        type: Date,
      },
      role: {
        type: String,
        enum: ['admin', 'member'],
        default: 'member',
      },
    }],
    settings: {
      allowFileSharing: { type: Boolean, default: true },
      allowNotifications: { type: Boolean, default: true },
      autoArchiveAfterDays: { type: Number, min: 1 },
    },
    metadata: {
      totalMessages: { type: Number, default: 0, min: 0 },
      totalFiles: { type: Number, default: 0, min: 0 },
      createdBy: { type: Schema.Types.ObjectId, required: true },
      tags: [{ type: String, trim: true }],
      priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Message Thread Schema
const messageThreadSchema = new Schema<IMessageThread>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    parentMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
    },
    messages: [{
      type: Schema.Types.ObjectId,
      ref: 'Message',
    }],
    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    isResolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
    },
    resolvedAt: {
      type: Date,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Message Notification Schema
const messageNotificationSchema = new Schema<IMessageNotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userType: {
      type: String,
      enum: ['student', 'teacher'],
      required: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    type: {
      type: String,
      enum: ['new_message', 'message_read', 'conversation_created'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    actionUrl: {
      type: String,
      trim: true,
    },
    metadata: {
      senderName: { type: String, required: true },
      courseName: { type: String, required: true },
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Message Search Index Schema
const messageSearchIndexSchema = new Schema<IMessageSearchIndex>(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
      unique: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    searchableContent: {
      type: String,
      required: true,
    },
    attachmentNames: [{
      type: String,
    }],
    tags: [{
      type: String,
    }],
    createdAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Create indexes for better performance
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ courseId: 1, createdAt: -1 });
messageSchema.index({ status: 1, createdAt: -1 });

conversationSchema.index({ teacherId: 1, studentId: 1, courseId: 1 }, { unique: true });
conversationSchema.index({ teacherId: 1, lastMessageAt: -1 });
conversationSchema.index({ studentId: 1, lastMessageAt: -1 });
conversationSchema.index({ courseId: 1, isActive: 1 });

messageThreadSchema.index({ conversationId: 1, isResolved: 1 });
messageThreadSchema.index({ parentMessageId: 1 });

messageNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
messageNotificationSchema.index({ conversationId: 1, createdAt: -1 });

messageSearchIndexSchema.index({ searchableContent: 'text', attachmentNames: 'text' });
messageSearchIndexSchema.index({ teacherId: 1, createdAt: -1 });
messageSearchIndexSchema.index({ courseId: 1, createdAt: -1 });

// Export models
export const Message = model<IMessage>('Message', messageSchema);
export const Conversation = model<IConversation>('Conversation', conversationSchema);
export const MessageThread = model<IMessageThread>('MessageThread', messageThreadSchema);
export const MessageNotification = model<IMessageNotification>('MessageNotification', messageNotificationSchema);
export const MessageSearchIndex = model<IMessageSearchIndex>('MessageSearchIndex', messageSearchIndexSchema);
