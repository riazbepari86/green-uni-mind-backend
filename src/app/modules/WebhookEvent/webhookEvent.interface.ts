import { Document, Types } from 'mongoose';

export enum WebhookEventType {
  // Stripe Connect Account Events
  ACCOUNT_UPDATED = 'account.updated',
  ACCOUNT_APPLICATION_DEAUTHORIZED = 'account.application.deauthorized',
  CAPABILITY_UPDATED = 'capability.updated',
  PERSON_CREATED = 'person.created',
  PERSON_UPDATED = 'person.updated',
  EXTERNAL_ACCOUNT_CREATED = 'account.external_account.created',
  EXTERNAL_ACCOUNT_UPDATED = 'account.external_account.updated',
  EXTERNAL_ACCOUNT_DELETED = 'account.external_account.deleted',
  
  // Payout Events
  PAYOUT_CREATED = 'payout.created',
  PAYOUT_PAID = 'payout.paid',
  PAYOUT_FAILED = 'payout.failed',
  PAYOUT_CANCELED = 'payout.canceled',
  PAYOUT_UPDATED = 'payout.updated',
  
  // Transfer Events
  TRANSFER_CREATED = 'transfer.created',
  TRANSFER_PAID = 'transfer.paid',
  TRANSFER_FAILED = 'transfer.failed',
  TRANSFER_REVERSED = 'transfer.reversed',
  TRANSFER_UPDATED = 'transfer.updated',
  
  // Payment Events
  PAYMENT_INTENT_SUCCEEDED = 'payment_intent.succeeded',
  PAYMENT_INTENT_PAYMENT_FAILED = 'payment_intent.payment_failed',
  CHARGE_SUCCEEDED = 'charge.succeeded',
  CHARGE_FAILED = 'charge.failed',
  CHARGE_DISPUTE_CREATED = 'charge.dispute.created',
  
  // Checkout Events
  CHECKOUT_SESSION_COMPLETED = 'checkout.session.completed',
  CHECKOUT_SESSION_EXPIRED = 'checkout.session.expired',
  
  // Application Fee Events
  APPLICATION_FEE_CREATED = 'application_fee.created',
  APPLICATION_FEE_REFUNDED = 'application_fee.refunded',
  
  // Balance Events
  BALANCE_AVAILABLE = 'balance.available',
  
  // Review Events
  REVIEW_OPENED = 'review.opened',
  REVIEW_CLOSED = 'review.closed',
  
  // Topup Events
  TOPUP_CREATED = 'topup.created',
  TOPUP_SUCCEEDED = 'topup.succeeded',
  TOPUP_FAILED = 'topup.failed',
}

export enum WebhookEventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  DUPLICATE = 'duplicate',
}

export enum WebhookEventSource {
  STRIPE_MAIN = 'stripe_main',
  STRIPE_CONNECT = 'stripe_connect',
}

export interface IWebhookEventMetadata {
  // Stripe Event Information
  stripeEventId: string;
  stripeAccountId?: string;
  apiVersion: string;
  
  // Request Information
  ipAddress?: string;
  userAgent?: string;
  requestHeaders?: Record<string, string>;
  
  // Processing Information
  processingStartTime?: Date;
  processingEndTime?: Date;
  processingDuration?: number;
  retryAttempts?: number;
  
  // Error Information
  errorMessage?: string;
  errorCode?: string;
  errorStack?: string;
  
  // Business Context
  affectedUserId?: string;
  affectedUserType?: 'student' | 'teacher' | 'admin';
  relatedResourceIds?: string[];
  
  // Idempotency
  idempotencyKey?: string;
  duplicateOfEventId?: string;
  
  // Compliance
  dataProcessingBasis?: string;
  retentionPeriod?: number;
  
  [key: string]: any;
}

export interface IWebhookEvent extends Document {
  // Core Event Information
  eventType: WebhookEventType;
  source: WebhookEventSource;
  status: WebhookEventStatus;
  
  // Stripe Information
  stripeEventId: string;
  stripeAccountId?: string;
  stripeApiVersion: string;
  
  // Event Data
  eventData: any;
  rawPayload: string;
  
  // Processing Information
  receivedAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  nextRetryAt?: Date;
  
  // Retry Logic
  retryCount: number;
  maxRetries: number;
  retryBackoffMultiplier: number;
  
  // Metadata
  metadata: IWebhookEventMetadata;
  
  // Relationships
  relatedEvents?: Types.ObjectId[];
  parentEventId?: Types.ObjectId;
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  
  // Archival
  archivedAt?: Date;
  isArchived?: boolean;
  
  // Search
  tags?: string[];
  searchableContent?: string;
}

export interface IWebhookEventQuery {
  eventType?: WebhookEventType | WebhookEventType[];
  source?: WebhookEventSource | WebhookEventSource[];
  status?: WebhookEventStatus | WebhookEventStatus[];
  stripeAccountId?: string;
  startDate?: Date;
  endDate?: Date;
  retryCount?: { min?: number; max?: number };
  tags?: string[];
  searchText?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IWebhookEventStats {
  totalEvents: number;
  eventsByType: Record<WebhookEventType, number>;
  eventsByStatus: Record<WebhookEventStatus, number>;
  eventsBySource: Record<WebhookEventSource, number>;
  averageProcessingTime: number;
  successRate: number;
  retryRate: number;
  timeRange: {
    start: Date;
    end: Date;
  };
  topFailureReasons: Array<{
    reason: string;
    count: number;
  }>;
}

export interface IWebhookRetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryableStatuses: string[];
  nonRetryableStatuses: string[];
}
