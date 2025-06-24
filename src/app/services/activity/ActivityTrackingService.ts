import { Types } from 'mongoose';
import { Activity } from '../../modules/Analytics/analytics.model';
import { IActivity, ActivityType, ActivityPriority } from '../../modules/Analytics/analytics.interface';
import { Logger } from '../../config/logger';
import WebSocketService from '../websocket/WebSocketService';
import { redisOperations } from '../../config/redis';

interface ActivityData {
  teacherId: string;
  courseId?: string;
  studentId?: string;
  type: ActivityType;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  priority?: ActivityPriority;
  actionRequired?: boolean;
  actionUrl?: string;
  relatedEntity: {
    entityType: 'course' | 'student' | 'payment' | 'review';
    entityId: string;
  };
}

class ActivityTrackingService {
  private webSocketService: WebSocketService | null = null;

  constructor(webSocketService?: WebSocketService) {
    this.webSocketService = webSocketService || null;
  }

  public setWebSocketService(webSocketService: WebSocketService): void {
    this.webSocketService = webSocketService;
  }

  /**
   * Track a new activity and broadcast it in real-time
   */
  public async trackActivity(activityData: ActivityData): Promise<IActivity> {
    try {
      // Create activity record
      const activity = new Activity({
        teacherId: new Types.ObjectId(activityData.teacherId),
        courseId: activityData.courseId ? new Types.ObjectId(activityData.courseId) : undefined,
        studentId: activityData.studentId ? new Types.ObjectId(activityData.studentId) : undefined,
        type: activityData.type,
        priority: activityData.priority || ActivityPriority.MEDIUM,
        title: activityData.title,
        description: activityData.description,
        metadata: activityData.metadata || {},
        isRead: false,
        actionRequired: activityData.actionRequired || false,
        actionUrl: activityData.actionUrl,
        relatedEntity: {
          entityType: activityData.relatedEntity.entityType,
          entityId: new Types.ObjectId(activityData.relatedEntity.entityId),
        },
      });

      const savedActivity = await activity.save();

      // Cache recent activities for quick access
      await this.cacheRecentActivity(activityData.teacherId, savedActivity);

      // Broadcast real-time update
      if (this.webSocketService) {
        this.webSocketService.broadcastActivityUpdate(activityData.teacherId, {
          id: savedActivity._id,
          type: savedActivity.type,
          priority: savedActivity.priority,
          title: savedActivity.title,
          description: savedActivity.description,
          metadata: savedActivity.metadata,
          actionRequired: savedActivity.actionRequired,
          actionUrl: savedActivity.actionUrl,
          createdAt: savedActivity.createdAt,
        });
      }

      Logger.info(`📊 Activity tracked: ${activityData.type} for teacher ${activityData.teacherId}`);
      return savedActivity;
    } catch (error) {
      Logger.error('❌ Failed to track activity:', error);
      throw error;
    }
  }

  /**
   * Track enrollment activity
   */
  public async trackEnrollment(teacherId: string, courseId: string, studentId: string, metadata?: Record<string, any>): Promise<IActivity> {
    return await this.trackActivity({
      teacherId,
      courseId,
      studentId,
      type: ActivityType.ENROLLMENT,
      title: 'New Student Enrollment',
      description: 'A new student has enrolled in your course',
      metadata: {
        enrollmentDate: new Date(),
        ...metadata,
      },
      priority: ActivityPriority.MEDIUM,
      actionRequired: false,
      relatedEntity: {
        entityType: 'student',
        entityId: studentId,
      },
    });
  }

  /**
   * Track course completion activity
   */
  public async trackCompletion(teacherId: string, courseId: string, studentId: string, metadata?: Record<string, any>): Promise<IActivity> {
    return await this.trackActivity({
      teacherId,
      courseId,
      studentId,
      type: ActivityType.COMPLETION,
      title: 'Course Completed',
      description: 'A student has completed your course',
      metadata: {
        completionDate: new Date(),
        completionRate: metadata?.completionRate || 100,
        ...metadata,
      },
      priority: ActivityPriority.HIGH,
      actionRequired: false,
      relatedEntity: {
        entityType: 'student',
        entityId: studentId,
      },
    });
  }

  /**
   * Track payment activity
   */
  public async trackPayment(teacherId: string, courseId: string, studentId: string, amount: number, metadata?: Record<string, any>): Promise<IActivity> {
    return await this.trackActivity({
      teacherId,
      courseId,
      studentId,
      type: ActivityType.PAYMENT,
      title: 'Payment Received',
      description: `Payment of $${amount} received for course enrollment`,
      metadata: {
        amount,
        paymentDate: new Date(),
        ...metadata,
      },
      priority: ActivityPriority.HIGH,
      actionRequired: false,
      relatedEntity: {
        entityType: 'payment',
        entityId: metadata?.paymentId || courseId,
      },
    });
  }

  /**
   * Track review activity
   */
  public async trackReview(teacherId: string, courseId: string, studentId: string, rating: number, metadata?: Record<string, any>): Promise<IActivity> {
    const priority = rating >= 4 ? ActivityPriority.MEDIUM : ActivityPriority.HIGH;
    const actionRequired = rating < 3;

    return await this.trackActivity({
      teacherId,
      courseId,
      studentId,
      type: ActivityType.REVIEW,
      title: `New ${rating}-Star Review`,
      description: `A student left a ${rating}-star review for your course`,
      metadata: {
        rating,
        reviewDate: new Date(),
        ...metadata,
      },
      priority,
      actionRequired,
      relatedEntity: {
        entityType: 'review',
        entityId: metadata?.reviewId || courseId,
      },
    });
  }

  /**
   * Track question activity
   */
  public async trackQuestion(teacherId: string, courseId: string, studentId: string, questionTitle: string, metadata?: Record<string, any>): Promise<IActivity> {
    return await this.trackActivity({
      teacherId,
      courseId,
      studentId,
      type: ActivityType.QUESTION,
      title: 'New Student Question',
      description: `Student asked: "${questionTitle}"`,
      metadata: {
        questionTitle,
        questionDate: new Date(),
        ...metadata,
      },
      priority: ActivityPriority.HIGH,
      actionRequired: true,
      actionUrl: `/teacher/courses/${courseId}/questions/${metadata?.questionId}`,
      relatedEntity: {
        entityType: 'course',
        entityId: courseId,
      },
    });
  }

  /**
   * Track course update activity
   */
  public async trackCourseUpdate(teacherId: string, courseId: string, updateType: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackActivity({
      teacherId,
      courseId,
      type: ActivityType.COURSE_UPDATE,
      title: 'Course Updated',
      description: `Course ${updateType} has been updated`,
      metadata: {
        updateType,
        updateDate: new Date(),
        ...metadata,
      },
      priority: ActivityPriority.LOW,
      actionRequired: false,
      relatedEntity: {
        entityType: 'course',
        entityId: courseId,
      },
    });
  }

  /**
   * Track certificate generation activity
   */
  public async trackCertificate(teacherId: string, courseId: string, studentId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackActivity({
      teacherId,
      courseId,
      studentId,
      type: ActivityType.CERTIFICATE,
      title: 'Certificate Generated',
      description: 'A completion certificate has been generated for a student',
      metadata: {
        certificateDate: new Date(),
        ...metadata,
      },
      priority: ActivityPriority.MEDIUM,
      actionRequired: false,
      relatedEntity: {
        entityType: 'student',
        entityId: studentId,
      },
    });
  }

  /**
   * Track refund activity
   */
  public async trackRefund(teacherId: string, courseId: string, studentId: string, amount: number, metadata?: Record<string, any>): Promise<IActivity> {
    return await this.trackActivity({
      teacherId,
      courseId,
      studentId,
      type: ActivityType.REFUND,
      title: 'Refund Processed',
      description: `Refund of $${amount} has been processed`,
      metadata: {
        amount,
        refundDate: new Date(),
        reason: metadata?.reason || 'Not specified',
        ...metadata,
      },
      priority: ActivityPriority.HIGH,
      actionRequired: true,
      relatedEntity: {
        entityType: 'payment',
        entityId: metadata?.paymentId || courseId,
      },
    });
  }

  /**
   * Track message activity
   */
  public async trackMessage(teacherId: string, courseId: string, studentId: string, metadata?: Record<string, any>): Promise<IActivity> {
    return await this.trackActivity({
      teacherId,
      courseId,
      studentId,
      type: ActivityType.MESSAGE,
      title: 'New Message',
      description: 'You have received a new message from a student',
      metadata: {
        messageDate: new Date(),
        ...metadata,
      },
      priority: ActivityPriority.MEDIUM,
      actionRequired: true,
      actionUrl: `/teacher/messages/${metadata?.conversationId}`,
      relatedEntity: {
        entityType: 'student',
        entityId: studentId,
      },
    });
  }

  /**
   * Mark activity as read
   */
  public async markActivityAsRead(activityId: string, teacherId: string): Promise<void> {
    try {
      await Activity.findOneAndUpdate(
        { _id: activityId, teacherId: new Types.ObjectId(teacherId) },
        { isRead: true },
        { new: true }
      );

      // Update cache
      await this.updateActivityCache(teacherId, activityId, { isRead: true });

      // Broadcast real-time update
      if (this.webSocketService) {
        this.webSocketService.broadcastActivityRead(teacherId, { activityId, isRead: true });
      }

      Logger.info(`📖 Activity marked as read: ${activityId}`);
    } catch (error) {
      Logger.error('❌ Failed to mark activity as read:', error);
      throw error;
    }
  }

  /**
   * Get recent activities for a teacher with advanced filtering
   */
  public async getRecentActivities(teacherId: string, limit: number = 20, offset: number = 0): Promise<IActivity[]> {
    try {
      // Try to get from cache first
      const cacheKey = `activities:teacher:${teacherId}:${limit}:${offset}`;
      const cached = await redisOperations.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch from database
      const activities = await Activity.find({ teacherId: new Types.ObjectId(teacherId) })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .populate('courseId', 'title')
        .populate('studentId', 'name email')
        .lean();

      // Cache for 5 minutes
      await redisOperations.setex(cacheKey, 300, JSON.stringify(activities));

      return activities as IActivity[];
    } catch (error) {
      Logger.error('❌ Failed to get recent activities:', error);
      throw error;
    }
  }

  /**
   * Get activities with advanced filtering and pagination
   */
  public async getActivitiesWithFilters(
    teacherId: string,
    filters: {
      type?: ActivityType;
      priority?: ActivityPriority;
      isRead?: boolean;
      courseId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      actionRequired?: boolean;
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'priority' | 'type';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{
    activities: IActivity[];
    total: number;
    unreadCount: number;
    priorityBreakdown: { [key in ActivityPriority]: number };
    typeBreakdown: { [key in ActivityType]: number };
  }> {
    try {
      const {
        type,
        priority,
        isRead,
        courseId,
        dateFrom,
        dateTo,
        actionRequired,
        limit = 20,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      // Build query
      const query: any = { teacherId: new Types.ObjectId(teacherId) };

      if (type) query.type = type;
      if (priority) query.priority = priority;
      if (isRead !== undefined) query.isRead = isRead;
      if (courseId) query.courseId = new Types.ObjectId(courseId);
      if (actionRequired !== undefined) query.actionRequired = actionRequired;

      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = dateFrom;
        if (dateTo) query.createdAt.$lte = dateTo;
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries in parallel
      const [activities, total, unreadCount, priorityStats, typeStats] = await Promise.all([
        Activity.find(query)
          .sort(sort)
          .limit(limit)
          .skip(offset)
          .populate('courseId', 'title')
          .populate('studentId', 'name email')
          .lean(),
        Activity.countDocuments(query),
        Activity.countDocuments({ ...query, isRead: false }),
        this.getPriorityBreakdown(teacherId, { type, courseId, dateFrom, dateTo }),
        this.getTypeBreakdown(teacherId, { priority, courseId, dateFrom, dateTo })
      ]);

      return {
        activities: activities as IActivity[],
        total,
        unreadCount,
        priorityBreakdown: priorityStats,
        typeBreakdown: typeStats
      };
    } catch (error) {
      Logger.error('❌ Failed to get activities with filters:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics for dashboard
   */
  public async getActivityStatistics(
    teacherId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ): Promise<{
    totalActivities: number;
    unreadActivities: number;
    actionRequiredActivities: number;
    activityTrends: { date: string; count: number; unreadCount: number }[];
    topActivityTypes: { type: ActivityType; count: number }[];
    averageResponseTime: number; // in hours
  }> {
    try {
      const cacheKey = `activity_stats:${teacherId}:${period}`;
      const cached = await redisOperations.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const dateRange = this.getDateRangeForPeriod(period);
      const query = {
        teacherId: new Types.ObjectId(teacherId),
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      };

      // Get basic counts
      const [totalActivities, unreadActivities, actionRequiredActivities] = await Promise.all([
        Activity.countDocuments(query),
        Activity.countDocuments({ ...query, isRead: false }),
        Activity.countDocuments({ ...query, actionRequired: true, isRead: false })
      ]);

      // Get activity trends
      const activityTrends = await this.getActivityTrends(teacherId, period);

      // Get top activity types
      const topActivityTypes = await this.getTopActivityTypes(teacherId, dateRange);

      // Calculate average response time
      const averageResponseTime = await this.calculateAverageResponseTime(teacherId, dateRange);

      const result = {
        totalActivities,
        unreadActivities,
        actionRequiredActivities,
        activityTrends,
        topActivityTypes,
        averageResponseTime
      };

      // Cache for 30 minutes
      await redisOperations.setex(cacheKey, 1800, JSON.stringify(result));

      return result;
    } catch (error) {
      Logger.error('❌ Failed to get activity statistics:', error);
      throw error;
    }
  }

  /**
   * Bulk mark activities as read
   */
  public async bulkMarkActivitiesAsRead(activityIds: string[], teacherId: string): Promise<void> {
    try {
      await Activity.updateMany(
        {
          _id: { $in: activityIds.map(id => new Types.ObjectId(id)) },
          teacherId: new Types.ObjectId(teacherId)
        },
        { isRead: true }
      );

      // Invalidate cache
      await this.invalidateActivityCache(teacherId);

      // Broadcast real-time update
      if (this.webSocketService) {
        this.webSocketService.broadcastBulkActivityRead(teacherId, activityIds);
      }

      Logger.info(`📖 Bulk marked ${activityIds.length} activities as read for teacher: ${teacherId}`);
    } catch (error) {
      Logger.error('❌ Failed to bulk mark activities as read:', error);
      throw error;
    }
  }

  /**
   * Cache recent activity for quick access
   */
  private async cacheRecentActivity(teacherId: string, activity: IActivity): Promise<void> {
    try {
      const cacheKey = `activities:teacher:${teacherId}:recent`;
      const activities = await redisOperations.get(cacheKey);
      
      let activityList: any[] = activities ? JSON.parse(activities) : [];
      
      // Add new activity to the beginning
      activityList.unshift(activity);
      
      // Keep only the most recent 50 activities
      activityList = activityList.slice(0, 50);
      
      // Cache for 1 hour
      await redisOperations.setex(cacheKey, 3600, JSON.stringify(activityList));
    } catch (error) {
      Logger.error('❌ Failed to cache recent activity:', error);
    }
  }

  /**
   * Update activity in cache
   */
  private async updateActivityCache(teacherId: string, activityId: string, updates: Partial<IActivity>): Promise<void> {
    try {
      const cacheKey = `activities:teacher:${teacherId}:recent`;
      const activities = await redisOperations.get(cacheKey);

      if (activities) {
        const activityList = JSON.parse(activities);
        const index = activityList.findIndex((a: any) => a._id.toString() === activityId);

        if (index !== -1) {
          activityList[index] = { ...activityList[index], ...updates };
          await redisOperations.setex(cacheKey, 3600, JSON.stringify(activityList));
        }
      }
    } catch (error) {
      Logger.error('❌ Failed to update activity cache:', error);
    }
  }

  /**
   * Helper methods for enhanced activity tracking
   */
  private async getPriorityBreakdown(
    teacherId: string,
    filters: { type?: ActivityType; courseId?: string; dateFrom?: Date; dateTo?: Date }
  ): Promise<{ [key in ActivityPriority]: number }> {
    try {
      const query: any = { teacherId: new Types.ObjectId(teacherId) };

      if (filters.type) query.type = filters.type;
      if (filters.courseId) query.courseId = new Types.ObjectId(filters.courseId);
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom;
        if (filters.dateTo) query.createdAt.$lte = filters.dateTo;
      }

      const breakdown = await Activity.aggregate([
        { $match: query },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]);

      const result: { [key in ActivityPriority]: number } = {
        [ActivityPriority.LOW]: 0,
        [ActivityPriority.MEDIUM]: 0,
        [ActivityPriority.HIGH]: 0,
        [ActivityPriority.URGENT]: 0
      };

      breakdown.forEach(item => {
        result[item._id as ActivityPriority] = item.count;
      });

      return result;
    } catch (error) {
      Logger.error('❌ Failed to get priority breakdown:', error);
      return {
        [ActivityPriority.LOW]: 0,
        [ActivityPriority.MEDIUM]: 0,
        [ActivityPriority.HIGH]: 0,
        [ActivityPriority.URGENT]: 0
      };
    }
  }

  private async getTypeBreakdown(
    teacherId: string,
    filters: { priority?: ActivityPriority; courseId?: string; dateFrom?: Date; dateTo?: Date }
  ): Promise<{ [key in ActivityType]: number }> {
    try {
      const query: any = { teacherId: new Types.ObjectId(teacherId) };

      if (filters.priority) query.priority = filters.priority;
      if (filters.courseId) query.courseId = new Types.ObjectId(filters.courseId);
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom;
        if (filters.dateTo) query.createdAt.$lte = filters.dateTo;
      }

      const breakdown = await Activity.aggregate([
        { $match: query },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);

      const result: { [key in ActivityType]: number } = {
        [ActivityType.ENROLLMENT]: 0,
        [ActivityType.COMPLETION]: 0,
        [ActivityType.PAYMENT]: 0,
        [ActivityType.REVIEW]: 0,
        [ActivityType.QUESTION]: 0,
        [ActivityType.COURSE_UPDATE]: 0,
        [ActivityType.CERTIFICATE]: 0,
        [ActivityType.REFUND]: 0,
        [ActivityType.MESSAGE]: 0
      };

      breakdown.forEach(item => {
        result[item._id as ActivityType] = item.count;
      });

      return result;
    } catch (error) {
      Logger.error('❌ Failed to get type breakdown:', error);
      return {
        [ActivityType.ENROLLMENT]: 0,
        [ActivityType.COMPLETION]: 0,
        [ActivityType.PAYMENT]: 0,
        [ActivityType.REVIEW]: 0,
        [ActivityType.QUESTION]: 0,
        [ActivityType.COURSE_UPDATE]: 0,
        [ActivityType.CERTIFICATE]: 0,
        [ActivityType.REFUND]: 0,
        [ActivityType.MESSAGE]: 0
      };
    }
  }

  private getDateRangeForPeriod(period: 'daily' | 'weekly' | 'monthly'): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate: now };
  }

  private async getActivityTrends(
    teacherId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<{ date: string; count: number; unreadCount: number }[]> {
    try {
      const dateRange = this.getDateRangeForPeriod(period);
      const intervals = this.generateDateIntervals(period, dateRange);

      const trends: { date: string; count: number; unreadCount: number }[] = [];

      for (const interval of intervals) {
        const query = {
          teacherId: new Types.ObjectId(teacherId),
          createdAt: { $gte: interval.start, $lte: interval.end }
        };

        const [count, unreadCount] = await Promise.all([
          Activity.countDocuments(query),
          Activity.countDocuments({ ...query, isRead: false })
        ]);

        trends.push({
          date: interval.start.toISOString().split('T')[0],
          count,
          unreadCount
        });
      }

      return trends;
    } catch (error) {
      Logger.error('❌ Failed to get activity trends:', error);
      return [];
    }
  }

  private async getTopActivityTypes(
    teacherId: string,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<{ type: ActivityType; count: number }[]> {
    try {
      const topTypes = await Activity.aggregate([
        {
          $match: {
            teacherId: new Types.ObjectId(teacherId),
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
          }
        },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      return topTypes.map(item => ({
        type: item._id as ActivityType,
        count: item.count
      }));
    } catch (error) {
      Logger.error('❌ Failed to get top activity types:', error);
      return [];
    }
  }

  private async calculateAverageResponseTime(
    teacherId: string,
    dateRange: { startDate: Date; endDate: Date }
  ): Promise<number> {
    try {
      // Calculate average time between activity creation and being marked as read
      const activities = await Activity.find({
        teacherId: new Types.ObjectId(teacherId),
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        isRead: true,
        updatedAt: { $exists: true }
      }).select('createdAt updatedAt');

      if (activities.length === 0) return 0;

      const totalResponseTime = activities.reduce((sum, activity) => {
        const responseTime = activity.updatedAt!.getTime() - activity.createdAt!.getTime();
        return sum + responseTime;
      }, 0);

      // Return average response time in hours
      return totalResponseTime / activities.length / (1000 * 60 * 60);
    } catch (error) {
      Logger.error('❌ Failed to calculate average response time:', error);
      return 0;
    }
  }

  private generateDateIntervals(
    period: 'daily' | 'weekly' | 'monthly',
    dateRange: { startDate: Date; endDate: Date }
  ): { start: Date; end: Date }[] {
    const intervals: { start: Date; end: Date }[] = [];
    const { startDate, endDate } = dateRange;

    let intervalSize: number;
    switch (period) {
      case 'daily':
        intervalSize = 24 * 60 * 60 * 1000; // 1 day in milliseconds
        break;
      case 'weekly':
        intervalSize = 24 * 60 * 60 * 1000; // 1 day intervals for weekly view
        break;
      case 'monthly':
        intervalSize = 7 * 24 * 60 * 60 * 1000; // 1 week intervals for monthly view
        break;
      default:
        intervalSize = 24 * 60 * 60 * 1000;
    }

    let currentStart = new Date(startDate);
    while (currentStart < endDate) {
      const currentEnd = new Date(Math.min(currentStart.getTime() + intervalSize, endDate.getTime()));
      intervals.push({ start: new Date(currentStart), end: currentEnd });
      currentStart = new Date(currentEnd);
    }

    return intervals;
  }

  private async invalidateActivityCache(teacherId: string): Promise<void> {
    try {
      // Invalidate all activity-related cache entries for this teacher
      const patterns = [
        `activities:teacher:${teacherId}:*`,
        `activity_stats:${teacherId}:*`
      ];

      for (const pattern of patterns) {
        await redisOperations.del(pattern);
      }

      Logger.info(`🗑️ Activity cache invalidated for teacher: ${teacherId}`);
    } catch (error) {
      Logger.error('❌ Failed to invalidate activity cache:', error);
    }
  }
}

export default ActivityTrackingService;
