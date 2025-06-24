import { Document, Types } from 'mongoose';

export enum AuditLogAction {
  // Payment Actions
  PAYMENT_CREATED = 'payment_created',
  PAYMENT_COMPLETED = 'payment_completed',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_REFUNDED = 'payment_refunded',
  
  // Payout Actions
  PAYOUT_CREATED = 'payout_created',
  PAYOUT_SCHEDULED = 'payout_scheduled',
  PAYOUT_PROCESSING = 'payout_processing',
  PAYOUT_COMPLETED = 'payout_completed',
  PAYOUT_FAILED = 'payout_failed',
  PAYOUT_CANCELLED = 'payout_cancelled',
  PAYOUT_RETRY_ATTEMPTED = 'payout_retry_attempted',
  
  // Stripe Connect Actions
  STRIPE_ACCOUNT_CREATED = 'stripe_account_created',
  STRIPE_ACCOUNT_UPDATED = 'stripe_account_updated',
  STRIPE_ACCOUNT_VERIFIED = 'stripe_account_verified',
  STRIPE_ACCOUNT_RESTRICTED = 'stripe_account_restricted',
  STRIPE_ACCOUNT_DEAUTHORIZED = 'stripe_account_deauthorized',
  STRIPE_CAPABILITY_UPDATED = 'stripe_capability_updated',
  STRIPE_EXTERNAL_ACCOUNT_UPDATED = 'stripe_external_account_updated',
  
  // Transfer Actions
  TRANSFER_CREATED = 'transfer_created',
  TRANSFER_PAID = 'transfer_paid',
  TRANSFER_FAILED = 'transfer_failed',
  TRANSFER_REVERSED = 'transfer_reversed',
  
  // Webhook Actions
  WEBHOOK_RECEIVED = 'webhook_received',
  WEBHOOK_PROCESSED = 'webhook_processed',
  WEBHOOK_FAILED = 'webhook_failed',
  WEBHOOK_RETRY_ATTEMPTED = 'webhook_retry_attempted',
  
  // User Actions
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_PROFILE_UPDATED = 'user_profile_updated',
  USER_PASSWORD_CHANGED = 'user_password_changed',
  
  // Administrative Actions
  ADMIN_ACTION_PERFORMED = 'admin_action_performed',
  SYSTEM_MAINTENANCE = 'system_maintenance',
  SECURITY_EVENT = 'security_event',
}

export enum AuditLogLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum AuditLogCategory {
  PAYMENT = 'payment',
  PAYOUT = 'payout',
  STRIPE_CONNECT = 'stripe_connect',
  TRANSFER = 'transfer',
  WEBHOOK = 'webhook',
  USER = 'user',
  ADMIN = 'admin',
  SECURITY = 'security',
  SYSTEM = 'system',
}

export interface IAuditLogMetadata {
  // Request Information
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  
  // Stripe Information
  stripeEventId?: string;
  stripeAccountId?: string;
  stripePayoutId?: string;
  stripeTransferId?: string;
  stripePaymentIntentId?: string;
  
  // Business Context
  amount?: number;
  currency?: string;
  courseId?: string;
  studentId?: string;
  teacherId?: string;
  
  // Error Information
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;
  
  // Additional Context
  previousValue?: any;
  newValue?: any;
  retryAttempt?: number;
  processingTime?: number;
  
  // Compliance Fields
  gdprProcessingBasis?: string;
  dataRetentionPeriod?: number;
  
  [key: string]: any;
}

export interface IAuditLog extends Document {
  // Core Fields
  action: AuditLogAction;
  category: AuditLogCategory;
  level: AuditLogLevel;
  message: string;
  
  // User Context
  userId?: Types.ObjectId;
  userType?: 'student' | 'teacher' | 'admin' | 'system';
  userEmail?: string;
  
  // Resource Context
  resourceType?: string;
  resourceId?: string;
  
  // Metadata
  metadata: IAuditLogMetadata;
  
  // Timestamps
  timestamp: Date;
  createdAt?: Date;
  updatedAt?: Date;
  
  // Compliance
  retentionDate?: Date;
  isArchived?: boolean;
  
  // Search and Indexing
  tags?: string[];
  searchableText?: string;
}

export interface IAuditLogQuery {
  action?: AuditLogAction | AuditLogAction[];
  category?: AuditLogCategory | AuditLogCategory[];
  level?: AuditLogLevel | AuditLogLevel[];
  userId?: string;
  userType?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  searchText?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IAuditLogSummary {
  totalEvents: number;
  eventsByCategory: Record<AuditLogCategory, number>;
  eventsByLevel: Record<AuditLogLevel, number>;
  eventsByAction: Record<AuditLogAction, number>;
  timeRange: {
    start: Date;
    end: Date;
  };
  topUsers: Array<{
    userId: string;
    userEmail: string;
    eventCount: number;
  }>;
  errorRate: number;
  averageProcessingTime: number;
}
