import { Schema, model } from 'mongoose';
import { 
  IWebhookEvent, 
  WebhookEventType, 
  WebhookEventStatus, 
  WebhookEventSource,
  IWebhookEventMetadata 
} from './webhookEvent.interface';

const webhookEventMetadataSchema = new Schema<IWebhookEventMetadata>({
  // Stripe Event Information
  stripeEventId: { type: String, required: true },
  stripeAccountId: { type: String },
  apiVersion: { type: String, required: true },
  
  // Request Information
  ipAddress: { type: String },
  userAgent: { type: String },
  requestHeaders: { type: Schema.Types.Mixed },
  
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

const webhookEventSchema = new Schema<IWebhookEvent>({
  // Core Event Information
  eventType: {
    type: String,
    enum: Object.values(WebhookEventType),
    required: true,
    index: true,
  },
  source: {
    type: String,
    enum: Object.values(WebhookEventSource),
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(WebhookEventStatus),
    required: true,
    default: WebhookEventStatus.PENDING,
    index: true,
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
    index: true,
  },
  stripeApiVersion: {
    type: String,
    required: true,
  },
  
  // Event Data
  eventData: {
    type: Schema.Types.Mixed,
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
    index: true,
  },
  processedAt: {
    type: Date,
    index: true,
  },
  failedAt: {
    type: Date,
    index: true,
  },
  nextRetryAt: {
    type: Date,
    index: true,
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
    type: Schema.Types.ObjectId,
    ref: 'WebhookEvent',
  }],
  parentEventId: {
    type: Schema.Types.ObjectId,
    ref: 'WebhookEvent',
  },
  
  // Archival
  archivedAt: {
    type: Date,
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  // Search
  tags: [{
    type: String,
    index: true,
  }],
  searchableContent: {
    type: String,
    index: 'text',
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
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
webhookEventSchema.index({ nextRetryAt: 1 }, { sparse: true });
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
webhookEventSchema.virtual('processingDuration').get(function() {
  if (this.metadata?.processingStartTime && this.metadata?.processingEndTime) {
    return this.metadata.processingEndTime.getTime() - this.metadata.processingStartTime.getTime();
  }
  return null;
});

// Pre-save middleware
webhookEventSchema.pre('save', function(next) {
  // Create searchable content
  const searchableFields = [
    this.eventType,
    this.stripeEventId,
    this.stripeAccountId,
    this.metadata?.affectedUserId,
    ...(this.tags || [])
  ].filter(Boolean);
  
  this.searchableContent = searchableFields.join(' ').toLowerCase();
  
  // Set processing duration in metadata if both times are available
  if (this.metadata?.processingStartTime && this.metadata?.processingEndTime) {
    this.metadata.processingDuration = this.metadata.processingEndTime.getTime() - this.metadata.processingStartTime.getTime();
  }
  
  next();
});

// Static methods for common operations
webhookEventSchema.statics.findPendingRetries = function() {
  return this.find({
    status: WebhookEventStatus.FAILED,
    nextRetryAt: { $lte: new Date() },
    retryCount: { $lt: this.maxRetries }
  }).sort({ nextRetryAt: 1 });
};

webhookEventSchema.statics.findByStripeEvent = function(stripeEventId: string) {
  return this.findOne({ stripeEventId });
};

webhookEventSchema.statics.findByAccount = function(stripeAccountId: string, options: any = {}) {
  return this.find({ stripeAccountId, ...options.filter })
    .sort({ receivedAt: -1 })
    .limit(options.limit || 100)
    .skip(options.offset || 0);
};

export const WebhookEvent = model<IWebhookEvent>('WebhookEvent', webhookEventSchema);
