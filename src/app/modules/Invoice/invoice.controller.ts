import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { InvoiceService } from './invoice.service';
import AppError from '../../errors/AppError';

// Generate invoice for a transaction
const generateInvoice = catchAsync(async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const { studentId, courseId, amount, teacherStripeAccountId } = req.body;

  if (!transactionId || !studentId || !courseId || !amount || !teacherStripeAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Missing required fields: transactionId, studentId, courseId, amount, teacherStripeAccountId'
    );
  }

  const result = await InvoiceService.processInvoiceGeneration(
    studentId,
    courseId,
    transactionId,
    amount,
    teacherStripeAccountId
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Invoice generated successfully',
    data: result,
  });
});

// Get invoice by transaction ID
const getInvoiceByTransaction = catchAsync(async (req: Request, res: Response) => {
  const { transactionId } = req.params;

  if (!transactionId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Transaction ID is required');
  }

  const result = await InvoiceService.getInvoiceByTransactionId(transactionId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Invoice retrieved successfully',
    data: result,
  });
});

// Get all invoices for a student
const getStudentInvoices = catchAsync(async (req: Request, res: Response) => {
  const { studentId } = req.params;

  if (!studentId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Student ID is required');
  }

  const result = await InvoiceService.getStudentInvoices(studentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Student invoices retrieved successfully',
    data: result,
  });
});

// Resend invoice email
const resendInvoiceEmail = catchAsync(async (req: Request, res: Response) => {
  const { transactionId } = req.params;

  if (!transactionId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Transaction ID is required');
  }

  // Get invoice details
  const invoice = await InvoiceService.getInvoiceByTransactionId(transactionId);
  
  // Get transaction details for email
  const Transaction = require('../Payment/transaction.model').Transaction;
  const Student = require('../Student/student.model').Student;
  const Course = require('../Course/course.model').Course;

  const transaction = await Transaction.findById(transactionId)
    .populate('studentId')
    .populate('courseId')
    .populate('teacherId');

  if (!transaction) {
    throw new AppError(httpStatus.NOT_FOUND, 'Transaction not found');
  }

  const student = transaction.studentId;
  const course = transaction.courseId;
  const teacher = transaction.teacherId;

  if (!student || !course || !teacher) {
    throw new AppError(httpStatus.NOT_FOUND, 'Required data not found');
  }

  const studentName = `${student.name.firstName} ${student.name.lastName}`;
  const teacherName = `${teacher.name.firstName} ${teacher.name.lastName}`;

  // Resend email
  await InvoiceService.sendInvoiceEmail(
    student.email,
    studentName,
    course.title,
    teacherName,
    invoice.invoiceUrl,
    invoice.pdfUrl,
    invoice.amount
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Invoice email resent successfully',
    data: { invoiceId: invoice.invoiceId },
  });
});

// Get invoice statistics for teacher
const getTeacherInvoiceStats = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { period = '30d' } = req.query;

  if (!teacherId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Teacher ID is required');
  }

  // Calculate date range based on period
  const now = new Date();
  let startDate: Date;

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
  const transactions = await Transaction.find({
    teacherId,
    createdAt: { $gte: startDate },
    stripeInvoiceId: { $exists: true, $ne: null },
  });

  // Calculate statistics
  const totalInvoices = transactions.length;
  const totalAmount = transactions.reduce((sum: number, t: any) => sum + t.totalAmount, 0);
  const averageAmount = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

  // Group by status (this would require fetching from Stripe, simplified for now)
  const stats = {
    totalInvoices,
    totalAmount,
    averageAmount,
    period: period as string,
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

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Teacher invoice statistics retrieved successfully',
    data: stats,
  });
});

// Bulk generate invoices for multiple transactions
const bulkGenerateInvoices = catchAsync(async (req: Request, res: Response) => {
  const { transactions } = req.body;

  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Transactions array is required and must not be empty'
    );
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

      const result = await InvoiceService.processInvoiceGeneration(
        studentId,
        courseId,
        transactionId,
        amount,
        teacherStripeAccountId
      );

      results.push({
        transactionId,
        invoiceId: result.invoiceId,
        status: 'success',
      });
    } catch (error) {
      errors.push({
        transactionId: transaction.transactionId || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
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
});

export const InvoiceController = {
  generateInvoice,
  getInvoiceByTransaction,
  getStudentInvoices,
  resendInvoiceEmail,
  getTeacherInvoiceStats,
  bulkGenerateInvoices,
};
