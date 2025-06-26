import { Schema, model } from 'mongoose';
import { 
  IAuditLog, 
  AuditLogAction, 
  AuditLogLevel, 
  AuditLogCategory,
  IAuditLogMetadata 
} from './auditLog.interface';

const auditLogMetadataSchema = new Schema<IAuditLogMetadata>({
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
  previousValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  retryAttempt: { type: Number },
  processingTime: { type: Number },
  
  // Compliance Fields
  gdprProcessingBasis: { type: String },
  dataRetentionPeriod: { type: Number },
}, { 
  _id: false,
  strict: false // Allow additional fields
});

const auditLogSchema = new Schema<IAuditLog>({
  // Core Fields
  action: {
    type: String,
    enum: Object.values(AuditLogAction),
    required: true,
  },
  category: {
    type: String,
    enum: Object.values(AuditLogCategory),
    required: true,
  },
  level: {
    type: String,
    enum: Object.values(AuditLogLevel),
    required: true,
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  
  // User Context
  userId: {
    type: Schema.Types.ObjectId,
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
    transform: function(_doc, ret) {
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
auditLogSchema.pre('save', function(next) {
  // Create searchable text from key fields
  const searchableFields = [
    this.message,
    this.userEmail,
    this.resourceType,
    this.resourceId,
    this.metadata?.errorMessage,
    ...(this.tags || [])
  ].filter(Boolean);
  
  this.searchableText = searchableFields.join(' ').toLowerCase();
  
  // Set retention date if not already set (default 7 years for compliance)
  if (!this.retentionDate) {
    const retentionPeriod = this.metadata?.dataRetentionPeriod || (7 * 365 * 24 * 60 * 60 * 1000); // 7 years in ms
    this.retentionDate = new Date(Date.now() + retentionPeriod);
  }
  
  next();
});

// Static methods for common queries
auditLogSchema.statics.findByUser = function(userId: string, options: any = {}) {
  return this.find({ userId, ...options.filter })
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .skip(options.offset || 0);
};

auditLogSchema.statics.findByResource = function(resourceType: string, resourceId: string, options: any = {}) {
  return this.find({ resourceType, resourceId, ...options.filter })
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .skip(options.offset || 0);
};

auditLogSchema.statics.findByStripeAccount = function(stripeAccountId: string, options: any = {}) {
  return this.find({ 'metadata.stripeAccountId': stripeAccountId, ...options.filter })
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .skip(options.offset || 0);
};

// Prevent model overwrite during development server restarts
export const AuditLog = (() => {
  try {
    // Try to get existing model first
    return model<IAuditLog>('AuditLog');
  } catch (error) {
    // Model doesn't exist, create it
    return model<IAuditLog>('AuditLog', auditLogSchema);
  }
})();
