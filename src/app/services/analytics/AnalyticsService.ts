import { Types } from 'mongoose';
import {
  CourseAnalytics,
  StudentEngagement,
  RevenueAnalytics,
  PerformanceMetrics,
  AnalyticsSummary
} from '../../modules/Analytics/analytics.model';
import {
  ICourseAnalytics,
  IRevenueAnalytics,
  IPerformanceMetrics,
  IAnalyticsSummary
} from '../../modules/Analytics/analytics.interface';
import { Course } from '../../modules/Course/course.model';
import { Student } from '../../modules/Student/student.model';
import { Payment } from '../../modules/Payment/payment.model';
import { Logger } from '../../config/logger';
import { redisOperations } from '../../config/redis';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface AnalyticsFilters {
  teacherId: string;
  courseId?: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate?: Date;
  endDate?: Date;
  compareWithPrevious?: boolean;
}

class AnalyticsService {
  private readonly CACHE_TTL = {
    realtime: 300, // 5 minutes
    hourly: 3600, // 1 hour
    daily: 86400, // 24 hours
    weekly: 604800, // 7 days
  };

  // WebSocket service removed - real-time analytics will be handled by SSE/Polling

  constructor() {
    // Constructor simplified - no WebSocket dependency
  }

  /**
   * Invalidate cache for teacher analytics
   */
  public async invalidateTeacherCache(teacherId: string): Promise<void> {
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
        await redisOperations.del(pattern);
      }

      Logger.info(`🗑️ Cache invalidated for teacher: ${teacherId}`);
    } catch (error) {
      Logger.error('❌ Failed to invalidate teacher cache:', error);
    }
  }

  /**
   * Warm up cache for frequently accessed data
   */
  public async warmUpCache(teacherId: string): Promise<void> {
    try {
      Logger.info(`🔥 Warming up cache for teacher: ${teacherId}`);

      // Pre-load monthly analytics
      const monthlyFilters = {
        teacherId,
        period: 'monthly' as const,
      };

      await this.getTeacherAnalytics(monthlyFilters);

      // Pre-load recent activities
      const activityTrackingService = new (await import('../activity/ActivityTrackingService')).default();
      await activityTrackingService.getRecentActivities(teacherId, 20);

      Logger.info(`✅ Cache warmed up for teacher: ${teacherId}`);
    } catch (error) {
      Logger.error('❌ Failed to warm up cache:', error);
    }
  }

  /**
   * Get comprehensive analytics for a teacher
   */
  public async getTeacherAnalytics(filters: AnalyticsFilters): Promise<IAnalyticsSummary> {
    try {
      const cacheKey = this.generateCacheKey('teacher_analytics', filters);
      const cached = await redisOperations.get(cacheKey);

      if (cached) {
        Logger.info(`📊 Returning cached analytics for teacher: ${filters.teacherId}`);
        return JSON.parse(cached);
      }

      const dateRange = this.getDateRange(filters.period, filters.startDate, filters.endDate);

      // Fetch all analytics data in parallel with error handling for new teachers
      const [courseAnalytics, revenueAnalytics, performanceMetrics, studentEngagement] = await Promise.allSettled([
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
      const insights = await this.generateInsights(courseAnalyticsData, revenueAnalyticsData, performanceMetricsData).catch(() => ({
        topInsight: 'Welcome! Start by creating your first course to see analytics.',
        recommendations: [
          'Create your first course to start tracking analytics',
          'Add engaging content to attract students',
          'Set up your Stripe account to receive payments'
        ],
        alerts: []
      }));

      // Get total students count with fallback
      const totalStudents = await this.getTotalStudentsCount(filters.teacherId, filters.courseId).catch(() => 0);

      const summary: IAnalyticsSummary = {
        teacherId: new Types.ObjectId(filters.teacherId),
        period: filters.period,
        dateRange: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
        courseAnalytics: courseAnalyticsData.map(ca => ({
          courseId: ca.courseId,
          courseName: (ca as any).courseName || 'Unknown Course',
          enrollments: ca.totalEnrollments || 0,
          revenue: 0, // Will be populated from revenue analytics
          completionRate: ca.completionRate || 0,
          rating: 0, // Will be populated from performance metrics
        })),
        revenueAnalytics: {
          totalRevenue: revenueAnalyticsData?.totalRevenue || 0,
          growth: 0, // Will be calculated if comparing with previous period
          topCourse: revenueAnalyticsData?.topPerformingCourses?.[0]?.courseId || new Types.ObjectId(),
          averageOrderValue: revenueAnalyticsData?.averageOrderValue || 0,
        },
        performanceMetrics: {
          averageRating: performanceMetricsData?.averageRating || 0,
          totalStudents,
          completionRate: performanceMetricsData?.courseCompletionRate || 0,
          satisfactionScore: performanceMetricsData?.studentSatisfactionScore || 0,
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
      } as IAnalyticsSummary;

      // Cache the result
      await redisOperations.setex(cacheKey, this.CACHE_TTL.hourly, JSON.stringify(summary));

      Logger.info(`✅ Generated analytics for teacher: ${filters.teacherId} (${courseAnalyticsData.length} courses)`);
      return summary;
    } catch (error) {
      Logger.error('❌ Failed to get teacher analytics:', error);

      // Return empty state for new teachers instead of throwing error
      return this.getEmptyAnalyticsSummary(filters);
    }
  }

  /**
   * Get empty analytics summary for new teachers
   */
  private getEmptyAnalyticsSummary(filters: AnalyticsFilters): IAnalyticsSummary {
    const dateRange = this.getDateRange(filters.period, filters.startDate, filters.endDate);

    const emptyAnalytics = new AnalyticsSummary({
      teacherId: new Types.ObjectId(filters.teacherId),
      period: filters.period,
      dateRange: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      courseAnalytics: [],
      revenueAnalytics: {
        totalRevenue: 0,
        growth: 0,
        topCourse: new Types.ObjectId(),
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
  public async getCourseAnalytics(
    teacherId: string,
    courseId?: string,
    dateRange?: DateRange
  ): Promise<any[]> {
    try {
      const query: any = { teacherId: new Types.ObjectId(teacherId) };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      if (dateRange) {
        query.lastUpdated = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate
        };
      }

      let analytics = await CourseAnalytics.find(query)
        .populate('courseId', 'title totalEnrollment')
        .sort({ lastUpdated: -1 });

      // If no analytics exist, generate them
      if (analytics.length === 0) {
        analytics = await this.generateCourseAnalytics(teacherId, courseId);
      }

      return analytics;
    } catch (error) {
      Logger.error('❌ Failed to get course analytics:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics with payment trends
   */
  public async getRevenueAnalytics(
    teacherId: string,
    courseId?: string,
    dateRange?: DateRange
  ): Promise<any | null> {
    try {
      const query: any = { teacherId: new Types.ObjectId(teacherId) };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      let analytics = await RevenueAnalytics.findOne(query).sort({ lastUpdated: -1 });

      // If no analytics exist, generate them
      if (!analytics) {
        analytics = await this.generateRevenueAnalytics(teacherId, courseId, dateRange);
      }

      return analytics;
    } catch (error) {
      Logger.error('❌ Failed to get revenue analytics:', error);
      return null;
    }
  }

  /**
   * Get performance metrics including ratings and completion rates
   */
  public async getPerformanceMetrics(
    teacherId: string,
    courseId?: string,
    dateRange?: DateRange
  ): Promise<any | null> {
    try {
      const query: any = { teacherId: new Types.ObjectId(teacherId) };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      if (dateRange) {
        query.lastUpdated = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate
        };
      }

      let metrics = await PerformanceMetrics.findOne(query).sort({ lastUpdated: -1 });

      // If no metrics exist, generate them
      if (!metrics) {
        metrics = await this.generatePerformanceMetrics(teacherId, courseId);
      }

      return metrics;
    } catch (error) {
      Logger.error('❌ Failed to get performance metrics:', error);
      return null;
    }
  }

  /**
   * Get student engagement summary
   */
  public async getStudentEngagementSummary(
    teacherId: string,
    courseId?: string,
    dateRange?: DateRange
  ): Promise<{
    totalActiveStudents: number;
    averageEngagementScore: number;
    topPerformingCourses: Types.ObjectId[];
    retentionRate: number;
  }> {
    try {
      const query: any = { teacherId: new Types.ObjectId(teacherId) };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      if (dateRange) {
        query.lastActivity = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate
        };
      }

      const engagementData = await StudentEngagement.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            averageEngagement: { $avg: '$engagementScore' },
            activeStudents: {
              $sum: {
                $cond: [
                  { $gte: ['$lastActivity', subDays(new Date(), 7)] },
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
      const topCourses = await StudentEngagement.aggregate([
        { $match: { teacherId: new Types.ObjectId(teacherId) } },
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
    } catch (error) {
      Logger.error('❌ Failed to get student engagement summary:', error);
      return {
        totalActiveStudents: 0,
        averageEngagementScore: 0,
        topPerformingCourses: [],
        retentionRate: 0,
      };
    }
  }

  /**
   * Generate course analytics from raw data
   */
  private async generateCourseAnalytics(teacherId: string, courseId?: string): Promise<any[]> {
    try {
      const query: any = { creator: new Types.ObjectId(teacherId) };
      if (courseId) {
        query._id = new Types.ObjectId(courseId);
      }

      const courses = await Course.find(query);
      const analytics: ICourseAnalytics[] = [];

      for (const course of courses) {
        // Calculate enrollment metrics
        const totalEnrollments = course.totalEnrollment || 0;
        const newEnrollments = await this.calculateNewEnrollments(course._id);
        
        // Calculate completion rate
        const completionRate = await this.calculateCompletionRate(course._id);
        
        // Calculate average time spent
        const averageTimeSpent = await this.calculateAverageTimeSpent(course._id);

        const courseAnalytics = new CourseAnalytics({
          courseId: course._id,
          teacherId: new Types.ObjectId(teacherId),
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

        const saved = await courseAnalytics.save();
        analytics.push(saved);
      }

      return analytics;
    } catch (error) {
      Logger.error('❌ Failed to generate course analytics:', error);
      return [];
    }
  }

  /**
   * Generate revenue analytics from payment data
   */
  private async generateRevenueAnalytics(
    teacherId: string,
    courseId?: string,
    dateRange?: DateRange
  ): Promise<any | null> {
    try {
      const query: any = { teacherId: new Types.ObjectId(teacherId) };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      if (dateRange) {
        query.lastUpdated = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate
        };
      }

      // Get payment data
      const payments = await Payment.find(query);
      const totalRevenue = payments.reduce((sum, payment) => sum + payment.teacherShare, 0);
      
      // Calculate revenue by period
      const revenueByPeriod = await this.calculateRevenueByPeriod(teacherId, courseId);
      
      // Calculate average order value
      const averageOrderValue = payments.length > 0 ? totalRevenue / payments.length : 0;

      // Get top performing courses
      const topPerformingCourses = await this.getTopPerformingCoursesByRevenue(teacherId);

      const revenueAnalytics = new RevenueAnalytics({
        teacherId: new Types.ObjectId(teacherId),
        courseId: courseId ? new Types.ObjectId(courseId) : undefined,
        totalRevenue,
        revenueByPeriod,
        averageOrderValue,
        refundRate: 0, // TODO: Calculate actual refund rate
        conversionRate: 0, // TODO: Calculate actual conversion rate
        paymentTrends: [], // TODO: Calculate payment trends
        topPerformingCourses,
        lastUpdated: new Date(),
      });

      return await revenueAnalytics.save();
    } catch (error) {
      Logger.error('❌ Failed to generate revenue analytics:', error);
      return null;
    }
  }

  /**
   * Generate performance metrics from course and student data
   */
  private async generatePerformanceMetrics(teacherId: string, courseId?: string): Promise<any | null> {
    try {
      // TODO: Implement actual performance metrics calculation
      // This would involve calculating ratings, reviews, completion rates, etc.
      
      const performanceMetrics = new PerformanceMetrics({
        teacherId: new Types.ObjectId(teacherId),
        courseId: courseId ? new Types.ObjectId(courseId) : undefined,
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

      return await performanceMetrics.save();
    } catch (error) {
      Logger.error('❌ Failed to generate performance metrics:', error);
      return null;
    }
  }

  /**
   * Helper methods for calculations
   */
  private async calculateNewEnrollments(courseId: Types.ObjectId): Promise<{
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  }> {
    try {
      const now = new Date();
      const dailyStart = startOfDay(now);
      const weeklyStart = startOfWeek(now);
      const monthlyStart = startOfMonth(now);
      const yearlyStart = startOfYear(now);

      // Get students enrolled in this course with enrollment dates
      const students = await Student.find({
        'enrolledCourses.courseId': courseId
      }, {
        'enrolledCourses.$': 1
      });

      const enrollmentDates = students
        .map(student => student.enrolledCourses[0]?.enrolledAt)
        .filter((date): date is Date => date !== undefined && date !== null);

      return {
        daily: enrollmentDates.filter(date => date >= dailyStart).length,
        weekly: enrollmentDates.filter(date => date >= weeklyStart).length,
        monthly: enrollmentDates.filter(date => date >= monthlyStart).length,
        yearly: enrollmentDates.filter(date => date >= yearlyStart).length,
      };
    } catch (error) {
      Logger.error('❌ Failed to calculate new enrollments:', error);
      return { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
    }
  }

  private async calculateCompletionRate(courseId: Types.ObjectId): Promise<number> {
    try {
      // Get course with lectures
      const course = await Course.findById(courseId).populate('lectures');
      if (!course || !course.lectures || course.lectures.length === 0) {
        return 0;
      }

      const totalLectures = course.lectures.length;

      // Get students enrolled in this course
      const students = await Student.find({
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
    } catch (error) {
      Logger.error('❌ Failed to calculate completion rate:', error);
      return 0;
    }
  }

  private async calculateAverageTimeSpent(courseId: Types.ObjectId): Promise<number> {
    try {
      // Get student engagement data for this course
      const engagementData = await StudentEngagement.find({ courseId });

      if (engagementData.length === 0) {
        return 0;
      }

      const totalTime = engagementData.reduce((sum, data) => sum + data.totalTimeSpent, 0);
      return totalTime / engagementData.length;
    } catch (error) {
      Logger.error('❌ Failed to calculate average time spent:', error);
      return 0;
    }
  }

  private async calculateRevenueByPeriod(teacherId: string, courseId?: string): Promise<{
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  }> {
    try {
      const now = new Date();
      const dailyStart = startOfDay(now);
      const weeklyStart = startOfWeek(now);
      const monthlyStart = startOfMonth(now);
      const yearlyStart = startOfYear(now);

      const query: any = { teacherId: new Types.ObjectId(teacherId), status: 'completed' };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      const payments = await Payment.find(query);

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
    } catch (error) {
      Logger.error('❌ Failed to calculate revenue by period:', error);
      return { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
    }
  }

  private async getTopPerformingCoursesByRevenue(teacherId: string): Promise<{
    courseId: Types.ObjectId;
    revenue: number;
    enrollments: number;
  }[]> {
    try {
      const revenueData = await Payment.aggregate([
        {
          $match: {
            teacherId: new Types.ObjectId(teacherId),
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
    } catch (error) {
      Logger.error('❌ Failed to get top performing courses by revenue:', error);
      return [];
    }
  }

  private async getTotalStudentsCount(teacherId: string, courseId?: string): Promise<number> {
    try {
      const query: any = { creator: new Types.ObjectId(teacherId) };
      if (courseId) {
        query._id = new Types.ObjectId(courseId);
      }

      const courses = await Course.find(query);
      return courses.reduce((total, course) => total + (course.totalEnrollment || 0), 0);
    } catch (error) {
      Logger.error('❌ Failed to get total students count:', error);
      return 0;
    }
  }

  private getDateRange(period: string, startDate?: Date, endDate?: Date): DateRange {
    const now = new Date();
    
    if (startDate && endDate) {
      return { startDate, endDate };
    }

    switch (period) {
      case 'daily':
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case 'weekly':
        return { startDate: startOfWeek(now), endDate: endOfWeek(now) };
      case 'monthly':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case 'yearly':
        return { startDate: startOfYear(now), endDate: endOfYear(now) };
      default:
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    }
  }

  private generateCacheKey(prefix: string, filters: AnalyticsFilters): string {
    const parts = [
      prefix,
      filters.teacherId,
      filters.courseId || 'all',
      filters.period,
      filters.startDate?.toISOString().split('T')[0] || 'current',
      filters.endDate?.toISOString().split('T')[0] || 'current',
    ];
    return parts.join(':');
  }

  /**
   * Get comprehensive enrollment statistics with time-based filtering
   */
  public async getEnrollmentStatistics(
    teacherId: string,
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    courseId?: string
  ): Promise<{
    totalEnrollments: number;
    newEnrollments: number;
    enrollmentTrend: { date: string; count: number }[];
    topCourses: { courseId: string; courseName: string; enrollments: number }[];
    growthRate: number;
  }> {
    try {
      const cacheKey = `enrollment_stats:${teacherId}:${period}:${courseId || 'all'}`;
      const cached = await redisOperations.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const dateRange = this.getDateRange(period);
      const query: any = { creator: new Types.ObjectId(teacherId) };
      if (courseId) {
        query._id = new Types.ObjectId(courseId);
      }

      // Get courses and their enrollment data
      const courses = await Course.find(query).populate('enrolledStudents');
      const totalEnrollments = courses.reduce((sum, course) => sum + (course.totalEnrollment || 0), 0);

      // Calculate new enrollments in the period
      const newEnrollments = await this.calculateNewEnrollmentsInPeriod(teacherId, dateRange, courseId);

      // Get enrollment trend data
      const enrollmentTrend = await this.getEnrollmentTrend(teacherId, period, courseId);

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
      const previousPeriodEnrollments = await this.getPreviousPeriodEnrollments(teacherId, period, courseId);
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
      await redisOperations.setex(cacheKey, this.CACHE_TTL.hourly, JSON.stringify(result));

      return result;
    } catch (error) {
      Logger.error('❌ Failed to get enrollment statistics:', error);

      // Return empty state for new teachers
      return {
        totalEnrollments: 0,
        newEnrollments: 0,
        enrollmentTrend: [],
        topCourses: [],
        growthRate: 0
      };
    }
  }

  /**
   * Get student engagement metrics with activity patterns
   */
  public async getStudentEngagementMetrics(
    teacherId: string,
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    courseId?: string
  ): Promise<{
    totalActiveStudents: number;
    averageEngagementScore: number;
    completionRates: { courseId: string; courseName: string; rate: number }[];
    timeSpentTrends: { date: string; minutes: number }[];
    activityPatterns: { hour: number; activity: number }[];
    retentionRate: number;
  }> {
    try {
      const cacheKey = `engagement_metrics:${teacherId}:${period}:${courseId || 'all'}`;
      const cached = await redisOperations.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const dateRange = this.getDateRange(period);
      const query: any = {
        teacherId: new Types.ObjectId(teacherId),
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      // Get engagement data
      const engagementData = await StudentEngagement.find(query)
        .populate('courseId', 'title')
        .populate('studentId', 'name email');

      // Calculate metrics
      const totalActiveStudents = engagementData.filter(
        data => data.lastActivity >= subDays(new Date(), 7)
      ).length;

      const averageEngagementScore = engagementData.length > 0
        ? engagementData.reduce((sum, data) => sum + data.engagementScore, 0) / engagementData.length
        : 0;

      // Get completion rates by course
      const completionRates = await this.getCompletionRatesByCourse(teacherId, courseId);

      // Get time spent trends
      const timeSpentTrends = await this.getTimeSpentTrends(teacherId, period, courseId);

      // Get activity patterns (by hour of day)
      const activityPatterns = await this.getActivityPatterns(teacherId, courseId);

      // Calculate retention rate
      const retentionRate = await this.calculateRetentionRate(teacherId, courseId);

      const result = {
        totalActiveStudents,
        averageEngagementScore,
        completionRates,
        timeSpentTrends,
        activityPatterns,
        retentionRate
      };

      // Cache for 30 minutes
      await redisOperations.setex(cacheKey, 1800, JSON.stringify(result));

      return result;
    } catch (error) {
      Logger.error('❌ Failed to get student engagement metrics:', error);

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
  }

  /**
   * Get comprehensive revenue analytics with payment trends
   */
  public async getRevenueAnalyticsDetailed(
    teacherId: string,
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    courseId?: string
  ): Promise<{
    totalRevenue: number;
    revenueGrowth: number;
    averageOrderValue: number;
    paymentTrends: { date: string; amount: number; count: number }[];
    topEarningCourses: { courseId: string; courseName: string; revenue: number; enrollments: number }[];
    revenueByPeriod: { daily: number; weekly: number; monthly: number; yearly: number };
    conversionRate: number;
    refundRate: number;
  }> {
    try {
      const cacheKey = `revenue_analytics:${teacherId}:${period}:${courseId || 'all'}`;
      const cached = await redisOperations.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const dateRange = this.getDateRange(period);
      const query: any = {
        teacherId: new Types.ObjectId(teacherId),
        status: 'completed',
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      // Get payment data
      const payments = await Payment.find(query);
      const totalRevenue = payments.reduce((sum, payment) => sum + payment.teacherShare, 0);

      // Calculate revenue growth
      const previousPeriodRevenue = await this.getPreviousPeriodRevenue(teacherId, period, courseId);
      const revenueGrowth = previousPeriodRevenue > 0
        ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : 0;

      // Calculate average order value
      const averageOrderValue = payments.length > 0 ? totalRevenue / payments.length : 0;

      // Get payment trends
      const paymentTrends = await this.getPaymentTrends(teacherId, period, courseId);

      // Get top earning courses
      const topEarningCourses = await this.getTopEarningCourses(teacherId);

      // Get revenue by period
      const revenueByPeriod = await this.calculateRevenueByPeriod(teacherId, courseId);

      // Calculate conversion rate (enrolled vs paid)
      const conversionRate = await this.calculateConversionRate(teacherId, courseId);

      // Calculate refund rate
      const refundRate = await this.calculateRefundRate(teacherId, courseId);

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
      await redisOperations.setex(cacheKey, this.CACHE_TTL.hourly, JSON.stringify(result));

      return result;
    } catch (error) {
      Logger.error('❌ Failed to get detailed revenue analytics:', error);

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
  }

  /**
   * Get performance metrics with comparative analysis
   */
  public async getPerformanceMetricsDetailed(
    teacherId: string,
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    courseId?: string
  ): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
    ratingTrends: { date: string; rating: number }[];
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
    improvementSuggestions: string[];
  }> {
    try {
      const cacheKey = `performance_metrics:${teacherId}:${period}:${courseId || 'all'}`;
      const cached = await redisOperations.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Get performance data (placeholder implementation)
      // In a real implementation, this would fetch from reviews, ratings, and feedback data
      const averageRating = 4.5; // TODO: Calculate from actual reviews
      const totalReviews = 0; // TODO: Count actual reviews
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; // TODO: Calculate from reviews
      const ratingTrends = await this.getRatingTrends(teacherId, period, courseId);
      const studentSatisfactionScore = 85; // TODO: Calculate from feedback
      const courseCompletionRate = await this.getAverageCompletionRate(teacherId, courseId);
      const studentRetentionRate = await this.calculateRetentionRate(teacherId, courseId);

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

      const improvementSuggestions = await this.generateImprovementSuggestions(
        averageRating,
        courseCompletionRate,
        studentRetentionRate
      );

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
      await redisOperations.setex(cacheKey, this.CACHE_TTL.hourly * 2, JSON.stringify(result));

      return result;
    } catch (error) {
      Logger.error('❌ Failed to get detailed performance metrics:', error);

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
  }
  /**
   * Helper methods for new analytics features
   */
  private async calculateNewEnrollmentsInPeriod(
    teacherId: string,
    dateRange: DateRange,
    courseId?: string
  ): Promise<number> {
    try {
      const query: any = { creator: new Types.ObjectId(teacherId) };
      if (courseId) {
        query._id = new Types.ObjectId(courseId);
      }

      const courses = await Course.find(query);
      let totalNewEnrollments = 0;

      for (const course of courses) {
        const students = await Student.find({
          'enrolledCourses.courseId': course._id,
          'enrolledCourses.enrolledAt': {
            $gte: dateRange.startDate,
            $lte: dateRange.endDate
          }
        });
        totalNewEnrollments += students.length;
      }

      return totalNewEnrollments;
    } catch (error) {
      Logger.error('❌ Failed to calculate new enrollments in period:', error);
      return 0;
    }
  }

  private async getEnrollmentTrend(
    teacherId: string,
    period: string,
    courseId?: string
  ): Promise<{ date: string; count: number }[]> {
    try {
      // Generate date intervals based on period
      const intervals = this.generateDateIntervals(period);
      const trend: { date: string; count: number }[] = [];

      for (const interval of intervals) {
        const count = await this.calculateNewEnrollmentsInPeriod(teacherId, interval, courseId);
        trend.push({
          date: interval.startDate.toISOString().split('T')[0],
          count
        });
      }

      return trend;
    } catch (error) {
      Logger.error('❌ Failed to get enrollment trend:', error);
      return [];
    }
  }

  private async getPreviousPeriodEnrollments(
    teacherId: string,
    period: string,
    courseId?: string
  ): Promise<number> {
    try {
      const currentRange = this.getDateRange(period);
      const periodLength = currentRange.endDate.getTime() - currentRange.startDate.getTime();

      const previousRange = {
        startDate: new Date(currentRange.startDate.getTime() - periodLength),
        endDate: new Date(currentRange.endDate.getTime() - periodLength)
      };

      return await this.calculateNewEnrollmentsInPeriod(teacherId, previousRange, courseId);
    } catch (error) {
      Logger.error('❌ Failed to get previous period enrollments:', error);
      return 0;
    }
  }

  private async getCompletionRatesByCourse(
    teacherId: string,
    courseId?: string
  ): Promise<{ courseId: string; courseName: string; rate: number }[]> {
    try {
      const query: any = { creator: new Types.ObjectId(teacherId) };
      if (courseId) {
        query._id = new Types.ObjectId(courseId);
      }

      const courses = await Course.find(query).populate('lectures');
      const completionRates: { courseId: string; courseName: string; rate: number }[] = [];

      for (const course of courses) {
        const rate = await this.calculateCompletionRate(course._id);
        completionRates.push({
          courseId: course._id.toString(),
          courseName: course.title,
          rate
        });
      }

      return completionRates;
    } catch (error) {
      Logger.error('❌ Failed to get completion rates by course:', error);
      return [];
    }
  }

  private async getTimeSpentTrends(
    teacherId: string,
    period: string,
    courseId?: string
  ): Promise<{ date: string; minutes: number }[]> {
    try {
      const intervals = this.generateDateIntervals(period);
      const trends: { date: string; minutes: number }[] = [];

      for (const interval of intervals) {
        const query: any = {
          teacherId: new Types.ObjectId(teacherId),
          lastActivity: {
            $gte: interval.startDate,
            $lte: interval.endDate
          }
        };
        if (courseId) {
          query.courseId = new Types.ObjectId(courseId);
        }

        const engagementData = await StudentEngagement.find(query);
        const totalMinutes = engagementData.reduce((sum, data) => sum + data.totalTimeSpent, 0);
        const averageMinutes = engagementData.length > 0 ? totalMinutes / engagementData.length : 0;

        trends.push({
          date: interval.startDate.toISOString().split('T')[0],
          minutes: averageMinutes
        });
      }

      return trends;
    } catch (error) {
      Logger.error('❌ Failed to get time spent trends:', error);
      return [];
    }
  }

  private async getActivityPatterns(
    teacherId: string,
    courseId?: string
  ): Promise<{ hour: number; activity: number }[]> {
    try {
      const query: any = { teacherId: new Types.ObjectId(teacherId) };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      const engagementData = await StudentEngagement.find(query);
      const hourlyActivity: { [hour: number]: number } = {};

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
    } catch (error) {
      Logger.error('❌ Failed to get activity patterns:', error);
      return [];
    }
  }

  private async calculateRetentionRate(teacherId: string, courseId?: string): Promise<number> {
    try {
      const query: any = { teacherId: new Types.ObjectId(teacherId) };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      const totalStudents = await StudentEngagement.countDocuments(query);
      if (totalStudents === 0) return 0;

      const activeStudents = await StudentEngagement.countDocuments({
        ...query,
        lastActivity: { $gte: subDays(new Date(), 30) }
      });

      return (activeStudents / totalStudents) * 100;
    } catch (error) {
      Logger.error('❌ Failed to calculate retention rate:', error);
      return 0;
    }
  }

  private generateDateIntervals(period: string): DateRange[] {
    const now = new Date();
    const intervals: DateRange[] = [];

    switch (period) {
      case 'daily':
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
          const date = subDays(now, i);
          intervals.push({
            startDate: startOfDay(date),
            endDate: endOfDay(date)
          });
        }
        break;
      case 'weekly':
        // Last 4 weeks
        for (let i = 3; i >= 0; i--) {
          const date = subDays(now, i * 7);
          intervals.push({
            startDate: startOfWeek(date),
            endDate: endOfWeek(date)
          });
        }
        break;
      case 'monthly':
        // Last 6 months
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          intervals.push({
            startDate: startOfMonth(date),
            endDate: endOfMonth(date)
          });
        }
        break;
      case 'yearly':
        // Last 3 years
        for (let i = 2; i >= 0; i--) {
          const date = new Date(now.getFullYear() - i, 0, 1);
          intervals.push({
            startDate: startOfYear(date),
            endDate: endOfYear(date)
          });
        }
        break;
    }

    return intervals;
  }

  private async getPreviousPeriodRevenue(
    teacherId: string,
    period: string,
    courseId?: string
  ): Promise<number> {
    try {
      const currentRange = this.getDateRange(period);
      const periodLength = currentRange.endDate.getTime() - currentRange.startDate.getTime();

      const previousRange = {
        startDate: new Date(currentRange.startDate.getTime() - periodLength),
        endDate: new Date(currentRange.endDate.getTime() - periodLength)
      };

      const query: any = {
        teacherId: new Types.ObjectId(teacherId),
        status: 'completed',
        createdAt: {
          $gte: previousRange.startDate,
          $lte: previousRange.endDate
        }
      };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      const payments = await Payment.find(query);
      return payments.reduce((sum, payment) => sum + payment.teacherShare, 0);
    } catch (error) {
      Logger.error('❌ Failed to get previous period revenue:', error);
      return 0;
    }
  }

  private async getPaymentTrends(
    teacherId: string,
    period: string,
    courseId?: string
  ): Promise<{ date: string; amount: number; count: number }[]> {
    try {
      const intervals = this.generateDateIntervals(period);
      const trends: { date: string; amount: number; count: number }[] = [];

      for (const interval of intervals) {
        const query: any = {
          teacherId: new Types.ObjectId(teacherId),
          status: 'completed',
          createdAt: {
            $gte: interval.startDate,
            $lte: interval.endDate
          }
        };
        if (courseId) {
          query.courseId = new Types.ObjectId(courseId);
        }

        const payments = await Payment.find(query);
        const totalAmount = payments.reduce((sum, payment) => sum + payment.teacherShare, 0);

        trends.push({
          date: interval.startDate.toISOString().split('T')[0],
          amount: totalAmount,
          count: payments.length
        });
      }

      return trends;
    } catch (error) {
      Logger.error('❌ Failed to get payment trends:', error);
      return [];
    }
  }

  private async getTopEarningCourses(teacherId: string): Promise<{
    courseId: string;
    courseName: string;
    revenue: number;
    enrollments: number;
  }[]> {
    try {
      const revenueData = await Payment.aggregate([
        {
          $match: {
            teacherId: new Types.ObjectId(teacherId),
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

      return revenueData.map(item => ({
        courseId: item._id.toString(),
        courseName: item.course[0]?.title || 'Unknown Course',
        revenue: item.totalRevenue,
        enrollments: item.enrollmentCount
      }));
    } catch (error) {
      Logger.error('❌ Failed to get top earning courses:', error);
      return [];
    }
  }

  private async calculateConversionRate(teacherId: string, courseId?: string): Promise<number> {
    try {
      const query: any = { creator: new Types.ObjectId(teacherId) };
      if (courseId) {
        query._id = new Types.ObjectId(courseId);
      }

      const courses = await Course.find(query);
      let totalEnrollments = 0;
      let totalPaidEnrollments = 0;

      for (const course of courses) {
        totalEnrollments += course.totalEnrollment || 0;

        const paidEnrollments = await Payment.countDocuments({
          courseId: course._id,
          teacherId: new Types.ObjectId(teacherId),
          status: 'completed'
        });
        totalPaidEnrollments += paidEnrollments;
      }

      return totalEnrollments > 0 ? (totalPaidEnrollments / totalEnrollments) * 100 : 0;
    } catch (error) {
      Logger.error('❌ Failed to calculate conversion rate:', error);
      return 0;
    }
  }

  private async calculateRefundRate(teacherId: string, courseId?: string): Promise<number> {
    try {
      const query: any = { teacherId: new Types.ObjectId(teacherId) };
      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      const totalPayments = await Payment.countDocuments({ ...query, status: 'completed' });
      const refundedPayments = await Payment.countDocuments({ ...query, status: 'failed' }); // Assuming 'failed' represents refunds

      return totalPayments > 0 ? (refundedPayments / totalPayments) * 100 : 0;
    } catch (error) {
      Logger.error('❌ Failed to calculate refund rate:', error);
      return 0;
    }
  }

  private async getRatingTrends(
    teacherId: string,
    period: string,
    courseId?: string
  ): Promise<{ date: string; rating: number }[]> {
    try {
      // Use the parameters to build query (even if placeholder implementation)
      const dateRange = this.getDateRange(period);
      const query: any = {
        teacherId: new Types.ObjectId(teacherId),
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      };

      if (courseId) {
        query.courseId = new Types.ObjectId(courseId);
      }

      // TODO: Implement actual rating trends from reviews data
      // This is a placeholder implementation
      const intervals = this.generateDateIntervals(period);
      return intervals.map(interval => ({
        date: interval.startDate.toISOString().split('T')[0],
        rating: 4.5 // Placeholder
      }));
    } catch (error) {
      Logger.error('❌ Failed to get rating trends:', error);
      return [];
    }
  }

  private async getAverageCompletionRate(teacherId: string, courseId?: string): Promise<number> {
    try {
      const query: any = { creator: new Types.ObjectId(teacherId) };
      if (courseId) {
        query._id = new Types.ObjectId(courseId);
      }

      const courses = await Course.find(query);
      if (courses.length === 0) return 0;

      let totalCompletionRate = 0;
      for (const course of courses) {
        const rate = await this.calculateCompletionRate(course._id);
        totalCompletionRate += rate;
      }

      return totalCompletionRate / courses.length;
    } catch (error) {
      Logger.error('❌ Failed to get average completion rate:', error);
      return 0;
    }
  }

  private async generateImprovementSuggestions(
    averageRating: number,
    completionRate: number,
    retentionRate: number
  ): Promise<string[]> {
    const suggestions: string[] = [];

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
  }

  private async generateInsights(
    courseAnalytics: ICourseAnalytics[],
    revenueAnalytics: IRevenueAnalytics | null,
    performanceMetrics: IPerformanceMetrics | null
  ): Promise<{ topInsight: string; recommendations: string[]; alerts: string[] }> {
    const recommendations: string[] = [];
    const alerts: string[] = [];
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
  }
}

export default AnalyticsService;
