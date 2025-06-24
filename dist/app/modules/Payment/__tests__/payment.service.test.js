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
const globals_1 = require("@jest/globals");
const stripe_1 = __importDefault(require("stripe"));
const mongoose_1 = __importDefault(require("mongoose"));
const payment_service_1 = require("../payment.service");
const student_model_1 = require("../../Student/student.model");
const teacher_model_1 = require("../../Teacher/teacher.model");
const course_model_1 = require("../../Course/course.model");
const payment_model_1 = require("../payment.model");
const transaction_model_1 = require("../transaction.model");
const payoutSummary_model_1 = require("../payoutSummary.model");
// Mock Stripe
globals_1.jest.mock('stripe');
const MockedStripe = stripe_1.default;
// Mock models
globals_1.jest.mock('../../Student/student.model');
globals_1.jest.mock('../../Teacher/teacher.model');
globals_1.jest.mock('../../Course/course.model');
globals_1.jest.mock('../payment.model');
globals_1.jest.mock('../transaction.model');
globals_1.jest.mock('../payoutSummary.model');
(0, globals_1.describe)('PaymentService', () => {
    let mockStripe;
    let mockSession;
    (0, globals_1.beforeEach)(() => {
        // Reset all mocks
        globals_1.jest.clearAllMocks();
        // Mock Stripe instance
        mockStripe = {
            paymentIntents: {
                create: globals_1.jest.fn(),
                retrieve: globals_1.jest.fn(),
            },
            checkout: {
                sessions: {
                    list: globals_1.jest.fn(),
                },
            },
            customers: {
                list: globals_1.jest.fn(),
                create: globals_1.jest.fn(),
            },
            invoices: {
                create: globals_1.jest.fn(),
                finalizeInvoice: globals_1.jest.fn(),
                retrieve: globals_1.jest.fn(),
            },
            invoiceItems: {
                create: globals_1.jest.fn(),
            },
        };
        MockedStripe.mockImplementation(() => mockStripe);
        // Mock mongoose session
        mockSession = {
            startTransaction: globals_1.jest.fn(),
            commitTransaction: globals_1.jest.fn(),
            abortTransaction: globals_1.jest.fn(),
            endSession: globals_1.jest.fn(),
        };
        mongoose_1.default.startSession.mockResolvedValue(mockSession);
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks();
    });
    (0, globals_1.describe)('createPaymentIntent', () => {
        const mockStudent = {
            _id: 'student123',
            email: 'student@test.com',
            enrolledCourses: [],
        };
        const mockCourse = {
            _id: 'course123',
            title: 'Test Course',
            creator: 'teacher123',
            price: 100,
        };
        const mockTeacher = {
            _id: 'teacher123',
            name: { firstName: 'John', lastName: 'Doe' },
            stripeAccountId: 'acct_123',
        };
        (0, globals_1.beforeEach)(() => {
            student_model_1.Student.findById.mockResolvedValue(mockStudent);
            course_model_1.Course.findById.mockResolvedValue(mockCourse);
            teacher_model_1.Teacher.findById.mockResolvedValue(mockTeacher);
        });
        (0, globals_1.it)('should create a payment intent successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockPaymentIntent = {
                id: 'pi_123',
                client_secret: 'pi_123_secret',
            };
            mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
            mockStripe.paymentIntents.retrieve.mockResolvedValue(Object.assign(Object.assign({}, mockPaymentIntent), { charges: [] }));
            const result = yield payment_service_1.PaymentService.createPaymentIntent('student123', 'course123', 100);
            (0, globals_1.expect)(result).toEqual({
                clientSecret: 'pi_123_secret',
                paymentIntentId: 'pi_123',
            });
            (0, globals_1.expect)(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
                amount: 10000, // $100 in cents
                currency: 'usd',
                metadata: {
                    studentId: 'student123',
                    courseId: 'course123',
                    teacherId: 'teacher123',
                    teacherShare: 70,
                    organizationShare: 30,
                },
            });
        }));
        (0, globals_1.it)('should throw error if student not found', () => __awaiter(void 0, void 0, void 0, function* () {
            student_model_1.Student.findById.mockResolvedValue(null);
            yield (0, globals_1.expect)(payment_service_1.PaymentService.createPaymentIntent('invalid', 'course123', 100)).rejects.toThrow('Student, course, or teacher not found');
        }));
        (0, globals_1.it)('should throw error if student already enrolled', () => __awaiter(void 0, void 0, void 0, function* () {
            const enrolledStudent = Object.assign(Object.assign({}, mockStudent), { enrolledCourses: [{ courseId: 'course123' }] });
            student_model_1.Student.findById.mockResolvedValue(enrolledStudent);
            yield (0, globals_1.expect)(payment_service_1.PaymentService.createPaymentIntent('student123', 'course123', 100)).rejects.toThrow('Already enrolled in this course');
        }));
        (0, globals_1.it)('should handle Stripe errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockStripe.paymentIntents.create.mockRejectedValue(new Error('Stripe error'));
            yield (0, globals_1.expect)(payment_service_1.PaymentService.createPaymentIntent('student123', 'course123', 100)).rejects.toThrow('Stripe error');
        }));
    });
    (0, globals_1.describe)('processCheckoutSessionCompleted', () => {
        const mockCheckoutSession = {
            id: 'cs_123',
            payment_intent: 'pi_123',
            payment_status: 'paid',
            amount_total: 10000,
            customer_details: { email: 'student@test.com' },
            metadata: {
                courseId: 'course123',
                studentId: 'student123',
                teacherId: 'teacher123',
                teacherShare: '7000',
                platformFee: '3000',
                version: '1.0',
            },
        };
        const mockStudent = {
            _id: 'student123',
            email: 'student@test.com',
            enrolledCourses: [],
        };
        const mockCourse = {
            _id: 'course123',
            title: 'Test Course',
            creator: 'teacher123',
        };
        const mockTeacher = {
            _id: 'teacher123',
            name: { firstName: 'John', lastName: 'Doe' },
            stripeAccountId: 'acct_123',
        };
        (0, globals_1.beforeEach)(() => {
            student_model_1.Student.findById.mockResolvedValue(mockStudent);
            course_model_1.Course.findById.mockResolvedValue(mockCourse);
            teacher_model_1.Teacher.findById.mockResolvedValue(mockTeacher);
            payment_model_1.Payment.create.mockResolvedValue([{ _id: 'payment123' }]);
            transaction_model_1.Transaction.create.mockResolvedValue([{ _id: 'transaction123' }]);
            payoutSummary_model_1.PayoutSummary.findOne.mockResolvedValue(null);
            payoutSummary_model_1.PayoutSummary.create.mockResolvedValue([{ _id: 'payout123' }]);
            student_model_1.Student.findByIdAndUpdate.mockResolvedValue(mockStudent);
            course_model_1.Course.findByIdAndUpdate.mockResolvedValue(mockCourse);
            teacher_model_1.Teacher.findByIdAndUpdate.mockResolvedValue(mockTeacher);
        });
        (0, globals_1.it)('should process checkout session successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield payment_service_1.PaymentService.processCheckoutSessionCompleted(mockCheckoutSession);
            (0, globals_1.expect)(result).toEqual({
                success: true,
                message: 'Payment processed successfully',
            });
            (0, globals_1.expect)(mockSession.startTransaction).toHaveBeenCalled();
            (0, globals_1.expect)(mockSession.commitTransaction).toHaveBeenCalled();
            (0, globals_1.expect)(mockSession.endSession).toHaveBeenCalled();
        }));
        (0, globals_1.it)('should handle missing metadata gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            const sessionWithoutMetadata = Object.assign(Object.assign({}, mockCheckoutSession), { metadata: {} });
            yield (0, globals_1.expect)(payment_service_1.PaymentService.processCheckoutSessionCompleted(sessionWithoutMetadata)).rejects.toThrow('Missing required metadata');
        }));
        (0, globals_1.it)('should handle already enrolled student', () => __awaiter(void 0, void 0, void 0, function* () {
            const enrolledStudent = Object.assign(Object.assign({}, mockStudent), { enrolledCourses: [{ courseId: 'course123' }] });
            student_model_1.Student.findById.mockResolvedValue(enrolledStudent);
            const result = yield payment_service_1.PaymentService.processCheckoutSessionCompleted(mockCheckoutSession);
            (0, globals_1.expect)(result).toEqual({
                success: true,
                message: 'Student already enrolled',
            });
        }));
        (0, globals_1.it)('should rollback transaction on error', () => __awaiter(void 0, void 0, void 0, function* () {
            payment_model_1.Payment.create.mockRejectedValue(new Error('Database error'));
            yield (0, globals_1.expect)(payment_service_1.PaymentService.processCheckoutSessionCompleted(mockCheckoutSession)).rejects.toThrow('Database error');
            (0, globals_1.expect)(mockSession.abortTransaction).toHaveBeenCalled();
            (0, globals_1.expect)(mockSession.endSession).toHaveBeenCalled();
        }));
        (0, globals_1.it)('should update existing payout summary', () => __awaiter(void 0, void 0, void 0, function* () {
            const existingPayoutSummary = {
                _id: 'existing123',
                totalEarned: 50,
                transactions: [],
                coursesSold: [],
                save: globals_1.jest.fn(),
            };
            payoutSummary_model_1.PayoutSummary.findOne.mockResolvedValue(existingPayoutSummary);
            yield payment_service_1.PaymentService.processCheckoutSessionCompleted(mockCheckoutSession);
            (0, globals_1.expect)(existingPayoutSummary.save).toHaveBeenCalled();
            (0, globals_1.expect)(existingPayoutSummary.totalEarned).toBe(120); // 50 + 70
        }));
    });
    (0, globals_1.describe)('validateSessionMetadata', () => {
        (0, globals_1.it)('should validate correct metadata', () => {
            const session = {
                id: 'cs_123',
                amount_total: 10000,
                metadata: {
                    courseId: '507f1f77bcf86cd799439011',
                    studentId: '507f1f77bcf86cd799439012',
                    teacherId: '507f1f77bcf86cd799439013',
                    teacherShare: '7000',
                    platformFee: '3000',
                    version: '1.0',
                },
            };
            const result = payment_service_1.PaymentService.validateSessionMetadata(session);
            (0, globals_1.expect)(result).toEqual({
                courseId: '507f1f77bcf86cd799439011',
                studentId: '507f1f77bcf86cd799439012',
                teacherId: '507f1f77bcf86cd799439013',
                teacherShareCents: 7000,
                platformFeeCents: 3000,
                teacherShareDollars: 70,
                platformFeeDollars: 30,
                totalAmountDollars: 100,
                version: '1.0',
            });
        });
        (0, globals_1.it)('should throw error for missing required fields', () => {
            const session = {
                id: 'cs_123',
                metadata: {
                    courseId: '507f1f77bcf86cd799439011',
                    // Missing studentId and teacherId
                },
            };
            (0, globals_1.expect)(() => payment_service_1.PaymentService.validateSessionMetadata(session))
                .toThrow('Missing required metadata');
        });
        (0, globals_1.it)('should throw error for invalid ObjectIds', () => {
            const session = {
                id: 'cs_123',
                metadata: {
                    courseId: 'invalid-id',
                    studentId: '507f1f77bcf86cd799439012',
                    teacherId: '507f1f77bcf86cd799439013',
                },
            };
            (0, globals_1.expect)(() => payment_service_1.PaymentService.validateSessionMetadata(session))
                .toThrow('Invalid ObjectId');
        });
        (0, globals_1.it)('should warn about payment split mismatch', () => {
            const consoleSpy = globals_1.jest.spyOn(console, 'warn').mockImplementation();
            const session = {
                id: 'cs_123',
                amount_total: 10000,
                metadata: {
                    courseId: '507f1f77bcf86cd799439011',
                    studentId: '507f1f77bcf86cd799439012',
                    teacherId: '507f1f77bcf86cd799439013',
                    teacherShare: '6000', // Should be 7000
                    platformFee: '3000',
                },
            };
            payment_service_1.PaymentService.validateSessionMetadata(session);
            (0, globals_1.expect)(consoleSpy).toHaveBeenCalledWith(globals_1.expect.stringContaining('Payment split mismatch'), globals_1.expect.any(Object));
            consoleSpy.mockRestore();
        });
    });
    (0, globals_1.describe)('retryOperation', () => {
        (0, globals_1.it)('should succeed on first attempt', () => __awaiter(void 0, void 0, void 0, function* () {
            const operation = globals_1.jest.fn().mockResolvedValue('success');
            const result = yield payment_service_1.PaymentService.retryOperation(operation);
            (0, globals_1.expect)(result).toBe('success');
            (0, globals_1.expect)(operation).toHaveBeenCalledTimes(1);
        }));
        (0, globals_1.it)('should retry on failure and eventually succeed', () => __awaiter(void 0, void 0, void 0, function* () {
            const operation = globals_1.jest.fn()
                .mockRejectedValueOnce(new Error('First failure'))
                .mockRejectedValueOnce(new Error('Second failure'))
                .mockResolvedValue('success');
            const result = yield payment_service_1.PaymentService.retryOperation(operation, 3, 10);
            (0, globals_1.expect)(result).toBe('success');
            (0, globals_1.expect)(operation).toHaveBeenCalledTimes(3);
        }));
        (0, globals_1.it)('should throw error after max retries', () => __awaiter(void 0, void 0, void 0, function* () {
            const operation = globals_1.jest.fn().mockRejectedValue(new Error('Persistent failure'));
            yield (0, globals_1.expect)(payment_service_1.PaymentService.retryOperation(operation, 2, 10)).rejects.toThrow('Persistent failure');
            (0, globals_1.expect)(operation).toHaveBeenCalledTimes(2);
        }));
    });
});
