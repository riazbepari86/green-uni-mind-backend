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
const database_1 = require("../setup/database");
const testData_1 = require("../helpers/testData");
const webhookEvent_service_1 = require("../../app/modules/WebhookEvent/webhookEvent.service");
const payoutManagement_service_1 = require("../../app/modules/Payment/payoutManagement.service");
const notification_service_1 = require("../../app/modules/Notification/notification.service");
const complianceService_1 = require("../../app/services/complianceService");
const retryService_1 = require("../../app/services/retryService");
describe('Enterprise Features End-to-End Tests', () => {
    let adminToken;
    let teacherToken;
    let testTeacher;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.connectDB)();
        // Create test tokens
        adminToken = (0, testData_1.createTestAuthToken)('admin');
        teacherToken = (0, testData_1.createTestAuthToken)('teacher');
        // Create test teacher
        testTeacher = yield (0, testData_1.createTestTeacher)({
            stripeConnect: {
                accountId: 'acct_test123',
                status: 'connected',
                verified: true,
            },
        });
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, testData_1.cleanupTestData)();
        yield (0, database_1.disconnectDB)();
    }));
    describe('Dual Webhook System', () => {
        it('should handle main webhook events end-to-end', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/payments/webhook/main')
                .set('stripe-signature', 'test_signature')
                .send(webhookPayload)
                .expect(200);
            expect(response.body.success).toBe(true);
            // Wait for async processing
            yield new Promise(resolve => setTimeout(resolve, 500));
            // Verify webhook was processed
            const webhookEvents = yield webhookEvent_service_1.WebhookEventService.getPendingRetries();
            expect(webhookEvents).toHaveLength(0); // Should be processed, not pending retry
        }));
        it('should handle connect webhook events end-to-end', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/payments/webhook/connect')
                .set('stripe-signature', 'test_signature')
                .send(webhookPayload)
                .expect(200);
            expect(response.body.success).toBe(true);
            // Wait for async processing
            yield new Promise(resolve => setTimeout(resolve, 500));
        }));
    });
    describe('Payout Management System', () => {
        it('should complete full payout lifecycle', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Create payout preferences
            const preferencesResponse = yield (0, supertest_1.default)(app_1.app)
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
            const payoutResponse = yield (0, supertest_1.default)(app_1.app)
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
            const summaryResponse = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/payouts/summary/${testTeacher._id}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(summaryResponse.body.success).toBe(true);
            expect(summaryResponse.body.data).toHaveProperty('payoutHistory');
        }));
        it('should run automatic payout scheduling', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield payoutManagement_service_1.PayoutManagementService.scheduleAutomaticPayouts();
            expect(result).toHaveProperty('scheduled');
            expect(result).toHaveProperty('skipped');
            expect(result).toHaveProperty('errors');
            expect(typeof result.scheduled).toBe('number');
        }));
    });
    describe('Real-time Notification System', () => {
        it('should create and process notifications end-to-end', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Create notification
            const notifications = yield notification_service_1.NotificationService.createNotification({
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
            const notificationsResponse = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/notifications')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(notificationsResponse.body.success).toBe(true);
            expect(notificationsResponse.body.data.notifications.length).toBeGreaterThan(0);
            // 3. Mark notification as read
            const notificationId = notificationsResponse.body.data.notifications[0]._id;
            const markReadResponse = yield (0, supertest_1.default)(app_1.app)
                .patch(`/api/v1/notifications/${notificationId}/read`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(markReadResponse.body.success).toBe(true);
            // 4. Process pending notifications
            const processResult = yield notification_service_1.NotificationService.processPendingNotifications();
            expect(processResult).toHaveProperty('processed');
            expect(processResult).toHaveProperty('delivered');
        }));
        it('should handle notification preferences', () => __awaiter(void 0, void 0, void 0, function* () {
            // Get preferences
            const getResponse = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/notifications/preferences')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(getResponse.body.success).toBe(true);
            // Update preferences
            const updateResponse = yield (0, supertest_1.default)(app_1.app)
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
        }));
    });
    describe('Audit Logging and Compliance', () => {
        it('should generate comprehensive audit logs', () => __awaiter(void 0, void 0, void 0, function* () {
            // Get audit logs (admin only)
            const auditResponse = yield (0, supertest_1.default)(app_1.app)
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
        }));
        it('should generate audit log summary', () => __awaiter(void 0, void 0, void 0, function* () {
            const summaryResponse = yield (0, supertest_1.default)(app_1.app)
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
        }));
        it('should run compliance check', () => __awaiter(void 0, void 0, void 0, function* () {
            const complianceResult = yield complianceService_1.complianceService.runComplianceCheck();
            expect(complianceResult).toHaveProperty('alerts');
            expect(complianceResult).toHaveProperty('metrics');
            expect(complianceResult).toHaveProperty('summary');
            expect(Array.isArray(complianceResult.alerts)).toBe(true);
        }));
        it('should export audit logs for compliance', () => __awaiter(void 0, void 0, void 0, function* () {
            const exportResponse = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/audit-logs/export')
                .set('Authorization', `Bearer ${adminToken}`)
                .query({
                format: 'json',
                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            })
                .expect(200);
            expect(exportResponse.headers['content-type']).toContain('application/json');
            expect(exportResponse.headers['content-disposition']).toContain('attachment');
        }));
    });
    describe('Retry and Error Handling', () => {
        it('should handle webhook retry logic', () => __awaiter(void 0, void 0, void 0, function* () {
            const retryResult = yield retryService_1.RetryService.retryFailedWebhooks();
            expect(retryResult).toHaveProperty('processed');
            expect(retryResult).toHaveProperty('succeeded');
            expect(retryResult).toHaveProperty('failed');
            expect(retryResult).toHaveProperty('rescheduled');
        }));
        it('should handle payout retry logic', () => __awaiter(void 0, void 0, void 0, function* () {
            const retryResult = yield retryService_1.RetryService.retryFailedPayouts();
            expect(retryResult).toHaveProperty('processed');
            expect(retryResult).toHaveProperty('succeeded');
            expect(retryResult).toHaveProperty('failed');
            expect(retryResult).toHaveProperty('rescheduled');
        }));
    });
    describe('System Health and Monitoring', () => {
        it('should provide webhook statistics', () => __awaiter(void 0, void 0, void 0, function* () {
            const statsResponse = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/payments/webhook/stats')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(statsResponse.body.success).toBe(true);
            expect(statsResponse.body.data).toHaveProperty('totalEvents');
        }));
        it('should provide system notification statistics', () => __awaiter(void 0, void 0, void 0, function* () {
            const statsResponse = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/notifications/system/stats')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(statsResponse.body.success).toBe(true);
            expect(statsResponse.body.data).toHaveProperty('connectedUsers');
        }));
        it('should generate compliance report', () => __awaiter(void 0, void 0, void 0, function* () {
            const reportResponse = yield (0, supertest_1.default)(app_1.app)
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
        }));
    });
});
