import { model, Schema } from 'mongoose';
import {
  ICourseAnalytics,
  IStudentEngagement,
  IRevenueAnalytics,
  IPerformanceMetrics,
  IAnalyticsSummary,
  IActivity,
  ActivityType,
  ActivityPriority
} from './analytics.interface';

// Course Analytics Schema
const courseAnalyticsSchema = new Schema<ICourseAnalytics>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      index: true,
    },
    totalEnrollments: {
      type: Number,
      default: 0,
      min: 0,
    },
    newEnrollments: {
      daily: { type: Number, default: 0, min: 0 },
      weekly: { type: Number, default: 0, min: 0 },
      monthly: { type: Number, default: 0, min: 0 },
      yearly: { type: Number, default: 0, min: 0 },
    },
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    averageTimeSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    dropoffRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    engagementMetrics: {
      averageSessionDuration: { type: Number, default: 0, min: 0 },
      totalSessions: { type: Number, default: 0, min: 0 },
      bounceRate: { type: Number, default: 0, min: 0, max: 100 },
      returnRate: { type: Number, default: 0, min: 0, max: 100 },
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Student Engagement Schema
const studentEngagementSchema = new Schema<IStudentEngagement>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      index: true,
    },
    totalTimeSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    lecturesCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalLectures: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    activityPattern: {
      dailyAverage: { type: Number, default: 0, min: 0 },
      weeklyAverage: { type: Number, default: 0, min: 0 },
      peakHours: [{ type: Number, min: 0, max: 23 }],
      streakDays: { type: Number, default: 0, min: 0 },
    },
    progressMetrics: {
      completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
      averageQuizScore: { type: Number, default: 0, min: 0, max: 100 },
      assignmentsCompleted: { type: Number, default: 0, min: 0 },
      certificateEarned: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Revenue Analytics Schema
const revenueAnalyticsSchema = new Schema<IRevenueAnalytics>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      index: true,
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    revenueByPeriod: {
      daily: { type: Number, default: 0, min: 0 },
      weekly: { type: Number, default: 0, min: 0 },
      monthly: { type: Number, default: 0, min: 0 },
      yearly: { type: Number, default: 0, min: 0 },
    },
    averageOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    refundRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    conversionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    paymentTrends: [{
      period: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      count: { type: Number, required: true, min: 0 },
      date: { type: Date, required: true },
    }],
    topPerformingCourses: [{
      courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
      revenue: { type: Number, required: true, min: 0 },
      enrollments: { type: Number, required: true, min: 0 },
    }],
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Performance Metrics Schema
const performanceMetricsSchema = new Schema<IPerformanceMetrics>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      index: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratingDistribution: {
      1: { type: Number, default: 0, min: 0 },
      2: { type: Number, default: 0, min: 0 },
      3: { type: Number, default: 0, min: 0 },
      4: { type: Number, default: 0, min: 0 },
      5: { type: Number, default: 0, min: 0 },
    },
    studentSatisfactionScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    courseCompletionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    studentRetentionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    qualityMetrics: {
      contentQuality: { type: Number, default: 0, min: 0, max: 100 },
      instructorRating: { type: Number, default: 0, min: 0, max: 100 },
      courseStructure: { type: Number, default: 0, min: 0, max: 100 },
      valueForMoney: { type: Number, default: 0, min: 0, max: 100 },
    },
    competitiveMetrics: {
      marketPosition: { type: Number, default: 0, min: 0, max: 100 },
      categoryRanking: { type: Number, default: 0, min: 0 },
      peerComparison: { type: Number, default: 0, min: 0, max: 100 },
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Analytics Summary Schema
const analyticsSummarySchema = new Schema<IAnalyticsSummary>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      index: true,
    },
    period: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      required: true,
    },
    dateRange: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    courseAnalytics: [{
      courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
      courseName: { type: String, required: true },
      enrollments: { type: Number, default: 0, min: 0 },
      revenue: { type: Number, default: 0, min: 0 },
      completionRate: { type: Number, default: 0, min: 0, max: 100 },
      rating: { type: Number, default: 0, min: 0, max: 5 },
    }],
    revenueAnalytics: {
      totalRevenue: { type: Number, default: 0, min: 0 },
      growth: { type: Number, default: 0 },
      topCourse: { type: Schema.Types.ObjectId, ref: 'Course' },
      averageOrderValue: { type: Number, default: 0, min: 0 },
    },
    performanceMetrics: {
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalStudents: { type: Number, default: 0, min: 0 },
      completionRate: { type: Number, default: 0, min: 0, max: 100 },
      satisfactionScore: { type: Number, default: 0, min: 0, max: 100 },
    },
    studentEngagement: {
      totalActiveStudents: { type: Number, default: 0, min: 0 },
      averageEngagementScore: { type: Number, default: 0, min: 0, max: 100 },
      topPerformingCourses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
      retentionRate: { type: Number, default: 0, min: 0, max: 100 },
    },
    insights: {
      topInsight: { type: String, default: '' },
      recommendations: [{ type: String }],
      alerts: [{ type: String }],
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Activity Schema
const activitySchema = new Schema<IActivity>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
    },
    type: {
      type: String,
      enum: Object.values(ActivityType),
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(ActivityPriority),
      default: ActivityPriority.MEDIUM,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    actionRequired: {
      type: Boolean,
      default: false,
      index: true,
    },
    actionUrl: {
      type: String,
      trim: true,
    },
    relatedEntity: {
      entityType: {
        type: String,
        enum: ['course', 'student', 'payment', 'review'],
        required: true,
      },
      entityId: {
        type: Schema.Types.ObjectId,
        required: true,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create indexes for better performance
courseAnalyticsSchema.index({ teacherId: 1, courseId: 1 }, { unique: true });
courseAnalyticsSchema.index({ lastUpdated: -1 });

studentEngagementSchema.index({ teacherId: 1, courseId: 1, studentId: 1 }, { unique: true });
studentEngagementSchema.index({ lastActivity: -1 });
studentEngagementSchema.index({ engagementScore: -1 });

revenueAnalyticsSchema.index({ teacherId: 1, courseId: 1 });
revenueAnalyticsSchema.index({ lastUpdated: -1 });

performanceMetricsSchema.index({ teacherId: 1, courseId: 1 });
performanceMetricsSchema.index({ averageRating: -1 });
performanceMetricsSchema.index({ lastUpdated: -1 });

analyticsSummarySchema.index({ teacherId: 1, period: 1, 'dateRange.startDate': 1 });
analyticsSummarySchema.index({ generatedAt: -1 });

activitySchema.index({ teacherId: 1, createdAt: -1 });
activitySchema.index({ teacherId: 1, isRead: 1, priority: -1 });
activitySchema.index({ teacherId: 1, type: 1, createdAt: -1 });

// Export models with overwrite protection
export const CourseAnalytics = (() => {
  try {
    return model<ICourseAnalytics>('CourseAnalytics');
  } catch (error) {
    return model<ICourseAnalytics>('CourseAnalytics', courseAnalyticsSchema);
  }
})();

export const StudentEngagement = (() => {
  try {
    return model<IStudentEngagement>('StudentEngagement');
  } catch (error) {
    return model<IStudentEngagement>('StudentEngagement', studentEngagementSchema);
  }
})();

export const RevenueAnalytics = (() => {
  try {
    return model<IRevenueAnalytics>('RevenueAnalytics');
  } catch (error) {
    return model<IRevenueAnalytics>('RevenueAnalytics', revenueAnalyticsSchema);
  }
})();

export const PerformanceMetrics = (() => {
  try {
    return model<IPerformanceMetrics>('PerformanceMetrics');
  } catch (error) {
    return model<IPerformanceMetrics>('PerformanceMetrics', performanceMetricsSchema);
  }
})();

export const AnalyticsSummary = (() => {
  try {
    return model<IAnalyticsSummary>('AnalyticsSummary');
  } catch (error) {
    return model<IAnalyticsSummary>('AnalyticsSummary', analyticsSummarySchema);
  }
})();

export const Activity = (() => {
  try {
    return model<IActivity>('Activity');
  } catch (error) {
    return model<IActivity>('Activity', activitySchema);
  }
})();
