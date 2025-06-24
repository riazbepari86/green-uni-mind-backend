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
exports.setupTestEnvironment = exports.cleanupTestData = exports.createTestAuthToken = exports.createMockStripePayout = exports.createMockStripeAccount = exports.createMockStripeWebhook = exports.createTestNotification = exports.createTestTransaction = exports.createTestPayout = exports.createTestWebhookEvent = exports.createTestTeacher = void 0;
const mongoose_1 = require("mongoose");
const teacher_model_1 = require("../../app/modules/Teacher/teacher.model");
const webhookEvent_model_1 = require("../../app/modules/WebhookEvent/webhookEvent.model");
const payout_model_1 = require("../../app/modules/Payment/payout.model");
const transaction_model_1 = require("../../app/modules/Payment/transaction.model");
const notification_model_1 = require("../../app/modules/Notification/notification.model");
const webhookEvent_interface_1 = require("../../app/modules/WebhookEvent/webhookEvent.interface");
const payout_interface_1 = require("../../app/modules/Payment/payout.interface");
const notification_interface_1 = require("../../app/modules/Notification/notification.interface");
// Teacher test data
const createTestTeacher = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (overrides = {}) {
    const defaultTeacher = Object.assign({ firstName: 'Test', lastName: 'Teacher', email: `teacher_${Date.now()}@test.com`, password: 'hashedPassword123', role: 'teacher', isEmailVerified: true, stripeConnect: {
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
        } }, overrides);
    const teacher = new teacher_model_1.Teacher(defaultTeacher);
    yield teacher.save();
    return teacher;
});
exports.createTestTeacher = createTestTeacher;
// Webhook event test data
const createTestWebhookEvent = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (overrides = {}) {
    const defaultWebhookEvent = Object.assign({ eventType: webhookEvent_interface_1.WebhookEventType.PAYMENT_INTENT_SUCCEEDED, source: webhookEvent_interface_1.WebhookEventSource.STRIPE_MAIN, status: webhookEvent_interface_1.WebhookEventStatus.PENDING, stripeEventId: `evt_test_${Date.now()}`, stripeAccountId: 'acct_test123', stripeApiVersion: '2024-06-20', eventData: {
            object: {
                id: 'pi_test123',
                amount: 5000,
                currency: 'usd',
            },
        }, rawPayload: JSON.stringify({
            id: `evt_test_${Date.now()}`,
            type: 'payment_intent.succeeded',
            data: { object: { id: 'pi_test123' } },
        }), receivedAt: new Date(), retryCount: 0, maxRetries: 3, retryBackoffMultiplier: 2, metadata: {
            stripeEventId: `evt_test_${Date.now()}`,
            processingStartTime: new Date(),
        }, tags: ['payment', 'test'], trackingId: `track_${Date.now()}` }, overrides);
    const webhookEvent = new webhookEvent_model_1.WebhookEvent(defaultWebhookEvent);
    yield webhookEvent.save();
    return webhookEvent;
});
exports.createTestWebhookEvent = createTestWebhookEvent;
// Payout test data
const createTestPayout = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (overrides = {}) {
    const defaultPayout = Object.assign({ teacherId: new mongoose_1.Types.ObjectId(), amount: 100, currency: 'usd', status: payout_interface_1.PayoutStatus.SCHEDULED, stripeAccountId: 'acct_test123', transactions: [], description: 'Test payout', scheduledAt: new Date(), requestedAt: new Date(), retryCount: 0, maxRetries: 3, retryConfig: {
            maxRetries: 3,
            baseDelay: 60000,
            maxDelay: 3600000,
            backoffMultiplier: 2,
            jitterEnabled: true,
        }, complianceChecked: false, notificationSent: false, notificationsSent: [], auditTrail: [{
                action: 'payout_created',
                timestamp: new Date(),
                details: {
                    amount: 100,
                    currency: 'usd',
                },
            }], metadata: {
            createdBy: 'test',
        }, tags: ['test'] }, overrides);
    const payout = new payout_model_1.Payout(defaultPayout);
    yield payout.save();
    return payout;
});
exports.createTestPayout = createTestPayout;
// Transaction test data
const createTestTransaction = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (overrides = {}) {
    const defaultTransaction = Object.assign({ courseId: new mongoose_1.Types.ObjectId(), studentId: new mongoose_1.Types.ObjectId(), teacherId: new mongoose_1.Types.ObjectId(), totalAmount: 100, teacherEarning: 80, platformEarning: 20, stripeTransactionId: `pi_test_${Date.now()}`, stripeTransferStatus: 'pending', paymentMethod: 'card', currency: 'usd', metadata: {
            testTransaction: true,
        } }, overrides);
    const transaction = new transaction_model_1.Transaction(defaultTransaction);
    yield transaction.save();
    return transaction;
});
exports.createTestTransaction = createTestTransaction;
// Notification test data
const createTestNotification = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (overrides = {}) {
    const defaultNotification = Object.assign({ type: notification_interface_1.NotificationType.PAYOUT_COMPLETED, channel: notification_interface_1.NotificationChannel.IN_APP, priority: notification_interface_1.NotificationPriority.NORMAL, status: notification_interface_1.NotificationStatus.PENDING, userId: new mongoose_1.Types.ObjectId(), userType: 'teacher', subject: 'Test Notification', title: 'Test Notification', body: 'This is a test notification', scheduledAt: new Date(), retryCount: 0, maxRetries: 3, metadata: {
            testNotification: true,
        }, trackingId: `notif_test_${Date.now()}` }, overrides);
    const notification = new notification_model_1.Notification(defaultNotification);
    yield notification.save();
    return notification;
});
exports.createTestNotification = createTestNotification;
// Mock Stripe webhook payload
const createMockStripeWebhook = (eventType, overrides = {}) => {
    var _a;
    const basePayload = Object.assign({ id: `evt_test_${Date.now()}`, object: 'event', type: eventType, api_version: '2024-06-20', created: Math.floor(Date.now() / 1000), data: Object.assign({ object: Object.assign({ id: `obj_test_${Date.now()}` }, (_a = overrides.data) === null || _a === void 0 ? void 0 : _a.object) }, overrides.data) }, overrides);
    return basePayload;
};
exports.createMockStripeWebhook = createMockStripeWebhook;
// Mock Stripe Connect account data
const createMockStripeAccount = (overrides = {}) => {
    return Object.assign({ id: 'acct_test123', object: 'account', business_profile: {
            name: 'Test Business',
            url: 'https://test.com',
        }, capabilities: Object.assign({ card_payments: 'active', transfers: 'active' }, overrides.capabilities), charges_enabled: true, payouts_enabled: true, details_submitted: true, requirements: Object.assign({ currently_due: [], errors: [] }, overrides.requirements), settings: {
            payouts: {
                schedule: {
                    interval: 'daily',
                },
            },
        } }, overrides);
};
exports.createMockStripeAccount = createMockStripeAccount;
// Mock Stripe payout data
const createMockStripePayout = (overrides = {}) => {
    return Object.assign({ id: `po_test_${Date.now()}`, object: 'payout', amount: 5000, currency: 'usd', arrival_date: Math.floor(Date.now() / 1000) + 86400, created: Math.floor(Date.now() / 1000), description: 'Test payout', destination: 'ba_test123', method: 'standard', status: 'paid', type: 'bank_account' }, overrides);
};
exports.createMockStripePayout = createMockStripePayout;
// Test user authentication tokens
const createTestAuthToken = (userType = 'teacher') => {
    // In a real test environment, this would generate a valid JWT
    // For now, returning a mock token
    return `test_${userType}_token_${Date.now()}`;
};
exports.createTestAuthToken = createTestAuthToken;
// Clean up test data
const cleanupTestData = () => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all([
        teacher_model_1.Teacher.deleteMany({ email: { $regex: /@test\.com$/ } }),
        webhookEvent_model_1.WebhookEvent.deleteMany({ tags: 'test' }),
        payout_model_1.Payout.deleteMany({ tags: 'test' }),
        transaction_model_1.Transaction.deleteMany({ 'metadata.testTransaction': true }),
        notification_model_1.Notification.deleteMany({ 'metadata.testNotification': true }),
    ]);
});
exports.cleanupTestData = cleanupTestData;
// Create test environment setup
const setupTestEnvironment = () => __awaiter(void 0, void 0, void 0, function* () {
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
                create: jest.fn().mockResolvedValue((0, exports.createMockStripePayout)()),
            },
            accounts: {
                retrieve: jest.fn().mockResolvedValue((0, exports.createMockStripeAccount)()),
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
});
exports.setupTestEnvironment = setupTestEnvironment;
exports.default = {
    createTestTeacher: exports.createTestTeacher,
    createTestWebhookEvent: exports.createTestWebhookEvent,
    createTestPayout: exports.createTestPayout,
    createTestTransaction: exports.createTestTransaction,
    createTestNotification: exports.createTestNotification,
    createMockStripeWebhook: exports.createMockStripeWebhook,
    createMockStripeAccount: exports.createMockStripeAccount,
    createMockStripePayout: exports.createMockStripePayout,
    createTestAuthToken: exports.createTestAuthToken,
    cleanupTestData: exports.cleanupTestData,
    setupTestEnvironment: exports.setupTestEnvironment,
};
