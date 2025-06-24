import { Model, Types } from 'mongoose';

export interface ITeacherUserName {
  firstName: string;
  middleName?: string;
  lastName: string;
}

export type StripeConnectionStatus = 'not_connected' | 'pending' | 'connected' | 'failed' | 'disconnected' | 'restricted';

export interface IStripeConnectInfo {
  accountId?: string;
  email?: string;
  status: StripeConnectionStatus;
  onboardingComplete: boolean;
  verified: boolean;
  requirements: string[];
  capabilities?: {
    card_payments?: 'active' | 'inactive' | 'pending';
    transfers?: 'active' | 'inactive' | 'pending';
  };
  lastStatusUpdate?: Date;
  onboardingUrl?: string;
  failureReason?: string;
  connectedAt?: Date;
  disconnectedAt?: Date;
  lastWebhookReceived?: Date;
}

export interface IStripeAuditLog {
  action: 'account_created' | 'onboarding_started' | 'onboarding_completed' | 'account_verified' | 'account_disconnected' | 'webhook_received' | 'error_occurred';
  timestamp: Date;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface ITeacher {
  user: Types.ObjectId;
  name: ITeacherUserName;
  gender: 'male' | 'female' | 'other';
  email: string;
  profileImg?: string;
  isDeleted?: boolean;
  // Legacy Stripe fields (keeping for backward compatibility)
  stripeAccountId?: string;
  stripeEmail?: string;
  stripeVerified?: boolean;
  stripeOnboardingComplete?: boolean;
  stripeRequirements?: string[];
  // Enhanced Stripe Connect integration
  stripeConnect: IStripeConnectInfo;
  stripeAuditLog: IStripeAuditLog[];
  earnings: {
    total: number;
    monthly: number;
    yearly: number;
    weekly: number;
  };
  totalEarnings?: number;
  payments?: Types.ObjectId[];
  courses: Types.ObjectId[];
  averageRating?: number;
  payoutInfo?: {
    availableBalance?: number;
    pendingBalance?: number;
    lastSyncedAt?: Date;
    nextPayoutDate?: Date;
    nextPayoutAmount?: number;
  };
}

// Analytics interfaces
export interface ICourseAnalytics {
  courseId: Types.ObjectId;
  totalEnrollments: number;
  newEnrollments: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  completionRate: number;
  averageTimeSpent: number; // in minutes
  dropoffRate: number;
  lastUpdated: Date;
}

export interface IStudentEngagement {
  courseId: Types.ObjectId;
  studentId: Types.ObjectId;
  totalTimeSpent: number; // in minutes
  lecturesCompleted: number;
  totalLectures: number;
  lastActivity: Date;
  engagementScore: number; // 0-100
  activityPattern: {
    dailyAverage: number;
    weeklyAverage: number;
    peakHours: number[];
  };
}

export interface IRevenueAnalytics {
  teacherId: Types.ObjectId;
  courseId?: Types.ObjectId;
  totalRevenue: number;
  revenueByPeriod: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  averageOrderValue: number;
  refundRate: number;
  paymentTrends: {
    period: string;
    amount: number;
    count: number;
  }[];
  lastUpdated: Date;
}

export interface IPerformanceMetrics {
  teacherId: Types.ObjectId;
  courseId?: Types.ObjectId;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  studentSatisfactionScore: number;
  courseCompletionRate: number;
  studentRetentionRate: number;
  lastUpdated: Date;
}

export interface IAnalyticsSummary {
  teacherId: Types.ObjectId;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  courseAnalytics: ICourseAnalytics[];
  revenueAnalytics: IRevenueAnalytics;
  performanceMetrics: IPerformanceMetrics;
  studentEngagement: {
    totalActiveStudents: number;
    averageEngagementScore: number;
    topPerformingCourses: Types.ObjectId[];
  };
  generatedAt: Date;
}

export interface TeacherModel extends Model<ITeacher> {
  isUserExists(email: string): Promise<ITeacher | null>;
}
