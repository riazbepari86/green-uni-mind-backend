"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutBatch = exports.PayoutPreference = exports.Payout = void 0;
const mongoose_1 = require("mongoose");
const payout_interface_1 = require("./payout.interface");
const payoutRetryConfigSchema = new mongoose_1.Schema({
    maxRetries: { type: Number, default: 3 },
    baseDelay: { type: Number, default: 60000 }, // 1 minute
    maxDelay: { type: Number, default: 3600000 }, // 1 hour
    backoffMultiplier: { type: Number, default: 2 },
    jitterEnabled: { type: Boolean, default: true },
}, { _id: false });
const payoutAttemptSchema = new mongoose_1.Schema({
    attemptNumber: { type: Number, required: true },
    attemptedAt: { type: Date, required: true },
    status: {
        type: String,
        enum: Object.values(payout_interface_1.PayoutStatus),
        required: true
    },
    stripePayoutId: { type: String },
    failureReason: { type: String },
    failureCategory: {
        type: String,
        enum: Object.values(payout_interface_1.PayoutFailureCategory)
    },
    processingTime: { type: Number },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
}, { _id: false });
const payoutSchema = new mongoose_1.Schema({
    teacherId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        default: 'usd',
        uppercase: true,
    },
    status: {
        type: String,
        enum: Object.values(payout_interface_1.PayoutStatus),
        default: payout_interface_1.PayoutStatus.PENDING,
    },
    // Stripe Information
    stripePayoutId: {
        type: String,
    },
    stripeTransferId: {
        type: String,
    },
    stripeAccountId: {
        type: String,
    },
    // Relationships
    transactions: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Transaction',
        }],
    batchId: {
        type: String,
    },
    // Content
    description: { type: String },
    internalNotes: { type: String },
    // Scheduling
    scheduledAt: { type: Date },
    requestedAt: { type: Date },
    processedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
    cancelledAt: { type: Date },
    // Failure Handling
    failureReason: { type: String },
    failureCategory: {
        type: String,
        enum: Object.values(payout_interface_1.PayoutFailureCategory)
    },
    retryCount: { type: Number, default: 0, min: 0 },
    maxRetries: { type: Number, default: 3, min: 0 },
    nextRetryAt: { type: Date },
    retryConfig: { type: payoutRetryConfigSchema },
    attempts: [payoutAttemptSchema],
    // Notifications
    notificationSent: { type: Boolean, default: false },
    notificationsSent: [{ type: String }],
    // Compliance and Audit
    complianceChecked: { type: Boolean, default: false },
    complianceNotes: { type: String },
    auditTrail: [{
            action: { type: String, required: true },
            timestamp: { type: Date, required: true, default: Date.now },
            userId: { type: String },
            userType: { type: String },
            details: { type: mongoose_1.Schema.Types.Mixed },
        }],
    // Metadata
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    tags: [{ type: String }],
    // Performance Tracking
    estimatedArrival: { type: Date },
    actualArrival: { type: Date },
    processingDuration: { type: Number },
    // Archival
    archivedAt: { type: Date },
    isArchived: { type: Boolean, default: false, index: true },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (_doc, ret) {
            delete ret.__v;
            return ret;
        },
    },
    toObject: {
        virtuals: true,
    },
});
const payoutPreferenceSchema = new mongoose_1.Schema({
    teacherId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true,
        unique: true,
    },
    // Schedule Configuration
    schedule: {
        type: String,
        enum: Object.values(payout_interface_1.PayoutSchedule),
        default: payout_interface_1.PayoutSchedule.MONTHLY,
    },
    customSchedule: {
        dayOfWeek: { type: Number, min: 0, max: 6 },
        dayOfMonth: { type: Number, min: 1, max: 31 },
        hour: { type: Number, min: 0, max: 23 },
        timezone: { type: String, default: 'UTC' },
    },
    // Amount Configuration
    minimumAmount: { type: Number, default: 50, min: 0 },
    maximumAmount: { type: Number, min: 0 },
    // Automation Settings
    isAutoPayoutEnabled: { type: Boolean, default: true },
    requiresApproval: { type: Boolean, default: false },
    approvalThreshold: { type: Number, min: 0 },
    // Timing
    lastPayoutDate: { type: Date },
    nextScheduledPayoutDate: { type: Date },
    // Retry Configuration
    retryConfig: { type: payoutRetryConfigSchema, required: true },
    // Notification Preferences
    notifyOnScheduled: { type: Boolean, default: true },
    notifyOnProcessing: { type: Boolean, default: true },
    notifyOnCompleted: { type: Boolean, default: true },
    notifyOnFailed: { type: Boolean, default: true },
    notificationChannels: [{ type: String, enum: ['email', 'sms', 'in_app'] }],
    // Banking Information
    preferredBankAccount: { type: String },
    backupBankAccount: { type: String },
    // Compliance
    taxWithholdingEnabled: { type: Boolean, default: false },
    taxWithholdingPercentage: { type: Number, min: 0, max: 100 },
    complianceChecksEnabled: { type: Boolean, default: true },
    // Metadata
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    // Status
    isActive: { type: Boolean, default: true },
    suspendedUntil: { type: Date },
    suspensionReason: { type: String },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (_, ret) {
            delete ret.__v;
            return ret;
        },
    },
    toObject: {
        virtuals: true,
    },
});
const payoutBatchSchema = new mongoose_1.Schema({
    batchId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    teacherIds: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Teacher',
        }],
    payoutIds: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Payout',
        }],
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        index: true,
    },
    scheduledAt: { type: Date, required: true },
    processedAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Indexes for performance
payoutSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
payoutSchema.index({ status: 1, scheduledAt: 1 });
payoutSchema.index({ status: 1, nextRetryAt: 1 });
payoutSchema.index({ batchId: 1, status: 1 });
payoutSchema.index({ stripePayoutId: 1 }, { sparse: true });
payoutSchema.index({ tags: 1, createdAt: -1 });
payoutPreferenceSchema.index({ teacherId: 1 }, { unique: true });
payoutPreferenceSchema.index({ nextScheduledPayoutDate: 1, isActive: 1 });
payoutBatchSchema.index({ status: 1, scheduledAt: 1 });
payoutBatchSchema.index({ createdAt: -1 });
// Pre-save middleware
payoutSchema.pre('save', function (next) {
    var _a;
    // Set default retry config if not provided
    if (!this.retryConfig) {
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 60000,
            maxDelay: 3600000,
            backoffMultiplier: 2,
            jitterEnabled: true,
        };
    }
    // Add audit trail entry for status changes
    if (this.isModified('status')) {
        this.auditTrail.push({
            action: `status_changed_to_${this.status}`,
            timestamp: new Date(),
            details: {
                previousStatus: (_a = this.getChanges().$set) === null || _a === void 0 ? void 0 : _a.status,
                newStatus: this.status,
            },
        });
    }
    next();
});
payoutPreferenceSchema.pre('save', function (next) {
    // Set default retry config if not provided
    if (!this.retryConfig) {
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 60000,
            maxDelay: 3600000,
            backoffMultiplier: 2,
            jitterEnabled: true,
        };
    }
    // Set default notification channels if not provided
    if (!this.notificationChannels || this.notificationChannels.length === 0) {
        this.notificationChannels = ['email', 'in_app'];
    }
    next();
});
// Static methods
payoutSchema.statics.findPendingRetries = function () {
    return this.find({
        status: payout_interface_1.PayoutStatus.FAILED,
        nextRetryAt: { $lte: new Date() },
        $expr: { $lt: ['$retryCount', '$maxRetries'] }
    }).sort({ nextRetryAt: 1 });
};
payoutSchema.statics.findByTeacher = function (teacherId, options = {}) {
    return this.find(Object.assign({ teacherId }, options.filter))
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.offset || 0);
};
// Prevent model overwrite during development server restarts
exports.Payout = (() => {
    try {
        return (0, mongoose_1.model)('Payout');
    }
    catch (error) {
        return (0, mongoose_1.model)('Payout', payoutSchema);
    }
})();
exports.PayoutPreference = (() => {
    try {
        return (0, mongoose_1.model)('PayoutPreference');
    }
    catch (error) {
        return (0, mongoose_1.model)('PayoutPreference', payoutPreferenceSchema);
    }
})();
exports.PayoutBatch = (() => {
    try {
        return (0, mongoose_1.model)('PayoutBatch');
    }
    catch (error) {
        return (0, mongoose_1.model)('PayoutBatch', payoutBatchSchema);
    }
})();
