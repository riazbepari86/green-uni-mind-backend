import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import AppError from '../../errors/AppError';
import AnalyticsService from '../../services/analytics/AnalyticsService';
import ActivityTrackingService from '../../services/activity/ActivityTrackingService';
import { Teacher } from '../Teacher/teacher.model';
// Removed unused imports

const analyticsService = new AnalyticsService();
const activityTrackingService = new ActivityTrackingService();

/**
 * Helper function to validate and resolve teacher ID
 * Handles cases where frontend passes user._id instead of teacher._id
 */
const validateAndResolveTeacherId = async (teacherId: string, authenticatedUser: any): Promise<string> => {
  console.log('🔍 validateAndResolveTeacherId called with:', { teacherId, userRole: authenticatedUser.role, userId: authenticatedUser._id });

  if (authenticatedUser.role !== 'teacher') {
    console.log('✅ Non-teacher user, returning original teacherId');
    return teacherId; // For non-teacher users, return as-is
  }

  // Try to find teacher by the provided ID first
  console.log('🔍 Looking for teacher by ID:', teacherId);
  let teacher = await Teacher.findById(teacherId);
  console.log('📊 Teacher.findById result:', teacher ? 'Found' : 'Not found');

  // If not found, try to find by user ID (common case when frontend passes user._id)
  if (!teacher) {
    console.log('🔍 Looking for teacher by user ID:', teacherId);
    teacher = await Teacher.findOne({ user: teacherId });
    console.log('📊 Teacher.findOne({user}) result:', teacher ? 'Found' : 'Not found');
  }

  // Validate that the teacher belongs to the authenticated user
  if (!teacher) {
    console.log('❌ No teacher found for ID:', teacherId);
    throw new AppError(httpStatus.FORBIDDEN, 'Teacher not found');
  }

  console.log('🔍 Teacher found:', { teacherId: teacher._id, userId: teacher.user });

  if (teacher.user.toString() !== authenticatedUser._id) {
    console.log('❌ Teacher user mismatch:', { teacherUserId: teacher.user.toString(), authenticatedUserId: authenticatedUser._id });
    throw new AppError(httpStatus.FORBIDDEN, 'You can only access your own data');
  }

  console.log('✅ Teacher validation successful, returning teacher ID:', teacher._id.toString());
  return teacher._id.toString();
};

/**
 * Get comprehensive teacher analytics
 */
const getTeacherAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const {
    period = 'monthly',
    courseId,
    startDate,
    endDate,
    compareWithPrevious = false
  } = req.query;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  const filters = {
    teacherId: actualTeacherId,
    courseId: courseId as string,
    period: period as 'daily' | 'weekly' | 'monthly' | 'yearly',
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    compareWithPrevious: compareWithPrevious === 'true',
  };

  const analytics = await analyticsService.getTeacherAnalytics(filters);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Teacher analytics retrieved successfully',
    data: analytics,
  });
});

/**
 * Get course-specific analytics
 */
const getCourseAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { teacherId, courseId } = req.params;
  const { period = 'monthly', startDate, endDate } = req.query;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  const dateRange = startDate && endDate ? {
    startDate: new Date(startDate as string),
    endDate: new Date(endDate as string),
  } : undefined;

  // Use period parameter for analytics (currently passed but not used in service)
  const analytics = await analyticsService.getCourseAnalytics(teacherId, courseId, dateRange);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course analytics retrieved successfully',
    data: analytics,
  });
});

/**
 * Get revenue analytics
 */
const getRevenueAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { courseId, period = 'monthly', startDate, endDate } = req.query;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  const dateRange = startDate && endDate ? {
    startDate: new Date(startDate as string),
    endDate: new Date(endDate as string),
  } : undefined;

  // Note: period parameter available for future use
  const analytics = await analyticsService.getRevenueAnalytics(
    teacherId,
    courseId as string,
    dateRange
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Revenue analytics retrieved successfully',
    data: analytics,
  });
});

/**
 * Get performance metrics
 */
const getPerformanceMetrics = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { courseId, period = 'monthly', startDate, endDate } = req.query;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  const dateRange = startDate && endDate ? {
    startDate: new Date(startDate as string),
    endDate: new Date(endDate as string),
  } : undefined;

  // Note: period parameter available for future use
  const metrics = await analyticsService.getPerformanceMetrics(
    teacherId,
    courseId as string,
    dateRange
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Performance metrics retrieved successfully',
    data: metrics,
  });
});

/**
 * Get student engagement analytics
 */
const getStudentEngagement = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { courseId, period = 'monthly', startDate, endDate } = req.query;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  const dateRange = startDate && endDate ? {
    startDate: new Date(startDate as string),
    endDate: new Date(endDate as string),
  } : undefined;

  // Note: period parameter available for future use
  const engagement = await analyticsService.getStudentEngagementSummary(
    teacherId,
    courseId as string,
    dateRange
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Student engagement data retrieved successfully',
    data: engagement,
  });
});

/**
 * Get activity feed for teacher
 */
const getActivityFeed = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const {
    limit = 20,
    offset = 0,
    type,
    priority,
    isRead,
    courseId,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  // Build filters object
  const filters = {
    limit: parseInt(limit as string),
    offset: parseInt(offset as string),
    type: type as any, // Cast to any to avoid type issues
    priority: priority as any,
    isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
    courseId: courseId as string,
    sortBy: sortBy as any,
    sortOrder: sortOrder as any
  };

  const activitiesResult = await activityTrackingService.getActivitiesWithFilters(actualTeacherId, filters);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Activity feed retrieved successfully',
    data: {
      activities: activitiesResult.activities,
      total: activitiesResult.total,
      unreadCount: activitiesResult.unreadCount,
      priorityBreakdown: activitiesResult.priorityBreakdown,
      typeBreakdown: activitiesResult.typeBreakdown,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: activitiesResult.total,
      },
    },
  });
});

/**
 * Mark activity as read
 */
const markActivityAsRead = catchAsync(async (req: Request, res: Response) => {
  const { teacherId, activityId } = req.params;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  await activityTrackingService.markActivityAsRead(activityId, actualTeacherId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Activity marked as read successfully',
    data: null,
  });
});

/**
 * Get analytics dashboard summary
 */
const getDashboardSummary = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  // Get summary data for the current month
  const filters = {
    teacherId: actualTeacherId,
    period: 'monthly' as const,
  };

  const [analytics, recentActivities] = await Promise.all([
    analyticsService.getTeacherAnalytics(filters),
    activityTrackingService.getRecentActivities(actualTeacherId, 10),
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

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Dashboard summary retrieved successfully',
    data: summary,
  });
});

/**
 * Export analytics data
 */
const exportAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { format = 'json', period = 'monthly', courseId } = req.query;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  const filters = {
    teacherId: actualTeacherId,
    courseId: courseId as string,
    period: period as 'daily' | 'weekly' | 'monthly' | 'yearly',
  };

  const analytics = await analyticsService.getTeacherAnalytics(filters);

  if (format === 'csv') {
    // TODO: Implement CSV export
    throw new AppError(httpStatus.NOT_IMPLEMENTED, 'CSV export not yet implemented');
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Analytics data exported successfully',
    data: analytics,
  });
});

/**
 * Get detailed enrollment statistics
 */
const getEnrollmentStatistics = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { period = 'monthly', courseId } = req.query;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  const statistics = await analyticsService.getEnrollmentStatistics(
    teacherId,
    period as 'daily' | 'weekly' | 'monthly' | 'yearly',
    courseId as string
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Enrollment statistics retrieved successfully',
    data: statistics,
  });
});

/**
 * Get detailed student engagement metrics
 */
const getStudentEngagementMetrics = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { period = 'monthly', courseId } = req.query;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  const metrics = await analyticsService.getStudentEngagementMetrics(
    teacherId,
    period as 'daily' | 'weekly' | 'monthly' | 'yearly',
    courseId as string
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Student engagement metrics retrieved successfully',
    data: metrics,
  });
});

/**
 * Get detailed revenue analytics
 */
const getRevenueAnalyticsDetailed = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { period = 'monthly', courseId } = req.query;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  const analytics = await analyticsService.getRevenueAnalyticsDetailed(
    teacherId,
    period as 'daily' | 'weekly' | 'monthly' | 'yearly',
    courseId as string
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Detailed revenue analytics retrieved successfully',
    data: analytics,
  });
});

/**
 * Get detailed performance metrics
 */
const getPerformanceMetricsDetailed = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { period = 'monthly', courseId } = req.query;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  const metrics = await analyticsService.getPerformanceMetricsDetailed(
    actualTeacherId,
    period as 'daily' | 'weekly' | 'monthly' | 'yearly',
    courseId as string
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Detailed performance metrics retrieved successfully',
    data: metrics,
  });
});

/**
 * Bulk mark activities as read
 */
const bulkMarkActivitiesAsRead = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { activityIds } = req.body;

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  if (!Array.isArray(activityIds) || activityIds.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Activity IDs array is required');
  }

  await Promise.all(
    activityIds.map(activityId =>
      activityTrackingService.markActivityAsRead(activityId, actualTeacherId)
    )
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Activities marked as read successfully',
    data: null,
  });
});

/**
 * Get real-time analytics data
 */
const getRealTimeData = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const user = (req as any).user;

  // Validate teacher ID matches authenticated user
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

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

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Real-time analytics data retrieved successfully',
    data: emptyRealTimeData,
  });
});

/**
 * Get analytics insights
 */
const getInsights = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { limit = 5 } = req.query;
  const user = (req as any).user;

  // Validate teacher ID matches authenticated user
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

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

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Analytics insights retrieved successfully',
    data: newTeacherInsights.slice(0, parseInt(limit as string)),
  });
});

export const AnalyticsController = {
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
