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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const analytics_model_1 = require("../../modules/Analytics/analytics.model");
const analytics_interface_1 = require("../../modules/Analytics/analytics.interface");
const logger_1 = require("../../config/logger");
// WebSocket removed - will be replaced with SSE/Polling system
const redis_1 = require("../../config/redis");
class ActivityTrackingService {
    // WebSocket service removed - real-time updates will be handled by SSE/Polling
    constructor() {
        // Constructor simplified - no WebSocket dependency
    }
    // WebSocket service setter removed - real-time updates handled by SSE/Polling
    /**
     * Track a new activity and broadcast it in real-time
     */
    trackActivity(activityData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create activity record
                const activity = new analytics_model_1.Activity({
                    teacherId: new mongoose_1.Types.ObjectId(activityData.teacherId),
                    courseId: activityData.courseId ? new mongoose_1.Types.ObjectId(activityData.courseId) : undefined,
                    studentId: activityData.studentId ? new mongoose_1.Types.ObjectId(activityData.studentId) : undefined,
                    type: activityData.type,
                    priority: activityData.priority || analytics_interface_1.ActivityPriority.MEDIUM,
                    title: activityData.title,
                    description: activityData.description,
                    metadata: activityData.metadata || {},
                    isRead: false,
                    actionRequired: activityData.actionRequired || false,
                    actionUrl: activityData.actionUrl,
                    relatedEntity: {
                        entityType: activityData.relatedEntity.entityType,
                        entityId: new mongoose_1.Types.ObjectId(activityData.relatedEntity.entityId),
                    },
                });
                const savedActivity = yield activity.save();
                // Cache recent activities for quick access
                yield this.cacheRecentActivity(activityData.teacherId, savedActivity);
                // Real-time update broadcasting removed - will be handled by SSE/Polling system
                // TODO: Implement SSE broadcasting for activity updates
                logger_1.Logger.info(`📊 Activity tracked: ${activityData.type} for teacher ${activityData.teacherId}`);
                return savedActivity;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to track activity:', error);
                throw error;
            }
        });
    }
    /**
     * Track enrollment activity
     */
    trackEnrollment(teacherId, courseId, studentId, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.trackActivity({
                teacherId,
                courseId,
                studentId,
                type: analytics_interface_1.ActivityType.ENROLLMENT,
                title: 'New Student Enrollment',
                description: 'A new student has enrolled in your course',
                metadata: Object.assign({ enrollmentDate: new Date() }, metadata),
                priority: analytics_interface_1.ActivityPriority.MEDIUM,
                actionRequired: false,
                relatedEntity: {
                    entityType: 'student',
                    entityId: studentId,
                },
            });
        });
    }
    /**
     * Track course completion activity
     */
    trackCompletion(teacherId, courseId, studentId, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.trackActivity({
                teacherId,
                courseId,
                studentId,
                type: analytics_interface_1.ActivityType.COMPLETION,
                title: 'Course Completed',
                description: 'A student has completed your course',
                metadata: Object.assign({ completionDate: new Date(), completionRate: (metadata === null || metadata === void 0 ? void 0 : metadata.completionRate) || 100 }, metadata),
                priority: analytics_interface_1.ActivityPriority.HIGH,
                actionRequired: false,
                relatedEntity: {
                    entityType: 'student',
                    entityId: studentId,
                },
            });
        });
    }
    /**
     * Track payment activity
     */
    trackPayment(teacherId, courseId, studentId, amount, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.trackActivity({
                teacherId,
                courseId,
                studentId,
                type: analytics_interface_1.ActivityType.PAYMENT,
                title: 'Payment Received',
                description: `Payment of $${amount} received for course enrollment`,
                metadata: Object.assign({ amount, paymentDate: new Date() }, metadata),
                priority: analytics_interface_1.ActivityPriority.HIGH,
                actionRequired: false,
                relatedEntity: {
                    entityType: 'payment',
                    entityId: (metadata === null || metadata === void 0 ? void 0 : metadata.paymentId) || courseId,
                },
            });
        });
    }
    /**
     * Track review activity
     */
    trackReview(teacherId, courseId, studentId, rating, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const priority = rating >= 4 ? analytics_interface_1.ActivityPriority.MEDIUM : analytics_interface_1.ActivityPriority.HIGH;
            const actionRequired = rating < 3;
            return yield this.trackActivity({
                teacherId,
                courseId,
                studentId,
                type: analytics_interface_1.ActivityType.REVIEW,
                title: `New ${rating}-Star Review`,
                description: `A student left a ${rating}-star review for your course`,
                metadata: Object.assign({ rating, reviewDate: new Date() }, metadata),
                priority,
                actionRequired,
                relatedEntity: {
                    entityType: 'review',
                    entityId: (metadata === null || metadata === void 0 ? void 0 : metadata.reviewId) || courseId,
                },
            });
        });
    }
    /**
     * Track question activity
     */
    trackQuestion(teacherId, courseId, studentId, questionTitle, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.trackActivity({
                teacherId,
                courseId,
                studentId,
                type: analytics_interface_1.ActivityType.QUESTION,
                title: 'New Student Question',
                description: `Student asked: "${questionTitle}"`,
                metadata: Object.assign({ questionTitle, questionDate: new Date() }, metadata),
                priority: analytics_interface_1.ActivityPriority.HIGH,
                actionRequired: true,
                actionUrl: `/teacher/courses/${courseId}/questions/${metadata === null || metadata === void 0 ? void 0 : metadata.questionId}`,
                relatedEntity: {
                    entityType: 'course',
                    entityId: courseId,
                },
            });
        });
    }
    /**
     * Track course update activity
     */
    trackCourseUpdate(teacherId, courseId, updateType, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.trackActivity({
                teacherId,
                courseId,
                type: analytics_interface_1.ActivityType.COURSE_UPDATE,
                title: 'Course Updated',
                description: `Course ${updateType} has been updated`,
                metadata: Object.assign({ updateType, updateDate: new Date() }, metadata),
                priority: analytics_interface_1.ActivityPriority.LOW,
                actionRequired: false,
                relatedEntity: {
                    entityType: 'course',
                    entityId: courseId,
                },
            });
        });
    }
    /**
     * Track certificate generation activity
     */
    trackCertificate(teacherId, courseId, studentId, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.trackActivity({
                teacherId,
                courseId,
                studentId,
                type: analytics_interface_1.ActivityType.CERTIFICATE,
                title: 'Certificate Generated',
                description: 'A completion certificate has been generated for a student',
                metadata: Object.assign({ certificateDate: new Date() }, metadata),
                priority: analytics_interface_1.ActivityPriority.MEDIUM,
                actionRequired: false,
                relatedEntity: {
                    entityType: 'student',
                    entityId: studentId,
                },
            });
        });
    }
    /**
     * Track refund activity
     */
    trackRefund(teacherId, courseId, studentId, amount, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.trackActivity({
                teacherId,
                courseId,
                studentId,
                type: analytics_interface_1.ActivityType.REFUND,
                title: 'Refund Processed',
                description: `Refund of $${amount} has been processed`,
                metadata: Object.assign({ amount, refundDate: new Date(), reason: (metadata === null || metadata === void 0 ? void 0 : metadata.reason) || 'Not specified' }, metadata),
                priority: analytics_interface_1.ActivityPriority.HIGH,
                actionRequired: true,
                relatedEntity: {
                    entityType: 'payment',
                    entityId: (metadata === null || metadata === void 0 ? void 0 : metadata.paymentId) || courseId,
                },
            });
        });
    }
    /**
     * Track message activity
     */
    trackMessage(teacherId, courseId, studentId, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.trackActivity({
                teacherId,
                courseId,
                studentId,
                type: analytics_interface_1.ActivityType.MESSAGE,
                title: 'New Message',
                description: 'You have received a new message from a student',
                metadata: Object.assign({ messageDate: new Date() }, metadata),
                priority: analytics_interface_1.ActivityPriority.MEDIUM,
                actionRequired: true,
                actionUrl: `/teacher/messages/${metadata === null || metadata === void 0 ? void 0 : metadata.conversationId}`,
                relatedEntity: {
                    entityType: 'student',
                    entityId: studentId,
                },
            });
        });
    }
    /**
     * Mark activity as read
     */
    markActivityAsRead(activityId, teacherId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield analytics_model_1.Activity.findOneAndUpdate({ _id: activityId, teacherId: new mongoose_1.Types.ObjectId(teacherId) }, { isRead: true }, { new: true });
                // Update cache
                yield this.updateActivityCache(teacherId, activityId, { isRead: true });
                // Real-time update broadcasting removed - will be handled by SSE/Polling system
                // TODO: Implement SSE broadcasting for activity read status
                logger_1.Logger.info(`📖 Activity marked as read: ${activityId}`);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to mark activity as read:', error);
                throw error;
            }
        });
    }
    /**
     * Get recent activities for a teacher with advanced filtering
     */
    getRecentActivities(teacherId_1) {
        return __awaiter(this, arguments, void 0, function* (teacherId, limit = 20, offset = 0) {
            try {
                // Try to get from cache first
                const cacheKey = `activities:teacher:${teacherId}:${limit}:${offset}`;
                const cached = yield redis_1.redisOperations.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
                // Fetch from database
                const activities = yield analytics_model_1.Activity.find({ teacherId: new mongoose_1.Types.ObjectId(teacherId) })
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .skip(offset)
                    .populate('courseId', 'title')
                    .populate('studentId', 'name email')
                    .lean();
                // Cache for 5 minutes
                yield redis_1.redisOperations.setex(cacheKey, 300, JSON.stringify(activities));
                return activities;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get recent activities:', error);
                throw error;
            }
        });
    }
    /**
     * Get activities with advanced filtering and pagination
     */
    getActivitiesWithFilters(teacherId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { type, priority, isRead, courseId, dateFrom, dateTo, actionRequired, limit = 20, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
                // Build query
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId) };
                if (type)
                    query.type = type;
                if (priority)
                    query.priority = priority;
                if (isRead !== undefined)
                    query.isRead = isRead;
                if (courseId)
                    query.courseId = new mongoose_1.Types.ObjectId(courseId);
                if (actionRequired !== undefined)
                    query.actionRequired = actionRequired;
                if (dateFrom || dateTo) {
                    query.createdAt = {};
                    if (dateFrom)
                        query.createdAt.$gte = dateFrom;
                    if (dateTo)
                        query.createdAt.$lte = dateTo;
                }
                // Build sort object
                const sort = {};
                sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
                // Execute queries in parallel
                const [activities, total, unreadCount, priorityStats, typeStats] = yield Promise.all([
                    analytics_model_1.Activity.find(query)
                        .sort(sort)
                        .limit(limit)
                        .skip(offset)
                        .populate('courseId', 'title')
                        .populate('studentId', 'name email')
                        .lean(),
                    analytics_model_1.Activity.countDocuments(query),
                    analytics_model_1.Activity.countDocuments(Object.assign(Object.assign({}, query), { isRead: false })),
                    this.getPriorityBreakdown(teacherId, { type, courseId, dateFrom, dateTo }),
                    this.getTypeBreakdown(teacherId, { priority, courseId, dateFrom, dateTo })
                ]);
                return {
                    activities: activities,
                    total,
                    unreadCount,
                    priorityBreakdown: priorityStats,
                    typeBreakdown: typeStats
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get activities with filters:', error);
                throw error;
            }
        });
    }
    /**
     * Get activity statistics for dashboard
     */
    getActivityStatistics(teacherId_1) {
        return __awaiter(this, arguments, void 0, function* (teacherId, period = 'weekly') {
            try {
                const cacheKey = `activity_stats:${teacherId}:${period}`;
                const cached = yield redis_1.redisOperations.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
                const dateRange = this.getDateRangeForPeriod(period);
                const query = {
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
                };
                // Get basic counts
                const [totalActivities, unreadActivities, actionRequiredActivities] = yield Promise.all([
                    analytics_model_1.Activity.countDocuments(query),
                    analytics_model_1.Activity.countDocuments(Object.assign(Object.assign({}, query), { isRead: false })),
                    analytics_model_1.Activity.countDocuments(Object.assign(Object.assign({}, query), { actionRequired: true, isRead: false }))
                ]);
                // Get activity trends
                const activityTrends = yield this.getActivityTrends(teacherId, period);
                // Get top activity types
                const topActivityTypes = yield this.getTopActivityTypes(teacherId, dateRange);
                // Calculate average response time
                const averageResponseTime = yield this.calculateAverageResponseTime(teacherId, dateRange);
                const result = {
                    totalActivities,
                    unreadActivities,
                    actionRequiredActivities,
                    activityTrends,
                    topActivityTypes,
                    averageResponseTime
                };
                // Cache for 30 minutes
                yield redis_1.redisOperations.setex(cacheKey, 1800, JSON.stringify(result));
                return result;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get activity statistics:', error);
                throw error;
            }
        });
    }
    /**
     * Bulk mark activities as read
     */
    bulkMarkActivitiesAsRead(activityIds, teacherId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield analytics_model_1.Activity.updateMany({
                    _id: { $in: activityIds.map(id => new mongoose_1.Types.ObjectId(id)) },
                    teacherId: new mongoose_1.Types.ObjectId(teacherId)
                }, { isRead: true });
                // Invalidate cache
                yield this.invalidateActivityCache(teacherId);
                // Real-time update broadcasting removed - will be handled by SSE/Polling system
                // TODO: Implement SSE broadcasting for bulk activity read status
                logger_1.Logger.info(`📖 Bulk marked ${activityIds.length} activities as read for teacher: ${teacherId}`);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to bulk mark activities as read:', error);
                throw error;
            }
        });
    }
    /**
     * Cache recent activity for quick access
     */
    cacheRecentActivity(teacherId, activity) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = `activities:teacher:${teacherId}:recent`;
                const activities = yield redis_1.redisOperations.get(cacheKey);
                let activityList = activities ? JSON.parse(activities) : [];
                // Add new activity to the beginning
                activityList.unshift(activity);
                // Keep only the most recent 50 activities
                activityList = activityList.slice(0, 50);
                // Cache for 1 hour
                yield redis_1.redisOperations.setex(cacheKey, 3600, JSON.stringify(activityList));
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to cache recent activity:', error);
            }
        });
    }
    /**
     * Update activity in cache
     */
    updateActivityCache(teacherId, activityId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = `activities:teacher:${teacherId}:recent`;
                const activities = yield redis_1.redisOperations.get(cacheKey);
                if (activities) {
                    const activityList = JSON.parse(activities);
                    const index = activityList.findIndex((a) => a._id.toString() === activityId);
                    if (index !== -1) {
                        activityList[index] = Object.assign(Object.assign({}, activityList[index]), updates);
                        yield redis_1.redisOperations.setex(cacheKey, 3600, JSON.stringify(activityList));
                    }
                }
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to update activity cache:', error);
            }
        });
    }
    /**
     * Helper methods for enhanced activity tracking
     */
    getPriorityBreakdown(teacherId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId) };
                if (filters.type)
                    query.type = filters.type;
                if (filters.courseId)
                    query.courseId = new mongoose_1.Types.ObjectId(filters.courseId);
                if (filters.dateFrom || filters.dateTo) {
                    query.createdAt = {};
                    if (filters.dateFrom)
                        query.createdAt.$gte = filters.dateFrom;
                    if (filters.dateTo)
                        query.createdAt.$lte = filters.dateTo;
                }
                const breakdown = yield analytics_model_1.Activity.aggregate([
                    { $match: query },
                    { $group: { _id: '$priority', count: { $sum: 1 } } }
                ]);
                const result = {
                    [analytics_interface_1.ActivityPriority.LOW]: 0,
                    [analytics_interface_1.ActivityPriority.MEDIUM]: 0,
                    [analytics_interface_1.ActivityPriority.HIGH]: 0,
                    [analytics_interface_1.ActivityPriority.URGENT]: 0
                };
                breakdown.forEach(item => {
                    result[item._id] = item.count;
                });
                return result;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get priority breakdown:', error);
                return {
                    [analytics_interface_1.ActivityPriority.LOW]: 0,
                    [analytics_interface_1.ActivityPriority.MEDIUM]: 0,
                    [analytics_interface_1.ActivityPriority.HIGH]: 0,
                    [analytics_interface_1.ActivityPriority.URGENT]: 0
                };
            }
        });
    }
    getTypeBreakdown(teacherId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = { teacherId: new mongoose_1.Types.ObjectId(teacherId) };
                if (filters.priority)
                    query.priority = filters.priority;
                if (filters.courseId)
                    query.courseId = new mongoose_1.Types.ObjectId(filters.courseId);
                if (filters.dateFrom || filters.dateTo) {
                    query.createdAt = {};
                    if (filters.dateFrom)
                        query.createdAt.$gte = filters.dateFrom;
                    if (filters.dateTo)
                        query.createdAt.$lte = filters.dateTo;
                }
                const breakdown = yield analytics_model_1.Activity.aggregate([
                    { $match: query },
                    { $group: { _id: '$type', count: { $sum: 1 } } }
                ]);
                const result = {
                    [analytics_interface_1.ActivityType.ENROLLMENT]: 0,
                    [analytics_interface_1.ActivityType.COMPLETION]: 0,
                    [analytics_interface_1.ActivityType.PAYMENT]: 0,
                    [analytics_interface_1.ActivityType.REVIEW]: 0,
                    [analytics_interface_1.ActivityType.QUESTION]: 0,
                    [analytics_interface_1.ActivityType.COURSE_UPDATE]: 0,
                    [analytics_interface_1.ActivityType.CERTIFICATE]: 0,
                    [analytics_interface_1.ActivityType.REFUND]: 0,
                    [analytics_interface_1.ActivityType.MESSAGE]: 0
                };
                breakdown.forEach(item => {
                    result[item._id] = item.count;
                });
                return result;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get type breakdown:', error);
                return {
                    [analytics_interface_1.ActivityType.ENROLLMENT]: 0,
                    [analytics_interface_1.ActivityType.COMPLETION]: 0,
                    [analytics_interface_1.ActivityType.PAYMENT]: 0,
                    [analytics_interface_1.ActivityType.REVIEW]: 0,
                    [analytics_interface_1.ActivityType.QUESTION]: 0,
                    [analytics_interface_1.ActivityType.COURSE_UPDATE]: 0,
                    [analytics_interface_1.ActivityType.CERTIFICATE]: 0,
                    [analytics_interface_1.ActivityType.REFUND]: 0,
                    [analytics_interface_1.ActivityType.MESSAGE]: 0
                };
            }
        });
    }
    getDateRangeForPeriod(period) {
        const now = new Date();
        let startDate;
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
    getActivityTrends(teacherId, period) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const dateRange = this.getDateRangeForPeriod(period);
                const intervals = this.generateDateIntervals(period, dateRange);
                const trends = [];
                for (const interval of intervals) {
                    const query = {
                        teacherId: new mongoose_1.Types.ObjectId(teacherId),
                        createdAt: { $gte: interval.start, $lte: interval.end }
                    };
                    const [count, unreadCount] = yield Promise.all([
                        analytics_model_1.Activity.countDocuments(query),
                        analytics_model_1.Activity.countDocuments(Object.assign(Object.assign({}, query), { isRead: false }))
                    ]);
                    trends.push({
                        date: interval.start.toISOString().split('T')[0],
                        count,
                        unreadCount
                    });
                }
                return trends;
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get activity trends:', error);
                return [];
            }
        });
    }
    getTopActivityTypes(teacherId, dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const topTypes = yield analytics_model_1.Activity.aggregate([
                    {
                        $match: {
                            teacherId: new mongoose_1.Types.ObjectId(teacherId),
                            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
                        }
                    },
                    { $group: { _id: '$type', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 5 }
                ]);
                return topTypes.map(item => ({
                    type: item._id,
                    count: item.count
                }));
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to get top activity types:', error);
                return [];
            }
        });
    }
    calculateAverageResponseTime(teacherId, dateRange) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Calculate average time between activity creation and being marked as read
                const activities = yield analytics_model_1.Activity.find({
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                    createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
                    isRead: true,
                    updatedAt: { $exists: true }
                }).select('createdAt updatedAt');
                if (activities.length === 0)
                    return 0;
                const totalResponseTime = activities.reduce((sum, activity) => {
                    const responseTime = activity.updatedAt.getTime() - activity.createdAt.getTime();
                    return sum + responseTime;
                }, 0);
                // Return average response time in hours
                return totalResponseTime / activities.length / (1000 * 60 * 60);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to calculate average response time:', error);
                return 0;
            }
        });
    }
    generateDateIntervals(period, dateRange) {
        const intervals = [];
        const { startDate, endDate } = dateRange;
        let intervalSize;
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
    invalidateActivityCache(teacherId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Invalidate all activity-related cache entries for this teacher
                const patterns = [
                    `activities:teacher:${teacherId}:*`,
                    `activity_stats:${teacherId}:*`
                ];
                for (const pattern of patterns) {
                    yield redis_1.redisOperations.del(pattern);
                }
                logger_1.Logger.info(`🗑️ Activity cache invalidated for teacher: ${teacherId}`);
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to invalidate activity cache:', error);
            }
        });
    }
}
exports.default = ActivityTrackingService;
