import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Stripe from 'stripe';
import { InvoiceService } from '../invoice.service';
import { Student } from '../../Student/student.model';
import { Teacher } from '../../Teacher/teacher.model';
import { Course } from '../../Course/course.model';
import { Transaction } from '../../Payment/transaction.model';
import { sendEmail } from '../../../utils/sendEmail';

// Mock Stripe
jest.mock('stripe');
const MockedStripe = Stripe as jest.MockedClass<typeof Stripe>;

// Mock models
jest.mock('../../Student/student.model');
jest.mock('../../Teacher/teacher.model');
jest.mock('../../Course/course.model');
jest.mock('../../Payment/transaction.model');
jest.mock('../../../utils/sendEmail');

describe('InvoiceService', () => {
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStripe = {
      customers: {
        list: jest.fn(),
        create: jest.fn(),
      },
      invoices: {
        create: jest.fn(),
        finalizeInvoice: jest.fn(),
        retrieve: jest.fn(),
      },
      invoiceItems: {
        create: jest.fn(),
      },
    } as any;

    MockedStripe.mockImplementation(() => mockStripe);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createStripeInvoice', () => {
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

    beforeEach(() => {
      (Student.findById as jest.Mock).mockResolvedValue(mockStudent);
      (Course.findById as jest.Mock).mockResolvedValue(mockCourse);
      (Transaction.findById as jest.Mock).mockResolvedValue(mockTransaction);
      (Transaction.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockTransaction);
    });

    it('should create invoice successfully for new customer', async () => {
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

      const mockFinalizedInvoice = {
        ...mockInvoice,
        status: 'open',
      };

      mockStripe.customers.list.mockResolvedValue({ data: [] } as any);
      mockStripe.customers.create.mockResolvedValue(mockCustomer as any);
      mockStripe.invoices.create.mockResolvedValue(mockInvoice as any);
      mockStripe.invoiceItems.create.mockResolvedValue({} as any);
      mockStripe.invoices.finalizeInvoice.mockResolvedValue(mockFinalizedInvoice as any);

      const result = await InvoiceService.createStripeInvoice(
        'student123',
        'course123',
        'transaction123',
        100,
        'acct_teacher123'
      );

      expect(result).toEqual({
        invoiceId: 'in_123',
        invoiceUrl: 'https://invoice.stripe.com/123',
        pdfUrl: 'https://invoice.stripe.com/123.pdf',
        status: 'open',
        customer: mockCustomer,
      });

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'student@test.com',
        name: 'John Doe',
        metadata: {
          studentId: 'student123',
          platform: 'LMS',
        },
      });

      expect(mockStripe.invoices.create).toHaveBeenCalledWith({
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
    });

    it('should use existing customer if found', async () => {
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

      mockStripe.customers.list.mockResolvedValue({ data: [existingCustomer] } as any);
      mockStripe.invoices.create.mockResolvedValue(mockInvoice as any);
      mockStripe.invoiceItems.create.mockResolvedValue({} as any);
      mockStripe.invoices.finalizeInvoice.mockResolvedValue(mockInvoice as any);

      await InvoiceService.createStripeInvoice(
        'student123',
        'course123',
        'transaction123',
        100,
        'acct_teacher123'
      );

      expect(mockStripe.customers.create).not.toHaveBeenCalled();
      expect(mockStripe.invoices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing',
        })
      );
    });

    it('should throw error for missing parameters', async () => {
      await expect(
        InvoiceService.createStripeInvoice('', 'course123', 'transaction123', 100, 'acct_teacher123')
      ).rejects.toThrow('Missing required parameters for invoice creation');
    });

    it('should throw error if student not found', async () => {
      (Student.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        InvoiceService.createStripeInvoice('invalid', 'course123', 'transaction123', 100, 'acct_teacher123')
      ).rejects.toThrow('Student not found');
    });

    it('should handle Stripe customer creation error', async () => {
      mockStripe.customers.list.mockResolvedValue({ data: [] } as any);
      mockStripe.customers.create.mockRejectedValue(new Error('Stripe customer error'));

      await expect(
        InvoiceService.createStripeInvoice('student123', 'course123', 'transaction123', 100, 'acct_teacher123')
      ).rejects.toThrow('Failed to create or retrieve customer');
    });

    it('should handle invoice creation error', async () => {
      const mockCustomer = { id: 'cus_123', email: 'student@test.com' };
      mockStripe.customers.list.mockResolvedValue({ data: [mockCustomer] } as any);
      mockStripe.invoices.create.mockRejectedValue(new Error('Invoice creation failed'));

      await expect(
        InvoiceService.createStripeInvoice('student123', 'course123', 'transaction123', 100, 'acct_teacher123')
      ).rejects.toThrow('Failed to create invoice');
    });
  });

  describe('sendInvoiceEmail', () => {
    it('should send invoice email successfully', async () => {
      (sendEmail as jest.Mock).mockResolvedValue(true);

      const result = await InvoiceService.sendInvoiceEmail(
        'student@test.com',
        'John Doe',
        'Test Course',
        'Jane Smith',
        'https://invoice.stripe.com/123',
        'https://invoice.stripe.com/123.pdf',
        100
      );

      expect(result).toEqual({ success: true });
      expect(sendEmail).toHaveBeenCalledWith({
        to: 'student@test.com',
        subject: 'Invoice for Test Course - Course Enrollment',
        html: expect.stringContaining('John Doe'),
      });
    });

    it('should handle email sending error', async () => {
      (sendEmail as jest.Mock).mockRejectedValue(new Error('Email sending failed'));

      await expect(
        InvoiceService.sendInvoiceEmail(
          'student@test.com',
          'John Doe',
          'Test Course',
          'Jane Smith',
          'https://invoice.stripe.com/123',
          'https://invoice.stripe.com/123.pdf',
          100
        )
      ).rejects.toThrow('Failed to send invoice email');
    });
  });

  describe('processInvoiceGeneration', () => {
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

    beforeEach(() => {
      (Student.findById as jest.Mock).mockResolvedValue(mockStudent);
      (Course.findById as jest.Mock).mockResolvedValue(mockCourse);
    });

    it('should process invoice generation successfully', async () => {
      const mockInvoiceResult = {
        invoiceId: 'in_123',
        invoiceUrl: 'https://invoice.stripe.com/123',
        pdfUrl: 'https://invoice.stripe.com/123.pdf',
        status: 'open',
        customer: { id: 'cus_123' },
      };

      // Mock the createStripeInvoice method
      jest.spyOn(InvoiceService, 'createStripeInvoice').mockResolvedValue(mockInvoiceResult);
      jest.spyOn(InvoiceService, 'sendInvoiceEmail').mockResolvedValue({ success: true });

      const result = await InvoiceService.processInvoiceGeneration(
        'student123',
        'course123',
        'transaction123',
        100,
        'acct_teacher123'
      );

      expect(result).toEqual(mockInvoiceResult);
      expect(InvoiceService.createStripeInvoice).toHaveBeenCalledWith(
        'student123',
        'course123',
        'transaction123',
        100,
        'acct_teacher123'
      );
      expect(InvoiceService.sendInvoiceEmail).toHaveBeenCalledWith(
        'student@test.com',
        'John Doe',
        'Test Course',
        'Jane Smith',
        'https://invoice.stripe.com/123',
        'https://invoice.stripe.com/123.pdf',
        100
      );
    });

    it('should handle missing student or course', async () => {
      (Student.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        InvoiceService.processInvoiceGeneration(
          'invalid',
          'course123',
          'transaction123',
          100,
          'acct_teacher123'
        )
      ).rejects.toThrow('Student or course not found');
    });
  });

  describe('getInvoiceByTransactionId', () => {
    it('should retrieve invoice successfully', async () => {
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

      (Transaction.findById as jest.Mock).mockResolvedValue(mockTransaction);
      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);

      const result = await InvoiceService.getInvoiceByTransactionId('transaction123');

      expect(result).toEqual({
        invoiceId: 'in_123',
        invoiceUrl: 'https://invoice.stripe.com/123',
        pdfUrl: 'https://invoice.stripe.com/123.pdf',
        status: 'paid',
        amount: 100,
        created: new Date(1640995200 * 1000),
      });
    });

    it('should throw error if transaction not found', async () => {
      (Transaction.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        InvoiceService.getInvoiceByTransactionId('invalid')
      ).rejects.toThrow('Transaction not found');
    });

    it('should throw error if invoice not found for transaction', async () => {
      const mockTransaction = {
        _id: 'transaction123',
        stripeInvoiceId: null,
      };

      (Transaction.findById as jest.Mock).mockResolvedValue(mockTransaction);

      await expect(
        InvoiceService.getInvoiceByTransactionId('transaction123')
      ).rejects.toThrow('Invoice not found for this transaction');
    });
  });

  describe('getStudentInvoices', () => {
    it('should retrieve student invoices successfully', async () => {
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

      (Transaction.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockTransactions),
          }),
        }),
      });

      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);

      const result = await InvoiceService.getStudentInvoices('student123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
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
    });

    it('should handle Stripe retrieval errors gracefully', async () => {
      const mockTransactions = [
        {
          _id: 'transaction123',
          stripeInvoiceId: 'in_123',
          courseId: { title: 'Test Course' },
          teacherId: { name: 'Jane Smith' },
        },
      ];

      (Transaction.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockTransactions),
          }),
        }),
      });

      mockStripe.invoices.retrieve.mockRejectedValue(new Error('Stripe error'));

      const result = await InvoiceService.getStudentInvoices('student123');

      expect(result).toEqual([]);
    });
  });
});
