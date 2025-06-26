import { Types } from 'mongoose';
import {
  Message,
  Conversation,
  MessageNotification,
  MessageSearchIndex
} from '../../modules/Messaging/messaging.model';
import {
  IMessage,
  IConversation,
  ICreateConversationDTO,
  ISendMessageDTO,
  IConversationResponseDTO,
  IMessageResponseDTO,
  IConversationQuery,
  IMessageQuery,
  MessageStatus,
  MessageType
} from '../../modules/Messaging/messaging.interface';
import { Student } from '../../modules/Student/student.model';
import { Teacher } from '../../modules/Teacher/teacher.model';
import { Course } from '../../modules/Course/course.model';
import { Logger } from '../../config/logger';
import MessagingValidationService from './MessagingValidationService';
import FileUploadService from './FileUploadService';
import ActivityTrackingService from '../activity/ActivityTrackingService';
import { redisOperations } from '../../config/redis';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

class MessagingService {
  private validationService: MessagingValidationService;
  private fileUploadService: FileUploadService;
  // WebSocket service removed - real-time messaging will be handled by SSE/Polling
  private activityTrackingService: ActivityTrackingService | null = null;

  constructor() {
    this.validationService = new MessagingValidationService();
    this.fileUploadService = new FileUploadService();
  }

  // WebSocket service setter removed - real-time messaging handled by SSE/Polling

  public setActivityTrackingService(activityTrackingService: ActivityTrackingService): void {
    this.activityTrackingService = activityTrackingService;
  }

  /**
   * Create a new conversation between student and teacher
   */
  public async createConversation(data: ICreateConversationDTO): Promise<IConversationResponseDTO> {
    try {
      // Enhanced enrollment validation
      const enrollmentValidation = await this.validateStudentEnrollment(
        data.studentId,
        data.teacherId,
        data.courseId
      );

      if (!enrollmentValidation.isValid) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `Cannot create conversation: ${enrollmentValidation.reason}`
        );
      }

      // Additional security checks
      await this.performSecurityChecks(data.studentId, data.teacherId, data.courseId);

      // Check if conversation already exists
      const existingConversation = await Conversation.findOne({
        teacherId: new Types.ObjectId(data.teacherId),
        studentId: new Types.ObjectId(data.studentId),
        courseId: new Types.ObjectId(data.courseId),
      });

      if (existingConversation) {
        return this.formatConversationResponse(existingConversation);
      }

      // Get course and participant details
      const [course, teacher, student] = await Promise.all([
        Course.findById(data.courseId).select('title'),
        Teacher.findById(data.teacherId).populate('user', 'email'),
        Student.findById(data.studentId).populate('user', 'email'),
      ]);

      if (!course || !teacher || !student) {
        throw new AppError(httpStatus.NOT_FOUND, 'Course, teacher, or student not found');
      }

      // Create conversation
      const conversation = new Conversation({
        courseId: new Types.ObjectId(data.courseId),
        teacherId: new Types.ObjectId(data.teacherId),
        studentId: new Types.ObjectId(data.studentId),
        title: data.title || `${course.title} - Discussion`,
        participants: [
          {
            userId: new Types.ObjectId(data.teacherId),
            userType: 'teacher',
            joinedAt: new Date(),
            role: 'admin',
          },
          {
            userId: new Types.ObjectId(data.studentId),
            userType: 'student',
            joinedAt: new Date(),
            role: 'member',
          },
        ],
        metadata: {
          totalMessages: 0,
          totalFiles: 0,
          createdBy: new Types.ObjectId(data.studentId),
        },
      });

      const savedConversation = await conversation.save();

      // Send initial message if provided
      if (data.initialMessage) {
        await this.sendMessage({
          conversationId: (savedConversation._id as any).toString(),
          content: data.initialMessage,
          messageType: MessageType.TEXT,
        }, data.studentId, 'student');
      }

      // Track activity
      if (this.activityTrackingService) {
        await this.activityTrackingService.trackMessage(
          data.teacherId,
          data.courseId,
          data.studentId,
          { conversationId: (savedConversation._id as any).toString() }
        );
      }

      Logger.info(`💬 Conversation created: ${savedConversation._id}`);
      return this.formatConversationResponse(savedConversation);
    } catch (error) {
      Logger.error('❌ Failed to create conversation:', error);
      throw error;
    }
  }

  /**
   * Send a message in a conversation
   */
  public async sendMessage(
    data: ISendMessageDTO,
    senderId: string,
    senderType: 'student' | 'teacher',
    files?: Express.Multer.File[]
  ): Promise<IMessageResponseDTO> {
    try {
      // Get conversation and validate permissions
      const conversation = await Conversation.findById(data.conversationId);
      if (!conversation) {
        throw new AppError(httpStatus.NOT_FOUND, 'Conversation not found');
      }

      // Validate sender is part of conversation
      const isParticipant = conversation.participants.some(
        p => p.userId.toString() === senderId && p.userType === senderType
      );

      if (!isParticipant) {
        throw new AppError(httpStatus.FORBIDDEN, 'You are not a participant in this conversation');
      }

      // Validate enrollment if sender is student
      if (senderType === 'student') {
        const validation = await this.validationService.validateStudentEnrollment(
          senderId,
          conversation.teacherId.toString(),
          conversation.courseId.toString()
        );

        if (!validation.isValid) {
          throw new AppError(httpStatus.FORBIDDEN, 'Student is not enrolled in this course');
        }
      }

      // Check rate limiting
      const canSend = await this.validationService.checkRateLimit(senderId, senderType);
      if (!canSend) {
        throw new AppError(httpStatus.TOO_MANY_REQUESTS, 'Rate limit exceeded');
      }

      // Process file attachments
      const attachments = files ? await this.fileUploadService.processUploadedFiles(
        files,
        senderType,
        data.conversationId
      ) : [];

      // Sanitize message content
      const sanitizedContent = this.validationService.sanitizeMessageContent(data.content);

      // Determine receiver
      const receiverId = senderType === 'student' 
        ? conversation.teacherId 
        : conversation.studentId;
      const receiverType = senderType === 'student' ? 'teacher' : 'student';

      // Create message
      const message = new Message({
        conversationId: new Types.ObjectId(data.conversationId),
        senderId: new Types.ObjectId(senderId),
        senderType,
        receiverId,
        receiverType,
        courseId: conversation.courseId,
        messageType: data.messageType || MessageType.TEXT,
        content: sanitizedContent,
        attachments,
        status: MessageStatus.SENT,
        replyTo: data.replyTo ? new Types.ObjectId(data.replyTo) : undefined,
        metadata: {
          deviceInfo: 'web', // TODO: Get from request headers
          ipAddress: '127.0.0.1', // TODO: Get from request
        },
      });

      const savedMessage = await message.save();

      // Update conversation
      await Conversation.findByIdAndUpdate(data.conversationId, {
        lastMessage: savedMessage._id,
        lastMessageAt: new Date(),
        $inc: {
          [`unreadCount.${receiverType}`]: 1,
          'metadata.totalMessages': 1,
          'metadata.totalFiles': attachments.length,
        },
      });

      // Create search index
      await this.createMessageSearchIndex(savedMessage);

      // Create notification
      await this.createMessageNotification(savedMessage, conversation);

      Logger.info(`📨 Message sent: ${savedMessage._id} in conversation ${data.conversationId}`);
      return this.formatMessageResponse(savedMessage);
    } catch (error) {
      Logger.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Get conversations for a user
   */
  public async getConversations(
    userId: string,
    userType: 'student' | 'teacher',
    query: IConversationQuery
  ): Promise<{ conversations: IConversationResponseDTO[]; total: number }> {
    try {
      const filter: any = {
        [`${userType}Id`]: new Types.ObjectId(userId),
        isActive: query.isActive !== undefined ? query.isActive : true,
      };

      if (query.courseId) {
        filter.courseId = new Types.ObjectId(query.courseId);
      }

      if (query.isArchived !== undefined) {
        filter.isArchived = query.isArchived;
      }

      const sortField = query.sortBy || 'lastMessageAt';
      const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

      const [conversations, total] = await Promise.all([
        Conversation.find(filter)
          .populate('courseId', 'title')
          .populate('teacherId', 'name email')
          .populate('studentId', 'name email')
          .populate('lastMessage', 'content createdAt')
          .sort({ [sortField]: sortOrder })
          .limit(query.limit || 20)
          .skip(query.offset || 0),
        Conversation.countDocuments(filter),
      ]);

      const formattedConversations = conversations.map(conv => this.formatConversationResponse(conv));

      return { conversations: formattedConversations, total };
    } catch (error) {
      Logger.error('❌ Failed to get conversations:', error);
      throw error;
    }
  }

  /**
   * Get messages in a conversation
   */
  public async getMessages(
    conversationId: string,
    userId: string,
    userType: 'student' | 'teacher',
    query: IMessageQuery
  ): Promise<{ messages: IMessageResponseDTO[]; total: number }> {
    try {
      // Validate user is part of conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new AppError(httpStatus.NOT_FOUND, 'Conversation not found');
      }

      const isParticipant = conversation.participants.some(
        p => p.userId.toString() === userId && p.userType === userType
      );

      if (!isParticipant) {
        throw new AppError(httpStatus.FORBIDDEN, 'You are not a participant in this conversation');
      }

      const filter: any = { conversationId: new Types.ObjectId(conversationId) };

      if (query.messageType) {
        filter.messageType = query.messageType;
      }

      if (query.hasAttachments) {
        filter['attachments.0'] = { $exists: true };
      }

      if (query.dateFrom || query.dateTo) {
        filter.createdAt = {};
        if (query.dateFrom) filter.createdAt.$gte = query.dateFrom;
        if (query.dateTo) filter.createdAt.$lte = query.dateTo;
      }

      const sortField = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

      const [messages, total] = await Promise.all([
        Message.find(filter)
          .populate('replyTo', 'content senderId senderType')
          .sort({ [sortField]: sortOrder })
          .limit(query.limit || 50)
          .skip(query.offset || 0),
        Message.countDocuments(filter),
      ]);

      // Mark messages as read
      await this.markMessagesAsRead(conversationId, userId, userType);

      const formattedMessages = await Promise.all(
        messages.map(msg => this.formatMessageResponse(msg))
      );

      return { messages: formattedMessages, total };
    } catch (error) {
      Logger.error('❌ Failed to get messages:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  public async markMessagesAsRead(
    conversationId: string,
    userId: string,
    userType: 'student' | 'teacher'
  ): Promise<void> {
    try {
      // Get unread messages before updating
      const unreadMessages = await Message.find({
        conversationId: new Types.ObjectId(conversationId),
        receiverId: new Types.ObjectId(userId),
        receiverType: userType,
        status: { $ne: MessageStatus.READ },
      }).select('_id');

      // Update unread messages to read
      await Message.updateMany(
        {
          conversationId: new Types.ObjectId(conversationId),
          receiverId: new Types.ObjectId(userId),
          receiverType: userType,
          status: { $ne: MessageStatus.READ },
        },
        {
          status: MessageStatus.READ,
          readAt: new Date(),
        }
      );

      // Reset unread count for user
      await Conversation.findByIdAndUpdate(conversationId, {
        [`unreadCount.${userType}`]: 0,
      });

      Logger.info(`📖 Messages marked as read in conversation ${conversationId} by ${userType} ${userId}`);
    } catch (error) {
      Logger.error('❌ Failed to mark messages as read:', error);
      throw error;
    }
  }

  /**
   * Search messages
   */
  public async searchMessages(
    userId: string,
    userType: 'student' | 'teacher',
    searchTerm: string,
    courseId?: string
  ): Promise<IMessageResponseDTO[]> {
    try {
      const filter: any = {
        [`${userType}Id`]: new Types.ObjectId(userId),
        $text: { $search: searchTerm },
      };

      if (courseId) {
        filter.courseId = new Types.ObjectId(courseId);
      }

      const searchResults = await MessageSearchIndex.find(filter)
        .limit(50)
        .sort({ createdAt: -1 });

      const messageIds = searchResults.map(result => result.messageId);
      
      const messages = await Message.find({ _id: { $in: messageIds } })
        .populate('replyTo', 'content senderId senderType')
        .sort({ createdAt: -1 });

      return Promise.all(messages.map(msg => this.formatMessageResponse(msg)));
    } catch (error) {
      Logger.error('❌ Failed to search messages:', error);
      return [];
    }
  }

  // Private helper methods
  private async createMessageSearchIndex(message: IMessage): Promise<void> {
    try {
      const searchIndex = new MessageSearchIndex({
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

      await searchIndex.save();
    } catch (error) {
      Logger.error('❌ Failed to create message search index:', error);
    }
  }

  private async createMessageNotification(message: IMessage, conversation: IConversation): Promise<void> {
    try {
      // Get sender and receiver details
      const [sender, receiver] = await Promise.all([
        message.senderType === 'teacher' 
          ? Teacher.findById(message.senderId).select('name')
          : Student.findById(message.senderId).select('name'),
        message.receiverType === 'teacher'
          ? Teacher.findById(message.receiverId).select('name')
          : Student.findById(message.receiverId).select('name'),
      ]);

      const course = await Course.findById(conversation.courseId).select('title');

      if (!sender || !receiver || !course) return;

      const senderName = `${(sender as any).name.firstName} ${(sender as any).name.lastName}`;
      const courseName = course.title;

      const notification = new MessageNotification({
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

      await notification.save();
    } catch (error) {
      Logger.error('❌ Failed to create message notification:', error);
    }
  }

  private formatConversationResponse(conversation: any): IConversationResponseDTO {
    return {
      id: conversation._id.toString(),
      courseId: conversation.courseId._id?.toString() || conversation.courseId.toString(),
      courseName: conversation.courseId.title || 'Unknown Course',
      teacherId: conversation.teacherId._id?.toString() || conversation.teacherId.toString(),
      teacherName: conversation.teacherId.name 
        ? `${conversation.teacherId.name.firstName} ${conversation.teacherId.name.lastName}`
        : 'Unknown Teacher',
      studentId: conversation.studentId._id?.toString() || conversation.studentId.toString(),
      studentName: conversation.studentId.name
        ? `${conversation.studentId.name.firstName} ${conversation.studentId.name.lastName}`
        : 'Unknown Student',
      title: conversation.title,
      lastMessage: conversation.lastMessage ? {
        id: conversation.lastMessage._id?.toString() || conversation.lastMessage.toString(),
        content: conversation.lastMessage.content || '',
        senderName: 'Unknown',
        createdAt: conversation.lastMessage.createdAt || new Date(),
      } : undefined,
      unreadCount: conversation.unreadCount?.teacher || conversation.unreadCount?.student || 0,
      isActive: conversation.isActive,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private async formatMessageResponse(message: any): Promise<IMessageResponseDTO> {
    // Get sender details
    const sender = message.senderType === 'teacher'
      ? await Teacher.findById(message.senderId).select('name')
      : await Student.findById(message.senderId).select('name');

    const senderName = sender 
      ? `${(sender as any).name.firstName} ${(sender as any).name.lastName}`
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
        id: message.replyTo._id?.toString() || message.replyTo.toString(),
        content: message.replyTo.content || '',
        senderName: 'Unknown',
      } : undefined,
      readAt: message.readAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }
  /**
   * Enhanced enrollment validation with detailed checks
   */
  private async validateStudentEnrollment(
    studentId: string,
    teacherId: string,
    courseId: string
  ): Promise<{ isValid: boolean; reason?: string; enrollmentDetails?: any }> {
    try {
      // Check if student exists and is active
      const student = await Student.findById(studentId).populate('user');
      if (!student || student.isDeleted) {
        return { isValid: false, reason: 'Student not found or inactive' };
      }

      // Check if teacher exists and owns the course
      const course = await Course.findById(courseId);
      if (!course) {
        return { isValid: false, reason: 'Course not found' };
      }

      if (course.creator.toString() !== teacherId) {
        return { isValid: false, reason: 'Teacher does not own this course' };
      }

      // Check if course is published and active
      if ((course.status as string) !== 'published') {
        return { isValid: false, reason: 'Course is not published' };
      }

      // Check if student is enrolled in the course
      const enrollment = student.enrolledCourses.find(
        enrollment => enrollment.courseId.toString() === courseId
      );

      if (!enrollment) {
        return { isValid: false, reason: 'Student is not enrolled in this course' };
      }

      // Check enrollment status and payment (for paid courses)
      if ((course.isFree as string) === 'paid') {
        const { Payment } = await import('../../modules/Payment/payment.model');
        const payment = await Payment.findOne({
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
          totalLectures: course.lectures?.length || 0,
          courseTitle: course.title,
          isPaid: (course.isFree as string) === 'paid'
        }
      };
    } catch (error) {
      Logger.error('❌ Failed to validate student enrollment:', error);
      return { isValid: false, reason: 'Validation error occurred' };
    }
  }

  /**
   * Perform additional security checks
   */
  private async performSecurityChecks(
    studentId: string,
    teacherId: string,
    courseId: string
  ): Promise<void> {
    try {
      // Check for any existing restrictions or blocks
      const restrictions = await this.checkUserRestrictions(studentId, teacherId);
      if (restrictions.isRestricted) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `Messaging restricted: ${restrictions.reason}`
        );
      }

      // Check rate limiting for conversation creation
      const rateLimitKey = `conversation_creation:${studentId}:${teacherId}`;
      const recentCreations = await redisOperations.get(rateLimitKey);

      if (recentCreations && parseInt(recentCreations) >= 3) {
        throw new AppError(
          httpStatus.TOO_MANY_REQUESTS,
          'Too many conversation creation attempts. Please wait before trying again.'
        );
      }

      // Set rate limit (3 conversations per hour)
      await redisOperations.setex(rateLimitKey, 3600, (parseInt(recentCreations || '0') + 1).toString());

      // Log security event
      Logger.info(`🔒 Security check passed for conversation creation: Student ${studentId} -> Teacher ${teacherId} for course ${courseId}`);
    } catch (error) {
      Logger.error('❌ Security check failed:', error);
      throw error;
    }
  }

  /**
   * Check for user restrictions or blocks
   */
  private async checkUserRestrictions(
    studentId: string,
    teacherId: string
  ): Promise<{ isRestricted: boolean; reason?: string }> {
    try {
      // Check if student user account is verified
      const student = await Student.findById(studentId).populate('user');
      if (!student?.user || !(student.user as any).isVerified) {
        return { isRestricted: true, reason: 'Student account not verified' };
      }

      // Check if teacher user account is active
      const teacher = await Teacher.findById(teacherId).populate('user');
      if (!teacher?.user || (teacher.user as any).status !== 'active') {
        return { isRestricted: true, reason: 'Teacher account not active' };
      }

      // TODO: Add more sophisticated restriction checks
      // - Check for reported users
      // - Check for suspended accounts
      // - Check for blocked relationships

      return { isRestricted: false };
    } catch (error) {
      Logger.error('❌ Failed to check user restrictions:', error);
      return { isRestricted: true, reason: 'Unable to verify user status' };
    }
  }

  /**
   * Enhanced message search with better filtering and security
   */
  public async searchMessagesAdvanced(
    userId: string,
    userType: 'student' | 'teacher',
    searchParams: {
      query: string;
      courseId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      messageType?: MessageType;
      hasAttachments?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    messages: IMessageResponseDTO[];
    total: number;
    searchMetadata: {
      searchTerm: string;
      resultsCount: number;
      searchTime: number;
    };
  }> {
    const startTime = Date.now();

    try {
      // Build search filter
      const filter: any = {
        [`${userType}Id`]: new Types.ObjectId(userId),
      };

      // Add text search
      if (searchParams.query) {
        filter.$text = { $search: searchParams.query };
      }

      if (searchParams.courseId) {
        filter.courseId = new Types.ObjectId(searchParams.courseId);
      }

      if (searchParams.dateFrom || searchParams.dateTo) {
        filter.createdAt = {};
        if (searchParams.dateFrom) filter.createdAt.$gte = searchParams.dateFrom;
        if (searchParams.dateTo) filter.createdAt.$lte = searchParams.dateTo;
      }

      if (searchParams.messageType) {
        filter.messageType = searchParams.messageType;
      }

      if (searchParams.hasAttachments) {
        filter.hasAttachments = true;
      }

      // Execute search
      const [searchResults, total] = await Promise.all([
        MessageSearchIndex.find(filter)
          .limit(searchParams.limit || 50)
          .skip(searchParams.offset || 0)
          .sort({ createdAt: -1 }),
        MessageSearchIndex.countDocuments(filter)
      ]);

      const messageIds = searchResults.map(result => result.messageId);

      const messages = await Message.find({ _id: { $in: messageIds } })
        .populate('replyTo', 'content senderId senderType')
        .sort({ createdAt: -1 });

      const formattedMessages = await Promise.all(
        messages.map(msg => this.formatMessageResponse(msg))
      );

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
    } catch (error) {
      Logger.error('❌ Failed to perform advanced message search:', error);
      throw error;
    }
  }

  /**
   * Get messaging statistics for teacher dashboard
   */
  public async getMessagingStatistics(
    teacherId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'monthly'
  ): Promise<{
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
    unreadMessages: number;
    averageResponseTime: number; // in hours
    messagesByType: { [key in MessageType]: number };
    conversationsByStatus: {
      active: number;
      archived: number;
      blocked: number;
    };
    topCoursesByMessages: {
      courseId: string;
      courseName: string;
      messageCount: number;
    }[];
  }> {
    try {
      const cacheKey = `messaging_stats:${teacherId}:${period}`;
      const cached = await redisOperations.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const dateRange = this.getDateRangeForPeriod(period);

      // Get basic conversation stats
      const [totalConversations, activeConversations] = await Promise.all([
        Conversation.countDocuments({ teacherId: new Types.ObjectId(teacherId) }),
        Conversation.countDocuments({
          teacherId: new Types.ObjectId(teacherId),
          isActive: true,
          lastMessageAt: { $gte: dateRange.startDate }
        })
      ]);

      // Get message stats
      const messageFilter = {
        receiverId: new Types.ObjectId(teacherId),
        receiverType: 'teacher',
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      };

      const [totalMessages, unreadMessages] = await Promise.all([
        Message.countDocuments(messageFilter),
        Message.countDocuments({ ...messageFilter, status: { $ne: MessageStatus.READ } })
      ]);

      // Get message type breakdown
      const messageTypeStats = await Message.aggregate([
        { $match: messageFilter },
        { $group: { _id: '$messageType', count: { $sum: 1 } } }
      ]);

      const messagesByType: { [key in MessageType]: number } = {
        [MessageType.TEXT]: 0,
        [MessageType.FILE]: 0,
        [MessageType.IMAGE]: 0,
        [MessageType.VIDEO]: 0,
        [MessageType.AUDIO]: 0,
        [MessageType.DOCUMENT]: 0
      };

      messageTypeStats.forEach(stat => {
        messagesByType[stat._id as MessageType] = stat.count;
      });

      // Get conversation status breakdown
      const conversationStats = await Conversation.aggregate([
        { $match: { teacherId: new Types.ObjectId(teacherId) } },
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
        conversationsByStatus[stat._id as keyof typeof conversationsByStatus] = stat.count;
      });

      // Calculate average response time
      const averageResponseTime = await this.calculateAverageResponseTime(teacherId, dateRange);

      // Get top courses by message count
      const topCoursesByMessages = await this.getTopCoursesByMessages(teacherId, dateRange);

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
      await redisOperations.setex(cacheKey, 1800, JSON.stringify(result));

      return result;
    } catch (error) {
      Logger.error('❌ Failed to get messaging statistics:', error);
      throw error;
    }
  }

  private getDateRangeForPeriod(period: 'daily' | 'weekly' | 'monthly'): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;

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

  private async calculateAverageResponseTime(
    teacherId: string,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<number> {
    try {
      // Get teacher's messages and their response times
      const teacherMessages = await Message.find({
        senderId: new Types.ObjectId(teacherId),
        senderType: 'teacher',
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      }).sort({ createdAt: 1 });

      if (teacherMessages.length === 0) return 0;

      let totalResponseTime = 0;
      let responseCount = 0;

      for (const message of teacherMessages) {
        // Find the previous student message in the same conversation
        const previousStudentMessage = await Message.findOne({
          conversationId: message.conversationId,
          senderType: 'student',
          createdAt: { $lt: message.createdAt }
        }).sort({ createdAt: -1 });

        if (previousStudentMessage) {
          const responseTime = message.createdAt!.getTime() - previousStudentMessage.createdAt!.getTime();
          totalResponseTime += responseTime;
          responseCount++;
        }
      }

      // Return average response time in hours
      return responseCount > 0 ? totalResponseTime / responseCount / (1000 * 60 * 60) : 0;
    } catch (error) {
      Logger.error('❌ Failed to calculate average response time:', error);
      return 0;
    }
  }

  private async getTopCoursesByMessages(
    teacherId: string,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<{ courseId: string; courseName: string; messageCount: number }[]> {
    try {
      const topCourses = await Message.aggregate([
        {
          $match: {
            $or: [
              { senderId: new Types.ObjectId(teacherId), senderType: 'teacher' },
              { receiverId: new Types.ObjectId(teacherId), receiverType: 'teacher' }
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

      return topCourses.map(item => ({
        courseId: item._id.toString(),
        courseName: item.course[0]?.title || 'Unknown Course',
        messageCount: item.messageCount
      }));
    } catch (error) {
      Logger.error('❌ Failed to get top courses by messages:', error);
      return [];
    }
  }

  /**
   * Get enhanced conversation details
   */
  public async getConversationDetails(
    conversationId: string,
    userId: string,
    userType: 'student' | 'teacher'
  ): Promise<{
    conversation: IConversationResponseDTO;
    messageStats: {
      totalMessages: number;
      unreadMessages: number;
      lastMessageAt: Date | null;
      messagesByType: { [key in MessageType]: number };
    };
    participants: {
      teacher: { id: string; name: string; email: string; profileImg?: string };
      student: { id: string; name: string; email: string; profileImg?: string };
    };
    courseInfo: {
      id: string;
      title: string;
      thumbnail?: string;
      enrollmentDate: Date;
    };
  }> {
    try {
      // Get conversation and validate permissions
      const conversation = await Conversation.findById(conversationId)
        .populate('courseId', 'title courseThumbnail')
        .populate('teacherId', 'name email profileImg')
        .populate('studentId', 'name email profileImg')
        .populate('lastMessage', 'content createdAt');

      if (!conversation) {
        throw new AppError(httpStatus.NOT_FOUND, 'Conversation not found');
      }

      // Validate user is participant
      const isParticipant = conversation.participants.some(
        p => p.userId.toString() === userId && p.userType === userType
      );

      if (!isParticipant) {
        throw new AppError(httpStatus.FORBIDDEN, 'You are not a participant in this conversation');
      }

      // Get message statistics
      const messageStats = await this.getConversationMessageStats(conversationId, userId, userType);

      // Get participant details
      const teacher = conversation.teacherId as any;
      const student = conversation.studentId as any;

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
      const course = conversation.courseId as any;
      const enrollmentInfo = await Student.findById(student._id)
        .select('enrolledCourses');

      const enrollment = enrollmentInfo?.enrolledCourses.find(
        e => e.courseId.toString() === course._id.toString()
      );

      const courseInfo = {
        id: course._id.toString(),
        title: course.title,
        thumbnail: course.courseThumbnail,
        enrollmentDate: enrollment?.enrolledAt || new Date()
      };

      return {
        conversation: this.formatConversationResponse(conversation),
        messageStats,
        participants,
        courseInfo
      };
    } catch (error) {
      Logger.error('❌ Failed to get conversation details:', error);
      throw error;
    }
  }

  private async getConversationMessageStats(
    conversationId: string,
    userId: string,
    userType: 'student' | 'teacher'
  ): Promise<{
    totalMessages: number;
    unreadMessages: number;
    lastMessageAt: Date | null;
    messagesByType: { [key in MessageType]: number };
  }> {
    try {
      const conversationFilter = { conversationId: new Types.ObjectId(conversationId) };
      const unreadFilter = {
        ...conversationFilter,
        receiverId: new Types.ObjectId(userId),
        receiverType: userType,
        status: { $ne: MessageStatus.READ }
      };

      // Get basic stats
      const [totalMessages, unreadMessages, lastMessage] = await Promise.all([
        Message.countDocuments(conversationFilter),
        Message.countDocuments(unreadFilter),
        Message.findOne(conversationFilter).sort({ createdAt: -1 }).select('createdAt')
      ]);

      // Get message type breakdown
      const messageTypeStats = await Message.aggregate([
        { $match: conversationFilter },
        { $group: { _id: '$messageType', count: { $sum: 1 } } }
      ]);

      const messagesByType: { [key in MessageType]: number } = {
        [MessageType.TEXT]: 0,
        [MessageType.FILE]: 0,
        [MessageType.IMAGE]: 0,
        [MessageType.VIDEO]: 0,
        [MessageType.AUDIO]: 0,
        [MessageType.DOCUMENT]: 0
      };

      messageTypeStats.forEach(stat => {
        messagesByType[stat._id as MessageType] = stat.count;
      });

      return {
        totalMessages,
        unreadMessages,
        lastMessageAt: lastMessage?.createdAt || null,
        messagesByType
      };
    } catch (error) {
      Logger.error('❌ Failed to get conversation message stats:', error);
      return {
        totalMessages: 0,
        unreadMessages: 0,
        lastMessageAt: null,
        messagesByType: {
          [MessageType.TEXT]: 0,
          [MessageType.FILE]: 0,
          [MessageType.IMAGE]: 0,
          [MessageType.VIDEO]: 0,
          [MessageType.AUDIO]: 0,
          [MessageType.DOCUMENT]: 0
        }
      };
    }
  }

  /**
   * Toggle conversation archive status
   */
  public async toggleConversationArchive(
    conversationId: string,
    userId: string,
    userType: 'teacher' | 'student',
    isArchived: boolean
  ): Promise<any> {
    try {
      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        throw new AppError(httpStatus.NOT_FOUND, 'Conversation not found');
      }

      // Verify user is participant
      const isParticipant = userType === 'teacher'
        ? conversation.teacherId.toString() === userId
        : conversation.studentId.toString() === userId;

      if (!isParticipant) {
        throw new AppError(httpStatus.FORBIDDEN, 'Access denied to this conversation');
      }

      // Update archive status
      conversation.isArchived = isArchived;
      await conversation.save();

      Logger.info(`📁 Conversation ${isArchived ? 'archived' : 'unarchived'}: ${conversationId}`);
      return conversation;
    } catch (error) {
      Logger.error('❌ Failed to toggle conversation archive:', error);
      throw error;
    }
  }

  /**
   * Get enhanced conversation details (alias for getConversationDetails)
   */
  public async getConversationDetailsEnhanced(
    conversationId: string,
    userId: string,
    userType: 'teacher' | 'student'
  ): Promise<any> {
    return this.getConversationDetails(conversationId, userId, userType);
  }
}

export default MessagingService;
