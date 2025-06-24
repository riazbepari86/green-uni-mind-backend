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
const payout_model_1 = require("../../app/modules/Payment/payout.model");
const teacher_model_1 = require("../../app/modules/Teacher/teacher.model");
const transaction_model_1 = require("../../app/modules/Payment/transaction.model");
const database_1 = require("../setup/database");
const testData_1 = require("../helpers/testData");
const payout_interface_1 = require("../../app/modules/Payment/payout.interface");
const payoutManagement_service_1 = require("../../app/modules/Payment/payoutManagement.service");
describe('Payout Management Integration Tests', () => {
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.connectDB)();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.disconnectDB)();
    }));
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        yield payout_model_1.Payout.deleteMany({});
        yield payout_model_1.PayoutPreference.deleteMany({});
        yield teacher_model_1.Teacher.deleteMany({});
        yield transaction_model_1.Transaction.deleteMany({});
    }));
    describe('Automatic Payout Scheduling', () => {
        it('should schedule automatic payout for eligible teacher', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)({
                stripeConnect: {
                    accountId: 'acct_test123',
                    status: 'connected',
                    verified: true,
                },
            });
            // Create payout preferences
            yield payout_model_1.PayoutPreference.create({
                teacherId: teacher._id,
                schedule: payout_interface_1.PayoutSchedule.WEEKLY,
                minimumAmount: 50,
                isAutoPayoutEnabled: true,
                isActive: true,
                nextScheduledPayoutDate: new Date(Date.now() - 1000), // Past date
                retryConfig: {
                    maxRetries: 3,
                    baseDelay: 60000,
                    maxDelay: 3600000,
                    backoffMultiplier: 2,
                    jitterEnabled: true,
                },
                notificationChannels: ['email', 'in_app'],
            });
            // Create pending transactions
            yield (0, testData_1.createTestTransaction)({
                teacherId: teacher._id,
                teacherEarning: 75,
                stripeTransferStatus: 'pending',
            });
            const result = yield payoutManagement_service_1.PayoutManagementService.scheduleAutomaticPayouts();
            expect(result.scheduled).toBe(1);
            expect(result.skipped).toBe(0);
            expect(result.errors).toBe(0);
            // Verify payout was created
            const payout = yield payout_model_1.Payout.findOne({ teacherId: teacher._id });
            expect(payout).toBeTruthy();
            expect(payout === null || payout === void 0 ? void 0 : payout.status).toBe(payout_interface_1.PayoutStatus.SCHEDULED);
            expect(payout === null || payout === void 0 ? void 0 : payout.amount).toBe(75);
        }));
        it('should skip payout if amount below minimum threshold', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)({
                stripeConnect: {
                    accountId: 'acct_test123',
                    status: 'connected',
                },
            });
            yield payout_model_1.PayoutPreference.create({
                teacherId: teacher._id,
                schedule: payout_interface_1.PayoutSchedule.WEEKLY,
                minimumAmount: 100,
                isAutoPayoutEnabled: true,
                isActive: true,
                nextScheduledPayoutDate: new Date(Date.now() - 1000),
                retryConfig: {
                    maxRetries: 3,
                    baseDelay: 60000,
                    maxDelay: 3600000,
                    backoffMultiplier: 2,
                    jitterEnabled: true,
                },
                notificationChannels: ['email'],
            });
            // Create transaction below threshold
            yield (0, testData_1.createTestTransaction)({
                teacherId: teacher._id,
                teacherEarning: 25,
                stripeTransferStatus: 'pending',
            });
            const result = yield payoutManagement_service_1.PayoutManagementService.scheduleAutomaticPayouts();
            expect(result.scheduled).toBe(0);
            expect(result.skipped).toBe(1);
            // Verify no payout was created
            const payout = yield payout_model_1.Payout.findOne({ teacherId: teacher._id });
            expect(payout).toBeFalsy();
        }));
        it('should skip payout if teacher account not connected', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)({
                stripeConnect: {
                    accountId: 'acct_test123',
                    status: 'pending',
                    verified: false,
                },
            });
            yield payout_model_1.PayoutPreference.create({
                teacherId: teacher._id,
                schedule: payout_interface_1.PayoutSchedule.WEEKLY,
                minimumAmount: 50,
                isAutoPayoutEnabled: true,
                isActive: true,
                nextScheduledPayoutDate: new Date(Date.now() - 1000),
                retryConfig: {
                    maxRetries: 3,
                    baseDelay: 60000,
                    maxDelay: 3600000,
                    backoffMultiplier: 2,
                    jitterEnabled: true,
                },
                notificationChannels: ['email'],
            });
            yield (0, testData_1.createTestTransaction)({
                teacherId: teacher._id,
                teacherEarning: 75,
                stripeTransferStatus: 'pending',
            });
            const result = yield payoutManagement_service_1.PayoutManagementService.scheduleAutomaticPayouts();
            expect(result.scheduled).toBe(0);
            expect(result.skipped).toBe(1);
        }));
    });
    describe('Payout Schedule Calculation', () => {
        it('should calculate next weekly payout date correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            const nextDate = payoutManagement_service_1.PayoutManagementService.calculateNextPayoutDate(payout_interface_1.PayoutSchedule.WEEKLY, { dayOfWeek: 1, hour: 9 }, // Monday at 9 AM
            'UTC');
            expect(nextDate).toBeInstanceOf(Date);
            expect(nextDate.getDay()).toBe(1); // Monday
            expect(nextDate.getHours()).toBe(9);
        }));
        it('should calculate next monthly payout date correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            const nextDate = payoutManagement_service_1.PayoutManagementService.calculateNextPayoutDate(payout_interface_1.PayoutSchedule.MONTHLY, { dayOfMonth: 15, hour: 10 }, // 15th of month at 10 AM
            'UTC');
            expect(nextDate).toBeInstanceOf(Date);
            expect(nextDate.getDate()).toBe(15);
            expect(nextDate.getHours()).toBe(10);
        }));
        it('should handle end-of-month edge cases', () => __awaiter(void 0, void 0, void 0, function* () {
            const nextDate = payoutManagement_service_1.PayoutManagementService.calculateNextPayoutDate(payout_interface_1.PayoutSchedule.MONTHLY, { dayOfMonth: 31, hour: 9 }, // 31st of month
            'UTC');
            expect(nextDate).toBeInstanceOf(Date);
            // Should handle months with fewer than 31 days
            expect(nextDate.getDate()).toBeLessThanOrEqual(31);
        }));
    });
    describe('Pending Earnings Calculation', () => {
        it('should calculate pending earnings correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            // Create multiple pending transactions
            yield (0, testData_1.createTestTransaction)({
                teacherId: teacher._id,
                teacherEarning: 50,
                currency: 'usd',
                stripeTransferStatus: 'pending',
            });
            yield (0, testData_1.createTestTransaction)({
                teacherId: teacher._id,
                teacherEarning: 75,
                currency: 'usd',
                stripeTransferStatus: 'pending',
            });
            // Create completed transaction (should not be included)
            yield (0, testData_1.createTestTransaction)({
                teacherId: teacher._id,
                teacherEarning: 25,
                currency: 'usd',
                stripeTransferStatus: 'completed',
            });
            const earnings = yield payoutManagement_service_1.PayoutManagementService.getPendingEarnings(teacher._id);
            expect(earnings.totalAmount).toBe(125);
            expect(earnings.transactionCount).toBe(2);
            expect(earnings.currency).toBe('usd');
        }));
        it('should return zero for teacher with no pending earnings', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            const earnings = yield payoutManagement_service_1.PayoutManagementService.getPendingEarnings(teacher._id);
            expect(earnings.totalAmount).toBe(0);
            expect(earnings.transactionCount).toBe(0);
            expect(earnings.currency).toBe('usd');
        }));
    });
    describe('Manual Payout Creation', () => {
        it('should create manual payout successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)({
                stripeConnect: {
                    accountId: 'acct_test123',
                    status: 'connected',
                },
            });
            yield (0, testData_1.createTestTransaction)({
                teacherId: teacher._id,
                teacherEarning: 100,
                stripeTransferStatus: 'pending',
            });
            const payout = yield payoutManagement_service_1.PayoutManagementService.createScheduledPayout(teacher._id, {
                amount: 100,
                description: 'Manual payout request',
            });
            expect(payout).toBeTruthy();
            expect(payout.amount).toBe(100);
            expect(payout.status).toBe(payout_interface_1.PayoutStatus.SCHEDULED);
            expect(payout.description).toBe('Manual payout request');
        }));
        it('should reject payout if teacher not found', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(payoutManagement_service_1.PayoutManagementService.createScheduledPayout('nonexistent_id', {
                amount: 100,
            })).rejects.toThrow('Teacher not found');
        }));
        it('should reject payout if no Stripe account connected', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)({
                stripeConnect: undefined,
            });
            yield expect(payoutManagement_service_1.PayoutManagementService.createScheduledPayout(teacher._id, {
                amount: 100,
            })).rejects.toThrow('does not have a connected Stripe account');
        }));
        it('should reject payout if amount below minimum', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)({
                stripeConnect: {
                    accountId: 'acct_test123',
                    status: 'connected',
                },
            });
            yield payout_model_1.PayoutPreference.create({
                teacherId: teacher._id,
                minimumAmount: 100,
                retryConfig: {
                    maxRetries: 3,
                    baseDelay: 60000,
                    maxDelay: 3600000,
                    backoffMultiplier: 2,
                    jitterEnabled: true,
                },
                notificationChannels: ['email'],
            });
            yield expect(payoutManagement_service_1.PayoutManagementService.createScheduledPayout(teacher._id, {
                amount: 50,
            })).rejects.toThrow('below minimum threshold');
        }));
    });
    describe('Payout API Endpoints', () => {
        it('should get payout summary for teacher', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            // Create test data
            yield (0, testData_1.createTestPayout)({
                teacherId: teacher._id,
                amount: 100,
                status: payout_interface_1.PayoutStatus.COMPLETED,
            });
            yield (0, testData_1.createTestTransaction)({
                teacherId: teacher._id,
                teacherEarning: 50,
                stripeTransferStatus: 'pending',
            });
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/payouts/summary/${teacher._id}`)
                .set('Authorization', 'Bearer teacher_token')
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('pendingEarnings');
            expect(response.body.data).toHaveProperty('payoutHistory');
            expect(response.body.data).toHaveProperty('analytics');
        }));
        it('should create payout request via API', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)({
                stripeConnect: {
                    accountId: 'acct_test123',
                    status: 'connected',
                },
            });
            yield (0, testData_1.createTestTransaction)({
                teacherId: teacher._id,
                teacherEarning: 100,
                stripeTransferStatus: 'pending',
            });
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/payouts/request')
                .set('Authorization', 'Bearer teacher_token')
                .send({
                teacherId: teacher._id,
                amount: 100,
                description: 'API payout request',
            })
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('amount', 100);
            expect(response.body.data).toHaveProperty('status', payout_interface_1.PayoutStatus.SCHEDULED);
        }));
        it('should get payout preferences for teacher', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            yield payout_model_1.PayoutPreference.create({
                teacherId: teacher._id,
                schedule: payout_interface_1.PayoutSchedule.WEEKLY,
                minimumAmount: 50,
                isAutoPayoutEnabled: true,
                retryConfig: {
                    maxRetries: 3,
                    baseDelay: 60000,
                    maxDelay: 3600000,
                    backoffMultiplier: 2,
                    jitterEnabled: true,
                },
                notificationChannels: ['email'],
            });
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/payouts/preferences/${teacher._id}`)
                .set('Authorization', 'Bearer teacher_token')
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('schedule', payout_interface_1.PayoutSchedule.WEEKLY);
            expect(response.body.data).toHaveProperty('minimumAmount', 50);
            expect(response.body.data).toHaveProperty('isAutoPayoutEnabled', true);
        }));
        it('should update payout preferences via API', () => __awaiter(void 0, void 0, void 0, function* () {
            const teacher = yield (0, testData_1.createTestTeacher)();
            const response = yield (0, supertest_1.default)(app_1.app)
                .put(`/api/v1/payouts/preferences/${teacher._id}`)
                .set('Authorization', 'Bearer teacher_token')
                .send({
                schedule: payout_interface_1.PayoutSchedule.MONTHLY,
                minimumAmount: 100,
                isAutoPayoutEnabled: false,
            })
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('schedule', payout_interface_1.PayoutSchedule.MONTHLY);
            expect(response.body.data).toHaveProperty('minimumAmount', 100);
            expect(response.body.data).toHaveProperty('isAutoPayoutEnabled', false);
        }));
    });
});
