import { Types } from 'mongoose';
import { Notification, NotificationPreference } from './notification.model';
import {
  INotification,
  INotificationPreference,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus
} from './notification.interface';
import { AuditLog } from '../AuditLog/auditLog.model';
import {
  AuditLogAction,
  AuditLogCategory,
  AuditLogLevel
} from '../AuditLog/auditLog.interface';

import { emailService } from '../../services/emailService';

interface CreateNotificationData {
  type: NotificationType;
  priority?: NotificationPriority;
  userId: string | Types.ObjectId;
  userType: 'student' | 'teacher' | 'admin';
  title?: string;
  body: string;
  relatedResourceType?: string;
  relatedResourceId?: string;
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, any>;
  scheduledAt?: Date;
  channels?: NotificationChannel[];
}

// Create notification with user preferences consideration
const createNotification = async (data: CreateNotificationData): Promise<INotification[]> => {
  try {
    // Get user notification preferences
    const preferences = await NotificationPreference.findOne({
      userId: data.userId,
      userType: data.userType,
    });

    // Check if user wants this type of notification
    if (preferences && !shouldSendNotification(data.type, preferences)) {
      console.log(`Notification skipped due to user preferences: ${data.type} for user ${data.userId}`);
      return [];
    }

    // Determine channels to use
    const channels = data.channels || getDefaultChannels(data.type, preferences || undefined);
    const notifications: INotification[] = [];

    // Create notification for each channel
    for (const channel of channels) {
      // Check if channel is enabled for user
      if (preferences && !isChannelEnabled(channel, preferences)) {
        continue;
      }

      // Check quiet hours
      if (preferences && isInQuietHours(preferences)) {
        // Schedule for after quiet hours
        const scheduledAt = calculateNextAvailableTime(preferences);
        data.scheduledAt = scheduledAt;
      }

      const notification = new Notification({
        type: data.type,
        channel,
        priority: data.priority || NotificationPriority.NORMAL,
        status: NotificationStatus.PENDING,
        userId: data.userId,
        userType: data.userType,
        subject: data.title,
        title: data.title,
        body: data.body,
        relatedResourceType: data.relatedResourceType,
        relatedResourceId: data.relatedResourceId,
        actionUrl: data.actionUrl,
        actionText: data.actionText,
        scheduledAt: data.scheduledAt || new Date(),
        retryCount: 0,
        maxRetries: 3,
        metadata: {
          ...data.metadata,
          createdBy: 'system',
          notificationType: data.type,
        },
        trackingId: generateTrackingId(),
      });

      // Set recipient contact info based on channel
      if (channel === NotificationChannel.EMAIL && preferences?.emailAddress) {
        notification.recipientEmail = preferences.emailAddress;
      } else if (channel === NotificationChannel.SMS && preferences?.phoneNumber) {
        notification.recipientPhone = preferences.phoneNumber;
      }

      await notification.save();
      notifications.push(notification);

      // In-app notifications are stored and delivered via standard API calls
      if (channel === NotificationChannel.IN_APP) {
        // Mark as delivered since it's stored in database for API retrieval
        await Notification.findByIdAndUpdate(notification._id, {
          status: NotificationStatus.DELIVERED,
          deliveredAt: new Date(),
        });
      }

      // Send email notifications immediately if not scheduled
      if (channel === NotificationChannel.EMAIL && (!data.scheduledAt || data.scheduledAt <= new Date())) {
        setImmediate(async () => {
          await deliverEmailNotification(notification);
        });
      }
    }

    // Log audit event
    await AuditLog.create({
      action: AuditLogAction.SYSTEM_MAINTENANCE,
      category: AuditLogCategory.SYSTEM,
      level: AuditLogLevel.INFO,
      message: `Notification created: ${data.type}`,
      userId: data.userId,
      userType: data.userType,
      resourceType: 'notification',
      metadata: {
        notificationType: data.type,
        channels: channels.join(','),
        priority: data.priority,
        relatedResourceType: data.relatedResourceType,
        relatedResourceId: data.relatedResourceId,
      },
      timestamp: new Date(),
    });

    return notifications;

  } catch (error: any) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Get or create user notification preferences
const getUserPreferences = async (
  userId: string | Types.ObjectId,
  userType: 'student' | 'teacher' | 'admin'
): Promise<INotificationPreference> => {
  let preferences = await NotificationPreference.findOne({ userId, userType });
  
  if (!preferences) {
    preferences = new NotificationPreference({
      userId,
      userType,
      // Default preferences
      emailEnabled: true,
      inAppEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      paymentNotifications: true,
      payoutNotifications: true,
      stripeConnectNotifications: true,
      transferNotifications: true,
      accountHealthNotifications: true,
      complianceNotifications: true,
      systemNotifications: true,
      marketingNotifications: false,
      digestFrequency: 'immediate',
      quietHoursEnabled: false,
      timezone: 'UTC',
      lastUpdated: new Date(),
    });
    
    await preferences.save();
  }
  
  return preferences;
};

// Update user notification preferences
const updateUserPreferences = async (
  userId: string | Types.ObjectId,
  userType: 'student' | 'teacher' | 'admin',
  updates: Partial<INotificationPreference>
): Promise<INotificationPreference> => {
  const preferences = await NotificationPreference.findOneAndUpdate(
    { userId, userType },
    {
      $set: {
        ...updates,
        lastUpdated: new Date(),
      },
    },
    { new: true, upsert: true }
  );

  // Log audit event
  await AuditLog.create({
    action: AuditLogAction.USER_PROFILE_UPDATED,
    category: AuditLogCategory.USER,
    level: AuditLogLevel.INFO,
    message: 'Notification preferences updated',
    userId,
    userType,
    resourceType: 'notification_preferences',
    metadata: {
      updatedFields: Object.keys(updates),
      updates,
    },
    timestamp: new Date(),
  });

  return preferences as INotificationPreference;
};

// Get notifications for a user
const getUserNotifications = async (
  userId: string | Types.ObjectId,
  options: {
    limit?: number;
    offset?: number;
    status?: NotificationStatus;
    type?: NotificationType;
    channel?: NotificationChannel;
    unreadOnly?: boolean;
  } = {}
): Promise<{ notifications: INotification[]; total: number }> => {
  const filter: any = { userId };
  
  if (options.status) filter.status = options.status;
  if (options.type) filter.type = options.type;
  if (options.channel) filter.channel = options.channel;
  if (options.unreadOnly) {
    filter.openedAt = { $exists: false };
  }

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50)
      .skip(options.offset || 0),
    Notification.countDocuments(filter),
  ]);

  return { notifications, total };
};

// Mark notification as read
const markAsRead = async (notificationId: string, userId?: string): Promise<void> => {
  const filter: any = { _id: notificationId };
  if (userId) filter.userId = userId;

  await Notification.findOneAndUpdate(filter, {
    $set: {
      openedAt: new Date(),
      status: NotificationStatus.OPENED,
    },
  });
};

// Helper functions
const shouldSendNotification = (type: NotificationType, preferences: INotificationPreference): boolean => {
  switch (type) {
    case NotificationType.PAYMENT_RECEIVED:
    case NotificationType.PAYMENT_FAILED:
    case NotificationType.PAYMENT_REFUNDED:
      return preferences.paymentNotifications;
    
    case NotificationType.PAYOUT_SCHEDULED:
    case NotificationType.PAYOUT_PROCESSING:
    case NotificationType.PAYOUT_COMPLETED:
    case NotificationType.PAYOUT_FAILED:
    case NotificationType.PAYOUT_DELAYED:
      return preferences.payoutNotifications;
    
    case NotificationType.STRIPE_ACCOUNT_VERIFIED:
    case NotificationType.STRIPE_ACCOUNT_RESTRICTED:
    case NotificationType.STRIPE_ACCOUNT_REQUIREMENTS_DUE:
    case NotificationType.STRIPE_ACCOUNT_DEAUTHORIZED:
    case NotificationType.STRIPE_CAPABILITY_ENABLED:
    case NotificationType.STRIPE_CAPABILITY_DISABLED:
    case NotificationType.STRIPE_EXTERNAL_ACCOUNT_ADDED:
    case NotificationType.STRIPE_EXTERNAL_ACCOUNT_UPDATED:
      return preferences.stripeConnectNotifications;
    
    case NotificationType.TRANSFER_CREATED:
    case NotificationType.TRANSFER_PAID:
    case NotificationType.TRANSFER_FAILED:
      return preferences.transferNotifications;
    
    case NotificationType.ACCOUNT_HEALTH_GOOD:
    case NotificationType.ACCOUNT_HEALTH_WARNING:
    case NotificationType.ACCOUNT_HEALTH_CRITICAL:
      return preferences.accountHealthNotifications;
    
    case NotificationType.COMPLIANCE_DOCUMENT_REQUIRED:
    case NotificationType.COMPLIANCE_VERIFICATION_PENDING:
    case NotificationType.COMPLIANCE_VERIFICATION_COMPLETED:
      return preferences.complianceNotifications;
    
    case NotificationType.SYSTEM_MAINTENANCE:
    case NotificationType.SECURITY_ALERT:
    case NotificationType.FEATURE_ANNOUNCEMENT:
      return preferences.systemNotifications;
    
    default:
      return true;
  }
};

const getDefaultChannels = (type: NotificationType, preferences?: INotificationPreference): NotificationChannel[] => {
  const channels: NotificationChannel[] = [NotificationChannel.IN_APP];
  
  if (preferences?.emailEnabled) {
    channels.push(NotificationChannel.EMAIL);
  }
  
  // Add SMS for urgent notifications
  if (preferences?.smsEnabled && isUrgentNotification(type)) {
    channels.push(NotificationChannel.SMS);
  }
  
  return channels;
};

const isChannelEnabled = (channel: NotificationChannel, preferences: INotificationPreference): boolean => {
  switch (channel) {
    case NotificationChannel.EMAIL:
      return preferences.emailEnabled;
    case NotificationChannel.IN_APP:
      return preferences.inAppEnabled;
    case NotificationChannel.SMS:
      return preferences.smsEnabled;
    case NotificationChannel.PUSH:
      return preferences.pushEnabled;
    default:
      return true;
  }
};

const isInQuietHours = (preferences: INotificationPreference): boolean => {
  if (!preferences.quietHoursEnabled || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
    return false;
  }
  
  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    timeZone: preferences.timezone 
  }).substring(0, 5);
  
  return currentTime >= preferences.quietHoursStart && currentTime <= preferences.quietHoursEnd;
};

const calculateNextAvailableTime = (preferences: INotificationPreference): Date => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (preferences.quietHoursEnd) {
    const [hours, minutes] = preferences.quietHoursEnd.split(':').map(Number);
    tomorrow.setHours(hours, minutes, 0, 0);
  }
  
  return tomorrow;
};

const isUrgentNotification = (type: NotificationType): boolean => {
  const urgentTypes = [
    NotificationType.PAYMENT_FAILED,
    NotificationType.PAYOUT_FAILED,
    NotificationType.STRIPE_ACCOUNT_RESTRICTED,
    NotificationType.STRIPE_ACCOUNT_DEAUTHORIZED,
    NotificationType.ACCOUNT_HEALTH_CRITICAL,
    NotificationType.SECURITY_ALERT,
  ];
  
  return urgentTypes.includes(type);
};

// Deliver email notification
const deliverEmailNotification = async (notification: INotification): Promise<void> => {
  try {
    if (!notification.recipientEmail) {
      console.warn(`No email address for notification ${notification._id}`);
      return;
    }

    // Prepare email variables
    const emailVariables = {
      userName: notification.recipientEmail.split('@')[0], // Fallback name
      notificationTitle: notification.title,
      notificationBody: notification.body,
      actionUrl: notification.actionUrl,
      actionText: notification.actionText,
      ...notification.metadata?.variables,
    };

    // Send email using email service
    const result = await emailService.sendNotificationEmail(
      notification.type,
      notification.recipientEmail,
      emailVariables
    );

    if (result.success) {
      await Notification.findByIdAndUpdate(notification._id, {
        status: NotificationStatus.DELIVERED,
        deliveredAt: new Date(),
        'metadata.emailMessageId': result.messageId,
      });
    } else {
      await Notification.findByIdAndUpdate(notification._id, {
        status: NotificationStatus.FAILED,
        failedAt: new Date(),
        'metadata.emailError': result.error,
      });
    }
  } catch (error: any) {
    console.error('Error delivering email notification:', error);
    await Notification.findByIdAndUpdate(notification._id, {
      status: NotificationStatus.FAILED,
      failedAt: new Date(),
      'metadata.emailError': error.message,
    });
  }
};

// Process pending notifications (for scheduled delivery)
const processPendingNotifications = async (): Promise<{
  processed: number;
  delivered: number;
  failed: number;
}> => {
  try {
    const pendingNotifications = await Notification.find({
      status: NotificationStatus.PENDING,
      scheduledAt: { $lte: new Date() },
    }).limit(100); // Process in batches

    let delivered = 0;
    let failed = 0;

    for (const notification of pendingNotifications) {
      try {
        if (notification.channel === NotificationChannel.EMAIL) {
          await deliverEmailNotification(notification);
          delivered++;
        } else if (notification.channel === NotificationChannel.IN_APP) {
          // Mark in-app notifications as delivered (available via API)
          await Notification.findByIdAndUpdate(notification._id, {
            status: NotificationStatus.DELIVERED,
            deliveredAt: new Date(),
          });
          delivered++;
        }
      } catch (error: any) {
        console.error(`Error processing notification ${notification._id}:`, error);
        failed++;
      }
    }

    return {
      processed: pendingNotifications.length,
      delivered,
      failed,
    };
  } catch (error: any) {
    console.error('Error processing pending notifications:', error);
    throw error;
  }
};

const generateTrackingId = (): string => {
  return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

export const NotificationService = {
  createNotification,
  getUserPreferences,
  updateUserPreferences,
  getUserNotifications,
  markAsRead,
  deliverEmailNotification,
  processPendingNotifications,
};
