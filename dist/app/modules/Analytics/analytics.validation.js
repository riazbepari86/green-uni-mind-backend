"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsValidation = exports.getPerformanceMetricsDetailedValidation = exports.getRevenueAnalyticsDetailedValidation = exports.getEngagementMetricsValidation = exports.getEnrollmentStatisticsValidation = exports.validateDateRange = exports.realtimeAnalyticsValidation = exports.analyticsFiltersValidation = exports.bulkMarkActivitiesAsReadValidation = exports.trackActivityValidation = exports.exportAnalyticsValidation = exports.getDashboardSummaryValidation = exports.markActivityAsReadValidation = exports.getActivityFeedValidation = exports.getStudentEngagementValidation = exports.getPerformanceMetricsValidation = exports.getRevenueAnalyticsValidation = exports.getCourseAnalyticsValidation = exports.getTeacherAnalyticsValidation = void 0;
const zod_1 = require("zod");
const analytics_interface_1 = require("./analytics.interface");
// Common validation schemas
const objectIdSchema = zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');
const periodSchema = zod_1.z.enum(['daily', 'weekly', 'monthly', 'yearly']);
const dateSchema = zod_1.z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
}, 'Invalid date format');
const paginationSchema = zod_1.z.object({
    limit: zod_1.z.string().optional().transform((val) => val ? parseInt(val) : 20).refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
    offset: zod_1.z.string().optional().transform((val) => val ? parseInt(val) : 0).refine((val) => val >= 0, 'Offset must be non-negative'),
});
// Analytics query validation
exports.getTeacherAnalyticsValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    query: zod_1.z.object({
        period: periodSchema.optional().default('monthly'),
        courseId: objectIdSchema.optional(),
        startDate: dateSchema.optional(),
        endDate: dateSchema.optional(),
        compareWithPrevious: zod_1.z.string().optional().transform((val) => val === 'true'),
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
exports.getCourseAnalyticsValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
        courseId: objectIdSchema,
    }),
    query: zod_1.z.object({
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
exports.getRevenueAnalyticsValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    query: zod_1.z.object({
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
exports.getPerformanceMetricsValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    query: zod_1.z.object({
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
exports.getStudentEngagementValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    query: zod_1.z.object({
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
exports.getActivityFeedValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    query: zod_1.z.object(Object.assign(Object.assign({}, paginationSchema.shape), { type: zod_1.z.nativeEnum(analytics_interface_1.ActivityType).optional(), priority: zod_1.z.nativeEnum(analytics_interface_1.ActivityPriority).optional(), isRead: zod_1.z.string().optional().transform((val) => val === 'true'), courseId: objectIdSchema.optional(), sortBy: zod_1.z.enum(['createdAt', 'priority', 'type']).optional().default('createdAt'), sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc') })),
});
exports.markActivityAsReadValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
        activityId: objectIdSchema,
    }),
});
exports.getDashboardSummaryValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
});
exports.exportAnalyticsValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    query: zod_1.z.object({
        format: zod_1.z.enum(['json', 'csv']).optional().default('json'),
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
exports.trackActivityValidation = zod_1.z.object({
    body: zod_1.z.object({
        teacherId: objectIdSchema,
        courseId: objectIdSchema.optional(),
        studentId: objectIdSchema.optional(),
        type: zod_1.z.nativeEnum(analytics_interface_1.ActivityType),
        title: zod_1.z.string().min(1).max(200),
        description: zod_1.z.string().min(1).max(500),
        metadata: zod_1.z.record(zod_1.z.any()).optional(),
        priority: zod_1.z.nativeEnum(analytics_interface_1.ActivityPriority).optional().default(analytics_interface_1.ActivityPriority.MEDIUM),
        actionRequired: zod_1.z.boolean().optional().default(false),
        actionUrl: zod_1.z.string().url().optional(),
        relatedEntity: zod_1.z.object({
            entityType: zod_1.z.enum(['course', 'student', 'payment', 'review']),
            entityId: objectIdSchema,
        }),
    }),
});
// Bulk operations validation
exports.bulkMarkActivitiesAsReadValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    body: zod_1.z.object({
        activityIds: zod_1.z.array(objectIdSchema).min(1).max(50),
    }),
});
// Analytics filters validation
exports.analyticsFiltersValidation = zod_1.z.object({
    teacherId: objectIdSchema,
    courseId: objectIdSchema.optional(),
    period: periodSchema,
    startDate: zod_1.z.date().optional(),
    endDate: zod_1.z.date().optional(),
    compareWithPrevious: zod_1.z.boolean().optional().default(false),
}).refine((data) => {
    if (data.startDate && data.endDate) {
        return data.startDate < data.endDate;
    }
    return true;
}, 'Start date must be before end date');
// Real-time analytics validation
exports.realtimeAnalyticsValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    query: zod_1.z.object({
        metrics: zod_1.z.array(zod_1.z.enum(['enrollments', 'revenue', 'activities', 'engagement'])).optional(),
        interval: zod_1.z.enum(['1m', '5m', '15m', '1h']).optional().default('5m'),
    }),
});
// Custom date range validation helper
const validateDateRange = (startDate, endDate) => {
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
exports.validateDateRange = validateDateRange;
// Enhanced analytics validation schemas
exports.getEnrollmentStatisticsValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    query: zod_1.z.object({
        period: periodSchema.optional().default('monthly'),
        courseId: objectIdSchema.optional(),
    }),
});
exports.getEngagementMetricsValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    query: zod_1.z.object({
        period: periodSchema.optional().default('monthly'),
        courseId: objectIdSchema.optional(),
    }),
});
exports.getRevenueAnalyticsDetailedValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    query: zod_1.z.object({
        period: periodSchema.optional().default('monthly'),
        courseId: objectIdSchema.optional(),
    }),
});
exports.getPerformanceMetricsDetailedValidation = zod_1.z.object({
    params: zod_1.z.object({
        teacherId: objectIdSchema,
    }),
    query: zod_1.z.object({
        period: periodSchema.optional().default('monthly'),
        courseId: objectIdSchema.optional(),
    }),
});
// Export all validation schemas
exports.AnalyticsValidation = {
    getTeacherAnalytics: exports.getTeacherAnalyticsValidation,
    getCourseAnalytics: exports.getCourseAnalyticsValidation,
    getRevenueAnalytics: exports.getRevenueAnalyticsValidation,
    getPerformanceMetrics: exports.getPerformanceMetricsValidation,
    getStudentEngagement: exports.getStudentEngagementValidation,
    getActivityFeed: exports.getActivityFeedValidation,
    markActivityAsRead: exports.markActivityAsReadValidation,
    getDashboardSummary: exports.getDashboardSummaryValidation,
    exportAnalytics: exports.exportAnalyticsValidation,
    trackActivity: exports.trackActivityValidation,
    bulkMarkActivitiesAsRead: exports.bulkMarkActivitiesAsReadValidation,
    realtimeAnalytics: exports.realtimeAnalyticsValidation,
    // Enhanced analytics validations
    getEnrollmentStatistics: exports.getEnrollmentStatisticsValidation,
    getEngagementMetrics: exports.getEngagementMetricsValidation,
    getRevenueAnalyticsDetailed: exports.getRevenueAnalyticsDetailedValidation,
    getPerformanceMetricsDetailed: exports.getPerformanceMetricsDetailedValidation,
};
