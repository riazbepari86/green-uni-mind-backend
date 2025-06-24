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
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../../app");
const notification_model_1 = require("../../app/modules/Notification/notification.model");
const teacher_model_1 = require("../../app/modules/Teacher/teacher.model");
const database_1 = require("../setup/database");
const testData_1 = require("../helpers/testData");
const notification_service_1 = require("../../app/modules/Notification/notification.service");
const notification_interface_1 = require("../../app/modules/Notification/notification.interface");
describe('Notification System Integration Tests', () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.connectDB)();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.disconnectDB)();
    }));
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        yield notification_model_1.Notification.deleteMany({});
        yield notification_model_1.NotificationPreference.deleteMany({});
        yield teacher_model_1.Teacher.deleteMany({});
    }));
    describe('Notification Creation', () => {
        it('should create notification with default preferences', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            const notifications = yield notification_service_1.NotificationService.createNotification({
                type: notification_interface_1.NotificationType.PAYOUT_COMPLETED,
                priority: notification_interface_1.NotificationPriority.NORMAL,
                userId: teacher._id,
                userType: 'teacher',
                title: 'Payout Completed',
                body: 'Your payout of $100 has been completed.',
                metadata: {
                    amount: 100,
                    currency: 'usd',
                },
            });
            expect(notifications).toHaveLength(2); // Email and in-app by default
            const inAppNotification = notifications.find(n => n.channel === notification_interface_1.NotificationChannel.IN_APP);
            const emailNotification = notifications.find(n => n.channel === notification_interface_1.NotificationChannel.EMAIL);
            expect(inAppNotification).toBeTruthy();
            expect(emailNotification).toBeTruthy();
            expect(inAppNotification === null || inAppNotification === void 0 ? void 0 : inAppNotification.status).toBe(notification_interface_1.NotificationStatus.PENDING);
            expect(emailNotification === null || emailNotification === void 0 ? void 0 : emailNotification.status).toBe(notification_interface_1.NotificationStatus.PENDING);
        }));
        it('should respect user notification preferences', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            // Create preferences with email disabled
            yield notification_model_1.NotificationPreference.create({
                userId: teacher._id,
                userType: 'teacher',
                emailEnabled: false,
                inAppEnabled: true,
                payoutNotifications: true,
            });
            const notifications = yield notification_service_1.NotificationService.createNotification({
                type: notification_interface_1.NotificationType.PAYOUT_COMPLETED,
                userId: teacher._id,
                userType: 'teacher',
                title: 'Payout Completed',
                body: 'Your payout has been completed.',
            });
            expect(notifications).toHaveLength(1); // Only in-app
            expect(notifications[0].channel).toBe(notification_interface_1.NotificationChannel.IN_APP);
        }));
        it('should skip notification if type is disabled', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            yield notification_model_1.NotificationPreference.create({
                userId: teacher._id,
                userType: 'teacher',
                payoutNotifications: false,
            });
            const notifications = yield notification_service_1.NotificationService.createNotification({
                type: notification_interface_1.NotificationType.PAYOUT_COMPLETED,
                userId: teacher._id,
                userType: 'teacher',
                title: 'Payout Completed',
                body: 'Your payout has been completed.',
            });
            expect(notifications).toHaveLength(0);
        }));
        it('should schedule notification during quiet hours', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            yield notification_model_1.NotificationPreference.create({
                userId: teacher._id,
                userType: 'teacher',
                quietHoursEnabled: true,
                quietHoursStart: '22:00',
                quietHoursEnd: '08:00',
                timezone: 'UTC',
            });
            // Mock current time to be during quiet hours
            const originalDate = Date;
            const mockDate = new Date('2024-01-01T23:00:00Z'); // 11 PM UTC
            global.Date = jest.fn(() => mockDate);
            global.Date.now = jest.fn(() => mockDate.getTime());
            const notifications = yield notification_service_1.NotificationService.createNotification({
                type: notification_interface_1.NotificationType.PAYOUT_COMPLETED,
                userId: teacher._id,
                userType: 'teacher',
                title: 'Payout Completed',
                body: 'Your payout has been completed.',
            });
            expect(notifications[0].scheduledAt).toBeInstanceOf(Date);
            expect(notifications[0].scheduledAt.getTime()).toBeGreaterThan(mockDate.getTime());
            // Restore original Date
            global.Date = originalDate;
        }));
    });
    describe('Notification Preferences', () => {
        it('should create default preferences for new user', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            const preferences = yield notification_service_1.NotificationService.getUserPreferences(teacher._id, 'teacher');
            expect(preferences).toBeTruthy();
            expect(preferences.emailEnabled).toBe(true);
            expect(preferences.inAppEnabled).toBe(true);
            expect(preferences.payoutNotifications).toBe(true);
            expect(preferences.systemNotifications).toBe(true);
        }));
        it('should update user preferences', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            const updatedPreferences = yield notification_service_1.NotificationService.updateUserPreferences(teacher._id, 'teacher', {
                emailEnabled: false,
                smsEnabled: true,
                minimumAmount: 100,
                digestFrequency: 'daily',
            });
            expect(updatedPreferences.emailEnabled).toBe(false);
            expect(updatedPreferences.smsEnabled).toBe(true);
            expect(updatedPreferences.digestFrequency).toBe('daily');
        }));
    });
    describe('Notification Retrieval', () => {
        it('should get user notifications with pagination', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            // Create multiple notifications
            for (let i = 0; i < 5; i++) {
                yield (0, testData_1.createTestNotification)({
                    userId: teacher._id,
                    userType: 'teacher',
                    title: `Notification ${i + 1}`,
                    body: `Body ${i + 1}`,
                });
            }
            const result = yield notification_service_1.NotificationService.getUserNotifications(teacher._id, {
                limit: 3,
                offset: 0,
            });
            expect(result.notifications).toHaveLength(3);
            expect(result.total).toBe(5);
        }));
        it('should filter notifications by status', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            yield (0, testData_1.createTestNotification)({
                userId: teacher._id,
                userType: 'teacher',
                status: notification_interface_1.NotificationStatus.PENDING,
            });
            yield (0, testData_1.createTestNotification)({
                userId: teacher._id,
                userType: 'teacher',
                status: notification_interface_1.NotificationStatus.DELIVERED,
            });
            const result = yield notification_service_1.NotificationService.getUserNotifications(teacher._id, {
                status: notification_interface_1.NotificationStatus.PENDING,
            });
            expect(result.notifications).toHaveLength(1);
            expect(result.notifications[0].status).toBe(notification_interface_1.NotificationStatus.PENDING);
        }));
        it('should filter unread notifications', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            const readNotification = yield (0, testData_1.createTestNotification)({
                userId: teacher._id,
                userType: 'teacher',
                openedAt: new Date(),
            });
            const unreadNotification = yield (0, testData_1.createTestNotification)({
                userId: teacher._id,
                userType: 'teacher',
                openedAt: undefined,
            });
            const result = yield notification_service_1.NotificationService.getUserNotifications(teacher._id, {
                unreadOnly: true,
            });
            expect(result.notifications).toHaveLength(1);
            expect(result.notifications[0]._id.toString()).toBe(unreadNotification._id.toString());
        }));
    });
    describe('Notification API Endpoints', () => {
        it('should get user notifications via API', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            yield (0, testData_1.createTestNotification)({
                userId: teacher._id,
                userType: 'teacher',
                title: 'Test Notification',
                body: 'Test body',
            });
            const response = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/notifications')
                .set('Authorization', 'Bearer teacher_token')
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.notifications).toHaveLength(1);
            expect(response.body.data.total).toBe(1);
        }));
        it('should get notification preferences via API', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            const response = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/notifications/preferences')
                .set('Authorization', 'Bearer teacher_token')
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('emailEnabled');
            expect(response.body.data).toHaveProperty('inAppEnabled');
        }));
        it('should update notification preferences via API', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            const response = yield (0, supertest_1.default)(app_1.app)
                .put('/api/v1/notifications/preferences')
                .set('Authorization', 'Bearer teacher_token')
                .send({
                emailEnabled: false,
                smsEnabled: true,
                payoutNotifications: false,
            })
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.emailEnabled).toBe(false);
            expect(response.body.data.smsEnabled).toBe(true);
            expect(response.body.data.payoutNotifications).toBe(false);
        }));
        it('should mark notification as read via API', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            const notification = yield (0, testData_1.createTestNotification)({
                userId: teacher._id,
                userType: 'teacher',
                status: notification_interface_1.NotificationStatus.DELIVERED,
            });
            const response = yield (0, supertest_1.default)(app_1.app)
                .patch(`/api/v1/notifications/${notification._id}/read`)
                .set('Authorization', 'Bearer teacher_token')
                .expect(200);
            expect(response.body.success).toBe(true);
            // Verify notification was marked as read
            const updatedNotification = yield notification_model_1.Notification.findById(notification._id);
            expect(updatedNotification === null || updatedNotification === void 0 ? void 0 : updatedNotification.openedAt).toBeTruthy();
            expect(updatedNotification === null || updatedNotification === void 0 ? void 0 : updatedNotification.status).toBe(notification_interface_1.NotificationStatus.OPENED);
        }));
        it('should send test notification via API (admin only)', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/notifications/test')
                .set('Authorization', 'Bearer admin_token')
                .send({
                type: notification_interface_1.NotificationType.SYSTEM_MAINTENANCE,
                title: 'Test Notification',
                body: 'This is a test notification',
                priority: notification_interface_1.NotificationPriority.NORMAL,
            })
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2); // Email and in-app
        }));
    });
    describe('Notification Processing', () => {
        it('should process pending notifications', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            // Create pending notification
            yield (0, testData_1.createTestNotification)({
                userId: teacher._id,
                userType: 'teacher',
                channel: notification_interface_1.NotificationChannel.EMAIL,
                status: notification_interface_1.NotificationStatus.PENDING,
                scheduledAt: new Date(Date.now() - 1000), // Past date
                recipientEmail: 'teacher@test.com',
            });
            const result = yield notification_service_1.NotificationService.processPendingNotifications();
            expect(result.processed).toBe(1);
            expect(result.delivered).toBeGreaterThanOrEqual(0);
        }));
        it('should handle notification delivery failures gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            // Create notification with invalid email
            const notification = yield (0, testData_1.createTestNotification)({
                userId: teacher._id,
                userType: 'teacher',
                channel: notification_interface_1.NotificationChannel.EMAIL,
                status: notification_interface_1.NotificationStatus.PENDING,
                scheduledAt: new Date(Date.now() - 1000),
                recipientEmail: 'invalid-email',
            });
            yield notification_service_1.NotificationService.processPendingNotifications();
            // Verify notification was marked as failed
            const updatedNotification = yield notification_model_1.Notification.findById(notification._id);
            expect(updatedNotification === null || updatedNotification === void 0 ? void 0 : updatedNotification.status).toBe(notification_interface_1.NotificationStatus.FAILED);
            expect(updatedNotification === null || updatedNotification === void 0 ? void 0 : updatedNotification.failedAt).toBeTruthy();
        }));
    });
});
