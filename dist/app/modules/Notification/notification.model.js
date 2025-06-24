"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = exports.NotificationPreference = void 0;
const mongoose_1 = require("mongoose");
const notification_interface_1 = require("./notification.interface");
const notificationPreferenceSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    userType: {
        type: String,
        enum: ['student', 'teacher', 'admin'],
        required: true,
        index: true,
    },
    // Channel Preferences
    emailEnabled: { type: Boolean, default: true },
    inAppEnabled: { type: Boolean, default: true },
    smsEnabled: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: true },
    // Notification Type Preferences
    paymentNotifications: { type: Boolean, default: true },
    payoutNotifications: { type: Boolean, default: true },
    stripeConnectNotifications: { type: Boolean, default: true },
    transferNotifications: { type: Boolean, default: true },
    accountHealthNotifications: { type: Boolean, default: true },
    complianceNotifications: { type: Boolean, default: true },
    systemNotifications: { type: Boolean, default: true },
    marketingNotifications: { type: Boolean, default: false },
    // Frequency Settings
    digestFrequency: {
        type: String,
        enum: ['immediate', 'hourly', 'daily', 'weekly', 'never'],
        default: 'immediate',
    },
    quietHoursEnabled: { type: Boolean, default: false },
    quietHoursStart: { type: String }, // HH:MM format
    quietHoursEnd: { type: String }, // HH:MM format
    timezone: { type: String, default: 'UTC' },
    // Contact Information
    emailAddress: { type: String },
    phoneNumber: { type: String },
    // Metadata
    lastUpdated: { type: Date, default: Date.now },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
const notificationSchema = new mongoose_1.Schema({
    // Core Information
    type: {
        type: String,
        enum: Object.values(notification_interface_1.NotificationType),
        required: true,
        index: true,
    },
    channel: {
        type: String,
        enum: Object.values(notification_interface_1.NotificationChannel),
        required: true,
        index: true,
    },
    priority: {
        type: String,
        enum: Object.values(notification_interface_1.NotificationPriority),
        required: true,
        default: notification_interface_1.NotificationPriority.NORMAL,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(notification_interface_1.NotificationStatus),
        required: true,
        default: notification_interface_1.NotificationStatus.PENDING,
        index: true,
    },
    // Recipients
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    userType: {
        type: String,
        enum: ['student', 'teacher', 'admin'],
        required: true,
        index: true,
    },
    recipientEmail: { type: String },
    recipientPhone: { type: String },
    // Content
    subject: { type: String },
    title: { type: String },
    body: { type: String, required: true },
    htmlBody: { type: String },
    // Context
    relatedResourceType: { type: String },
    relatedResourceId: { type: String },
    actionUrl: { type: String },
    actionText: { type: String },
    // Delivery Information
    scheduledAt: { type: Date },
    sentAt: { type: Date, index: true },
    deliveredAt: { type: Date },
    failedAt: { type: Date },
    openedAt: { type: Date },
    clickedAt: { type: Date },
    // Retry Logic
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    nextRetryAt: { type: Date, index: true },
    // Metadata
    metadata: {
        templateId: { type: String },
        templateVersion: { type: Number },
        variables: { type: mongoose_1.Schema.Types.Mixed },
        externalId: { type: String },
        providerResponse: { type: mongoose_1.Schema.Types.Mixed },
        errorMessage: { type: String },
        deliveryAttempts: [{
                attemptedAt: { type: Date, required: true },
                status: { type: String, required: true },
                response: { type: mongoose_1.Schema.Types.Mixed },
                error: { type: String },
            }],
    },
    // Archival
    archivedAt: { type: Date },
    isArchived: { type: Boolean, default: false, index: true },
    // Tracking
    trackingId: { type: String, index: true },
    campaignId: { type: String, index: true },
    tags: [{ type: String, index: true }],
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.__v;
            return ret;
        },
    },
    toObject: { virtuals: true },
});
// Indexes for performance
notificationPreferenceSchema.index({ userId: 1, userType: 1 }, { unique: true });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ channel: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, createdAt: -1 });
notificationSchema.index({ status: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ scheduledAt: 1 }, { sparse: true });
notificationSchema.index({ nextRetryAt: 1 }, { sparse: true });
notificationSchema.index({ tags: 1, createdAt: -1 });
// Compound indexes for common queries
notificationSchema.index({
    userId: 1,
    type: 1,
    createdAt: -1
});
notificationSchema.index({
    status: 1,
    scheduledAt: 1
});
notificationSchema.index({
    status: 1,
    nextRetryAt: 1
});
notificationSchema.index({
    channel: 1,
    status: 1,
    createdAt: -1
});
// Virtual for delivery time
notificationSchema.virtual('deliveryTime').get(function () {
    if (this.sentAt && this.deliveredAt) {
        return this.deliveredAt.getTime() - this.sentAt.getTime();
    }
    return null;
});
// Pre-save middleware
notificationSchema.pre('save', function (next) {
    // Set scheduled time if not provided
    if (!this.scheduledAt && this.status === notification_interface_1.NotificationStatus.PENDING) {
        this.scheduledAt = new Date();
    }
    next();
});
// Static methods for common operations
notificationPreferenceSchema.statics.findByUser = function (userId, userType) {
    return this.findOne({ userId, userType });
};
notificationSchema.statics.findPendingForDelivery = function () {
    return this.find({
        status: notification_interface_1.NotificationStatus.PENDING,
        scheduledAt: { $lte: new Date() }
    }).sort({ priority: -1, scheduledAt: 1 });
};
notificationSchema.statics.findFailedForRetry = function () {
    return this.find({
        status: notification_interface_1.NotificationStatus.FAILED,
        nextRetryAt: { $lte: new Date() },
        retryCount: { $lt: this.maxRetries }
    }).sort({ nextRetryAt: 1 });
};
notificationSchema.statics.findByUser = function (userId, options = {}) {
    return this.find(Object.assign({ userId }, options.filter))
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.offset || 0);
};
exports.NotificationPreference = (0, mongoose_1.model)('NotificationPreference', notificationPreferenceSchema);
exports.Notification = (0, mongoose_1.model)('Notification', notificationSchema);
