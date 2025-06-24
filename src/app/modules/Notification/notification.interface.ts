import { Document, Types } from 'mongoose';

export enum NotificationType {
  // Payment Notifications
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_REFUNDED = 'payment_refunded',
  
  // Payout Notifications
  PAYOUT_SCHEDULED = 'payout_scheduled',
  PAYOUT_PROCESSING = 'payout_processing',
  PAYOUT_COMPLETED = 'payout_completed',
  PAYOUT_FAILED = 'payout_failed',
  PAYOUT_DELAYED = 'payout_delayed',
  
  // Stripe Connect Notifications
  STRIPE_ACCOUNT_VERIFIED = 'stripe_account_verified',
  STRIPE_ACCOUNT_RESTRICTED = 'stripe_account_restricted',
  STRIPE_ACCOUNT_REQUIREMENTS_DUE = 'stripe_account_requirements_due',
  STRIPE_ACCOUNT_DEAUTHORIZED = 'stripe_account_deauthorized',
  STRIPE_CAPABILITY_ENABLED = 'stripe_capability_enabled',
  STRIPE_CAPABILITY_DISABLED = 'stripe_capability_disabled',
  STRIPE_EXTERNAL_ACCOUNT_ADDED = 'stripe_external_account_added',
  STRIPE_EXTERNAL_ACCOUNT_UPDATED = 'stripe_external_account_updated',
  
  // Transfer Notifications
  TRANSFER_CREATED = 'transfer_created',
  TRANSFER_PAID = 'transfer_paid',
  TRANSFER_FAILED = 'transfer_failed',
  
  // Account Health Notifications
  ACCOUNT_HEALTH_GOOD = 'account_health_good',
  ACCOUNT_HEALTH_WARNING = 'account_health_warning',
  ACCOUNT_HEALTH_CRITICAL = 'account_health_critical',
  
  // Compliance Notifications
  COMPLIANCE_DOCUMENT_REQUIRED = 'compliance_document_required',
  COMPLIANCE_VERIFICATION_PENDING = 'compliance_verification_pending',
  COMPLIANCE_VERIFICATION_COMPLETED = 'compliance_verification_completed',
  
  // System Notifications
  SYSTEM_MAINTENANCE = 'system_maintenance',
  SECURITY_ALERT = 'security_alert',
  FEATURE_ANNOUNCEMENT = 'feature_announcement',
}

export enum NotificationChannel {
  EMAIL = 'email',
  IN_APP = 'in_app',
  SMS = 'sms',
  PUSH = 'push',
  WEBHOOK = 'webhook',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  OPENED = 'opened',
  CLICKED = 'clicked',
}

export interface INotificationTemplate {
  type: NotificationType;
  channel: NotificationChannel;
  subject?: string;
  title?: string;
  body: string;
  htmlBody?: string;
  variables: string[];
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationPreference extends Document {
  userId: Types.ObjectId;
  userType: 'student' | 'teacher' | 'admin';
  
  // Channel Preferences
  emailEnabled: boolean;
  inAppEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  
  // Notification Type Preferences
  paymentNotifications: boolean;
  payoutNotifications: boolean;
  stripeConnectNotifications: boolean;
  transferNotifications: boolean;
  accountHealthNotifications: boolean;
  complianceNotifications: boolean;
  systemNotifications: boolean;
  marketingNotifications: boolean;
  
  // Frequency Settings
  digestFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly' | 'never';
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
  timezone: string;
  
  // Contact Information
  emailAddress?: string;
  phoneNumber?: string;
  
  // Metadata
  lastUpdated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface INotification extends Document {
  // Core Information
  type: NotificationType;
  channel: NotificationChannel;
  priority: NotificationPriority;
  status: NotificationStatus;
  
  // Recipients
  userId: Types.ObjectId;
  userType: 'student' | 'teacher' | 'admin';
  recipientEmail?: string;
  recipientPhone?: string;
  
  // Content
  subject?: string;
  title?: string;
  body: string;
  htmlBody?: string;
  
  // Context
  relatedResourceType?: string;
  relatedResourceId?: string;
  actionUrl?: string;
  actionText?: string;
  
  // Delivery Information
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  
  // Retry Logic
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  
  // Metadata
  metadata: {
    templateId?: string;
    templateVersion?: number;
    variables?: Record<string, any>;
    externalId?: string;
    providerResponse?: any;
    errorMessage?: string;
    deliveryAttempts?: Array<{
      attemptedAt: Date;
      status: string;
      response?: any;
      error?: string;
    }>;
    [key: string]: any;
  };
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  
  // Archival
  archivedAt?: Date;
  isArchived?: boolean;
  
  // Tracking
  trackingId?: string;
  campaignId?: string;
  tags?: string[];
}

export interface INotificationQuery {
  type?: NotificationType | NotificationType[];
  channel?: NotificationChannel | NotificationChannel[];
  priority?: NotificationPriority | NotificationPriority[];
  status?: NotificationStatus | NotificationStatus[];
  userId?: string;
  userType?: 'student' | 'teacher' | 'admin';
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  campaignId?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface INotificationStats {
  totalNotifications: number;
  notificationsByType: Record<NotificationType, number>;
  notificationsByChannel: Record<NotificationChannel, number>;
  notificationsByStatus: Record<NotificationStatus, number>;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  averageDeliveryTime: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}
