import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import EnhancedRateLimitService from '../../services/rateLimit/EnhancedRateLimitService';
import { USER_ROLE } from '../User/user.constant';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsValidation } from './analytics.validation';

const router = Router();

// Rate limiting for analytics endpoints - OPTIMIZED
// Removed global analytics rate limit to prevent double rate limiting
// Individual endpoints now use specific rate limits based on their usage patterns

const dashboardRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 40, // Increased from 30 to 40 requests per minute for dashboard
  message: {
    error: 'Too Many Requests',
    message: 'Too many dashboard requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General analytics rate limit for non-enhanced endpoints
const generalAnalyticsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute for general analytics
  message: {
    error: 'Too Many Requests',
    message: 'Too many analytics requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Teacher Analytics Routes - OPTIMIZED RATE LIMITING
router.get(
  '/teachers/:teacherId/overview',
  generalAnalyticsRateLimit, // Apply general rate limit
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getTeacherAnalytics),
  AnalyticsController.getTeacherAnalytics,
);

router.get(
  '/teachers/:teacherId/dashboard',
  dashboardRateLimit, // Higher limit for dashboard endpoint
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getDashboardSummary),
  AnalyticsController.getDashboardSummary,
);

router.get(
  '/teachers/:teacherId/export',
  generalAnalyticsRateLimit, // Apply general rate limit
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.exportAnalytics),
  AnalyticsController.exportAnalytics,
);

// Course Analytics Routes
router.get(
  '/teachers/:teacherId/courses/:courseId',
  generalAnalyticsRateLimit, // Apply general rate limit
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getCourseAnalytics),
  AnalyticsController.getCourseAnalytics,
);

// Revenue Analytics Routes
router.get(
  '/teachers/:teacherId/revenue',
  generalAnalyticsRateLimit, // Apply general rate limit
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getRevenueAnalytics),
  AnalyticsController.getRevenueAnalytics,
);

// Performance Metrics Routes
router.get(
  '/teachers/:teacherId/performance',
  generalAnalyticsRateLimit, // Apply general rate limit
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getPerformanceMetrics),
  AnalyticsController.getPerformanceMetrics,
);

// Student Engagement Routes
router.get(
  '/teachers/:teacherId/engagement',
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getStudentEngagement),
  AnalyticsController.getStudentEngagement,
);

// Student Engagement Details Route (for frontend compatibility)
router.get(
  '/teachers/:teacherId/student-engagement',
  generalAnalyticsRateLimit,
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getStudentEngagementDetails),
  AnalyticsController.getStudentEngagementDetails,
);

// Activity Feed Routes
router.get(
  '/teachers/:teacherId/activities',
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getActivityFeed),
  AnalyticsController.getActivityFeed,
);

router.patch(
  '/teachers/:teacherId/activities/:activityId/read',
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.markActivityAsRead),
  AnalyticsController.markActivityAsRead,
);

// Enhanced Analytics Routes with Rate Limiting
router.get(
  '/teachers/:teacherId/enrollment-statistics',
  EnhancedRateLimitService.createRateLimit('enhancedAnalytics'),
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getEnrollmentStatistics),
  AnalyticsController.getEnrollmentStatistics,
);

router.get(
  '/teachers/:teacherId/engagement-metrics',
  EnhancedRateLimitService.createRateLimit('enhancedAnalytics'),
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getEngagementMetrics),
  AnalyticsController.getStudentEngagementMetrics,
);

router.get(
  '/teachers/:teacherId/revenue-detailed',
  EnhancedRateLimitService.createRateLimit('enhancedAnalytics'),
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getRevenueAnalyticsDetailed),
  AnalyticsController.getRevenueAnalyticsDetailed,
);

router.get(
  '/teachers/:teacherId/performance-detailed',
  EnhancedRateLimitService.createRateLimit('enhancedAnalytics'),
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getPerformanceMetricsDetailed),
  AnalyticsController.getPerformanceMetricsDetailed,
);

// Bulk operations with stricter rate limiting
router.patch(
  '/teachers/:teacherId/activities/bulk-read',
  EnhancedRateLimitService.createRateLimit('bulkOperations'),
  auth(USER_ROLE.teacher),
  AnalyticsController.bulkMarkActivitiesAsRead,
);

// Real-time and insights routes (missing endpoints)
router.get(
  '/teachers/:teacherId/realtime',
  auth(USER_ROLE.teacher),
  AnalyticsController.getRealTimeData,
);

router.get(
  '/teachers/:teacherId/insights',
  auth(USER_ROLE.teacher),
  AnalyticsController.getInsights,
);

// Student Analytics Routes
router.get(
  '/students/:studentId/dashboard',
  generalAnalyticsRateLimit,
  auth(USER_ROLE.student),
  AnalyticsController.getStudentDashboard,
);

export const AnalyticsRoutes = router;
