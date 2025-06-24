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
exports.InvoiceController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const invoice_service_1 = require("./invoice.service");
const AppError_1 = __importDefault(require("../../errors/AppError"));
// Generate invoice for a transaction
const generateInvoice = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { transactionId } = req.params;
    const { studentId, courseId, amount, teacherStripeAccountId } = req.body;
    if (!transactionId || !studentId || !courseId || !amount || !teacherStripeAccountId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required fields: transactionId, studentId, courseId, amount, teacherStripeAccountId');
    }
    const result = yield invoice_service_1.InvoiceService.processInvoiceGeneration(studentId, courseId, transactionId, amount, teacherStripeAccountId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Invoice generated successfully',
        data: result,
    });
}));
// Get invoice by transaction ID
const getInvoiceByTransaction = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { transactionId } = req.params;
    if (!transactionId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Transaction ID is required');
    }
    const result = yield invoice_service_1.InvoiceService.getInvoiceByTransactionId(transactionId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Invoice retrieved successfully',
        data: result,
    });
}));
// Get all invoices for a student
const getStudentInvoices = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId } = req.params;
    if (!studentId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Student ID is required');
    }
    const result = yield invoice_service_1.InvoiceService.getStudentInvoices(studentId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Student invoices retrieved successfully',
        data: result,
    });
}));
// Resend invoice email
const resendInvoiceEmail = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { transactionId } = req.params;
    if (!transactionId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Transaction ID is required');
    }
    // Get invoice details
    const invoice = yield invoice_service_1.InvoiceService.getInvoiceByTransactionId(transactionId);
    // Get transaction details for email
    const Transaction = require('../Payment/transaction.model').Transaction;
    const Student = require('../Student/student.model').Student;
    const Course = require('../Course/course.model').Course;
    const transaction = yield Transaction.findById(transactionId)
        .populate('studentId')
        .populate('courseId')
        .populate('teacherId');
    if (!transaction) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Transaction not found');
    }
    const student = transaction.studentId;
    const course = transaction.courseId;
    const teacher = transaction.teacherId;
    if (!student || !course || !teacher) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Required data not found');
    }
    const studentName = `${student.name.firstName} ${student.name.lastName}`;
    const teacherName = `${teacher.name.firstName} ${teacher.name.lastName}`;
    // Resend email
    yield invoice_service_1.InvoiceService.sendInvoiceEmail(student.email, studentName, course.title, teacherName, invoice.invoiceUrl, invoice.pdfUrl, invoice.amount);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Invoice email resent successfully',
        data: { invoiceId: invoice.invoiceId },
    });
}));
// Get invoice statistics for teacher
const getTeacherInvoiceStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period = '30d' } = req.query;
    if (!teacherId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Teacher ID is required');
    }
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    switch (period) {
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case '90d':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case '1y':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    const Transaction = require('../Payment/transaction.model').Transaction;
    // Get transactions with invoices for the teacher
    const transactions = yield Transaction.find({
        teacherId,
        createdAt: { $gte: startDate },
        stripeInvoiceId: { $exists: true, $ne: null },
    });
    // Calculate statistics
    const totalInvoices = transactions.length;
    const totalAmount = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const averageAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;
    // Group by status (this would require fetching from Stripe, simplified for now)
    const stats = {
        totalInvoices,
        totalAmount,
        averageAmount,
        period: period,
        dateRange: {
            start: startDate,
            end: now,
        },
        // These would be calculated by fetching actual invoice statuses from Stripe
        statusBreakdown: {
            paid: totalInvoices, // Assuming all are paid since they're from completed transactions
            pending: 0,
            failed: 0,
        },
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Teacher invoice statistics retrieved successfully',
        data: stats,
    });
}));
// Bulk generate invoices for multiple transactions
const bulkGenerateInvoices = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { transactions } = req.body;
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Transactions array is required and must not be empty');
    }
    const results = [];
    const errors = [];
    for (const transaction of transactions) {
        try {
            const { transactionId, studentId, courseId, amount, teacherStripeAccountId } = transaction;
            if (!transactionId || !studentId || !courseId || !amount || !teacherStripeAccountId) {
                errors.push({
                    transactionId: transactionId || 'unknown',
                    error: 'Missing required fields',
                });
                continue;
            }
            const result = yield invoice_service_1.InvoiceService.processInvoiceGeneration(studentId, courseId, transactionId, amount, teacherStripeAccountId);
            results.push({
                transactionId,
                invoiceId: result.invoiceId,
                status: 'success',
            });
        }
        catch (error) {
            errors.push({
                transactionId: transaction.transactionId || 'unknown',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `Bulk invoice generation completed. ${results.length} successful, ${errors.length} failed.`,
        data: {
            successful: results,
            failed: errors,
            summary: {
                total: transactions.length,
                successful: results.length,
                failed: errors.length,
            },
        },
    });
}));
exports.InvoiceController = {
    generateInvoice,
    getInvoiceByTransaction,
    getStudentInvoices,
    resendInvoiceEmail,
    getTeacherInvoiceStats,
    bulkGenerateInvoices,
};
