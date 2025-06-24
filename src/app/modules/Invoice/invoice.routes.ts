import express from 'express';
import { InvoiceController } from './invoice.controller';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const generateInvoiceSchema = z.object({
  body: z.object({
    studentId: z.string().min(1, 'Student ID is required'),
    courseId: z.string().min(1, 'Course ID is required'),
    amount: z.number().positive('Amount must be positive'),
    teacherStripeAccountId: z.string().min(1, 'Teacher Stripe account ID is required'),
  }),
});

const bulkGenerateInvoicesSchema = z.object({
  body: z.object({
    transactions: z.array(
      z.object({
        transactionId: z.string().min(1, 'Transaction ID is required'),
        studentId: z.string().min(1, 'Student ID is required'),
        courseId: z.string().min(1, 'Course ID is required'),
        amount: z.number().positive('Amount must be positive'),
        teacherStripeAccountId: z.string().min(1, 'Teacher Stripe account ID is required'),
      })
    ).min(1, 'At least one transaction is required'),
  }),
});

// Generate invoice for a specific transaction
router.post(
  '/generate/:transactionId',
  auth(USER_ROLE.admin, USER_ROLE.teacher),
  validateRequest(generateInvoiceSchema),
  InvoiceController.generateInvoice
);

// Get invoice by transaction ID
router.get(
  '/transaction/:transactionId',
  auth(USER_ROLE.admin, USER_ROLE.teacher, USER_ROLE.student),
  InvoiceController.getInvoiceByTransaction
);

// Get all invoices for a student
router.get(
  '/student/:studentId',
  auth(USER_ROLE.admin, USER_ROLE.student),
  InvoiceController.getStudentInvoices
);

// Resend invoice email
router.post(
  '/resend/:transactionId',
  auth(USER_ROLE.admin, USER_ROLE.teacher),
  InvoiceController.resendInvoiceEmail
);

// Get invoice statistics for teacher
router.get(
  '/stats/teacher/:teacherId',
  auth(USER_ROLE.admin, USER_ROLE.teacher),
  InvoiceController.getTeacherInvoiceStats
);

// Bulk generate invoices
router.post(
  '/bulk-generate',
  auth(USER_ROLE.admin),
  validateRequest(bulkGenerateInvoicesSchema),
  InvoiceController.bulkGenerateInvoices
);

export const InvoiceRoutes = router;
