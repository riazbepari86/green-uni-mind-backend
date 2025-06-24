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
const webhookEvent_model_1 = require("../../app/modules/WebhookEvent/webhookEvent.model");
const teacher_model_1 = require("../../app/modules/Teacher/teacher.model");
const auditLog_model_1 = require("../../app/modules/AuditLog/auditLog.model");
const database_1 = require("../setup/database");
const testData_1 = require("../helpers/testData");
const webhookEvent_interface_1 = require("../../app/modules/WebhookEvent/webhookEvent.interface");
describe('Webhook Event Integration Tests', () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.connectDB)();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.disconnectDB)();
    }));
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        yield webhookEvent_model_1.WebhookEvent.deleteMany({});
        yield teacher_model_1.Teacher.deleteMany({});
        yield auditLog_model_1.AuditLog.deleteMany({});
    }));
    describe('POST /api/v1/payments/webhook/main', () => {
        it('should process checkout.session.completed webhook successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create test teacher
            const teacher = yield (0, testData_1.createTestTeacher)({
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
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/payments/webhook/main')
                .set('stripe-signature', 'test_signature')
                .send(webhookPayload)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.received).toBe(true);
            // Verify webhook event was created
            const webhookEvent = yield webhookEvent_model_1.WebhookEvent.findOne({ stripeEventId: 'evt_test123' });
            expect(webhookEvent).toBeTruthy();
            expect(webhookEvent === null || webhookEvent === void 0 ? void 0 : webhookEvent.status).toBe(webhookEvent_interface_1.WebhookEventStatus.PENDING);
            expect(webhookEvent === null || webhookEvent === void 0 ? void 0 : webhookEvent.source).toBe(webhookEvent_interface_1.WebhookEventSource.STRIPE_MAIN);
            // Wait for async processing
            yield new Promise(resolve => setTimeout(resolve, 100));
            // Verify audit log was created
            const auditLog = yield auditLog_model_1.AuditLog.findOne({
                'metadata.stripeEventId': 'evt_test123'
            });
            expect(auditLog).toBeTruthy();
        }));
        it('should handle duplicate webhook events', () => __awaiter(void 0, void 0, void 0, function* () {
            const webhookPayload = {
                id: 'evt_duplicate123',
                object: 'event',
                type: 'payment_intent.succeeded',
                data: { object: { id: 'pi_test123' } },
                api_version: '2024-06-20',
                created: Math.floor(Date.now() / 1000),
            };
            // Create existing webhook event
            yield (0, testData_1.createTestWebhookEvent)({
                stripeEventId: 'evt_duplicate123',
                status: webhookEvent_interface_1.WebhookEventStatus.PROCESSED,
            });
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/payments/webhook/main')
                .set('stripe-signature', 'test_signature')
                .send(webhookPayload)
                .expect(200);
            expect(response.body.success).toBe(true);
            // Verify only one webhook event exists
            const webhookEvents = yield webhookEvent_model_1.WebhookEvent.find({ stripeEventId: 'evt_duplicate123' });
            expect(webhookEvents).toHaveLength(1);
            expect(webhookEvents[0].status).toBe(webhookEvent_interface_1.WebhookEventStatus.DUPLICATE);
        }));
        it('should reject webhook with invalid signature', () => __awaiter(void 0, void 0, void 0, function* () {
            const webhookPayload = {
                id: 'evt_invalid123',
                object: 'event',
                type: 'payment_intent.succeeded',
                data: { object: { id: 'pi_test123' } },
                api_version: '2024-06-20',
                created: Math.floor(Date.now() / 1000),
            };
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/payments/webhook/main')
                .set('stripe-signature', 'invalid_signature')
                .send(webhookPayload)
                .expect(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('signature verification failed');
        }));
    });
    describe('POST /api/v1/payments/webhook/connect', () => {
        it('should process account.updated webhook successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const teacher = yield (0, testData_1.createTestTeacher)({
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
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/payments/webhook/connect')
                .set('stripe-signature', 'test_signature')
                .send(webhookPayload)
                .expect(200);
            expect(response.body.success).toBe(true);
            // Wait for async processing
            yield new Promise(resolve => setTimeout(resolve, 100));
            // Verify teacher was updated
            const updatedTeacher = yield teacher_model_1.Teacher.findById(teacher._id);
            expect((_a = updatedTeacher === null || updatedTeacher === void 0 ? void 0 : updatedTeacher.stripeConnect) === null || _a === void 0 ? void 0 : _a.status).toBe('connected');
            expect((_b = updatedTeacher === null || updatedTeacher === void 0 ? void 0 : updatedTeacher.stripeConnect) === null || _b === void 0 ? void 0 : _b.verified).toBe(true);
        }));
        it('should process payout.paid webhook successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)({
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
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/payments/webhook/connect')
                .set('stripe-signature', 'test_signature')
                .send(webhookPayload)
                .expect(200);
            expect(response.body.success).toBe(true);
            // Wait for async processing
            yield new Promise(resolve => setTimeout(resolve, 100));
            // Verify audit log was created
            const auditLog = yield auditLog_model_1.AuditLog.findOne({
                'metadata.stripePayoutId': 'po_test123'
            });
            expect(auditLog).toBeTruthy();
        }));
    });
    describe('Webhook Retry Logic', () => {
        it('should schedule retry for failed webhook processing', () => __awaiter(void 0, void 0, void 0, function* () {
            const webhookEvent = yield (0, testData_1.createTestWebhookEvent)({
                status: webhookEvent_interface_1.WebhookEventStatus.FAILED,
                retryCount: 1,
                maxRetries: 3,
                nextRetryAt: new Date(Date.now() - 1000), // Past date for immediate retry
            });
            // This would typically be called by the retry service
            // For testing, we'll simulate the retry logic
            const retryResult = yield webhookEvent_model_1.WebhookEvent.findPendingRetries();
            expect(retryResult).toHaveLength(1);
            expect(retryResult[0]._id.toString()).toBe(webhookEvent._id.toString());
        }));
        it('should not retry webhook beyond max attempts', () => __awaiter(void 0, void 0, void 0, function* () {
            const webhookEvent = yield (0, testData_1.createTestWebhookEvent)({
                status: webhookEvent_interface_1.WebhookEventStatus.FAILED,
                retryCount: 3,
                maxRetries: 3,
                nextRetryAt: new Date(Date.now() - 1000),
            });
            const retryResult = yield webhookEvent_model_1.WebhookEvent.findPendingRetries();
            expect(retryResult).toHaveLength(0);
        }));
    });
    describe('Webhook Statistics', () => {
        it('should return webhook statistics for admin', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create test webhook events
            yield (0, testData_1.createTestWebhookEvent)({
                eventType: 'payment_intent.succeeded',
                status: webhookEvent_interface_1.WebhookEventStatus.PROCESSED,
            });
            yield (0, testData_1.createTestWebhookEvent)({
                eventType: 'payment_intent.payment_failed',
                status: webhookEvent_interface_1.WebhookEventStatus.FAILED,
            });
            const response = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/payments/webhook/stats')
                .set('Authorization', 'Bearer admin_token')
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalEvents');
            expect(response.body.data).toHaveProperty('eventsByType');
            expect(response.body.data).toHaveProperty('eventsByStatus');
        }));
    });
});
