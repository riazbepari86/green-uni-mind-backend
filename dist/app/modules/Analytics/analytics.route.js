"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const user_constant_1 = require("../User/user.constant");
const analytics_controller_1 = require("./analytics.controller");
const analytics_validation_1 = require("./analytics.validation");
const EnhancedRateLimitService_1 = __importDefault(require("../../services/rateLimit/EnhancedRateLimitService"));
const router = (0, express_1.Router)();
// Rate limiting for analytics endpoints
const analyticsRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: {
        error: 'Too Many Requests',
        message: 'Too many analytics requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const dashboardRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: {
        error: 'Too Many Requests',
        message: 'Too many dashboard requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Apply rate limiting to all analytics routes
router.use(analyticsRateLimit);
// Teacher Analytics Routes
router.get('/teachers/:teacherId/overview', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.getTeacherAnalytics), analytics_controller_1.AnalyticsController.getTeacherAnalytics);
router.get('/teachers/:teacherId/dashboard', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), dashboardRateLimit, (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.getDashboardSummary), analytics_controller_1.AnalyticsController.getDashboardSummary);
router.get('/teachers/:teacherId/export', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.exportAnalytics), analytics_controller_1.AnalyticsController.exportAnalytics);
// Course Analytics Routes
router.get('/teachers/:teacherId/courses/:courseId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.getCourseAnalytics), analytics_controller_1.AnalyticsController.getCourseAnalytics);
// Revenue Analytics Routes
router.get('/teachers/:teacherId/revenue', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.getRevenueAnalytics), analytics_controller_1.AnalyticsController.getRevenueAnalytics);
// Performance Metrics Routes
router.get('/teachers/:teacherId/performance', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.getPerformanceMetrics), analytics_controller_1.AnalyticsController.getPerformanceMetrics);
// Student Engagement Routes
router.get('/teachers/:teacherId/engagement', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.getStudentEngagement), analytics_controller_1.AnalyticsController.getStudentEngagement);
// Activity Feed Routes
router.get('/teachers/:teacherId/activities', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.getActivityFeed), analytics_controller_1.AnalyticsController.getActivityFeed);
router.patch('/teachers/:teacherId/activities/:activityId/read', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.markActivityAsRead), analytics_controller_1.AnalyticsController.markActivityAsRead);
// Enhanced Analytics Routes with Rate Limiting
router.get('/teachers/:teacherId/enrollment-statistics', EnhancedRateLimitService_1.default.createRateLimit('enhancedAnalytics'), (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.getEnrollmentStatistics), analytics_controller_1.AnalyticsController.getEnrollmentStatistics);
router.get('/teachers/:teacherId/engagement-metrics', EnhancedRateLimitService_1.default.createRateLimit('enhancedAnalytics'), (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.getEngagementMetrics), analytics_controller_1.AnalyticsController.getStudentEngagementMetrics);
router.get('/teachers/:teacherId/revenue-detailed', EnhancedRateLimitService_1.default.createRateLimit('enhancedAnalytics'), (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.getRevenueAnalyticsDetailed), analytics_controller_1.AnalyticsController.getRevenueAnalyticsDetailed);
router.get('/teachers/:teacherId/performance-detailed', EnhancedRateLimitService_1.default.createRateLimit('enhancedAnalytics'), (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(analytics_validation_1.AnalyticsValidation.getPerformanceMetricsDetailed), analytics_controller_1.AnalyticsController.getPerformanceMetricsDetailed);
// Bulk operations with stricter rate limiting
router.patch('/teachers/:teacherId/activities/bulk-read', EnhancedRateLimitService_1.default.createRateLimit('bulkOperations'), (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), analytics_controller_1.AnalyticsController.bulkMarkActivitiesAsRead);
// Real-time and insights routes (missing endpoints)
router.get('/teachers/:teacherId/realtime', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), analytics_controller_1.AnalyticsController.getRealTimeData);
router.get('/teachers/:teacherId/insights', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), analytics_controller_1.AnalyticsController.getInsights);
exports.AnalyticsRoutes = router;
