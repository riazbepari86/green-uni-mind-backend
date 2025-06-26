"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
const mongoose_1 = require("mongoose");
const auditLog_interface_1 = require("./auditLog.interface");
const auditLogMetadataSchema = new mongoose_1.Schema({
    // Request Information
    ipAddress: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
    sessionId: { type: String },
    // Stripe Information
    stripeEventId: { type: String },
    stripeAccountId: { type: String },
    stripePayoutId: { type: String },
    stripeTransferId: { type: String },
    stripePaymentIntentId: { type: String },
    // Business Context
    amount: { type: Number },
    currency: { type: String },
    courseId: { type: String },
    studentId: { type: String },
    teacherId: { type: String },
    // Error Information
    errorCode: { type: String },
    errorMessage: { type: String },
    stackTrace: { type: String },
    // Additional Context
    previousValue: { type: mongoose_1.Schema.Types.Mixed },
    newValue: { type: mongoose_1.Schema.Types.Mixed },
    retryAttempt: { type: Number },
    processingTime: { type: Number },
    // Compliance Fields
    gdprProcessingBasis: { type: String },
    dataRetentionPeriod: { type: Number },
}, {
    _id: false,
    strict: false // Allow additional fields
});
const auditLogSchema = new mongoose_1.Schema({
    // Core Fields
    action: {
        type: String,
        enum: Object.values(auditLog_interface_1.AuditLogAction),
        required: true,
    },
    category: {
        type: String,
        enum: Object.values(auditLog_interface_1.AuditLogCategory),
        required: true,
    },
    level: {
        type: String,
        enum: Object.values(auditLog_interface_1.AuditLogLevel),
        required: true,
    },
    message: {
        type: String,
        required: true,
        maxlength: 1000,
    },
    // User Context
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
    },
    userType: {
        type: String,
        enum: ['student', 'teacher', 'admin', 'system'],
    },
    userEmail: {
        type: String,
    },
    // Resource Context
    resourceType: {
        type: String,
    },
    resourceId: {
        type: String,
    },
    // Metadata
    metadata: {
        type: auditLogMetadataSchema,
        required: true,
    },
    // Timestamps
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
    },
    // Compliance
    retentionDate: {
        type: Date,
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
    // Search and Indexing
    tags: [{
            type: String,
        }],
    searchableText: {
        type: String,
        index: 'text',
    },
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
// Indexes for performance
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, timestamp: -1 });
auditLogSchema.index({ level: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ 'metadata.stripeEventId': 1 });
auditLogSchema.index({ 'metadata.stripeAccountId': 1, timestamp: -1 });
auditLogSchema.index({ tags: 1, timestamp: -1 });
// Compound indexes for common queries
auditLogSchema.index({
    category: 1,
    action: 1,
    timestamp: -1
});
auditLogSchema.index({
    userId: 1,
    category: 1,
    timestamp: -1
});
auditLogSchema.index({
    'metadata.stripeAccountId': 1,
    action: 1,
    timestamp: -1
});
// TTL index for automatic cleanup (optional - can be managed by retention policy)
auditLogSchema.index({
    retentionDate: 1
}, {
    expireAfterSeconds: 0,
    sparse: true
});
// Pre-save middleware to set searchable text and retention date
auditLogSchema.pre('save', function (next) {
    var _a, _b;
    // Create searchable text from key fields
    const searchableFields = [
        this.message,
        this.userEmail,
        this.resourceType,
        this.resourceId,
        (_a = this.metadata) === null || _a === void 0 ? void 0 : _a.errorMessage,
        ...(this.tags || [])
    ].filter(Boolean);
    this.searchableText = searchableFields.join(' ').toLowerCase();
    // Set retention date if not already set (default 7 years for compliance)
    if (!this.retentionDate) {
        const retentionPeriod = ((_b = this.metadata) === null || _b === void 0 ? void 0 : _b.dataRetentionPeriod) || (7 * 365 * 24 * 60 * 60 * 1000); // 7 years in ms
        this.retentionDate = new Date(Date.now() + retentionPeriod);
    }
    next();
});
// Static methods for common queries
auditLogSchema.statics.findByUser = function (userId, options = {}) {
    return this.find(Object.assign({ userId }, options.filter))
        .sort({ timestamp: -1 })
        .limit(options.limit || 100)
        .skip(options.offset || 0);
};
auditLogSchema.statics.findByResource = function (resourceType, resourceId, options = {}) {
    return this.find(Object.assign({ resourceType, resourceId }, options.filter))
        .sort({ timestamp: -1 })
        .limit(options.limit || 100)
        .skip(options.offset || 0);
};
auditLogSchema.statics.findByStripeAccount = function (stripeAccountId, options = {}) {
    return this.find(Object.assign({ 'metadata.stripeAccountId': stripeAccountId }, options.filter))
        .sort({ timestamp: -1 })
        .limit(options.limit || 100)
        .skip(options.offset || 0);
};
// Prevent model overwrite during development server restarts
exports.AuditLog = (() => {
    try {
        // Try to get existing model first
        return (0, mongoose_1.model)('AuditLog');
    }
    catch (error) {
        // Model doesn't exist, create it
        return (0, mongoose_1.model)('AuditLog', auditLogSchema);
    }
})();
