import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import rateLimit from 'express-rate-limit';
import { USER_ROLE } from '../User/user.constant';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsValidation } from './analytics.validation';
import EnhancedRateLimitService from '../../services/rateLimit/EnhancedRateLimitService';

const router = Router();

// Rate limiting for analytics endpoints
const analyticsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    error: 'Too Many Requests',
    message: 'Too many analytics requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const dashboardRateLimit = rateLimit({
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
router.get(
  '/teachers/:teacherId/overview',
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getTeacherAnalytics),
  AnalyticsController.getTeacherAnalytics
);

router.get(
  '/teachers/:teacherId/dashboard',
  auth(USER_ROLE.teacher),
  dashboardRateLimit,
  validateRequest(AnalyticsValidation.getDashboardSummary),
  AnalyticsController.getDashboardSummary
);

router.get(
  '/teachers/:teacherId/export',
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.exportAnalytics),
  AnalyticsController.exportAnalytics
);

// Course Analytics Routes
router.get(
  '/teachers/:teacherId/courses/:courseId',
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getCourseAnalytics),
  AnalyticsController.getCourseAnalytics
);

// Revenue Analytics Routes
router.get(
  '/teachers/:teacherId/revenue',
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getRevenueAnalytics),
  AnalyticsController.getRevenueAnalytics
);

// Performance Metrics Routes
router.get(
  '/teachers/:teacherId/performance',
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getPerformanceMetrics),
  AnalyticsController.getPerformanceMetrics
);

// Student Engagement Routes
router.get(
  '/teachers/:teacherId/engagement',
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getStudentEngagement),
  AnalyticsController.getStudentEngagement
);

// Activity Feed Routes
router.get(
  '/teachers/:teacherId/activities',
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getActivityFeed),
  AnalyticsController.getActivityFeed
);

router.patch(
  '/teachers/:teacherId/activities/:activityId/read',
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.markActivityAsRead),
  AnalyticsController.markActivityAsRead
);

// Enhanced Analytics Routes with Rate Limiting
router.get(
  '/teachers/:teacherId/enrollment-statistics',
  EnhancedRateLimitService.createRateLimit('enhancedAnalytics'),
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getEnrollmentStatistics),
  AnalyticsController.getEnrollmentStatistics
);

router.get(
  '/teachers/:teacherId/engagement-metrics',
  EnhancedRateLimitService.createRateLimit('enhancedAnalytics'),
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getEngagementMetrics),
  AnalyticsController.getStudentEngagementMetrics
);

router.get(
  '/teachers/:teacherId/revenue-detailed',
  EnhancedRateLimitService.createRateLimit('enhancedAnalytics'),
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getRevenueAnalyticsDetailed),
  AnalyticsController.getRevenueAnalyticsDetailed
);

router.get(
  '/teachers/:teacherId/performance-detailed',
  EnhancedRateLimitService.createRateLimit('enhancedAnalytics'),
  auth(USER_ROLE.teacher),
  validateRequest(AnalyticsValidation.getPerformanceMetricsDetailed),
  AnalyticsController.getPerformanceMetricsDetailed
);

// Bulk operations with stricter rate limiting
router.patch(
  '/teachers/:teacherId/activities/bulk-read',
  EnhancedRateLimitService.createRateLimit('bulkOperations'),
  auth(USER_ROLE.teacher),
  AnalyticsController.bulkMarkActivitiesAsRead
);

// Real-time and insights routes (missing endpoints)
router.get(
  '/teachers/:teacherId/realtime',
  auth(USER_ROLE.teacher),
  AnalyticsController.getRealTimeData
);

router.get(
  '/teachers/:teacherId/insights',
  auth(USER_ROLE.teacher),
  AnalyticsController.getInsights
);

export const AnalyticsRoutes = router;
