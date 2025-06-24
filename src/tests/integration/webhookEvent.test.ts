import request from 'supertest';
import { app } from '../../app';
import { WebhookEvent } from '../../app/modules/WebhookEvent/webhookEvent.model';
import { Teacher } from '../../app/modules/Teacher/teacher.model';
import { AuditLog } from '../../app/modules/AuditLog/auditLog.model';
import { connectDB, disconnectDB } from '../setup/database';
import { createTestTeacher, createTestWebhookEvent } from '../helpers/testData';
import { WebhookEventStatus, WebhookEventSource } from '../../app/modules/WebhookEvent/webhookEvent.interface';

describe('Webhook Event Integration Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await WebhookEvent.deleteMany({});
    await Teacher.deleteMany({});
    await AuditLog.deleteMany({});
  });

  describe('POST /api/v1/payments/webhook/main', () => {
    it('should process checkout.session.completed webhook successfully', async () => {
      // Create test teacher
      const teacher = await createTestTeacher({
        stripeConnect: {
          accountId: 'acct_test123',
          status: 'connected',
          verified: true,
        },
      });

      const webhookPayload = {
        id: 'evt_test123',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test123',
            payment_intent: 'pi_test123',
            amount_total: 5000, // $50.00
            currency: 'usd',
            payment_status: 'paid',
            customer_details: {
              email: 'student@test.com',
            },
            metadata: {
              courseId: 'course123',
              studentId: 'student123',
              teacherId: teacher._id.toString(),
            },
          },
        },
        api_version: '2024-06-20',
        created: Math.floor(Date.now() / 1000),
      };

      const response = await request(app)
        .post('/api/v1/payments/webhook/main')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.received).toBe(true);

      // Verify webhook event was created
      const webhookEvent = await WebhookEvent.findOne({ stripeEventId: 'evt_test123' });
      expect(webhookEvent).toBeTruthy();
      expect(webhookEvent?.status).toBe(WebhookEventStatus.PENDING);
      expect(webhookEvent?.source).toBe(WebhookEventSource.STRIPE_MAIN);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify audit log was created
      const auditLog = await AuditLog.findOne({ 
        'metadata.stripeEventId': 'evt_test123' 
      });
      expect(auditLog).toBeTruthy();
    });

    it('should handle duplicate webhook events', async () => {
      const webhookPayload = {
        id: 'evt_duplicate123',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test123' } },
        api_version: '2024-06-20',
        created: Math.floor(Date.now() / 1000),
      };

      // Create existing webhook event
      await createTestWebhookEvent({
        stripeEventId: 'evt_duplicate123',
        status: WebhookEventStatus.PROCESSED,
      });

      const response = await request(app)
        .post('/api/v1/payments/webhook/main')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify only one webhook event exists
      const webhookEvents = await WebhookEvent.find({ stripeEventId: 'evt_duplicate123' });
      expect(webhookEvents).toHaveLength(1);
      expect(webhookEvents[0].status).toBe(WebhookEventStatus.DUPLICATE);
    });

    it('should reject webhook with invalid signature', async () => {
      const webhookPayload = {
        id: 'evt_invalid123',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test123' } },
        api_version: '2024-06-20',
        created: Math.floor(Date.now() / 1000),
      };

      const response = await request(app)
        .post('/api/v1/payments/webhook/main')
        .set('stripe-signature', 'invalid_signature')
        .send(webhookPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('signature verification failed');
    });
  });

  describe('POST /api/v1/payments/webhook/connect', () => {
    it('should process account.updated webhook successfully', async () => {
      const teacher = await createTestTeacher({
        stripeConnect: {
          accountId: 'acct_test123',
          status: 'pending',
          verified: false,
        },
      });

      const webhookPayload = {
        id: 'evt_account123',
        object: 'event',
        type: 'account.updated',
        account: 'acct_test123',
        data: {
          object: {
            id: 'acct_test123',
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
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify teacher was updated
      const updatedTeacher = await Teacher.findById(teacher._id);
      expect(updatedTeacher?.stripeConnect?.status).toBe('connected');
      expect(updatedTeacher?.stripeConnect?.verified).toBe(true);
    });

    it('should process payout.paid webhook successfully', async () => {
      const teacher = await createTestTeacher({
        stripeConnect: {
          accountId: 'acct_test123',
          status: 'connected',
        },
      });

      const webhookPayload = {
        id: 'evt_payout123',
        object: 'event',
        type: 'payout.paid',
        account: 'acct_test123',
        data: {
          object: {
            id: 'po_test123',
            amount: 5000,
            currency: 'usd',
            arrival_date: Math.floor(Date.now() / 1000) + 86400,
            status: 'paid',
            destination: 'acct_test123',
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
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify audit log was created
      const auditLog = await AuditLog.findOne({ 
        'metadata.stripePayoutId': 'po_test123' 
      });
      expect(auditLog).toBeTruthy();
    });
  });

  describe('Webhook Retry Logic', () => {
    it('should schedule retry for failed webhook processing', async () => {
      const webhookEvent = await createTestWebhookEvent({
        status: WebhookEventStatus.FAILED,
        retryCount: 1,
        maxRetries: 3,
        nextRetryAt: new Date(Date.now() - 1000), // Past date for immediate retry
      });

      // This would typically be called by the retry service
      // For testing, we'll simulate the retry logic
      const retryResult = await WebhookEvent.findPendingRetries();
      expect(retryResult).toHaveLength(1);
      expect(retryResult[0]._id.toString()).toBe(webhookEvent._id.toString());
    });

    it('should not retry webhook beyond max attempts', async () => {
      const webhookEvent = await createTestWebhookEvent({
        status: WebhookEventStatus.FAILED,
        retryCount: 3,
        maxRetries: 3,
        nextRetryAt: new Date(Date.now() - 1000),
      });

      const retryResult = await WebhookEvent.findPendingRetries();
      expect(retryResult).toHaveLength(0);
    });
  });

  describe('Webhook Statistics', () => {
    it('should return webhook statistics for admin', async () => {
      // Create test webhook events
      await createTestWebhookEvent({
        eventType: 'payment_intent.succeeded',
        status: WebhookEventStatus.PROCESSED,
      });
      await createTestWebhookEvent({
        eventType: 'payment_intent.payment_failed',
        status: WebhookEventStatus.FAILED,
      });

      const response = await request(app)
        .get('/api/v1/payments/webhook/stats')
        .set('Authorization', 'Bearer admin_token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalEvents');
      expect(response.body.data).toHaveProperty('eventsByType');
      expect(response.body.data).toHaveProperty('eventsByStatus');
    });
  });
});
