"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookEvent = void 0;
const mongoose_1 = require("mongoose");
const webhookEvent_interface_1 = require("./webhookEvent.interface");
const webhookEventMetadataSchema = new mongoose_1.Schema({
    // Stripe Event Information
    stripeEventId: { type: String, required: true },
    stripeAccountId: { type: String },
    apiVersion: { type: String, required: true },
    // Request Information
    ipAddress: { type: String },
    userAgent: { type: String },
    requestHeaders: { type: mongoose_1.Schema.Types.Mixed },
    // Processing Information
    processingStartTime: { type: Date },
    processingEndTime: { type: Date },
    processingDuration: { type: Number },
    retryAttempts: { type: Number, default: 0 },
    // Error Information
    errorMessage: { type: String },
    errorCode: { type: String },
    errorStack: { type: String },
    // Business Context
    affectedUserId: { type: String },
    affectedUserType: {
        type: String,
        enum: ['student', 'teacher', 'admin']
    },
    relatedResourceIds: [{ type: String }],
    // Idempotency
    idempotencyKey: { type: String },
    duplicateOfEventId: { type: String },
    // Compliance
    dataProcessingBasis: { type: String },
    retentionPeriod: { type: Number },
}, {
    _id: false,
    strict: false // Allow additional fields
});
const webhookEventSchema = new mongoose_1.Schema({
    // Core Event Information
    eventType: {
        type: String,
        enum: Object.values(webhookEvent_interface_1.WebhookEventType),
        required: true,
    },
    source: {
        type: String,
        enum: Object.values(webhookEvent_interface_1.WebhookEventSource),
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(webhookEvent_interface_1.WebhookEventStatus),
        required: true,
        default: webhookEvent_interface_1.WebhookEventStatus.PENDING,
    },
    // Stripe Information
    stripeEventId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    stripeAccountId: {
        type: String,
    },
    stripeApiVersion: {
        type: String,
        required: true,
    },
    // Event Data
    eventData: {
        type: mongoose_1.Schema.Types.Mixed,
        required: true,
    },
    rawPayload: {
        type: String,
        required: true,
    },
    // Processing Information
    receivedAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
    processedAt: {
        type: Date,
    },
    failedAt: {
        type: Date,
    },
    nextRetryAt: {
        type: Date,
    },
    // Retry Logic
    retryCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    maxRetries: {
        type: Number,
        default: 3,
        min: 0,
    },
    retryBackoffMultiplier: {
        type: Number,
        default: 2,
        min: 1,
    },
    // Metadata
    metadata: {
        type: webhookEventMetadataSchema,
        required: true,
    },
    // Relationships
    relatedEvents: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'WebhookEvent',
        }],
    parentEventId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'WebhookEvent',
    },
    // Archival
    archivedAt: {
        type: Date,
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
    // Search
    tags: [{
            type: String,
        }],
    searchableContent: {
        type: String,
        index: 'text',
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.__v;
            delete ret.rawPayload; // Don't expose raw payload in JSON by default
            return ret;
        },
    },
    toObject: {
        virtuals: true,
    },
});
// Indexes for performance
webhookEventSchema.index({ receivedAt: -1 });
webhookEventSchema.index({ eventType: 1, receivedAt: -1 });
webhookEventSchema.index({ source: 1, receivedAt: -1 });
webhookEventSchema.index({ status: 1, receivedAt: -1 });
webhookEventSchema.index({ stripeAccountId: 1, receivedAt: -1 });
webhookEventSchema.index({ tags: 1, receivedAt: -1 });
// Compound indexes for common queries
webhookEventSchema.index({
    eventType: 1,
    status: 1,
    receivedAt: -1
});
webhookEventSchema.index({
    source: 1,
    eventType: 1,
    receivedAt: -1
});
webhookEventSchema.index({
    stripeAccountId: 1,
    eventType: 1,
    receivedAt: -1
});
webhookEventSchema.index({
    status: 1,
    nextRetryAt: 1
});
// Virtual for processing duration
webhookEventSchema.virtual('processingDuration').get(function () {
    var _a, _b;
    if (((_a = this.metadata) === null || _a === void 0 ? void 0 : _a.processingStartTime) && ((_b = this.metadata) === null || _b === void 0 ? void 0 : _b.processingEndTime)) {
        return this.metadata.processingEndTime.getTime() - this.metadata.processingStartTime.getTime();
    }
    return null;
});
// Pre-save middleware
webhookEventSchema.pre('save', function (next) {
    var _a, _b, _c;
    // Create searchable content
    const searchableFields = [
        this.eventType,
        this.stripeEventId,
        this.stripeAccountId,
        (_a = this.metadata) === null || _a === void 0 ? void 0 : _a.affectedUserId,
        ...(this.tags || [])
    ].filter(Boolean);
    this.searchableContent = searchableFields.join(' ').toLowerCase();
    // Set processing duration in metadata if both times are available
    if (((_b = this.metadata) === null || _b === void 0 ? void 0 : _b.processingStartTime) && ((_c = this.metadata) === null || _c === void 0 ? void 0 : _c.processingEndTime)) {
        this.metadata.processingDuration = this.metadata.processingEndTime.getTime() - this.metadata.processingStartTime.getTime();
    }
    next();
});
// Static methods for common operations
webhookEventSchema.statics.findPendingRetries = function () {
    return this.find({
        status: webhookEvent_interface_1.WebhookEventStatus.FAILED,
        nextRetryAt: { $lte: new Date() },
        $expr: { $lt: ['$retryCount', '$maxRetries'] }
    }).sort({ nextRetryAt: 1 });
};
webhookEventSchema.statics.findByStripeEvent = function (stripeEventId) {
    return this.findOne({ stripeEventId });
};
webhookEventSchema.statics.findByAccount = function (stripeAccountId, options = {}) {
    return this.find(Object.assign({ stripeAccountId }, options.filter))
        .sort({ receivedAt: -1 })
        .limit(options.limit || 100)
        .skip(options.offset || 0);
};
// Prevent model overwrite during development server restarts
exports.WebhookEvent = (() => {
    try {
        // Try to get existing model first
        return (0, mongoose_1.model)('WebhookEvent');
    }
    catch (error) {
        // Model doesn't exist, create it
        return (0, mongoose_1.model)('WebhookEvent', webhookEventSchema);
    }
})();
