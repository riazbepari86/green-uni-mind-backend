import { Document, Types } from 'mongoose';

export enum PayoutStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  IN_TRANSIT = 'in_transit',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REVERSED = 'reversed',
}

export enum PayoutSchedule {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  MANUAL = 'manual',
}

export enum PayoutFailureCategory {
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  ACCOUNT_CLOSED = 'account_closed',
  INVALID_ACCOUNT = 'invalid_account',
  BANK_DECLINED = 'bank_declined',
  COMPLIANCE_ISSUE = 'compliance_issue',
  TECHNICAL_ERROR = 'technical_error',
  NETWORK_ERROR = 'network_error',
  RATE_LIMITED = 'rate_limited',
  UNKNOWN = 'unknown',
}

export interface IPayoutRetryConfig {
  maxRetries: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffMultiplier: number;
  jitterEnabled: boolean;
}

export interface IPayoutAttempt {
  attemptNumber: number;
  attemptedAt: Date;
  status: PayoutStatus;
  stripePayoutId?: string;
  failureReason?: string;
  failureCategory?: PayoutFailureCategory;
  processingTime?: number; // in milliseconds
  metadata?: Record<string, any>;
}

export interface IPayout extends Document {
  teacherId: Types.ObjectId;
  amount: number;
  currency: string;
  status: PayoutStatus;

  // Stripe Information
  stripePayoutId?: string;
  stripeTransferId?: string;
  stripeAccountId?: string;

  // Relationships
  transactions: Types.ObjectId[];
  batchId?: string;

  // Content
  description?: string;
  internalNotes?: string;

  // Scheduling
  scheduledAt?: Date;
  requestedAt?: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;

  // Failure Handling
  failureReason?: string;
  failureCategory?: PayoutFailureCategory;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  retryConfig?: IPayoutRetryConfig;
  attempts: IPayoutAttempt[];

  // Notifications
  notificationSent: boolean;
  notificationsSent: string[]; // Array of notification types sent

  // Compliance and Audit
  complianceChecked: boolean;
  complianceNotes?: string;
  auditTrail: Array<{
    action: string;
    timestamp: Date;
    userId?: string;
    userType?: string;
    details?: any;
  }>;

  // Metadata
  metadata: Record<string, any>;
  tags?: string[];

  // Performance Tracking
  estimatedArrival?: Date;
  actualArrival?: Date;
  processingDuration?: number; // in milliseconds

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;

  // Archival
  archivedAt?: Date;
  isArchived?: boolean;
}

export interface IPayoutPreference extends Document {
  teacherId: Types.ObjectId;

  // Schedule Configuration
  schedule: PayoutSchedule;
  customSchedule?: {
    dayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly
    dayOfMonth?: number; // 1-31 for monthly
    hour?: number; // 0-23 for time of day
    timezone?: string;
  };

  // Amount Configuration
  minimumAmount: number;
  maximumAmount?: number;

  // Automation Settings
  isAutoPayoutEnabled: boolean;
  requiresApproval: boolean;
  approvalThreshold?: number; // Amount above which approval is required

  // Timing
  lastPayoutDate?: Date;
  nextScheduledPayoutDate?: Date;

  // Retry Configuration
  retryConfig: IPayoutRetryConfig;

  // Notification Preferences
  notifyOnScheduled: boolean;
  notifyOnProcessing: boolean;
  notifyOnCompleted: boolean;
  notifyOnFailed: boolean;
  notificationChannels: string[]; // email, sms, in_app

  // Banking Information
  preferredBankAccount?: string;
  backupBankAccount?: string;

  // Compliance
  taxWithholdingEnabled: boolean;
  taxWithholdingPercentage?: number;
  complianceChecksEnabled: boolean;

  // Metadata
  metadata: Record<string, any>;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;

  // Status
  isActive: boolean;
  suspendedUntil?: Date;
  suspensionReason?: string;
}

export interface IPayoutBatch extends Document {
  batchId: string;
  teacherIds: Types.ObjectId[];
  payoutIds: Types.ObjectId[];
  totalAmount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  scheduledAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  metadata: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPayoutAnalytics {
  totalPayouts: number;
  totalAmount: number;
  currency: string;
  averageAmount: number;
  successRate: number;
  averageProcessingTime: number; // in milliseconds
  payoutsByStatus: Record<PayoutStatus, number>;
  payoutsBySchedule: Record<PayoutSchedule, number>;
  failuresByCategory: Record<PayoutFailureCategory, number>;
  timeRange: {
    start: Date;
    end: Date;
  };
  trends: {
    daily: Array<{ date: string; count: number; amount: number }>;
    weekly: Array<{ week: string; count: number; amount: number }>;
    monthly: Array<{ month: string; count: number; amount: number }>;
  };
}

export interface IPayoutQuery {
  teacherId?: string;
  status?: PayoutStatus | PayoutStatus[];
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  batchId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
