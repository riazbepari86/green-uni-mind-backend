import { Schema, model } from 'mongoose';
import {
  IPayout,
  IPayoutPreference,
  IPayoutBatch,
  PayoutSchedule,
  PayoutStatus,
  PayoutFailureCategory,
  IPayoutRetryConfig,
  IPayoutAttempt
} from './payout.interface';

const payoutRetryConfigSchema = new Schema<IPayoutRetryConfig>({
  maxRetries: { type: Number, default: 3 },
  baseDelay: { type: Number, default: 60000 }, // 1 minute
  maxDelay: { type: Number, default: 3600000 }, // 1 hour
  backoffMultiplier: { type: Number, default: 2 },
  jitterEnabled: { type: Boolean, default: true },
}, { _id: false });

const payoutAttemptSchema = new Schema<IPayoutAttempt>({
  attemptNumber: { type: Number, required: true },
  attemptedAt: { type: Date, required: true },
  status: {
    type: String,
    enum: Object.values(PayoutStatus),
    required: true
  },
  stripePayoutId: { type: String },
  failureReason: { type: String },
  failureCategory: {
    type: String,
    enum: Object.values(PayoutFailureCategory)
  },
  processingTime: { type: Number },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

const payoutSchema = new Schema<IPayout>({
  teacherId: {
    type: Schema.Types.ObjectId,
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
    enum: Object.values(PayoutStatus),
    default: PayoutStatus.PENDING,
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
    type: Schema.Types.ObjectId,
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
    enum: Object.values(PayoutFailureCategory)
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
    details: { type: Schema.Types.Mixed },
  }],

  // Metadata
  metadata: { type: Schema.Types.Mixed, default: {} },
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
    transform: function(_doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
});

const payoutPreferenceSchema = new Schema<IPayoutPreference>({
  teacherId: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
    unique: true,
  },

  // Schedule Configuration
  schedule: {
    type: String,
    enum: Object.values(PayoutSchedule),
    default: PayoutSchedule.MONTHLY,
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
  metadata: { type: Schema.Types.Mixed, default: {} },

  // Status
  isActive: { type: Boolean, default: true },
  suspendedUntil: { type: Date },
  suspensionReason: { type: String },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(_, ret) {
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
  },
});

const payoutBatchSchema = new Schema<IPayoutBatch>({
  batchId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  teacherIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Teacher',
  }],
  payoutIds: [{
    type: Schema.Types.ObjectId,
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
  metadata: { type: Schema.Types.Mixed, default: {} },
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
payoutSchema.pre('save', function(next) {
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
        previousStatus: this.getChanges().$set?.status,
        newStatus: this.status,
      },
    });
  }

  next();
});

payoutPreferenceSchema.pre('save', function(next) {
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
payoutSchema.statics.findPendingRetries = function() {
  return this.find({
    status: PayoutStatus.FAILED,
    nextRetryAt: { $lte: new Date() },
    $expr: { $lt: ['$retryCount', '$maxRetries'] }
  }).sort({ nextRetryAt: 1 });
};

payoutSchema.statics.findByTeacher = function(teacherId: string, options: any = {}) {
  return this.find({ teacherId, ...options.filter })
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.offset || 0);
};

// Prevent model overwrite during development server restarts
export const Payout = (() => {
  try {
    return model<IPayout>('Payout');
  } catch (error) {
    return model<IPayout>('Payout', payoutSchema);
  }
})();

export const PayoutPreference = (() => {
  try {
    return model<IPayoutPreference>('PayoutPreference');
  } catch (error) {
    return model<IPayoutPreference>('PayoutPreference', payoutPreferenceSchema);
  }
})();

export const PayoutBatch = (() => {
  try {
    return model<IPayoutBatch>('PayoutBatch');
  } catch (error) {
    return model<IPayoutBatch>('PayoutBatch', payoutBatchSchema);
  }
})();
