import request from 'supertest';
import { app } from '../../app';
import { connectDB, disconnectDB } from '../setup/database';
import { 
  createTestTeacher, 
  createTestAuthToken, 
  cleanupTestData 
} from '../helpers/testData';
import { WebhookEventService } from '../../app/modules/WebhookEvent/webhookEvent.service';
import { PayoutManagementService } from '../../app/modules/Payment/payoutManagement.service';
import { NotificationService } from '../../app/modules/Notification/notification.service';
import { complianceService } from '../../app/services/complianceService';
import { RetryService } from '../../app/services/retryService';

describe('Enterprise Features End-to-End Tests', () => {
  let adminToken: string;
  let teacherToken: string;
  let testTeacher: any;

  beforeAll(async () => {
    await connectDB();
    
    // Create test tokens
    adminToken = createTestAuthToken('admin');
    teacherToken = createTestAuthToken('teacher');
    
    // Create test teacher
    testTeacher = await createTestTeacher({
      stripeConnect: {
        accountId: 'acct_test123',
        status: 'connected',
        verified: true,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectDB();
  });

  describe('Dual Webhook System', () => {
    it('should handle main webhook events end-to-end', async () => {
      const webhookPayload = {
        id: 'evt_e2e_main',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_e2e_test',
            payment_intent: 'pi_e2e_test',
            amount_total: 10000,
            currency: 'usd',
            payment_status: 'paid',
            customer_details: {
              email: 'student@e2e.com',
            },
            metadata: {
              courseId: 'course_e2e',
              studentId: 'student_e2e',
              teacherId: testTeacher._id.toString(),
            },
          },
        },
        api_version: '2024-06-20',
        created: Math.floor(Date.now() / 1000),
      };

      // Send webhook
      const response = await request(app)
        .post('/api/v1/payments/webhook/main')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify webhook was processed
      const webhookEvents = await WebhookEventService.getPendingRetries();
      expect(webhookEvents).toHaveLength(0); // Should be processed, not pending retry
    });

    it('should handle connect webhook events end-to-end', async () => {
      const webhookPayload = {
        id: 'evt_e2e_connect',
        object: 'event',
        type: 'account.updated',
        account: testTeacher.stripeConnect.accountId,
        data: {
          object: {
            id: testTeacher.stripeConnect.accountId,
            details_submitted: true,
            charges_enabled: true,
            payouts_enabled: true,
            capabilities: {
              card_payments: 'active',
              transfers: 'active',
            },
            requirements: {
              currently_due: [],
              errors: [],
            },
          },
        },
        api_version: '2024-06-20',
        created: Math.floor(Date.now() / 1000),
      };

      const response = await request(app)
        .post('/api/v1/payments/webhook/connect')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 500));
    });
  });

  describe('Payout Management System', () => {
    it('should complete full payout lifecycle', async () => {
      // 1. Create payout preferences
      const preferencesResponse = await request(app)
        .put(`/api/v1/payouts/preferences/${testTeacher._id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          schedule: 'weekly',
          minimumAmount: 50,
          isAutoPayoutEnabled: true,
        })
        .expect(200);

      expect(preferencesResponse.body.success).toBe(true);

      // 2. Request manual payout
      const payoutResponse = await request(app)
        .post('/api/v1/payouts/request')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          teacherId: testTeacher._id,
          amount: 100,
          description: 'E2E test payout',
        })
        .expect(200);

      expect(payoutResponse.body.success).toBe(true);
      expect(payoutResponse.body.data.amount).toBe(100);

      // 3. Get payout summary
      const summaryResponse = await request(app)
        .get(`/api/v1/payouts/summary/${testTeacher._id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(summaryResponse.body.success).toBe(true);
      expect(summaryResponse.body.data).toHaveProperty('payoutHistory');
    });

    it('should run automatic payout scheduling', async () => {
      const result = await PayoutManagementService.scheduleAutomaticPayouts();
      
      expect(result).toHaveProperty('scheduled');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');
      expect(typeof result.scheduled).toBe('number');
    });
  });

  describe('Real-time Notification System', () => {
    it('should create and process notifications end-to-end', async () => {
      // 1. Create notification
      const notifications = await NotificationService.createNotification({
        type: 'payout_completed',
        priority: 'normal',
        userId: testTeacher._id,
        userType: 'teacher',
        title: 'E2E Test Notification',
        body: 'This is an end-to-end test notification',
        metadata: {
          e2eTest: true,
        },
      });

      expect(notifications.length).toBeGreaterThan(0);

      // 2. Get user notifications via API
      const notificationsResponse = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(notificationsResponse.body.success).toBe(true);
      expect(notificationsResponse.body.data.notifications.length).toBeGreaterThan(0);

      // 3. Mark notification as read
      const notificationId = notificationsResponse.body.data.notifications[0]._id;
      const markReadResponse = await request(app)
        .patch(`/api/v1/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(markReadResponse.body.success).toBe(true);

      // 4. Process pending notifications
      const processResult = await NotificationService.processPendingNotifications();
      expect(processResult).toHaveProperty('processed');
      expect(processResult).toHaveProperty('delivered');
    });

    it('should handle notification preferences', async () => {
      // Get preferences
      const getResponse = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);

      // Update preferences
      const updateResponse = await request(app)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          emailEnabled: false,
          smsEnabled: true,
          payoutNotifications: true,
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.emailEnabled).toBe(false);
      expect(updateResponse.body.data.smsEnabled).toBe(true);
    });
  });

  describe('Audit Logging and Compliance', () => {
    it('should generate comprehensive audit logs', async () => {
      // Get audit logs (admin only)
      const auditResponse = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          limit: 10,
          category: 'payment',
        })
        .expect(200);

      expect(auditResponse.body.success).toBe(true);
      expect(auditResponse.body.data).toHaveProperty('logs');
      expect(auditResponse.body.data).toHaveProperty('total');
    });

    it('should generate audit log summary', async () => {
      const summaryResponse = await request(app)
        .get('/api/v1/audit-logs/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        })
        .expect(200);

      expect(summaryResponse.body.success).toBe(true);
      expect(summaryResponse.body.data).toHaveProperty('totalEvents');
      expect(summaryResponse.body.data).toHaveProperty('eventsByCategory');
    });

    it('should run compliance check', async () => {
      const complianceResult = await complianceService.runComplianceCheck();
      
      expect(complianceResult).toHaveProperty('alerts');
      expect(complianceResult).toHaveProperty('metrics');
      expect(complianceResult).toHaveProperty('summary');
      expect(Array.isArray(complianceResult.alerts)).toBe(true);
    });

    it('should export audit logs for compliance', async () => {
      const exportResponse = await request(app)
        .get('/api/v1/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'json',
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(200);

      expect(exportResponse.headers['content-type']).toContain('application/json');
      expect(exportResponse.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('Retry and Error Handling', () => {
    it('should handle webhook retry logic', async () => {
      const retryResult = await RetryService.retryFailedWebhooks();
      
      expect(retryResult).toHaveProperty('processed');
      expect(retryResult).toHaveProperty('succeeded');
      expect(retryResult).toHaveProperty('failed');
      expect(retryResult).toHaveProperty('rescheduled');
    });

    it('should handle payout retry logic', async () => {
      const retryResult = await RetryService.retryFailedPayouts();
      
      expect(retryResult).toHaveProperty('processed');
      expect(retryResult).toHaveProperty('succeeded');
      expect(retryResult).toHaveProperty('failed');
      expect(retryResult).toHaveProperty('rescheduled');
    });
  });

  describe('System Health and Monitoring', () => {
    it('should provide webhook statistics', async () => {
      const statsResponse = await request(app)
        .get('/api/v1/payments/webhook/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data).toHaveProperty('totalEvents');
    });

    it('should provide system notification statistics', async () => {
      const statsResponse = await request(app)
        .get('/api/v1/notifications/system/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data).toHaveProperty('connectedUsers');
    });

    it('should generate compliance report', async () => {
      const reportResponse = await request(app)
        .get('/api/v1/audit-logs/compliance-report')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          reportType: 'general',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(200);

      expect(reportResponse.body.success).toBe(true);
      expect(reportResponse.body.data).toHaveProperty('reportType');
      expect(reportResponse.body.data).toHaveProperty('summary');
    });
  });
});
