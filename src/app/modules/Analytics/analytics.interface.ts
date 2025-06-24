import { Document, Types } from 'mongoose';

// Course Analytics Interface
export interface ICourseAnalytics extends Document {
  courseId: Types.ObjectId;
  teacherId: Types.ObjectId;
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
  engagementMetrics: {
    averageSessionDuration: number;
    totalSessions: number;
    bounceRate: number;
    returnRate: number;
  };
  lastUpdated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Student Engagement Interface
export interface IStudentEngagement extends Document {
  courseId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  totalTimeSpent: number; // in minutes
  lecturesCompleted: number;
  totalLectures: number;
  lastActivity: Date;
  engagementScore: number; // 0-100
  activityPattern: {
    dailyAverage: number;
    weeklyAverage: number;
    peakHours: number[];
    streakDays: number;
  };
  progressMetrics: {
    completionPercentage: number;
    averageQuizScore: number;
    assignmentsCompleted: number;
    certificateEarned: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

// Revenue Analytics Interface
export interface IRevenueAnalytics extends Document {
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
  conversionRate: number;
  paymentTrends: {
    period: string;
    amount: number;
    count: number;
    date: Date;
  }[];
  topPerformingCourses: {
    courseId: Types.ObjectId;
    revenue: number;
    enrollments: number;
  }[];
  lastUpdated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Performance Metrics Interface
export interface IPerformanceMetrics extends Document {
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
  qualityMetrics: {
    contentQuality: number;
    instructorRating: number;
    courseStructure: number;
    valueForMoney: number;
  };
  competitiveMetrics: {
    marketPosition: number;
    categoryRanking: number;
    peerComparison: number;
  };
  lastUpdated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Analytics Summary Interface
export interface IAnalyticsSummary extends Document {
  teacherId: Types.ObjectId;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  courseAnalytics: {
    courseId: Types.ObjectId;
    courseName: string;
    enrollments: number;
    revenue: number;
    completionRate: number;
    rating: number;
  }[];
  revenueAnalytics: {
    totalRevenue: number;
    growth: number;
    topCourse: Types.ObjectId;
    averageOrderValue: number;
  };
  performanceMetrics: {
    averageRating: number;
    totalStudents: number;
    completionRate: number;
    satisfactionScore: number;
  };
  studentEngagement: {
    totalActiveStudents: number;
    averageEngagementScore: number;
    topPerformingCourses: Types.ObjectId[];
    retentionRate: number;
  };
  insights: {
    topInsight: string;
    recommendations: string[];
    alerts: string[];
  };
  generatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Activity Types for Activity Feed
export enum ActivityType {
  ENROLLMENT = 'enrollment',
  COMPLETION = 'completion',
  PAYMENT = 'payment',
  REVIEW = 'review',
  QUESTION = 'question',
  COURSE_UPDATE = 'course_update',
  CERTIFICATE = 'certificate',
  REFUND = 'refund',
  MESSAGE = 'message'
}

export enum ActivityPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Activity Feed Interface
export interface IActivity extends Document {
  teacherId: Types.ObjectId;
  courseId?: Types.ObjectId;
  studentId?: Types.ObjectId;
  type: ActivityType;
  priority: ActivityPriority;
  title: string;
  description: string;
  metadata: {
    amount?: number;
    rating?: number;
    progress?: number;
    [key: string]: any;
  };
  isRead: boolean;
  actionRequired: boolean;
  actionUrl?: string;
  relatedEntity: {
    entityType: 'course' | 'student' | 'payment' | 'review';
    entityId: Types.ObjectId;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

// Query interfaces for filtering and pagination
export interface IAnalyticsQuery {
  teacherId: string;
  courseId?: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface IActivityQuery {
  teacherId: string;
  type?: ActivityType;
  priority?: ActivityPriority;
  isRead?: boolean;
  courseId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
}
