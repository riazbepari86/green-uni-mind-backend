import { z } from 'zod';
import { ActivityType, ActivityPriority } from './analytics.interface';

// Common validation schemas
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

const periodSchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

const dateSchema = z.string().refine((date) => {
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}, 'Invalid date format');

const paginationSchema = z.object({
  limit: z.string().optional().transform((val) => val ? parseInt(val) : 20).refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  offset: z.string().optional().transform((val) => val ? parseInt(val) : 0).refine((val) => val >= 0, 'Offset must be non-negative'),
});

// Analytics query validation
export const getTeacherAnalyticsValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    period: periodSchema.optional().default('monthly'),
    courseId: objectIdSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    compareWithPrevious: z.string().optional().transform((val) => val === 'true'),
  }).refine((data) => {
    // If startDate is provided, endDate must also be provided
    if (data.startDate && !data.endDate) {
      return false;
    }
    if (data.endDate && !data.startDate) {
      return false;
    }
    // If both dates are provided, startDate must be before endDate
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  }, 'Invalid date range: startDate must be before endDate, and both must be provided together'),
});

export const getCourseAnalyticsValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
    courseId: objectIdSchema,
  }),
  query: z.object({
    period: periodSchema.optional().default('monthly'),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  }).refine((data) => {
    if (data.startDate && !data.endDate) {
      return false;
    }
    if (data.endDate && !data.startDate) {
      return false;
    }
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  }, 'Invalid date range'),
});

export const getRevenueAnalyticsValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    courseId: objectIdSchema.optional(),
    period: periodSchema.optional().default('monthly'),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  }).refine((data) => {
    if (data.startDate && !data.endDate) {
      return false;
    }
    if (data.endDate && !data.startDate) {
      return false;
    }
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  }, 'Invalid date range'),
});

export const getPerformanceMetricsValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    courseId: objectIdSchema.optional(),
    period: periodSchema.optional().default('monthly'),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  }).refine((data) => {
    if (data.startDate && !data.endDate) {
      return false;
    }
    if (data.endDate && !data.startDate) {
      return false;
    }
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  }, 'Invalid date range'),
});

export const getStudentEngagementValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    courseId: objectIdSchema.optional(),
    period: periodSchema.optional().default('monthly'),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  }).refine((data) => {
    if (data.startDate && !data.endDate) {
      return false;
    }
    if (data.endDate && !data.startDate) {
      return false;
    }
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  }, 'Invalid date range'),
});

// Activity feed validation
export const getActivityFeedValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    ...paginationSchema.shape,
    type: z.nativeEnum(ActivityType).optional(),
    priority: z.nativeEnum(ActivityPriority).optional(),
    isRead: z.string().optional().transform((val) => val === 'true'),
    courseId: objectIdSchema.optional(),
    sortBy: z.enum(['createdAt', 'priority', 'type']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const markActivityAsReadValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
    activityId: objectIdSchema,
  }),
});

export const getDashboardSummaryValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
});

export const exportAnalyticsValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    format: z.enum(['json', 'csv']).optional().default('json'),
    period: periodSchema.optional().default('monthly'),
    courseId: objectIdSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  }).refine((data) => {
    if (data.startDate && !data.endDate) {
      return false;
    }
    if (data.endDate && !data.startDate) {
      return false;
    }
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  }, 'Invalid date range'),
});

// Activity tracking validation (for internal use)
export const trackActivityValidation = z.object({
  body: z.object({
    teacherId: objectIdSchema,
    courseId: objectIdSchema.optional(),
    studentId: objectIdSchema.optional(),
    type: z.nativeEnum(ActivityType),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(500),
    metadata: z.record(z.any()).optional(),
    priority: z.nativeEnum(ActivityPriority).optional().default(ActivityPriority.MEDIUM),
    actionRequired: z.boolean().optional().default(false),
    actionUrl: z.string().url().optional(),
    relatedEntity: z.object({
      entityType: z.enum(['course', 'student', 'payment', 'review']),
      entityId: objectIdSchema,
    }),
  }),
});

// Bulk operations validation
export const bulkMarkActivitiesAsReadValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  body: z.object({
    activityIds: z.array(objectIdSchema).min(1).max(50),
  }),
});

// Analytics filters validation
export const analyticsFiltersValidation = z.object({
  teacherId: objectIdSchema,
  courseId: objectIdSchema.optional(),
  period: periodSchema,
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  compareWithPrevious: z.boolean().optional().default(false),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return data.startDate < data.endDate;
  }
  return true;
}, 'Start date must be before end date');

// Real-time analytics validation
export const realtimeAnalyticsValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    metrics: z.array(z.enum(['enrollments', 'revenue', 'activities', 'engagement'])).optional(),
    interval: z.enum(['1m', '5m', '15m', '1h']).optional().default('5m'),
  }),
});

// Custom date range validation helper
export const validateDateRange = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) {
    return true; // Optional dates
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return false; // Invalid dates
  }
  
  if (start >= end) {
    return false; // Start date must be before end date
  }
  
  // Check if date range is not too large (max 1 year)
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > oneYear) {
    return false;
  }
  
  return true;
};

// Enhanced analytics validation schemas
export const getEnrollmentStatisticsValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    period: periodSchema.optional().default('monthly'),
    courseId: objectIdSchema.optional(),
  }),
});

export const getEngagementMetricsValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    period: periodSchema.optional().default('monthly'),
    courseId: objectIdSchema.optional(),
  }),
});

export const getRevenueAnalyticsDetailedValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    period: periodSchema.optional().default('monthly'),
    courseId: objectIdSchema.optional(),
  }),
});

export const getPerformanceMetricsDetailedValidation = z.object({
  params: z.object({
    teacherId: objectIdSchema,
  }),
  query: z.object({
    period: periodSchema.optional().default('monthly'),
    courseId: objectIdSchema.optional(),
  }),
});

// Export all validation schemas
export const AnalyticsValidation = {
  getTeacherAnalytics: getTeacherAnalyticsValidation,
  getCourseAnalytics: getCourseAnalyticsValidation,
  getRevenueAnalytics: getRevenueAnalyticsValidation,
  getPerformanceMetrics: getPerformanceMetricsValidation,
  getStudentEngagement: getStudentEngagementValidation,
  getActivityFeed: getActivityFeedValidation,
  markActivityAsRead: markActivityAsReadValidation,
  getDashboardSummary: getDashboardSummaryValidation,
  exportAnalytics: exportAnalyticsValidation,
  trackActivity: trackActivityValidation,
  bulkMarkActivitiesAsRead: bulkMarkActivitiesAsReadValidation,
  realtimeAnalytics: realtimeAnalyticsValidation,
  // Enhanced analytics validations
  getEnrollmentStatistics: getEnrollmentStatisticsValidation,
  getEngagementMetrics: getEngagementMetricsValidation,
  getRevenueAnalyticsDetailed: getRevenueAnalyticsDetailedValidation,
  getPerformanceMetricsDetailed: getPerformanceMetricsDetailedValidation,
};
