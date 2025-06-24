"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const AnalyticsService_1 = __importDefault(require("../../services/analytics/AnalyticsService"));
const ActivityTrackingService_1 = __importDefault(require("../../services/activity/ActivityTrackingService"));
const teacher_model_1 = require("../Teacher/teacher.model");
// Removed unused imports
const analyticsService = new AnalyticsService_1.default();
const activityTrackingService = new ActivityTrackingService_1.default();
/**
 * Get comprehensive teacher analytics
 */
const getTeacherAnalytics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period = 'monthly', courseId, startDate, endDate, compareWithPrevious = false } = req.query;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        // Find the teacher by teacherId and check if the user field matches the authenticated user
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own analytics');
        }
    }
    const filters = {
        teacherId,
        courseId: courseId,
        period: period,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        compareWithPrevious: compareWithPrevious === 'true',
    };
    const analytics = yield analyticsService.getTeacherAnalytics(filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Teacher analytics retrieved successfully',
        data: analytics,
    });
}));
/**
 * Get course-specific analytics
 */
const getCourseAnalytics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId, courseId } = req.params;
    const { period = 'monthly', startDate, endDate } = req.query;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own course analytics');
        }
    }
    const dateRange = startDate && endDate ? {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
    } : undefined;
    // Use period parameter for analytics (currently passed but not used in service)
    const analytics = yield analyticsService.getCourseAnalytics(teacherId, courseId, dateRange);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Course analytics retrieved successfully',
        data: analytics,
    });
}));
/**
 * Get revenue analytics
 */
const getRevenueAnalytics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { courseId, period = 'monthly', startDate, endDate } = req.query;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own revenue analytics');
        }
    }
    const dateRange = startDate && endDate ? {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
    } : undefined;
    // Note: period parameter available for future use
    const analytics = yield analyticsService.getRevenueAnalytics(teacherId, courseId, dateRange);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Revenue analytics retrieved successfully',
        data: analytics,
    });
}));
/**
 * Get performance metrics
 */
const getPerformanceMetrics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { courseId, period = 'monthly', startDate, endDate } = req.query;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own performance metrics');
        }
    }
    const dateRange = startDate && endDate ? {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
    } : undefined;
    // Note: period parameter available for future use
    const metrics = yield analyticsService.getPerformanceMetrics(teacherId, courseId, dateRange);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Performance metrics retrieved successfully',
        data: metrics,
    });
}));
/**
 * Get student engagement analytics
 */
const getStudentEngagement = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { courseId, period = 'monthly', startDate, endDate } = req.query;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own student engagement data');
        }
    }
    const dateRange = startDate && endDate ? {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
    } : undefined;
    // Note: period parameter available for future use
    const engagement = yield analyticsService.getStudentEngagementSummary(teacherId, courseId, dateRange);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Student engagement data retrieved successfully',
        data: engagement,
    });
}));
/**
 * Get activity feed for teacher
 */
const getActivityFeed = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { limit = 20, offset = 0, type, priority, isRead, courseId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own activity feed');
        }
    }
    // Build filters object
    const filters = {
        limit: parseInt(limit),
        offset: parseInt(offset),
        type: type, // Cast to any to avoid type issues
        priority: priority,
        isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
        courseId: courseId,
        sortBy: sortBy,
        sortOrder: sortOrder
    };
    const activitiesResult = yield activityTrackingService.getActivitiesWithFilters(teacherId, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Activity feed retrieved successfully',
        data: {
            activities: activitiesResult.activities,
            total: activitiesResult.total,
            unreadCount: activitiesResult.unreadCount,
            priorityBreakdown: activitiesResult.priorityBreakdown,
            typeBreakdown: activitiesResult.typeBreakdown,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: activitiesResult.total,
            },
        },
    });
}));
/**
 * Mark activity as read
 */
const markActivityAsRead = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId, activityId } = req.params;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only mark your own activities as read');
        }
    }
    yield activityTrackingService.markActivityAsRead(activityId, teacherId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Activity marked as read successfully',
        data: null,
    });
}));
/**
 * Get analytics dashboard summary
 */
const getDashboardSummary = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own dashboard');
        }
    }
    // Get summary data for the current month
    const filters = {
        teacherId,
        period: 'monthly',
    };
    const [analytics, recentActivities] = yield Promise.all([
        analyticsService.getTeacherAnalytics(filters),
        activityTrackingService.getRecentActivities(teacherId, 10),
    ]);
    const summary = {
        overview: {
            totalRevenue: analytics.revenueAnalytics.totalRevenue,
            totalStudents: analytics.performanceMetrics.totalStudents,
            averageRating: analytics.performanceMetrics.averageRating,
            totalCourses: analytics.courseAnalytics.length,
        },
        recentActivities: recentActivities.slice(0, 5),
        topPerformingCourses: analytics.courseAnalytics
            .sort((a, b) => b.enrollments - a.enrollments)
            .slice(0, 3),
        insights: analytics.insights,
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Dashboard summary retrieved successfully',
        data: summary,
    });
}));
/**
 * Export analytics data
 */
const exportAnalytics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { format = 'json', period = 'monthly', courseId } = req.query;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only export your own analytics');
        }
    }
    const filters = {
        teacherId,
        courseId: courseId,
        period: period,
    };
    const analytics = yield analyticsService.getTeacherAnalytics(filters);
    if (format === 'csv') {
        // TODO: Implement CSV export
        throw new AppError_1.default(http_status_1.default.NOT_IMPLEMENTED, 'CSV export not yet implemented');
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Analytics data exported successfully',
        data: analytics,
    });
}));
/**
 * Get detailed enrollment statistics
 */
const getEnrollmentStatistics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period = 'monthly', courseId } = req.query;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own enrollment statistics');
        }
    }
    const statistics = yield analyticsService.getEnrollmentStatistics(teacherId, period, courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Enrollment statistics retrieved successfully',
        data: statistics,
    });
}));
/**
 * Get detailed student engagement metrics
 */
const getStudentEngagementMetrics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period = 'monthly', courseId } = req.query;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own engagement metrics');
        }
    }
    const metrics = yield analyticsService.getStudentEngagementMetrics(teacherId, period, courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Student engagement metrics retrieved successfully',
        data: metrics,
    });
}));
/**
 * Get detailed revenue analytics
 */
const getRevenueAnalyticsDetailed = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period = 'monthly', courseId } = req.query;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own revenue analytics');
        }
    }
    const analytics = yield analyticsService.getRevenueAnalyticsDetailed(teacherId, period, courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Detailed revenue analytics retrieved successfully',
        data: analytics,
    });
}));
/**
 * Get detailed performance metrics
 */
const getPerformanceMetricsDetailed = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period = 'monthly', courseId } = req.query;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own performance metrics');
        }
    }
    const metrics = yield analyticsService.getPerformanceMetricsDetailed(teacherId, period, courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Detailed performance metrics retrieved successfully',
        data: metrics,
    });
}));
/**
 * Bulk mark activities as read
 */
const bulkMarkActivitiesAsRead = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { activityIds } = req.body;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only mark your own activities as read');
        }
    }
    if (!Array.isArray(activityIds) || activityIds.length === 0) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Activity IDs array is required');
    }
    yield Promise.all(activityIds.map(activityId => activityTrackingService.markActivityAsRead(activityId, teacherId)));
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Activities marked as read successfully',
        data: null,
    });
}));
/**
 * Get real-time analytics data
 */
const getRealTimeData = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const user = req.user;
    // Validate teacher ID matches authenticated user
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own real-time data');
        }
    }
    // Return empty real-time data for new teachers
    const emptyRealTimeData = {
        activeUsers: 0,
        currentEnrollments: 0,
        recentActivity: [],
        liveMetrics: {
            studentsOnline: 0,
            coursesViewed: 0,
            lessonsCompleted: 0,
            questionsAsked: 0
        },
        lastUpdated: new Date().toISOString()
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Real-time analytics data retrieved successfully',
        data: emptyRealTimeData,
    });
}));
/**
 * Get analytics insights
 */
const getInsights = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { limit = 5 } = req.query;
    const user = req.user;
    // Validate teacher ID matches authenticated user
    if (user.role === 'teacher') {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher || teacher.user.toString() !== user._id) {
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own insights');
        }
    }
    // Return welcome insights for new teachers
    const newTeacherInsights = [
        {
            id: 'welcome',
            type: 'welcome',
            title: 'Welcome to Your Teaching Journey!',
            description: 'Start by creating your first course to unlock powerful analytics and insights.',
            priority: 'high',
            actionable: true,
            action: {
                text: 'Create Your First Course',
                url: '/teacher/courses/create'
            },
            createdAt: new Date().toISOString()
        },
        {
            id: 'setup-profile',
            type: 'onboarding',
            title: 'Complete Your Teacher Profile',
            description: 'A complete profile helps students trust and connect with you.',
            priority: 'medium',
            actionable: true,
            action: {
                text: 'Edit Profile',
                url: '/teacher/profile/edit'
            },
            createdAt: new Date().toISOString()
        },
        {
            id: 'stripe-setup',
            type: 'financial',
            title: 'Set Up Payment Processing',
            description: 'Connect your Stripe account to start earning from your courses.',
            priority: 'medium',
            actionable: true,
            action: {
                text: 'Connect Stripe',
                url: '/teacher/earnings'
            },
            createdAt: new Date().toISOString()
        }
    ];
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Analytics insights retrieved successfully',
        data: newTeacherInsights.slice(0, parseInt(limit)),
    });
}));
exports.AnalyticsController = {
    getTeacherAnalytics,
    getCourseAnalytics,
    getRevenueAnalytics,
    getPerformanceMetrics,
    getStudentEngagement,
    getActivityFeed,
    markActivityAsRead,
    getDashboardSummary,
    exportAnalytics,
    // New enhanced endpoints
    getEnrollmentStatistics,
    getStudentEngagementMetrics,
    getRevenueAnalyticsDetailed,
    getPerformanceMetricsDetailed,
    bulkMarkActivitiesAsRead,
    // Missing endpoints
    getRealTimeData,
    getInsights,
};
