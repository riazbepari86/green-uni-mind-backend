"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const analytics_model_1 = require("../../modules/Analytics/analytics.model");
const course_model_1 = require("../../modules/Course/course.model");
const student_model_1 = require("../../modules/Student/student.model");
const payment_model_1 = require("../../modules/Payment/payment.model");
const logger_1 = require("../../config/logger");
const redis_1 = require("../../config/redis");
const date_fns_1 = require("date-fns");
class AnalyticsService {
    constructor(webSocketService) {
        this.CACHE_TTL = {
            realtime: 300, // 5 minutes
            hourly: 3600, // 1 hour
            daily: 86400, // 24 hours
            weekly: 604800, // 7 days
        };
        this.webSocketService = null;
        this.webSocketService = webSocketService || null;
    }
    /**
     * Invalidate cache for teacher analytics
     */
    invalidateTeacherCache(teacherId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const patterns = [
                    `teacher_analytics:${teacherId}:*`,
                    `activities:teacher:${teacherId}:*`,
                    `course_analytics:${teacherId}:*`,
                    `revenue_analytics:${teacherId}:*`,
                    `performance_metrics:${teacherId}:*`,
                ];
                for (const pattern of patterns) {
                    // Note: This is a simplified cache invalidation
                    // In production, you might want to use Redis SCAN with pattern matching
                    yield redis_1.redisOperations.del(pattern);
                }
                logger_1.Logger.info(`🗑️ Cache invalidated for teacher: ${teacherId}`);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to invalidate teacher cache:', error);
            }
        });
    }
    /**
     * Warm up cache for frequently accessed data
     */
    warmUpCache(teacherId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info(`🔥 Warming up cache for teacher: ${teacherId}`);
                // Pre-load monthly analytics
                const monthlyFilters = {
                    teacherId,
                    period: 'monthly',
                };
                yield this.getTeacherAnalytics(monthlyFilters);
                // Pre-load recent activities
                const activityTrackingService = new (yield Promise.resolve().then(() => __importStar(require('../activity/ActivityTrackingService')))).default();
                yield activityTrackingService.getRecentActivities(teacherId, 20);
                logger_1.Logger.info(`✅ Cache warmed up for teacher: ${teacherId}`);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to warm up cache:', error);
            }
        });
    }
    /**
     * Get comprehensive analytics for a teacher
     */
    getTeacherAnalytics(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const cacheKey = this.generateCacheKey('teacher_analytics', filters);
                const cached = yield redis_1.redisOperations.get(cacheKey);
                if (cached) {
                    logger_1.Logger.info(`📊 Returning cached analytics for teacher: ${filters.teacherId}`);
                    return JSON.parse(cached);
                }
                const dateRange = this.getDateRange(filters.period, filters.startDate, filters.endDate);
                // Fetch all analytics data in parallel with error handling for new teachers
                const [courseAnalytics, revenueAnalytics, performanceMetrics, studentEngagement] = yield Promise.allSettled([
                    this.getCourseAnalytics(filters.teacherId, filters.courseId, dateRange),
                    this.getRevenueAnalytics(filters.teacherId, filters.courseId, dateRange),
                    this.getPerformanceMetrics(filters.teacherId, filters.courseId, dateRange),
                    this.getStudentEngagementSummary(filters.teacherId, filters.courseId, dateRange),
                ]);
                // Extract results with fallbacks for new teachers
                const courseAnalyticsData = courseAnalytics.status === 'fulfilled' ? courseAnalytics.value : [];
                const revenueAnalyticsData = revenueAnalytics.status === 'fulfilled' ? revenueAnalytics.value : null;
                const performanceMetricsData = performanceMetrics.status === 'fulfilled' ? performanceMetrics.value : null;
                const studentEngagementData = studentEngagement.status === 'fulfilled' ? studentEngagement.value : {
                    totalActiveStudents: 0,
                    averageEngagementScore: 0,
                    topPerformingCourses: [],
                    retentionRate: 0,
                };
                // Generate insights and recommendations (with fallback for new teachers)
                const insights = yield this.generateInsights(courseAnalyticsData, revenueAnalyticsData, performanceMetricsData).catch(() => ({
                    topInsight: 'Welcome! Start by creating your first course to see analytics.',
                    recommendations: [
                        'Create your first course to start tracking analytics',
                        'Add engaging content to attract students',
                        'Set up your Stripe account to receive payments'
                    ],
                    alerts: []
                }));
                // Get total students count with fallback
                const totalStudents = yield this.getTotalStudentsCount(filters.teacherId, filters.courseId).catch(() => 0);
                const summary = {
                    teacherId: new mongoose_1.Types.ObjectId(filters.teacherId),
                    period: filters.period,
                    dateRange: {
                        startDate: dateRange.startDate,
                        endDate: dateRange.endDate,
                    },
                    courseAnalytics: courseAnalyticsData.map(ca => ({
                        courseId: ca.courseId,
                        courseName: ca.courseName || 'Unknown Course',
                        enrollments: ca.totalEnrollments || 0,
                        revenue: 0, // Will be populated from revenue analytics
                        completionRate: ca.completionRate || 0,
                        rating: 0, // Will be populated from performance metrics
                    })),
                    revenueAnalytics: {
                        totalRevenue: (revenueAnalyticsData === null || revenueAnalyticsData === void 0 ? void 0 : revenueAnalyticsData.totalRevenue) || 0,
                        growth: 0, // Will be calculated if comparing with previous period
                        topCourse: ((_b = (_a = revenueAnalyticsData === null || revenueAnalyticsData === void 0 ? void 0 : revenueAnalyticsData.topPerformingCourses) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.courseId) || new mongoose_1.Types.ObjectId(),
                        averageOrderValue: (revenueAnalyticsData === null || revenueAnalyticsData === void 0 ? void 0 : revenueAnalyticsData.averageOrderValue) || 0,
                    },
                    performanceMetrics: {
                        averageRating: (performanceMetricsData === null || performanceMetricsData === void 0 ? void 0 : performanceMetricsData.averageRating) || 0,
                        totalStudents,
                        completionRate: (performanceMetricsData === null || performanceMetricsData === void 0 ? void 0 : performanceMetricsData.courseCompletionRate) || 0,
                        satisfactionScore: (performanceMetricsData === null || performanceMetricsData === void 0 ? void 0 : performanceMetricsData.studentSatisfactionScore) || 0,
                    },
                    studentEngagement: studentEngagementData,
                    insights: insights || {
                        topInsight: 'Welcome! Start by creating your first course to see analytics.',
                        recommendations: [
                            'Create your first course to start tracking analytics',
                            'Add engaging content to attract students',
                            'Set up your Stripe account to receive payments'
                        ],
                        alerts: []
                    },
                    generatedAt: new Date(),
                };
                // Cache the result
                yield redis_1.redisOperations.setex(cacheKey, this.CACHE_TTL.hourly, JSON.stringify(summary));
                logger_1.Logger.info(`✅ Generated analytics for teacher: ${filters.teacherId} (${courseAnalyticsData.length} courses)`);
                return summary;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get teacher analytics:', error);
                // Return empty state for new teachers instead of throwing error
                return this.getEmptyAnalyticsSummary(filters);
            }
        });
    }
    /**
     * Get empty analytics summary for new teachers
     */
    getEmptyAnalyticsSummary(filters) {
        const dateRange = this.getDateRange(filters.period, filters.startDate, filters.endDate);
        const emptyAnalytics = new analytics_model_1.AnalyticsSummary({
            teacherId: new mongoose_1.Types.ObjectId(filters.teacherId),
            period: filters.period,
            dateRange: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
            },
            courseAnalytics: [],
            revenueAnalytics: {
                totalRevenue: 0,
                growth: 0,
                topCourse: new mongoose_1.Types.ObjectId(),
                averageOrderValue: 0,
            },
            performanceMetrics: {
                averageRating: 0,
                totalStudents: 0,
                completionRate: 0,
                satisfactionScore: 0,
            },
            studentEngagement: {
                totalActiveStudents: 0,
                averageEngagementScore: 0,
                topPerformingCourses: [],
                retentionRate: 0,
            },
            insights: {
                topInsight: 'Welcome to your teaching dashboard! Start by creating your first course.',
                recommendations: [
                    'Create your first course to start tracking analytics',
                    'Add engaging content to attract students',
                    'Set up your Stripe account to receive payments',
                    'Optimize your course title and description for better discoverability'
                ],
                alerts: []
            },
            generatedAt: new Date(),
        });
        return emptyAnalytics;
    }
    /**
     * Get course analytics with enrollment and engagement data
     */
    getCourseAnalytics(teacherId, courseId, dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                if (dateRange) {
                    query.lastUpdated = {
                        $gte: dateRange.startDate,
                        $lte: dateRange.endDate
                    };
                }
                let analytics = yield analytics_model_1.CourseAnalytics.find(query)
                    .populate('courseId', 'title totalEnrollment')
                    .sort({ lastUpdated: -1 });
                // If no analytics exist, generate them
                if (analytics.length === 0) {
                    analytics = yield this.generateCourseAnalytics(teacherId, courseId);
                }
                return analytics;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get course analytics:', error);
                throw error;
            }
        });
    }
    /**
     * Get revenue analytics with payment trends
     */
    getRevenueAnalytics(teacherId, courseId, dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                let analytics = yield analytics_model_1.RevenueAnalytics.findOne(query).sort({ lastUpdated: -1 });
                // If no analytics exist, generate them
                if (!analytics) {
                    analytics = yield this.generateRevenueAnalytics(teacherId, courseId, dateRange);
                }
                return analytics;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get revenue analytics:', error);
                return null;
            }
        });
    }
    /**
     * Get performance metrics including ratings and completion rates
     */
    getPerformanceMetrics(teacherId, courseId, dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                if (dateRange) {
                    query.lastUpdated = {
                        $gte: dateRange.startDate,
                        $lte: dateRange.endDate
                    };
                }
                let metrics = yield analytics_model_1.PerformanceMetrics.findOne(query).sort({ lastUpdated: -1 });
                // If no metrics exist, generate them
                if (!metrics) {
                    metrics = yield this.generatePerformanceMetrics(teacherId, courseId);
                }
                return metrics;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get performance metrics:', error);
                return null;
            }
        });
    }
    /**
     * Get student engagement summary
     */
    getStudentEngagementSummary(teacherId, courseId, dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                if (dateRange) {
                    query.lastActivity = {
                        $gte: dateRange.startDate,
                        $lte: dateRange.endDate
                    };
                }
                const engagementData = yield analytics_model_1.StudentEngagement.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalStudents: { $sum: 1 },
                            averageEngagement: { $avg: '$engagementScore' },
                            activeStudents: {
                                $sum: {
                                    $cond: [
                                        { $gte: ['$lastActivity', (0, date_fns_1.subDays)(new Date(), 7)] },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ]);
                const summary = engagementData[0] || {
                    totalStudents: 0,
                    averageEngagement: 0,
                    activeStudents: 0,
                };
                // Get top performing courses
                const topCourses = yield analytics_model_1.StudentEngagement.aggregate([
                    { $match: { teacherId: new mongoose_1.Types.ObjectId(teacherId) } },
                    {
                        $group: {
                            _id: '$courseId',
                            averageEngagement: { $avg: '$engagementScore' },
                            studentCount: { $sum: 1 }
                        }
                    },
                    { $sort: { averageEngagement: -1 } },
                    { $limit: 5 }
                ]);
                return {
                    totalActiveStudents: summary.activeStudents,
                    averageEngagementScore: summary.averageEngagement,
                    topPerformingCourses: topCourses.map(course => course._id),
                    retentionRate: summary.totalStudents > 0 ? (summary.activeStudents / summary.totalStudents) * 100 : 0,
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get student engagement summary:', error);
                return {
                    totalActiveStudents: 0,
                    averageEngagementScore: 0,
                    topPerformingCourses: [],
                    retentionRate: 0,
                };
            }
        });
    }
    /**
     * Generate course analytics from raw data
     */
    generateCourseAnalytics(teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { creator: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query._id = new mongoose_1.Types.ObjectId(courseId);
                }
                const courses = yield course_model_1.Course.find(query);
                const analytics = [];
                for (const course of courses) {
                    // Calculate enrollment metrics
                    const totalEnrollments = course.totalEnrollment || 0;
                    const newEnrollments = yield this.calculateNewEnrollments(course._id);
                    // Calculate completion rate
                    const completionRate = yield this.calculateCompletionRate(course._id);
                    // Calculate average time spent
                    const averageTimeSpent = yield this.calculateAverageTimeSpent(course._id);
                    const courseAnalytics = new analytics_model_1.CourseAnalytics({
                        courseId: course._id,
                        teacherId: new mongoose_1.Types.ObjectId(teacherId),
                        totalEnrollments,
                        newEnrollments,
                        completionRate,
                        averageTimeSpent,
                        dropoffRate: 100 - completionRate,
                        engagementMetrics: {
                            averageSessionDuration: averageTimeSpent,
                            totalSessions: totalEnrollments,
                            bounceRate: 0, // TODO: Calculate actual bounce rate
                            returnRate: 0, // TODO: Calculate actual return rate
                        },
                        lastUpdated: new Date(),
                    });
                    const saved = yield courseAnalytics.save();
                    analytics.push(saved);
                }
                return analytics;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to generate course analytics:', error);
                return [];
            }
        });
    }
    /**
     * Generate revenue analytics from payment data
     */
    generateRevenueAnalytics(teacherId, courseId, dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                if (dateRange) {
                    query.lastUpdated = {
                        $gte: dateRange.startDate,
                        $lte: dateRange.endDate
                    };
                }
                // Get payment data
                const payments = yield payment_model_1.Payment.find(query);
                const totalRevenue = payments.reduce((sum, payment) => sum + payment.teacherShare, 0);
                // Calculate revenue by period
                const revenueByPeriod = yield this.calculateRevenueByPeriod(teacherId, courseId);
                // Calculate average order value
                const averageOrderValue = payments.length > 0 ? totalRevenue / payments.length : 0;
                // Get top performing courses
                const topPerformingCourses = yield this.getTopPerformingCoursesByRevenue(teacherId);
                const revenueAnalytics = new analytics_model_1.RevenueAnalytics({
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                    courseId: courseId ? new mongoose_1.Types.ObjectId(courseId) : undefined,
                    totalRevenue,
                    revenueByPeriod,
                    averageOrderValue,
                    refundRate: 0, // TODO: Calculate actual refund rate
                    conversionRate: 0, // TODO: Calculate actual conversion rate
                    paymentTrends: [], // TODO: Calculate payment trends
                    topPerformingCourses,
                    lastUpdated: new Date(),
                });
                return yield revenueAnalytics.save();
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to generate revenue analytics:', error);
                return null;
            }
        });
    }
    /**
     * Generate performance metrics from course and student data
     */
    generatePerformanceMetrics(teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implement actual performance metrics calculation
                // This would involve calculating ratings, reviews, completion rates, etc.
                const performanceMetrics = new analytics_model_1.PerformanceMetrics({
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                    courseId: courseId ? new mongoose_1.Types.ObjectId(courseId) : undefined,
                    averageRating: 4.5, // Placeholder
                    totalReviews: 0,
                    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                    studentSatisfactionScore: 85,
                    courseCompletionRate: 75,
                    studentRetentionRate: 80,
                    qualityMetrics: {
                        contentQuality: 85,
                        instructorRating: 90,
                        courseStructure: 80,
                        valueForMoney: 85,
                    },
                    competitiveMetrics: {
                        marketPosition: 75,
                        categoryRanking: 10,
                        peerComparison: 80,
                    },
                    lastUpdated: new Date(),
                });
                return yield performanceMetrics.save();
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to generate performance metrics:', error);
                return null;
            }
        });
    }
    /**
     * Helper methods for calculations
     */
    calculateNewEnrollments(courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                const dailyStart = (0, date_fns_1.startOfDay)(now);
                const weeklyStart = (0, date_fns_1.startOfWeek)(now);
                const monthlyStart = (0, date_fns_1.startOfMonth)(now);
                const yearlyStart = (0, date_fns_1.startOfYear)(now);
                // Get students enrolled in this course with enrollment dates
                const students = yield student_model_1.Student.find({
                    'enrolledCourses.courseId': courseId
                }, {
                    'enrolledCourses.$': 1
                });
                const enrollmentDates = students
                    .map(student => { var _a; return (_a = student.enrolledCourses[0]) === null || _a === void 0 ? void 0 : _a.enrolledAt; })
                    .filter((date) => date !== undefined && date !== null);
                return {
                    daily: enrollmentDates.filter(date => date >= dailyStart).length,
                    weekly: enrollmentDates.filter(date => date >= weeklyStart).length,
                    monthly: enrollmentDates.filter(date => date >= monthlyStart).length,
                    yearly: enrollmentDates.filter(date => date >= yearlyStart).length,
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to calculate new enrollments:', error);
                return { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
            }
        });
    }
    calculateCompletionRate(courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get course with lectures
                const course = yield course_model_1.Course.findById(courseId).populate('lectures');
                if (!course || !course.lectures || course.lectures.length === 0) {
                    return 0;
                }
                const totalLectures = course.lectures.length;
                // Get students enrolled in this course
                const students = yield student_model_1.Student.find({
                    'enrolledCourses.courseId': courseId
                }, {
                    'enrolledCourses.$': 1
                });
                if (students.length === 0) {
                    return 0;
                }
                // Calculate completion rate
                let totalCompletedStudents = 0;
                for (const student of students) {
                    const enrollment = student.enrolledCourses[0];
                    if (enrollment && enrollment.completedLectures.length === totalLectures) {
                        totalCompletedStudents++;
                    }
                }
                return (totalCompletedStudents / students.length) * 100;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to calculate completion rate:', error);
                return 0;
            }
        });
    }
    calculateAverageTimeSpent(courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get student engagement data for this course
                const engagementData = yield analytics_model_1.StudentEngagement.find({ courseId });
                if (engagementData.length === 0) {
                    return 0;
                }
                const totalTime = engagementData.reduce((sum, data) => sum + data.totalTimeSpent, 0);
                return totalTime / engagementData.length;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to calculate average time spent:', error);
                return 0;
            }
        });
    }
    calculateRevenueByPeriod(teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                const dailyStart = (0, date_fns_1.startOfDay)(now);
                const weeklyStart = (0, date_fns_1.startOfWeek)(now);
                const monthlyStart = (0, date_fns_1.startOfMonth)(now);
                const yearlyStart = (0, date_fns_1.startOfYear)(now);
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId), status: 'completed' };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                const payments = yield payment_model_1.Payment.find(query);
                return {
                    daily: payments
                        .filter(p => p.createdAt && p.createdAt >= dailyStart)
                        .reduce((sum, p) => sum + p.teacherShare, 0),
                    weekly: payments
                        .filter(p => p.createdAt && p.createdAt >= weeklyStart)
                        .reduce((sum, p) => sum + p.teacherShare, 0),
                    monthly: payments
                        .filter(p => p.createdAt && p.createdAt >= monthlyStart)
                        .reduce((sum, p) => sum + p.teacherShare, 0),
                    yearly: payments
                        .filter(p => p.createdAt && p.createdAt >= yearlyStart)
                        .reduce((sum, p) => sum + p.teacherShare, 0),
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to calculate revenue by period:', error);
                return { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
            }
        });
    }
    getTopPerformingCoursesByRevenue(teacherId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const revenueData = yield payment_model_1.Payment.aggregate([
                    {
                        $match: {
                            teacherId: new mongoose_1.Types.ObjectId(teacherId),
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: '$courseId',
                            totalRevenue: { $sum: '$teacherShare' },
                            enrollmentCount: { $sum: 1 }
                        }
                    },
                    {
                        $sort: { totalRevenue: -1 }
                    },
                    {
                        $limit: 10
                    }
                ]);
                return revenueData.map(item => ({
                    courseId: item._id,
                    revenue: item.totalRevenue,
                    enrollments: item.enrollmentCount
                }));
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get top performing courses by revenue:', error);
                return [];
            }
        });
    }
    getTotalStudentsCount(teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { creator: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query._id = new mongoose_1.Types.ObjectId(courseId);
                }
                const courses = yield course_model_1.Course.find(query);
                return courses.reduce((total, course) => total + (course.totalEnrollment || 0), 0);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get total students count:', error);
                return 0;
            }
        });
    }
    getDateRange(period, startDate, endDate) {
        const now = new Date();
        if (startDate && endDate) {
            return { startDate, endDate };
        }
        switch (period) {
            case 'daily':
                return { startDate: (0, date_fns_1.startOfDay)(now), endDate: (0, date_fns_1.endOfDay)(now) };
            case 'weekly':
                return { startDate: (0, date_fns_1.startOfWeek)(now), endDate: (0, date_fns_1.endOfWeek)(now) };
            case 'monthly':
                return { startDate: (0, date_fns_1.startOfMonth)(now), endDate: (0, date_fns_1.endOfMonth)(now) };
            case 'yearly':
                return { startDate: (0, date_fns_1.startOfYear)(now), endDate: (0, date_fns_1.endOfYear)(now) };
            default:
                return { startDate: (0, date_fns_1.startOfMonth)(now), endDate: (0, date_fns_1.endOfMonth)(now) };
        }
    }
    generateCacheKey(prefix, filters) {
        var _a, _b;
        const parts = [
            prefix,
            filters.teacherId,
            filters.courseId || 'all',
            filters.period,
            ((_a = filters.startDate) === null || _a === void 0 ? void 0 : _a.toISOString().split('T')[0]) || 'current',
            ((_b = filters.endDate) === null || _b === void 0 ? void 0 : _b.toISOString().split('T')[0]) || 'current',
        ];
        return parts.join(':');
    }
    /**
     * Get comprehensive enrollment statistics with time-based filtering
     */
    getEnrollmentStatistics(teacherId_1) {
        return __awaiter(this, arguments, void 0, function* (teacherId, period = 'monthly', courseId) {
            try {
                const cacheKey = `enrollment_stats:${teacherId}:${period}:${courseId || 'all'}`;
                const cached = yield redis_1.redisOperations.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
                const dateRange = this.getDateRange(period);
                const query = { creator: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query._id = new mongoose_1.Types.ObjectId(courseId);
                }
                // Get courses and their enrollment data
                const courses = yield course_model_1.Course.find(query).populate('enrolledStudents');
                const totalEnrollments = courses.reduce((sum, course) => sum + (course.totalEnrollment || 0), 0);
                // Calculate new enrollments in the period
                const newEnrollments = yield this.calculateNewEnrollmentsInPeriod(teacherId, dateRange, courseId);
                // Get enrollment trend data
                const enrollmentTrend = yield this.getEnrollmentTrend(teacherId, period, courseId);
                // Get top courses by enrollment
                const topCourses = courses
                    .sort((a, b) => (b.totalEnrollment || 0) - (a.totalEnrollment || 0))
                    .slice(0, 5)
                    .map(course => ({
                    courseId: course._id.toString(),
                    courseName: course.title,
                    enrollments: course.totalEnrollment || 0
                }));
                // Calculate growth rate (compare with previous period)
                const previousPeriodEnrollments = yield this.getPreviousPeriodEnrollments(teacherId, period, courseId);
                const growthRate = previousPeriodEnrollments > 0
                    ? ((newEnrollments - previousPeriodEnrollments) / previousPeriodEnrollments) * 100
                    : 0;
                const result = {
                    totalEnrollments,
                    newEnrollments,
                    enrollmentTrend,
                    topCourses,
                    growthRate
                };
                // Cache for 1 hour
                yield redis_1.redisOperations.setex(cacheKey, this.CACHE_TTL.hourly, JSON.stringify(result));
                // Broadcast real-time update
                if (this.webSocketService) {
                    this.webSocketService.broadcastEnrollmentUpdate(teacherId, result);
                }
                return result;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get enrollment statistics:', error);
                // Return empty state for new teachers
                return {
                    totalEnrollments: 0,
                    newEnrollments: 0,
                    enrollmentTrend: [],
                    topCourses: [],
                    growthRate: 0
                };
            }
        });
    }
    /**
     * Get student engagement metrics with activity patterns
     */
    getStudentEngagementMetrics(teacherId_1) {
        return __awaiter(this, arguments, void 0, function* (teacherId, period = 'monthly', courseId) {
            try {
                const cacheKey = `engagement_metrics:${teacherId}:${period}:${courseId || 'all'}`;
                const cached = yield redis_1.redisOperations.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
                const dateRange = this.getDateRange(period);
                const query = {
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
                };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                // Get engagement data
                const engagementData = yield analytics_model_1.StudentEngagement.find(query)
                    .populate('courseId', 'title')
                    .populate('studentId', 'name email');
                // Calculate metrics
                const totalActiveStudents = engagementData.filter(data => data.lastActivity >= (0, date_fns_1.subDays)(new Date(), 7)).length;
                const averageEngagementScore = engagementData.length > 0
                    ? engagementData.reduce((sum, data) => sum + data.engagementScore, 0) / engagementData.length
                    : 0;
                // Get completion rates by course
                const completionRates = yield this.getCompletionRatesByCourse(teacherId, courseId);
                // Get time spent trends
                const timeSpentTrends = yield this.getTimeSpentTrends(teacherId, period, courseId);
                // Get activity patterns (by hour of day)
                const activityPatterns = yield this.getActivityPatterns(teacherId, courseId);
                // Calculate retention rate
                const retentionRate = yield this.calculateRetentionRate(teacherId, courseId);
                const result = {
                    totalActiveStudents,
                    averageEngagementScore,
                    completionRates,
                    timeSpentTrends,
                    activityPatterns,
                    retentionRate
                };
                // Cache for 30 minutes
                yield redis_1.redisOperations.setex(cacheKey, 1800, JSON.stringify(result));
                // Broadcast real-time update
                if (this.webSocketService) {
                    this.webSocketService.broadcastEngagementUpdate(teacherId, result);
                }
                return result;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get student engagement metrics:', error);
                // Return empty state for new teachers
                return {
                    totalActiveStudents: 0,
                    averageEngagementScore: 0,
                    completionRates: [],
                    timeSpentTrends: [],
                    activityPatterns: [],
                    retentionRate: 0
                };
            }
        });
    }
    /**
     * Get comprehensive revenue analytics with payment trends
     */
    getRevenueAnalyticsDetailed(teacherId_1) {
        return __awaiter(this, arguments, void 0, function* (teacherId, period = 'monthly', courseId) {
            try {
                const cacheKey = `revenue_analytics:${teacherId}:${period}:${courseId || 'all'}`;
                const cached = yield redis_1.redisOperations.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
                const dateRange = this.getDateRange(period);
                const query = {
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                    status: 'completed',
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
                };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                // Get payment data
                const payments = yield payment_model_1.Payment.find(query);
                const totalRevenue = payments.reduce((sum, payment) => sum + payment.teacherShare, 0);
                // Calculate revenue growth
                const previousPeriodRevenue = yield this.getPreviousPeriodRevenue(teacherId, period, courseId);
                const revenueGrowth = previousPeriodRevenue > 0
                    ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
                    : 0;
                // Calculate average order value
                const averageOrderValue = payments.length > 0 ? totalRevenue / payments.length : 0;
                // Get payment trends
                const paymentTrends = yield this.getPaymentTrends(teacherId, period, courseId);
                // Get top earning courses
                const topEarningCourses = yield this.getTopEarningCourses(teacherId);
                // Get revenue by period
                const revenueByPeriod = yield this.calculateRevenueByPeriod(teacherId, courseId);
                // Calculate conversion rate (enrolled vs paid)
                const conversionRate = yield this.calculateConversionRate(teacherId, courseId);
                // Calculate refund rate
                const refundRate = yield this.calculateRefundRate(teacherId, courseId);
                const result = {
                    totalRevenue,
                    revenueGrowth,
                    averageOrderValue,
                    paymentTrends,
                    topEarningCourses,
                    revenueByPeriod,
                    conversionRate,
                    refundRate
                };
                // Cache for 1 hour
                yield redis_1.redisOperations.setex(cacheKey, this.CACHE_TTL.hourly, JSON.stringify(result));
                // Broadcast real-time update
                if (this.webSocketService) {
                    this.webSocketService.broadcastRevenueUpdate(teacherId, result);
                }
                return result;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get detailed revenue analytics:', error);
                // Return empty state for new teachers
                return {
                    totalRevenue: 0,
                    revenueGrowth: 0,
                    averageOrderValue: 0,
                    paymentTrends: [],
                    topEarningCourses: [],
                    revenueByPeriod: { daily: 0, weekly: 0, monthly: 0, yearly: 0 },
                    conversionRate: 0,
                    refundRate: 0
                };
            }
        });
    }
    /**
     * Get performance metrics with comparative analysis
     */
    getPerformanceMetricsDetailed(teacherId_1) {
        return __awaiter(this, arguments, void 0, function* (teacherId, period = 'monthly', courseId) {
            try {
                const cacheKey = `performance_metrics:${teacherId}:${period}:${courseId || 'all'}`;
                const cached = yield redis_1.redisOperations.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
                // Get performance data (placeholder implementation)
                // In a real implementation, this would fetch from reviews, ratings, and feedback data
                const averageRating = 4.5; // TODO: Calculate from actual reviews
                const totalReviews = 0; // TODO: Count actual reviews
                const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; // TODO: Calculate from reviews
                const ratingTrends = yield this.getRatingTrends(teacherId, period, courseId);
                const studentSatisfactionScore = 85; // TODO: Calculate from feedback
                const courseCompletionRate = yield this.getAverageCompletionRate(teacherId, courseId);
                const studentRetentionRate = yield this.calculateRetentionRate(teacherId, courseId);
                const qualityMetrics = {
                    contentQuality: 85,
                    instructorRating: 90,
                    courseStructure: 80,
                    valueForMoney: 85,
                };
                const competitiveMetrics = {
                    marketPosition: 75,
                    categoryRanking: 10,
                    peerComparison: 80,
                };
                const improvementSuggestions = yield this.generateImprovementSuggestions(averageRating, courseCompletionRate, studentRetentionRate);
                const result = {
                    averageRating,
                    totalReviews,
                    ratingDistribution,
                    ratingTrends,
                    studentSatisfactionScore,
                    courseCompletionRate,
                    studentRetentionRate,
                    qualityMetrics,
                    competitiveMetrics,
                    improvementSuggestions
                };
                // Cache for 2 hours
                yield redis_1.redisOperations.setex(cacheKey, this.CACHE_TTL.hourly * 2, JSON.stringify(result));
                // Broadcast real-time update
                if (this.webSocketService) {
                    this.webSocketService.broadcastPerformanceUpdate(teacherId, result);
                }
                return result;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get detailed performance metrics:', error);
                // Return empty state for new teachers
                return {
                    averageRating: 0,
                    totalReviews: 0,
                    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                    ratingTrends: [],
                    studentSatisfactionScore: 0,
                    courseCompletionRate: 0,
                    studentRetentionRate: 0,
                    qualityMetrics: {
                        contentQuality: 0,
                        instructorRating: 0,
                        courseStructure: 0,
                        valueForMoney: 0,
                    },
                    competitiveMetrics: {
                        marketPosition: 0,
                        categoryRanking: 0,
                        peerComparison: 0,
                    },
                    improvementSuggestions: [
                        'Create your first course to start tracking performance metrics',
                        'Add engaging content to improve student satisfaction',
                        'Set up your profile to build credibility'
                    ]
                };
            }
        });
    }
    /**
     * Helper methods for new analytics features
     */
    calculateNewEnrollmentsInPeriod(teacherId, dateRange, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { creator: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query._id = new mongoose_1.Types.ObjectId(courseId);
                }
                const courses = yield course_model_1.Course.find(query);
                let totalNewEnrollments = 0;
                for (const course of courses) {
                    const students = yield student_model_1.Student.find({
                        'enrolledCourses.courseId': course._id,
                        'enrolledCourses.enrolledAt': {
                            $gte: dateRange.startDate,
                            $lte: dateRange.endDate
                        }
                    });
                    totalNewEnrollments += students.length;
                }
                return totalNewEnrollments;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to calculate new enrollments in period:', error);
                return 0;
            }
        });
    }
    getEnrollmentTrend(teacherId, period, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Generate date intervals based on period
                const intervals = this.generateDateIntervals(period);
                const trend = [];
                for (const interval of intervals) {
                    const count = yield this.calculateNewEnrollmentsInPeriod(teacherId, interval, courseId);
                    trend.push({
                        date: interval.startDate.toISOString().split('T')[0],
                        count
                    });
                }
                return trend;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get enrollment trend:', error);
                return [];
            }
        });
    }
    getPreviousPeriodEnrollments(teacherId, period, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const currentRange = this.getDateRange(period);
                const periodLength = currentRange.endDate.getTime() - currentRange.startDate.getTime();
                const previousRange = {
                    startDate: new Date(currentRange.startDate.getTime() - periodLength),
                    endDate: new Date(currentRange.endDate.getTime() - periodLength)
                };
                return yield this.calculateNewEnrollmentsInPeriod(teacherId, previousRange, courseId);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get previous period enrollments:', error);
                return 0;
            }
        });
    }
    getCompletionRatesByCourse(teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { creator: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query._id = new mongoose_1.Types.ObjectId(courseId);
                }
                const courses = yield course_model_1.Course.find(query).populate('lectures');
                const completionRates = [];
                for (const course of courses) {
                    const rate = yield this.calculateCompletionRate(course._id);
                    completionRates.push({
                        courseId: course._id.toString(),
                        courseName: course.title,
                        rate
                    });
                }
                return completionRates;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get completion rates by course:', error);
                return [];
            }
        });
    }
    getTimeSpentTrends(teacherId, period, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const intervals = this.generateDateIntervals(period);
                const trends = [];
                for (const interval of intervals) {
                    const query = {
                        teacherId: new mongoose_1.Types.ObjectId(teacherId),
                        lastActivity: {
                            $gte: interval.startDate,
                            $lte: interval.endDate
                        }
                    };
                    if (courseId) {
                        query.courseId = new mongoose_1.Types.ObjectId(courseId);
                    }
                    const engagementData = yield analytics_model_1.StudentEngagement.find(query);
                    const totalMinutes = engagementData.reduce((sum, data) => sum + data.totalTimeSpent, 0);
                    const averageMinutes = engagementData.length > 0 ? totalMinutes / engagementData.length : 0;
                    trends.push({
                        date: interval.startDate.toISOString().split('T')[0],
                        minutes: averageMinutes
                    });
                }
                return trends;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get time spent trends:', error);
                return [];
            }
        });
    }
    getActivityPatterns(teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                const engagementData = yield analytics_model_1.StudentEngagement.find(query);
                const hourlyActivity = {};
                // Initialize all hours
                for (let i = 0; i < 24; i++) {
                    hourlyActivity[i] = 0;
                }
                // Count activity by hour (using peak hours from engagement data)
                engagementData.forEach(data => {
                    data.activityPattern.peakHours.forEach(hour => {
                        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
                    });
                });
                return Object.entries(hourlyActivity).map(([hour, activity]) => ({
                    hour: parseInt(hour),
                    activity
                }));
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get activity patterns:', error);
                return [];
            }
        });
    }
    calculateRetentionRate(teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                const totalStudents = yield analytics_model_1.StudentEngagement.countDocuments(query);
                if (totalStudents === 0)
                    return 0;
                const activeStudents = yield analytics_model_1.StudentEngagement.countDocuments(Object.assign(Object.assign({}, query), { lastActivity: { $gte: (0, date_fns_1.subDays)(new Date(), 30) } }));
                return (activeStudents / totalStudents) * 100;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to calculate retention rate:', error);
                return 0;
            }
        });
    }
    generateDateIntervals(period) {
        const now = new Date();
        const intervals = [];
        switch (period) {
            case 'daily':
                // Last 7 days
                for (let i = 6; i >= 0; i--) {
                    const date = (0, date_fns_1.subDays)(now, i);
                    intervals.push({
                        startDate: (0, date_fns_1.startOfDay)(date),
                        endDate: (0, date_fns_1.endOfDay)(date)
                    });
                }
                break;
            case 'weekly':
                // Last 4 weeks
                for (let i = 3; i >= 0; i--) {
                    const date = (0, date_fns_1.subDays)(now, i * 7);
                    intervals.push({
                        startDate: (0, date_fns_1.startOfWeek)(date),
                        endDate: (0, date_fns_1.endOfWeek)(date)
                    });
                }
                break;
            case 'monthly':
                // Last 6 months
                for (let i = 5; i >= 0; i--) {
                    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    intervals.push({
                        startDate: (0, date_fns_1.startOfMonth)(date),
                        endDate: (0, date_fns_1.endOfMonth)(date)
                    });
                }
                break;
            case 'yearly':
                // Last 3 years
                for (let i = 2; i >= 0; i--) {
                    const date = new Date(now.getFullYear() - i, 0, 1);
                    intervals.push({
                        startDate: (0, date_fns_1.startOfYear)(date),
                        endDate: (0, date_fns_1.endOfYear)(date)
                    });
                }
                break;
        }
        return intervals;
    }
    getPreviousPeriodRevenue(teacherId, period, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const currentRange = this.getDateRange(period);
                const periodLength = currentRange.endDate.getTime() - currentRange.startDate.getTime();
                const previousRange = {
                    startDate: new Date(currentRange.startDate.getTime() - periodLength),
                    endDate: new Date(currentRange.endDate.getTime() - periodLength)
                };
                const query = {
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                    status: 'completed',
                    createdAt: {
                        $gte: previousRange.startDate,
                        $lte: previousRange.endDate
                    }
                };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                const payments = yield payment_model_1.Payment.find(query);
                return payments.reduce((sum, payment) => sum + payment.teacherShare, 0);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get previous period revenue:', error);
                return 0;
            }
        });
    }
    getPaymentTrends(teacherId, period, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const intervals = this.generateDateIntervals(period);
                const trends = [];
                for (const interval of intervals) {
                    const query = {
                        teacherId: new mongoose_1.Types.ObjectId(teacherId),
                        status: 'completed',
                        createdAt: {
                            $gte: interval.startDate,
                            $lte: interval.endDate
                        }
                    };
                    if (courseId) {
                        query.courseId = new mongoose_1.Types.ObjectId(courseId);
                    }
                    const payments = yield payment_model_1.Payment.find(query);
                    const totalAmount = payments.reduce((sum, payment) => sum + payment.teacherShare, 0);
                    trends.push({
                        date: interval.startDate.toISOString().split('T')[0],
                        amount: totalAmount,
                        count: payments.length
                    });
                }
                return trends;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get payment trends:', error);
                return [];
            }
        });
    }
    getTopEarningCourses(teacherId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const revenueData = yield payment_model_1.Payment.aggregate([
                    {
                        $match: {
                            teacherId: new mongoose_1.Types.ObjectId(teacherId),
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: '$courseId',
                            totalRevenue: { $sum: '$teacherShare' },
                            enrollmentCount: { $sum: 1 }
                        }
                    },
                    {
                        $sort: { totalRevenue: -1 }
                    },
                    {
                        $limit: 10
                    },
                    {
                        $lookup: {
                            from: 'courses',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'course'
                        }
                    }
                ]);
                return revenueData.map(item => {
                    var _a;
                    return ({
                        courseId: item._id.toString(),
                        courseName: ((_a = item.course[0]) === null || _a === void 0 ? void 0 : _a.title) || 'Unknown Course',
                        revenue: item.totalRevenue,
                        enrollments: item.enrollmentCount
                    });
                });
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get top earning courses:', error);
                return [];
            }
        });
    }
    calculateConversionRate(teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { creator: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query._id = new mongoose_1.Types.ObjectId(courseId);
                }
                const courses = yield course_model_1.Course.find(query);
                let totalEnrollments = 0;
                let totalPaidEnrollments = 0;
                for (const course of courses) {
                    totalEnrollments += course.totalEnrollment || 0;
                    const paidEnrollments = yield payment_model_1.Payment.countDocuments({
                        courseId: course._id,
                        teacherId: new mongoose_1.Types.ObjectId(teacherId),
                        status: 'completed'
                    });
                    totalPaidEnrollments += paidEnrollments;
                }
                return totalEnrollments > 0 ? (totalPaidEnrollments / totalEnrollments) * 100 : 0;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to calculate conversion rate:', error);
                return 0;
            }
        });
    }
    calculateRefundRate(teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                const totalPayments = yield payment_model_1.Payment.countDocuments(Object.assign(Object.assign({}, query), { status: 'completed' }));
                const refundedPayments = yield payment_model_1.Payment.countDocuments(Object.assign(Object.assign({}, query), { status: 'failed' })); // Assuming 'failed' represents refunds
                return totalPayments > 0 ? (refundedPayments / totalPayments) * 100 : 0;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to calculate refund rate:', error);
                return 0;
            }
        });
    }
    getRatingTrends(teacherId, period, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Use the parameters to build query (even if placeholder implementation)
                const dateRange = this.getDateRange(period);
                const query = {
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
                };
                if (courseId) {
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                }
                // TODO: Implement actual rating trends from reviews data
                // This is a placeholder implementation
                const intervals = this.generateDateIntervals(period);
                return intervals.map(interval => ({
                    date: interval.startDate.toISOString().split('T')[0],
                    rating: 4.5 // Placeholder
                }));
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get rating trends:', error);
                return [];
            }
        });
    }
    getAverageCompletionRate(teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { creator: new mongoose_1.Types.ObjectId(teacherId) };
                if (courseId) {
                    query._id = new mongoose_1.Types.ObjectId(courseId);
                }
                const courses = yield course_model_1.Course.find(query);
                if (courses.length === 0)
                    return 0;
                let totalCompletionRate = 0;
                for (const course of courses) {
                    const rate = yield this.calculateCompletionRate(course._id);
                    totalCompletionRate += rate;
                }
                return totalCompletionRate / courses.length;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get average completion rate:', error);
                return 0;
            }
        });
    }
    generateImprovementSuggestions(averageRating, completionRate, retentionRate) {
        return __awaiter(this, void 0, void 0, function* () {
            const suggestions = [];
            if (averageRating < 4.0) {
                suggestions.push('Focus on improving course content quality and student satisfaction');
            }
            if (completionRate < 60) {
                suggestions.push('Consider breaking down content into smaller, more digestible modules');
                suggestions.push('Add more interactive elements and quizzes to maintain engagement');
            }
            if (retentionRate < 70) {
                suggestions.push('Implement regular check-ins and progress tracking for students');
                suggestions.push('Create a community or discussion forum for peer interaction');
            }
            if (averageRating > 4.5 && completionRate > 80) {
                suggestions.push('Excellent performance! Consider creating advanced or specialized courses');
            }
            return suggestions;
        });
    }
    generateInsights(courseAnalytics, revenueAnalytics, performanceMetrics) {
        return __awaiter(this, void 0, void 0, function* () {
            const recommendations = [];
            const alerts = [];
            let topInsight = 'Your courses are performing well overall.';
            // Analyze course performance
            if (courseAnalytics.length > 0) {
                const avgCompletionRate = courseAnalytics.reduce((sum, ca) => sum + ca.completionRate, 0) / courseAnalytics.length;
                if (avgCompletionRate < 50) {
                    alerts.push('Low course completion rates detected');
                    recommendations.push('Consider reviewing course structure and content engagement');
                }
                if (avgCompletionRate > 80) {
                    recommendations.push('Excellent completion rates! Consider creating advanced courses');
                }
            }
            // Analyze revenue trends
            if (revenueAnalytics && revenueAnalytics.totalRevenue > 0) {
                topInsight = `You've generated $${revenueAnalytics.totalRevenue.toFixed(2)} in total revenue.`;
                if (revenueAnalytics.averageOrderValue < 50) {
                    recommendations.push('Consider bundling courses or increasing course value to improve average order value');
                }
            }
            // Analyze performance metrics
            if (performanceMetrics) {
                if (performanceMetrics.averageRating < 4.0) {
                    alerts.push('Course ratings below 4.0 - consider improving content quality');
                }
                if (performanceMetrics.studentRetentionRate < 70) {
                    alerts.push('Low student retention rate detected');
                    recommendations.push('Focus on improving student engagement and course interaction');
                }
            }
            return {
                topInsight,
                recommendations,
                alerts,
            };
        });
    }
}
exports.default = AnalyticsService;
