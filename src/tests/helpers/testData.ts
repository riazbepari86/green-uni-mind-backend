import { Types } from 'mongoose';
import { Teacher } from '../../app/modules/Teacher/teacher.model';
import { WebhookEvent } from '../../app/modules/WebhookEvent/webhookEvent.model';
import { Payout } from '../../app/modules/Payment/payout.model';
import { Transaction } from '../../app/modules/Payment/transaction.model';
import { Notification } from '../../app/modules/Notification/notification.model';
import { 
  WebhookEventType, 
  WebhookEventStatus, 
  WebhookEventSource 
} from '../../app/modules/WebhookEvent/webhookEvent.interface';
import { PayoutStatus } from '../../app/modules/Payment/payout.interface';
import { 
  NotificationType, 
  NotificationChannel, 
  NotificationPriority, 
  NotificationStatus 
} from '../../app/modules/Notification/notification.interface';

// Teacher test data
export const createTestTeacher = async (overrides: any = {}) => {
  const defaultTeacher = {
    firstName: 'Test',
    lastName: 'Teacher',
    email: `teacher_${Date.now()}@test.com`,
    password: 'hashedPassword123',
    role: 'teacher',
    isEmailVerified: true,
    stripeConnect: {
      accountId: 'acct_test123',
      status: 'connected',
      verified: true,
      onboardingComplete: true,
      requirements: [],
      capabilities: {
        card_payments: 'active',
        transfers: 'active',
      },
      accountHealthScore: 100,
      lastStatusUpdate: new Date(),
      auditTrail: [],
    },
    ...overrides,
  };

  const teacher = new Teacher(defaultTeacher);
  await teacher.save();
  return teacher;
};

// Webhook event test data
export const createTestWebhookEvent = async (overrides: any = {}) => {
  const defaultWebhookEvent = {
    eventType: WebhookEventType.PAYMENT_INTENT_SUCCEEDED,
    source: WebhookEventSource.STRIPE_MAIN,
    status: WebhookEventStatus.PENDING,
    stripeEventId: `evt_test_${Date.now()}`,
    stripeAccountId: 'acct_test123',
    stripeApiVersion: '2024-06-20',
    eventData: {
      object: {
        id: 'pi_test123',
        amount: 5000,
        currency: 'usd',
      },
    },
    rawPayload: JSON.stringify({
      id: `evt_test_${Date.now()}`,
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test123' } },
    }),
    receivedAt: new Date(),
    retryCount: 0,
    maxRetries: 3,
    retryBackoffMultiplier: 2,
    metadata: {
      stripeEventId: `evt_test_${Date.now()}`,
      processingStartTime: new Date(),
    },
    tags: ['payment', 'test'],
    trackingId: `track_${Date.now()}`,
    ...overrides,
  };

  const webhookEvent = new WebhookEvent(defaultWebhookEvent);
  await webhookEvent.save();
  return webhookEvent;
};

// Payout test data
export const createTestPayout = async (overrides: any = {}) => {
  const defaultPayout = {
    teacherId: new Types.ObjectId(),
    amount: 100,
    currency: 'usd',
    status: PayoutStatus.SCHEDULED,
    stripeAccountId: 'acct_test123',
    transactions: [],
    description: 'Test payout',
    scheduledAt: new Date(),
    requestedAt: new Date(),
    retryCount: 0,
    maxRetries: 3,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 60000,
      maxDelay: 3600000,
      backoffMultiplier: 2,
      jitterEnabled: true,
    },
    complianceChecked: false,
    notificationSent: false,
    notificationsSent: [],
    auditTrail: [{
      action: 'payout_created',
      timestamp: new Date(),
      details: {
        amount: 100,
        currency: 'usd',
      },
    }],
    metadata: {
      createdBy: 'test',
    },
    tags: ['test'],
    ...overrides,
  };

  const payout = new Payout(defaultPayout);
  await payout.save();
  return payout;
};

// Transaction test data
export const createTestTransaction = async (overrides: any = {}) => {
  const defaultTransaction = {
    courseId: new Types.ObjectId(),
    studentId: new Types.ObjectId(),
    teacherId: new Types.ObjectId(),
    totalAmount: 100,
    teacherEarning: 80,
    platformEarning: 20,
    stripeTransactionId: `pi_test_${Date.now()}`,
    stripeTransferStatus: 'pending',
    paymentMethod: 'card',
    currency: 'usd',
    metadata: {
      testTransaction: true,
    },
    ...overrides,
  };

  const transaction = new Transaction(defaultTransaction);
  await transaction.save();
  return transaction;
};

// Notification test data
export const createTestNotification = async (overrides: any = {}) => {
  const defaultNotification = {
    type: NotificationType.PAYOUT_COMPLETED,
    channel: NotificationChannel.IN_APP,
    priority: NotificationPriority.NORMAL,
    status: NotificationStatus.PENDING,
    userId: new Types.ObjectId(),
    userType: 'teacher',
    subject: 'Test Notification',
    title: 'Test Notification',
    body: 'This is a test notification',
    scheduledAt: new Date(),
    retryCount: 0,
    maxRetries: 3,
    metadata: {
      testNotification: true,
    },
    trackingId: `notif_test_${Date.now()}`,
    ...overrides,
  };

  const notification = new Notification(defaultNotification);
  await notification.save();
  return notification;
};

// Mock Stripe webhook payload
export const createMockStripeWebhook = (eventType: string, overrides: any = {}) => {
  const basePayload = {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type: eventType,
    api_version: '2024-06-20',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `obj_test_${Date.now()}`,
        ...overrides.data?.object,
      },
      ...overrides.data,
    },
    ...overrides,
  };

  return basePayload;
};

// Mock Stripe Connect account data
export const createMockStripeAccount = (overrides: any = {}) => {
  return {
    id: 'acct_test123',
    object: 'account',
    business_profile: {
      name: 'Test Business',
      url: 'https://test.com',
    },
    capabilities: {
      card_payments: 'active',
      transfers: 'active',
      ...overrides.capabilities,
    },
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    requirements: {
      currently_due: [],
      errors: [],
      ...overrides.requirements,
    },
    settings: {
      payouts: {
        schedule: {
          interval: 'daily',
        },
      },
    },
    ...overrides,
  };
};

// Mock Stripe payout data
export const createMockStripePayout = (overrides: any = {}) => {
  return {
    id: `po_test_${Date.now()}`,
    object: 'payout',
    amount: 5000,
    currency: 'usd',
    arrival_date: Math.floor(Date.now() / 1000) + 86400, // Tomorrow
    created: Math.floor(Date.now() / 1000),
    description: 'Test payout',
    destination: 'ba_test123',
    method: 'standard',
    status: 'paid',
    type: 'bank_account',
    ...overrides,
  };
};

// Test user authentication tokens
export const createTestAuthToken = (userType: 'student' | 'teacher' | 'admin' = 'teacher') => {
  // In a real test environment, this would generate a valid JWT
  // For now, returning a mock token
  return `test_${userType}_token_${Date.now()}`;
};

// Clean up test data
export const cleanupTestData = async () => {
  await Promise.all([
    Teacher.deleteMany({ email: { $regex: /@test\.com$/ } }),
    WebhookEvent.deleteMany({ tags: 'test' }),
    Payout.deleteMany({ tags: 'test' }),
    Transaction.deleteMany({ 'metadata.testTransaction': true }),
    Notification.deleteMany({ 'metadata.testNotification': true }),
  ]);
};

// Create test environment setup
export const setupTestEnvironment = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_test_connect_secret';
  
  // Mock external services
  jest.mock('stripe', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          id: 'evt_test123',
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test123' } },
        }),
      },
      payouts: {
        create: jest.fn().mockResolvedValue(createMockStripePayout()),
      },
      accounts: {
        retrieve: jest.fn().mockResolvedValue(createMockStripeAccount()),
      },
    })),
  }));
  
  // Mock email service
  jest.mock('../../app/services/emailService', () => ({
    emailService: {
      sendNotificationEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'test_message_id',
      }),
    },
  }));
  
  // Mock WebSocket service
  jest.mock('../../app/services/websocketService', () => ({
    webSocketService: {
      sendRealTimeNotification: jest.fn().mockReturnValue(true),
      isUserConnected: jest.fn().mockReturnValue(false),
    },
  }));
};

export default {
  createTestTeacher,
  createTestWebhookEvent,
  createTestPayout,
  createTestTransaction,
  createTestNotification,
  createMockStripeWebhook,
  createMockStripeAccount,
  createMockStripePayout,
  createTestAuthToken,
  cleanupTestData,
  setupTestEnvironment,
};
