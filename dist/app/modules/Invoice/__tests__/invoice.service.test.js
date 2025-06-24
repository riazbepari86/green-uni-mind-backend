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
const invoice_service_1 = require("../invoice.service");
const student_model_1 = require("../../Student/student.model");
const course_model_1 = require("../../Course/course.model");
const transaction_model_1 = require("../../Payment/transaction.model");
const sendEmail_1 = require("../../../utils/sendEmail");
// Mock Stripe
globals_1.jest.mock('stripe');
const MockedStripe = stripe_1.default;
// Mock models
globals_1.jest.mock('../../Student/student.model');
globals_1.jest.mock('../../Teacher/teacher.model');
globals_1.jest.mock('../../Course/course.model');
globals_1.jest.mock('../../Payment/transaction.model');
globals_1.jest.mock('../../../utils/sendEmail');
(0, globals_1.describe)('InvoiceService', () => {
    let mockStripe;
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
        mockStripe = {
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
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks();
    });
    (0, globals_1.describe)('createStripeInvoice', () => {
        const mockStudent = {
            _id: 'student123',
            email: 'student@test.com',
            name: { firstName: 'John', lastName: 'Doe' },
        };
        const mockCourse = {
            _id: 'course123',
            title: 'Test Course',
            creator: {
                _id: 'teacher123',
                name: { firstName: 'Jane', lastName: 'Smith' },
            },
        };
        const mockTransaction = {
            _id: 'transaction123',
            totalAmount: 100,
        };
        (0, globals_1.beforeEach)(() => {
            student_model_1.Student.findById.mockResolvedValue(mockStudent);
            course_model_1.Course.findById.mockResolvedValue(mockCourse);
            transaction_model_1.Transaction.findById.mockResolvedValue(mockTransaction);
            transaction_model_1.Transaction.findByIdAndUpdate.mockResolvedValue(mockTransaction);
        });
        (0, globals_1.it)('should create invoice successfully for new customer', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockCustomer = {
                id: 'cus_123',
                email: 'student@test.com',
            };
            const mockInvoice = {
                id: 'in_123',
                hosted_invoice_url: 'https://invoice.stripe.com/123',
                invoice_pdf: 'https://invoice.stripe.com/123.pdf',
                status: 'open',
            };
            const mockFinalizedInvoice = Object.assign(Object.assign({}, mockInvoice), { status: 'open' });
            mockStripe.customers.list.mockResolvedValue({ data: [] });
            mockStripe.customers.create.mockResolvedValue(mockCustomer);
            mockStripe.invoices.create.mockResolvedValue(mockInvoice);
            mockStripe.invoiceItems.create.mockResolvedValue({});
            mockStripe.invoices.finalizeInvoice.mockResolvedValue(mockFinalizedInvoice);
            const result = yield invoice_service_1.InvoiceService.createStripeInvoice('student123', 'course123', 'transaction123', 100, 'acct_teacher123');
            (0, globals_1.expect)(result).toEqual({
                invoiceId: 'in_123',
                invoiceUrl: 'https://invoice.stripe.com/123',
                pdfUrl: 'https://invoice.stripe.com/123.pdf',
                status: 'open',
                customer: mockCustomer,
            });
            (0, globals_1.expect)(mockStripe.customers.create).toHaveBeenCalledWith({
                email: 'student@test.com',
                name: 'John Doe',
                metadata: {
                    studentId: 'student123',
                    platform: 'LMS',
                },
            });
            (0, globals_1.expect)(mockStripe.invoices.create).toHaveBeenCalledWith({
                customer: 'cus_123',
                currency: 'usd',
                collection_method: 'send_invoice',
                auto_advance: true,
                days_until_due: 7,
                footer: 'Thank you for your purchase! For support, contact us at support@yourlms.com',
                metadata: {
                    studentId: 'student123',
                    courseId: 'course123',
                    transactionId: 'transaction123',
                    teacherId: 'teacher123',
                    platform: 'LMS',
                    invoiceType: 'course_enrollment',
                },
                on_behalf_of: 'acct_teacher123',
                transfer_data: {
                    destination: 'acct_teacher123',
                },
            });
        }));
        (0, globals_1.it)('should use existing customer if found', () => __awaiter(void 0, void 0, void 0, function* () {
            const existingCustomer = {
                id: 'cus_existing',
                email: 'student@test.com',
            };
            const mockInvoice = {
                id: 'in_123',
                hosted_invoice_url: 'https://invoice.stripe.com/123',
                invoice_pdf: 'https://invoice.stripe.com/123.pdf',
                status: 'open',
            };
            mockStripe.customers.list.mockResolvedValue({ data: [existingCustomer] });
            mockStripe.invoices.create.mockResolvedValue(mockInvoice);
            mockStripe.invoiceItems.create.mockResolvedValue({});
            mockStripe.invoices.finalizeInvoice.mockResolvedValue(mockInvoice);
            yield invoice_service_1.InvoiceService.createStripeInvoice('student123', 'course123', 'transaction123', 100, 'acct_teacher123');
            (0, globals_1.expect)(mockStripe.customers.create).not.toHaveBeenCalled();
            (0, globals_1.expect)(mockStripe.invoices.create).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                customer: 'cus_existing',
            }));
        }));
        (0, globals_1.it)('should throw error for missing parameters', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, globals_1.expect)(invoice_service_1.InvoiceService.createStripeInvoice('', 'course123', 'transaction123', 100, 'acct_teacher123')).rejects.toThrow('Missing required parameters for invoice creation');
        }));
        (0, globals_1.it)('should throw error if student not found', () => __awaiter(void 0, void 0, void 0, function* () {
            student_model_1.Student.findById.mockResolvedValue(null);
            yield (0, globals_1.expect)(invoice_service_1.InvoiceService.createStripeInvoice('invalid', 'course123', 'transaction123', 100, 'acct_teacher123')).rejects.toThrow('Student not found');
        }));
        (0, globals_1.it)('should handle Stripe customer creation error', () => __awaiter(void 0, void 0, void 0, function* () {
            mockStripe.customers.list.mockResolvedValue({ data: [] });
            mockStripe.customers.create.mockRejectedValue(new Error('Stripe customer error'));
            yield (0, globals_1.expect)(invoice_service_1.InvoiceService.createStripeInvoice('student123', 'course123', 'transaction123', 100, 'acct_teacher123')).rejects.toThrow('Failed to create or retrieve customer');
        }));
        (0, globals_1.it)('should handle invoice creation error', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockCustomer = { id: 'cus_123', email: 'student@test.com' };
            mockStripe.customers.list.mockResolvedValue({ data: [mockCustomer] });
            mockStripe.invoices.create.mockRejectedValue(new Error('Invoice creation failed'));
            yield (0, globals_1.expect)(invoice_service_1.InvoiceService.createStripeInvoice('student123', 'course123', 'transaction123', 100, 'acct_teacher123')).rejects.toThrow('Failed to create invoice');
        }));
    });
    (0, globals_1.describe)('sendInvoiceEmail', () => {
        (0, globals_1.it)('should send invoice email successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            sendEmail_1.sendEmail.mockResolvedValue(true);
            const result = yield invoice_service_1.InvoiceService.sendInvoiceEmail('student@test.com', 'John Doe', 'Test Course', 'Jane Smith', 'https://invoice.stripe.com/123', 'https://invoice.stripe.com/123.pdf', 100);
            (0, globals_1.expect)(result).toEqual({ success: true });
            (0, globals_1.expect)(sendEmail_1.sendEmail).toHaveBeenCalledWith({
                to: 'student@test.com',
                subject: 'Invoice for Test Course - Course Enrollment',
                html: globals_1.expect.stringContaining('John Doe'),
            });
        }));
        (0, globals_1.it)('should handle email sending error', () => __awaiter(void 0, void 0, void 0, function* () {
            sendEmail_1.sendEmail.mockRejectedValue(new Error('Email sending failed'));
            yield (0, globals_1.expect)(invoice_service_1.InvoiceService.sendInvoiceEmail('student@test.com', 'John Doe', 'Test Course', 'Jane Smith', 'https://invoice.stripe.com/123', 'https://invoice.stripe.com/123.pdf', 100)).rejects.toThrow('Failed to send invoice email');
        }));
    });
    (0, globals_1.describe)('processInvoiceGeneration', () => {
        const mockStudent = {
            _id: 'student123',
            email: 'student@test.com',
            name: { firstName: 'John', lastName: 'Doe' },
        };
        const mockCourse = {
            _id: 'course123',
            title: 'Test Course',
            creator: {
                _id: 'teacher123',
                name: { firstName: 'Jane', lastName: 'Smith' },
            },
        };
        (0, globals_1.beforeEach)(() => {
            student_model_1.Student.findById.mockResolvedValue(mockStudent);
            course_model_1.Course.findById.mockResolvedValue(mockCourse);
        });
        (0, globals_1.it)('should process invoice generation successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockInvoiceResult = {
                invoiceId: 'in_123',
                invoiceUrl: 'https://invoice.stripe.com/123',
                pdfUrl: 'https://invoice.stripe.com/123.pdf',
                status: 'open',
                customer: { id: 'cus_123' },
            };
            // Mock the createStripeInvoice method
            globals_1.jest.spyOn(invoice_service_1.InvoiceService, 'createStripeInvoice').mockResolvedValue(mockInvoiceResult);
            globals_1.jest.spyOn(invoice_service_1.InvoiceService, 'sendInvoiceEmail').mockResolvedValue({ success: true });
            const result = yield invoice_service_1.InvoiceService.processInvoiceGeneration('student123', 'course123', 'transaction123', 100, 'acct_teacher123');
            (0, globals_1.expect)(result).toEqual(mockInvoiceResult);
            (0, globals_1.expect)(invoice_service_1.InvoiceService.createStripeInvoice).toHaveBeenCalledWith('student123', 'course123', 'transaction123', 100, 'acct_teacher123');
            (0, globals_1.expect)(invoice_service_1.InvoiceService.sendInvoiceEmail).toHaveBeenCalledWith('student@test.com', 'John Doe', 'Test Course', 'Jane Smith', 'https://invoice.stripe.com/123', 'https://invoice.stripe.com/123.pdf', 100);
        }));
        (0, globals_1.it)('should handle missing student or course', () => __awaiter(void 0, void 0, void 0, function* () {
            student_model_1.Student.findById.mockResolvedValue(null);
            yield (0, globals_1.expect)(invoice_service_1.InvoiceService.processInvoiceGeneration('invalid', 'course123', 'transaction123', 100, 'acct_teacher123')).rejects.toThrow('Student or course not found');
        }));
    });
    (0, globals_1.describe)('getInvoiceByTransactionId', () => {
        (0, globals_1.it)('should retrieve invoice successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockTransaction = {
                _id: 'transaction123',
                stripeInvoiceId: 'in_123',
            };
            const mockInvoice = {
                id: 'in_123',
                hosted_invoice_url: 'https://invoice.stripe.com/123',
                invoice_pdf: 'https://invoice.stripe.com/123.pdf',
                status: 'paid',
                amount_paid: 10000,
                created: 1640995200, // Unix timestamp
            };
            transaction_model_1.Transaction.findById.mockResolvedValue(mockTransaction);
            mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice);
            const result = yield invoice_service_1.InvoiceService.getInvoiceByTransactionId('transaction123');
            (0, globals_1.expect)(result).toEqual({
                invoiceId: 'in_123',
                invoiceUrl: 'https://invoice.stripe.com/123',
                pdfUrl: 'https://invoice.stripe.com/123.pdf',
                status: 'paid',
                amount: 100,
                created: new Date(1640995200 * 1000),
            });
        }));
        (0, globals_1.it)('should throw error if transaction not found', () => __awaiter(void 0, void 0, void 0, function* () {
            transaction_model_1.Transaction.findById.mockResolvedValue(null);
            yield (0, globals_1.expect)(invoice_service_1.InvoiceService.getInvoiceByTransactionId('invalid')).rejects.toThrow('Transaction not found');
        }));
        (0, globals_1.it)('should throw error if invoice not found for transaction', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockTransaction = {
                _id: 'transaction123',
                stripeInvoiceId: null,
            };
            transaction_model_1.Transaction.findById.mockResolvedValue(mockTransaction);
            yield (0, globals_1.expect)(invoice_service_1.InvoiceService.getInvoiceByTransactionId('transaction123')).rejects.toThrow('Invoice not found for this transaction');
        }));
    });
    (0, globals_1.describe)('getStudentInvoices', () => {
        (0, globals_1.it)('should retrieve student invoices successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockTransactions = [
                {
                    _id: 'transaction123',
                    stripeInvoiceId: 'in_123',
                    courseId: { title: 'Test Course' },
                    teacherId: { name: 'Jane Smith' },
                },
            ];
            const mockInvoice = {
                id: 'in_123',
                hosted_invoice_url: 'https://invoice.stripe.com/123',
                invoice_pdf: 'https://invoice.stripe.com/123.pdf',
                status: 'paid',
                amount_paid: 10000,
                created: 1640995200,
            };
            transaction_model_1.Transaction.find.mockReturnValue({
                populate: globals_1.jest.fn().mockReturnValue({
                    populate: globals_1.jest.fn().mockReturnValue({
                        sort: globals_1.jest.fn().mockResolvedValue(mockTransactions),
                    }),
                }),
            });
            mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice);
            const result = yield invoice_service_1.InvoiceService.getStudentInvoices('student123');
            (0, globals_1.expect)(result).toHaveLength(1);
            (0, globals_1.expect)(result[0]).toEqual({
                transactionId: 'transaction123',
                invoiceId: 'in_123',
                invoiceUrl: 'https://invoice.stripe.com/123',
                pdfUrl: 'https://invoice.stripe.com/123.pdf',
                status: 'paid',
                amount: 100,
                courseTitle: 'Test Course',
                teacherName: 'Jane Smith',
                created: new Date(1640995200 * 1000),
            });
        }));
        (0, globals_1.it)('should handle Stripe retrieval errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockTransactions = [
                {
                    _id: 'transaction123',
                    stripeInvoiceId: 'in_123',
                    courseId: { title: 'Test Course' },
                    teacherId: { name: 'Jane Smith' },
                },
            ];
            transaction_model_1.Transaction.find.mockReturnValue({
                populate: globals_1.jest.fn().mockReturnValue({
                    populate: globals_1.jest.fn().mockReturnValue({
                        sort: globals_1.jest.fn().mockResolvedValue(mockTransactions),
                    }),
                }),
            });
            mockStripe.invoices.retrieve.mockRejectedValue(new Error('Stripe error'));
            const result = yield invoice_service_1.InvoiceService.getStudentInvoices('student123');
            (0, globals_1.expect)(result).toEqual([]);
        }));
    });
});
