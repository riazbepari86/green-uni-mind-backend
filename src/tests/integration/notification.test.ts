import request from 'supertest';
import { app } from '../../app';
import { Notification, NotificationPreference } from '../../app/modules/Notification/notification.model';
import { Teacher } from '../../app/modules/Teacher/teacher.model';
import { connectDB, disconnectDB } from '../setup/database';
import { createTestTeacher, createTestNotification } from '../helpers/testData';
import { NotificationService } from '../../app/modules/Notification/notification.service';
import { 
  NotificationType, 
  NotificationChannel, 
  NotificationPriority, 
  NotificationStatus 
} from '../../app/modules/Notification/notification.interface';

describe('Notification System Integration Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await Notification.deleteMany({});
    await NotificationPreference.deleteMany({});
    await Teacher.deleteMany({});
  });

  describe('Notification Creation', () => {
    it('should create notification with default preferences', async () => {
      const teacher = await createTestTeacher();

      const notifications = await NotificationService.createNotification({
        type: NotificationType.PAYOUT_COMPLETED,
        priority: NotificationPriority.NORMAL,
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
      
      const inAppNotification = notifications.find(n => n.channel === NotificationChannel.IN_APP);
      const emailNotification = notifications.find(n => n.channel === NotificationChannel.EMAIL);

      expect(inAppNotification).toBeTruthy();
      expect(emailNotification).toBeTruthy();
      expect(inAppNotification?.status).toBe(NotificationStatus.PENDING);
      expect(emailNotification?.status).toBe(NotificationStatus.PENDING);
    });

    it('should respect user notification preferences', async () => {
      const teacher = await createTestTeacher();

      // Create preferences with email disabled
      await NotificationPreference.create({
        userId: teacher._id,
        userType: 'teacher',
        emailEnabled: false,
        inAppEnabled: true,
        payoutNotifications: true,
      });

      const notifications = await NotificationService.createNotification({
        type: NotificationType.PAYOUT_COMPLETED,
        userId: teacher._id,
        userType: 'teacher',
        title: 'Payout Completed',
        body: 'Your payout has been completed.',
      });

      expect(notifications).toHaveLength(1); // Only in-app
      expect(notifications[0].channel).toBe(NotificationChannel.IN_APP);
    });

    it('should skip notification if type is disabled', async () => {
      const teacher = await createTestTeacher();

      await NotificationPreference.create({
        userId: teacher._id,
        userType: 'teacher',
        payoutNotifications: false,
      });

      const notifications = await NotificationService.createNotification({
        type: NotificationType.PAYOUT_COMPLETED,
        userId: teacher._id,
        userType: 'teacher',
        title: 'Payout Completed',
        body: 'Your payout has been completed.',
      });

      expect(notifications).toHaveLength(0);
    });

    it('should schedule notification during quiet hours', async () => {
      const teacher = await createTestTeacher();

      await NotificationPreference.create({
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
      global.Date = jest.fn(() => mockDate) as any;
      global.Date.now = jest.fn(() => mockDate.getTime());

      const notifications = await NotificationService.createNotification({
        type: NotificationType.PAYOUT_COMPLETED,
        userId: teacher._id,
        userType: 'teacher',
        title: 'Payout Completed',
        body: 'Your payout has been completed.',
      });

      expect(notifications[0].scheduledAt).toBeInstanceOf(Date);
      expect(notifications[0].scheduledAt.getTime()).toBeGreaterThan(mockDate.getTime());

      // Restore original Date
      global.Date = originalDate;
    });
  });

  describe('Notification Preferences', () => {
    it('should create default preferences for new user', async () => {
      const teacher = await createTestTeacher();

      const preferences = await NotificationService.getUserPreferences(teacher._id, 'teacher');

      expect(preferences).toBeTruthy();
      expect(preferences.emailEnabled).toBe(true);
      expect(preferences.inAppEnabled).toBe(true);
      expect(preferences.payoutNotifications).toBe(true);
      expect(preferences.systemNotifications).toBe(true);
    });

    it('should update user preferences', async () => {
      const teacher = await createTestTeacher();

      const updatedPreferences = await NotificationService.updateUserPreferences(
        teacher._id,
        'teacher',
        {
          emailEnabled: false,
          smsEnabled: true,
          minimumAmount: 100,
          digestFrequency: 'daily',
        }
      );

      expect(updatedPreferences.emailEnabled).toBe(false);
      expect(updatedPreferences.smsEnabled).toBe(true);
      expect(updatedPreferences.digestFrequency).toBe('daily');
    });
  });

  describe('Notification Retrieval', () => {
    it('should get user notifications with pagination', async () => {
      const teacher = await createTestTeacher();

      // Create multiple notifications
      for (let i = 0; i < 5; i++) {
        await createTestNotification({
          userId: teacher._id,
          userType: 'teacher',
          title: `Notification ${i + 1}`,
          body: `Body ${i + 1}`,
        });
      }

      const result = await NotificationService.getUserNotifications(teacher._id, {
        limit: 3,
        offset: 0,
      });

      expect(result.notifications).toHaveLength(3);
      expect(result.total).toBe(5);
    });

    it('should filter notifications by status', async () => {
      const teacher = await createTestTeacher();

      await createTestNotification({
        userId: teacher._id,
        userType: 'teacher',
        status: NotificationStatus.PENDING,
      });

      await createTestNotification({
        userId: teacher._id,
        userType: 'teacher',
        status: NotificationStatus.DELIVERED,
      });

      const result = await NotificationService.getUserNotifications(teacher._id, {
        status: NotificationStatus.PENDING,
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].status).toBe(NotificationStatus.PENDING);
    });

    it('should filter unread notifications', async () => {
      const teacher = await createTestTeacher();

      const readNotification = await createTestNotification({
        userId: teacher._id,
        userType: 'teacher',
        openedAt: new Date(),
      });

      const unreadNotification = await createTestNotification({
        userId: teacher._id,
        userType: 'teacher',
        openedAt: undefined,
      });

      const result = await NotificationService.getUserNotifications(teacher._id, {
        unreadOnly: true,
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]._id.toString()).toBe(unreadNotification._id.toString());
    });
  });

  describe('Notification API Endpoints', () => {
    it('should get user notifications via API', async () => {
      const teacher = await createTestTeacher();

      await createTestNotification({
        userId: teacher._id,
        userType: 'teacher',
        title: 'Test Notification',
        body: 'Test body',
      });

      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', 'Bearer teacher_token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });

    it('should get notification preferences via API', async () => {
      const teacher = await createTestTeacher();

      const response = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', 'Bearer teacher_token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('emailEnabled');
      expect(response.body.data).toHaveProperty('inAppEnabled');
    });

    it('should update notification preferences via API', async () => {
      const teacher = await createTestTeacher();

      const response = await request(app)
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
    });

    it('should mark notification as read via API', async () => {
      const teacher = await createTestTeacher();

      const notification = await createTestNotification({
        userId: teacher._id,
        userType: 'teacher',
        status: NotificationStatus.DELIVERED,
      });

      const response = await request(app)
        .patch(`/api/v1/notifications/${notification._id}/read`)
        .set('Authorization', 'Bearer teacher_token')
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify notification was marked as read
      const updatedNotification = await Notification.findById(notification._id);
      expect(updatedNotification?.openedAt).toBeTruthy();
      expect(updatedNotification?.status).toBe(NotificationStatus.OPENED);
    });

    it('should send test notification via API (admin only)', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/test')
        .set('Authorization', 'Bearer admin_token')
        .send({
          type: NotificationType.SYSTEM_MAINTENANCE,
          title: 'Test Notification',
          body: 'This is a test notification',
          priority: NotificationPriority.NORMAL,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Email and in-app
    });
  });

  describe('Notification Processing', () => {
    it('should process pending notifications', async () => {
      const teacher = await createTestTeacher();

      // Create pending notification
      await createTestNotification({
        userId: teacher._id,
        userType: 'teacher',
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
        scheduledAt: new Date(Date.now() - 1000), // Past date
        recipientEmail: 'teacher@test.com',
      });

      const result = await NotificationService.processPendingNotifications();

      expect(result.processed).toBe(1);
      expect(result.delivered).toBeGreaterThanOrEqual(0);
    });

    it('should handle notification delivery failures gracefully', async () => {
      const teacher = await createTestTeacher();

      // Create notification with invalid email
      const notification = await createTestNotification({
        userId: teacher._id,
        userType: 'teacher',
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
        scheduledAt: new Date(Date.now() - 1000),
        recipientEmail: 'invalid-email',
      });

      await NotificationService.processPendingNotifications();

      // Verify notification was marked as failed
      const updatedNotification = await Notification.findById(notification._id);
      expect(updatedNotification?.status).toBe(NotificationStatus.FAILED);
      expect(updatedNotification?.failedAt).toBeTruthy();
    });
  });
});
