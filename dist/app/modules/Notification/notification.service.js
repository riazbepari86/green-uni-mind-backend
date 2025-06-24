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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const notification_model_1 = require("./notification.model");
const notification_interface_1 = require("./notification.interface");
const auditLog_model_1 = require("../AuditLog/auditLog.model");
const auditLog_interface_1 = require("../AuditLog/auditLog.interface");
const websocketService_1 = require("../../services/websocketService");
const emailService_1 = require("../../services/emailService");
// Create notification with user preferences consideration
const createNotification = (data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get user notification preferences
        const preferences = yield notification_model_1.NotificationPreference.findOne({
            userId: data.userId,
            userType: data.userType,
        });
        // Check if user wants this type of notification
        if (preferences && !shouldSendNotification(data.type, preferences)) {
            console.log(`Notification skipped due to user preferences: ${data.type} for user ${data.userId}`);
            return [];
        }
        // Determine channels to use
        const channels = data.channels || getDefaultChannels(data.type, preferences);
        const notifications = [];
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
            const notification = new notification_model_1.Notification({
                type: data.type,
                channel,
                priority: data.priority || notification_interface_1.NotificationPriority.NORMAL,
                status: notification_interface_1.NotificationStatus.PENDING,
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
                metadata: Object.assign(Object.assign({}, data.metadata), { createdBy: 'system', notificationType: data.type }),
                trackingId: generateTrackingId(),
            });
            // Set recipient contact info based on channel
            if (channel === notification_interface_1.NotificationChannel.EMAIL && (preferences === null || preferences === void 0 ? void 0 : preferences.emailAddress)) {
                notification.recipientEmail = preferences.emailAddress;
            }
            else if (channel === notification_interface_1.NotificationChannel.SMS && (preferences === null || preferences === void 0 ? void 0 : preferences.phoneNumber)) {
                notification.recipientPhone = preferences.phoneNumber;
            }
            yield notification.save();
            notifications.push(notification);
            // Immediately deliver in-app notifications via WebSocket
            if (channel === notification_interface_1.NotificationChannel.IN_APP) {
                const delivered = websocketService_1.webSocketService.sendRealTimeNotification({
                    userId: data.userId.toString(),
                    type: data.type,
                    title: data.title || '',
                    body: data.body,
                    priority: data.priority || notification_interface_1.NotificationPriority.NORMAL,
                    actionUrl: data.actionUrl,
                    actionText: data.actionText,
                    metadata: Object.assign({ notificationId: notification._id.toString() }, data.metadata),
                });
                if (delivered) {
                    yield notification_model_1.Notification.findByIdAndUpdate(notification._id, {
                        status: notification_interface_1.NotificationStatus.DELIVERED,
                        deliveredAt: new Date(),
                    });
                }
            }
            // Send email notifications immediately if not scheduled
            if (channel === notification_interface_1.NotificationChannel.EMAIL && (!data.scheduledAt || data.scheduledAt <= new Date())) {
                setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
                    yield deliverEmailNotification(notification);
                }));
            }
        }
        // Log audit event
        yield auditLog_model_1.AuditLog.create({
            action: auditLog_interface_1.AuditLogAction.SYSTEM_MAINTENANCE,
            category: auditLog_interface_1.AuditLogCategory.SYSTEM,
            level: auditLog_interface_1.AuditLogLevel.INFO,
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
    }
    catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
});
// Get or create user notification preferences
const getUserPreferences = (userId, userType) => __awaiter(void 0, void 0, void 0, function* () {
    let preferences = yield notification_model_1.NotificationPreference.findOne({ userId, userType });
    if (!preferences) {
        preferences = new notification_model_1.NotificationPreference({
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
        yield preferences.save();
    }
    return preferences;
});
// Update user notification preferences
const updateUserPreferences = (userId, userType, updates) => __awaiter(void 0, void 0, void 0, function* () {
    const preferences = yield notification_model_1.NotificationPreference.findOneAndUpdate({ userId, userType }, {
        $set: Object.assign(Object.assign({}, updates), { lastUpdated: new Date() }),
    }, { new: true, upsert: true });
    // Log audit event
    yield auditLog_model_1.AuditLog.create({
        action: auditLog_interface_1.AuditLogAction.USER_PROFILE_UPDATED,
        category: auditLog_interface_1.AuditLogCategory.USER,
        level: auditLog_interface_1.AuditLogLevel.INFO,
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
    return preferences;
});
// Get notifications for a user
const getUserNotifications = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, options = {}) {
    const filter = { userId };
    if (options.status)
        filter.status = options.status;
    if (options.type)
        filter.type = options.type;
    if (options.channel)
        filter.channel = options.channel;
    if (options.unreadOnly) {
        filter.openedAt = { $exists: false };
    }
    const [notifications, total] = yield Promise.all([
        notification_model_1.Notification.find(filter)
            .sort({ createdAt: -1 })
            .limit(options.limit || 50)
            .skip(options.offset || 0),
        notification_model_1.Notification.countDocuments(filter),
    ]);
    return { notifications, total };
});
// Mark notification as read
const markAsRead = (notificationId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = { _id: notificationId };
    if (userId)
        filter.userId = userId;
    yield notification_model_1.Notification.findOneAndUpdate(filter, {
        $set: {
            openedAt: new Date(),
            status: notification_interface_1.NotificationStatus.OPENED,
        },
    });
});
// Helper functions
const shouldSendNotification = (type, preferences) => {
    switch (type) {
        case notification_interface_1.NotificationType.PAYMENT_RECEIVED:
        case notification_interface_1.NotificationType.PAYMENT_FAILED:
        case notification_interface_1.NotificationType.PAYMENT_REFUNDED:
            return preferences.paymentNotifications;
        case notification_interface_1.NotificationType.PAYOUT_SCHEDULED:
        case notification_interface_1.NotificationType.PAYOUT_PROCESSING:
        case notification_interface_1.NotificationType.PAYOUT_COMPLETED:
        case notification_interface_1.NotificationType.PAYOUT_FAILED:
        case notification_interface_1.NotificationType.PAYOUT_DELAYED:
            return preferences.payoutNotifications;
        case notification_interface_1.NotificationType.STRIPE_ACCOUNT_VERIFIED:
        case notification_interface_1.NotificationType.STRIPE_ACCOUNT_RESTRICTED:
        case notification_interface_1.NotificationType.STRIPE_ACCOUNT_REQUIREMENTS_DUE:
        case notification_interface_1.NotificationType.STRIPE_ACCOUNT_DEAUTHORIZED:
        case notification_interface_1.NotificationType.STRIPE_CAPABILITY_ENABLED:
        case notification_interface_1.NotificationType.STRIPE_CAPABILITY_DISABLED:
        case notification_interface_1.NotificationType.STRIPE_EXTERNAL_ACCOUNT_ADDED:
        case notification_interface_1.NotificationType.STRIPE_EXTERNAL_ACCOUNT_UPDATED:
            return preferences.stripeConnectNotifications;
        case notification_interface_1.NotificationType.TRANSFER_CREATED:
        case notification_interface_1.NotificationType.TRANSFER_PAID:
        case notification_interface_1.NotificationType.TRANSFER_FAILED:
            return preferences.transferNotifications;
        case notification_interface_1.NotificationType.ACCOUNT_HEALTH_GOOD:
        case notification_interface_1.NotificationType.ACCOUNT_HEALTH_WARNING:
        case notification_interface_1.NotificationType.ACCOUNT_HEALTH_CRITICAL:
            return preferences.accountHealthNotifications;
        case notification_interface_1.NotificationType.COMPLIANCE_DOCUMENT_REQUIRED:
        case notification_interface_1.NotificationType.COMPLIANCE_VERIFICATION_PENDING:
        case notification_interface_1.NotificationType.COMPLIANCE_VERIFICATION_COMPLETED:
            return preferences.complianceNotifications;
        case notification_interface_1.NotificationType.SYSTEM_MAINTENANCE:
        case notification_interface_1.NotificationType.SECURITY_ALERT:
        case notification_interface_1.NotificationType.FEATURE_ANNOUNCEMENT:
            return preferences.systemNotifications;
        default:
            return true;
    }
};
const getDefaultChannels = (type, preferences) => {
    const channels = [notification_interface_1.NotificationChannel.IN_APP];
    if (preferences === null || preferences === void 0 ? void 0 : preferences.emailEnabled) {
        channels.push(notification_interface_1.NotificationChannel.EMAIL);
    }
    // Add SMS for urgent notifications
    if ((preferences === null || preferences === void 0 ? void 0 : preferences.smsEnabled) && isUrgentNotification(type)) {
        channels.push(notification_interface_1.NotificationChannel.SMS);
    }
    return channels;
};
const isChannelEnabled = (channel, preferences) => {
    switch (channel) {
        case notification_interface_1.NotificationChannel.EMAIL:
            return preferences.emailEnabled;
        case notification_interface_1.NotificationChannel.IN_APP:
            return preferences.inAppEnabled;
        case notification_interface_1.NotificationChannel.SMS:
            return preferences.smsEnabled;
        case notification_interface_1.NotificationChannel.PUSH:
            return preferences.pushEnabled;
        default:
            return true;
    }
};
const isInQuietHours = (preferences) => {
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
const calculateNextAvailableTime = (preferences) => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (preferences.quietHoursEnd) {
        const [hours, minutes] = preferences.quietHoursEnd.split(':').map(Number);
        tomorrow.setHours(hours, minutes, 0, 0);
    }
    return tomorrow;
};
const isUrgentNotification = (type) => {
    const urgentTypes = [
        notification_interface_1.NotificationType.PAYMENT_FAILED,
        notification_interface_1.NotificationType.PAYOUT_FAILED,
        notification_interface_1.NotificationType.STRIPE_ACCOUNT_RESTRICTED,
        notification_interface_1.NotificationType.STRIPE_ACCOUNT_DEAUTHORIZED,
        notification_interface_1.NotificationType.ACCOUNT_HEALTH_CRITICAL,
        notification_interface_1.NotificationType.SECURITY_ALERT,
    ];
    return urgentTypes.includes(type);
};
// Deliver email notification
const deliverEmailNotification = (notification) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!notification.recipientEmail) {
            console.warn(`No email address for notification ${notification._id}`);
            return;
        }
        // Prepare email variables
        const emailVariables = Object.assign({ userName: notification.recipientEmail.split('@')[0], notificationTitle: notification.title, notificationBody: notification.body, actionUrl: notification.actionUrl, actionText: notification.actionText }, (_a = notification.metadata) === null || _a === void 0 ? void 0 : _a.variables);
        // Send email using email service
        const result = yield emailService_1.emailService.sendNotificationEmail(notification.type, notification.recipientEmail, emailVariables);
        if (result.success) {
            yield notification_model_1.Notification.findByIdAndUpdate(notification._id, {
                status: notification_interface_1.NotificationStatus.DELIVERED,
                deliveredAt: new Date(),
                'metadata.emailMessageId': result.messageId,
            });
        }
        else {
            yield notification_model_1.Notification.findByIdAndUpdate(notification._id, {
                status: notification_interface_1.NotificationStatus.FAILED,
                failedAt: new Date(),
                'metadata.emailError': result.error,
            });
        }
    }
    catch (error) {
        console.error('Error delivering email notification:', error);
        yield notification_model_1.Notification.findByIdAndUpdate(notification._id, {
            status: notification_interface_1.NotificationStatus.FAILED,
            failedAt: new Date(),
            'metadata.emailError': error.message,
        });
    }
});
// Process pending notifications (for scheduled delivery)
const processPendingNotifications = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pendingNotifications = yield notification_model_1.Notification.find({
            status: notification_interface_1.NotificationStatus.PENDING,
            scheduledAt: { $lte: new Date() },
        }).limit(100); // Process in batches
        let delivered = 0;
        let failed = 0;
        for (const notification of pendingNotifications) {
            try {
                if (notification.channel === notification_interface_1.NotificationChannel.EMAIL) {
                    yield deliverEmailNotification(notification);
                    delivered++;
                }
                else if (notification.channel === notification_interface_1.NotificationChannel.IN_APP) {
                    // Try to deliver via WebSocket
                    const success = websocketService_1.webSocketService.sendRealTimeNotification({
                        userId: notification.userId.toString(),
                        type: notification.type,
                        title: notification.title || '',
                        body: notification.body,
                        priority: notification.priority,
                        actionUrl: notification.actionUrl,
                        actionText: notification.actionText,
                        metadata: notification.metadata,
                    });
                    if (success) {
                        yield notification_model_1.Notification.findByIdAndUpdate(notification._id, {
                            status: notification_interface_1.NotificationStatus.DELIVERED,
                            deliveredAt: new Date(),
                        });
                        delivered++;
                    }
                    else {
                        // User not connected, keep as pending for later delivery
                        continue;
                    }
                }
            }
            catch (error) {
                console.error(`Error processing notification ${notification._id}:`, error);
                failed++;
            }
        }
        return {
            processed: pendingNotifications.length,
            delivered,
            failed,
        };
    }
    catch (error) {
        console.error('Error processing pending notifications:', error);
        throw error;
    }
});
const generateTrackingId = () => {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};
exports.NotificationService = {
    createNotification,
    getUserPreferences,
    updateUserPreferences,
    getUserNotifications,
    markAsRead,
    deliverEmailNotification,
    processPendingNotifications,
};
