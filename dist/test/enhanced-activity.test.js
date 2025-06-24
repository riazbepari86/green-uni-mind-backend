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
const database_1 = require("./setup/database");
const testHelpers_1 = require("./helpers/testHelpers");
const auth_utils_1 = require("../app/modules/Auth/auth.utils");
const ActivityTrackingService_1 = __importDefault(require("../app/services/activity/ActivityTrackingService"));
const analytics_interface_1 = require("../app/modules/Analytics/analytics.interface");
// Mock generateToken function for tests
const generateToken = (payload) => {
    return (0, auth_utils_1.createToken)(payload, 'test-secret', '1h');
};
describe('Enhanced Activity Tracking', () => {
    let teacherId;
    let courseId;
    let studentId;
    let activityTrackingService;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.connectDB)();
        // Create test teacher
        const teacher = yield (0, testHelpers_1.createTestTeacher)();
        teacherId = teacher._id.toString();
        // Create test course
        const course = yield (0, testHelpers_1.createTestCourse)(teacher._id);
        courseId = course._id.toString();
        // Create test student
        const student = yield (0, testHelpers_1.createTestStudent)();
        studentId = student._id.toString();
        // Initialize services
        activityTrackingService = new ActivityTrackingService_1.default();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.disconnectDB)();
    }));
    describe('Activity Tracking Service', () => {
        it('should track enrollment activity', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const activity = yield activityTrackingService.trackEnrollment(teacherId, courseId, studentId, { enrollmentSource: 'direct' });
            expect(activity).toBeDefined();
            expect(activity.type).toBe(analytics_interface_1.ActivityType.ENROLLMENT);
            expect(activity.teacherId.toString()).toBe(teacherId);
            expect((_a = activity.courseId) === null || _a === void 0 ? void 0 : _a.toString()).toBe(courseId);
            expect((_b = activity.studentId) === null || _b === void 0 ? void 0 : _b.toString()).toBe(studentId);
            expect(activity.priority).toBe(analytics_interface_1.ActivityPriority.MEDIUM);
            expect(activity.actionRequired).toBe(false);
        }));
        it('should track completion activity', () => __awaiter(void 0, void 0, void 0, function* () {
            const activity = yield activityTrackingService.trackCompletion(teacherId, courseId, studentId, { completionRate: 100 });
            expect(activity).toBeDefined();
            expect(activity.type).toBe(analytics_interface_1.ActivityType.COMPLETION);
            expect(activity.priority).toBe(analytics_interface_1.ActivityPriority.HIGH);
            expect(activity.metadata.completionRate).toBe(100);
        }));
        it('should track payment activity', () => __awaiter(void 0, void 0, void 0, function* () {
            const amount = 99.99;
            const activity = yield activityTrackingService.trackPayment(teacherId, courseId, studentId, amount, { paymentMethod: 'stripe' });
            expect(activity).toBeDefined();
            expect(activity.type).toBe(analytics_interface_1.ActivityType.PAYMENT);
            expect(activity.priority).toBe(analytics_interface_1.ActivityPriority.HIGH);
            expect(activity.metadata.amount).toBe(amount);
            expect(activity.description).toContain(`$${amount}`);
        }));
        it('should track review activity with appropriate priority', () => __awaiter(void 0, void 0, void 0, function* () {
            // High rating review
            const highRatingActivity = yield activityTrackingService.trackReview(teacherId, courseId, studentId, 5, { reviewText: 'Excellent course!' });
            expect(highRatingActivity.priority).toBe(analytics_interface_1.ActivityPriority.MEDIUM);
            expect(highRatingActivity.actionRequired).toBe(false);
            // Low rating review
            const lowRatingActivity = yield activityTrackingService.trackReview(teacherId, courseId, studentId, 2, { reviewText: 'Needs improvement' });
            expect(lowRatingActivity.priority).toBe(analytics_interface_1.ActivityPriority.HIGH);
            expect(lowRatingActivity.actionRequired).toBe(true);
        }));
        it('should track question activity with action required', () => __awaiter(void 0, void 0, void 0, function* () {
            const activity = yield activityTrackingService.trackQuestion(teacherId, courseId, studentId, 'How do I access the course materials?', { questionId: 'q123' });
            expect(activity).toBeDefined();
            expect(activity.type).toBe(analytics_interface_1.ActivityType.QUESTION);
            expect(activity.priority).toBe(analytics_interface_1.ActivityPriority.HIGH);
            expect(activity.actionRequired).toBe(true);
            expect(activity.actionUrl).toContain('/questions/');
        }));
        it('should track message activity', () => __awaiter(void 0, void 0, void 0, function* () {
            const activity = yield activityTrackingService.trackMessage(teacherId, courseId, studentId, { conversationId: 'conv123' });
            expect(activity).toBeDefined();
            expect(activity.type).toBe(analytics_interface_1.ActivityType.MESSAGE);
            expect(activity.priority).toBe(analytics_interface_1.ActivityPriority.MEDIUM);
            expect(activity.actionRequired).toBe(true);
            expect(activity.actionUrl).toContain('/messages/');
        }));
        it('should track refund activity', () => __awaiter(void 0, void 0, void 0, function* () {
            const amount = 99.99;
            const activity = yield activityTrackingService.trackRefund(teacherId, courseId, studentId, amount, { reason: 'Student request', paymentId: 'pay123' });
            expect(activity).toBeDefined();
            expect(activity.type).toBe(analytics_interface_1.ActivityType.REFUND);
            expect(activity.priority).toBe(analytics_interface_1.ActivityPriority.HIGH);
            expect(activity.actionRequired).toBe(true);
            expect(activity.metadata.amount).toBe(amount);
            expect(activity.metadata.reason).toBe('Student request');
        }));
    });
    describe('Activity Filtering and Pagination', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            // Create some test activities
            yield Promise.all([
                activityTrackingService.trackEnrollment(teacherId, courseId, studentId),
                activityTrackingService.trackCompletion(teacherId, courseId, studentId),
                activityTrackingService.trackPayment(teacherId, courseId, studentId, 99.99),
                activityTrackingService.trackReview(teacherId, courseId, studentId, 5),
                activityTrackingService.trackQuestion(teacherId, courseId, studentId, 'Test question'),
            ]);
        }));
        it('should get activities with filters', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield activityTrackingService.getActivitiesWithFilters(teacherId, {
                type: analytics_interface_1.ActivityType.ENROLLMENT,
                limit: 10,
                offset: 0
            });
            expect(result).toHaveProperty('activities');
            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('unreadCount');
            expect(result).toHaveProperty('priorityBreakdown');
            expect(result).toHaveProperty('typeBreakdown');
            expect(result.activities).toBeInstanceOf(Array);
        }));
        it('should filter by priority', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield activityTrackingService.getActivitiesWithFilters(teacherId, {
                priority: analytics_interface_1.ActivityPriority.HIGH,
                limit: 10,
                offset: 0
            });
            expect(result.activities.every(activity => activity.priority === analytics_interface_1.ActivityPriority.HIGH)).toBe(true);
        }));
        it('should filter by read status', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield activityTrackingService.getActivitiesWithFilters(teacherId, {
                isRead: false,
                limit: 10,
                offset: 0
            });
            expect(result.activities.every(activity => !activity.isRead)).toBe(true);
        }));
        it('should filter by course', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield activityTrackingService.getActivitiesWithFilters(teacherId, {
                courseId,
                limit: 10,
                offset: 0
            });
            expect(result.activities.every(activity => { var _a; return ((_a = activity.courseId) === null || _a === void 0 ? void 0 : _a.toString()) === courseId; })).toBe(true);
        }));
        it('should filter by date range', () => __awaiter(void 0, void 0, void 0, function* () {
            const dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
            const dateTo = new Date();
            const result = yield activityTrackingService.getActivitiesWithFilters(teacherId, {
                dateFrom,
                dateTo,
                limit: 10,
                offset: 0
            });
            expect(result.activities.every(activity => activity.createdAt &&
                activity.createdAt >= dateFrom &&
                activity.createdAt <= dateTo)).toBe(true);
        }));
        it('should support sorting', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield activityTrackingService.getActivitiesWithFilters(teacherId, {
                sortBy: 'createdAt',
                sortOrder: 'desc',
                limit: 10,
                offset: 0
            });
            // Check if activities are sorted by creation date (descending)
            for (let i = 1; i < result.activities.length; i++) {
                const current = new Date(result.activities[i].createdAt);
                const previous = new Date(result.activities[i - 1].createdAt);
                expect(current.getTime()).toBeLessThanOrEqual(previous.getTime());
            }
        }));
        it('should provide priority breakdown', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield activityTrackingService.getActivitiesWithFilters(teacherId, {
                limit: 100,
                offset: 0
            });
            const priorityBreakdown = result.priorityBreakdown;
            expect(priorityBreakdown).toHaveProperty(analytics_interface_1.ActivityPriority.LOW);
            expect(priorityBreakdown).toHaveProperty(analytics_interface_1.ActivityPriority.MEDIUM);
            expect(priorityBreakdown).toHaveProperty(analytics_interface_1.ActivityPriority.HIGH);
            expect(priorityBreakdown).toHaveProperty(analytics_interface_1.ActivityPriority.URGENT);
            Object.values(priorityBreakdown).forEach(count => {
                expect(typeof count).toBe('number');
                expect(count).toBeGreaterThanOrEqual(0);
            });
        }));
        it('should provide type breakdown', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield activityTrackingService.getActivitiesWithFilters(teacherId, {
                limit: 100,
                offset: 0
            });
            const typeBreakdown = result.typeBreakdown;
            expect(typeBreakdown).toHaveProperty(analytics_interface_1.ActivityType.ENROLLMENT);
            expect(typeBreakdown).toHaveProperty(analytics_interface_1.ActivityType.COMPLETION);
            expect(typeBreakdown).toHaveProperty(analytics_interface_1.ActivityType.PAYMENT);
            expect(typeBreakdown).toHaveProperty(analytics_interface_1.ActivityType.REVIEW);
            expect(typeBreakdown).toHaveProperty(analytics_interface_1.ActivityType.QUESTION);
            Object.values(typeBreakdown).forEach(count => {
                expect(typeof count).toBe('number');
                expect(count).toBeGreaterThanOrEqual(0);
            });
        }));
    });
    describe('Activity Statistics', () => {
        it('should get activity statistics', () => __awaiter(void 0, void 0, void 0, function* () {
            const stats = yield activityTrackingService.getActivityStatistics(teacherId, 'weekly');
            expect(stats).toHaveProperty('totalActivities');
            expect(stats).toHaveProperty('unreadActivities');
            expect(stats).toHaveProperty('actionRequiredActivities');
            expect(stats).toHaveProperty('activityTrends');
            expect(stats).toHaveProperty('topActivityTypes');
            expect(stats).toHaveProperty('averageResponseTime');
            expect(typeof stats.totalActivities).toBe('number');
            expect(typeof stats.unreadActivities).toBe('number');
            expect(typeof stats.actionRequiredActivities).toBe('number');
            expect(typeof stats.averageResponseTime).toBe('number');
            expect(stats.activityTrends).toBeInstanceOf(Array);
            expect(stats.topActivityTypes).toBeInstanceOf(Array);
        }));
        it('should validate activity trends structure', () => __awaiter(void 0, void 0, void 0, function* () {
            const stats = yield activityTrackingService.getActivityStatistics(teacherId, 'daily');
            stats.activityTrends.forEach(trend => {
                expect(trend).toHaveProperty('date');
                expect(trend).toHaveProperty('count');
                expect(trend).toHaveProperty('unreadCount');
                expect(typeof trend.date).toBe('string');
                expect(typeof trend.count).toBe('number');
                expect(typeof trend.unreadCount).toBe('number');
            });
        }));
        it('should validate top activity types structure', () => __awaiter(void 0, void 0, void 0, function* () {
            const stats = yield activityTrackingService.getActivityStatistics(teacherId, 'monthly');
            stats.topActivityTypes.forEach(typeData => {
                expect(typeData).toHaveProperty('type');
                expect(typeData).toHaveProperty('count');
                expect(Object.values(analytics_interface_1.ActivityType)).toContain(typeData.type);
                expect(typeof typeData.count).toBe('number');
                expect(typeData.count).toBeGreaterThanOrEqual(0);
            });
        }));
    });
    describe('Activity Management', () => {
        let activityId;
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            const activity = yield activityTrackingService.trackEnrollment(teacherId, courseId, studentId);
            activityId = activity._id.toString();
        }));
        it('should mark activity as read', () => __awaiter(void 0, void 0, void 0, function* () {
            yield activityTrackingService.markActivityAsRead(activityId, teacherId);
            // Verify activity is marked as read
            const activities = yield activityTrackingService.getRecentActivities(teacherId, 10, 0);
            const markedActivity = activities.find(a => a._id.toString() === activityId);
            expect(markedActivity === null || markedActivity === void 0 ? void 0 : markedActivity.isRead).toBe(true);
        }));
        it('should bulk mark activities as read', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create multiple activities
            const activities = yield Promise.all([
                activityTrackingService.trackEnrollment(teacherId, courseId, studentId),
                activityTrackingService.trackCompletion(teacherId, courseId, studentId),
                activityTrackingService.trackPayment(teacherId, courseId, studentId, 99.99)
            ]);
            const activityIds = activities.map(a => a._id.toString());
            yield activityTrackingService.bulkMarkActivitiesAsRead(activityIds, teacherId);
            // Verify all activities are marked as read
            const recentActivities = yield activityTrackingService.getRecentActivities(teacherId, 20, 0);
            const markedActivities = recentActivities.filter(a => activityIds.includes(a._id.toString()));
            expect(markedActivities.every(a => a.isRead)).toBe(true);
        }));
    });
    // WebSocket Integration tests removed since WebSocket service is not initialized in tests
    describe('Error Handling', () => {
        it('should handle invalid teacher ID', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(activityTrackingService.trackEnrollment('invalid-id', courseId, studentId)).rejects.toThrow();
        }));
        it('should handle missing required fields', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(activityTrackingService.trackActivity({
                teacherId: '',
                type: analytics_interface_1.ActivityType.ENROLLMENT,
                title: '',
                description: '',
                relatedEntity: {
                    entityType: 'student',
                    entityId: studentId
                }
            })).rejects.toThrow();
        }));
    });
    describe('Performance and Caching', () => {
        it('should cache recent activities', () => __awaiter(void 0, void 0, void 0, function* () {
            const start = Date.now();
            // First request
            yield activityTrackingService.getRecentActivities(teacherId, 20, 0);
            const firstRequestTime = Date.now() - start;
            // Second request (should be cached)
            const secondStart = Date.now();
            yield activityTrackingService.getRecentActivities(teacherId, 20, 0);
            const secondRequestTime = Date.now() - secondStart;
            // Cached request should be faster
            expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5);
        }));
        it('should cache activity statistics', () => __awaiter(void 0, void 0, void 0, function* () {
            const start = Date.now();
            // First request
            yield activityTrackingService.getActivityStatistics(teacherId, 'weekly');
            const firstRequestTime = Date.now() - start;
            // Second request (should be cached)
            const secondStart = Date.now();
            yield activityTrackingService.getActivityStatistics(teacherId, 'weekly');
            const secondRequestTime = Date.now() - secondStart;
            // Cached request should be faster
            expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5);
        }));
    });
});
