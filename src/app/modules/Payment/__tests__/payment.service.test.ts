import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import Stripe from 'stripe';
import mongoose from 'mongoose';
import { PaymentService } from '../payment.service';
import { Student } from '../../Student/student.model';
import { Teacher } from '../../Teacher/teacher.model';
import { Course } from '../../Course/course.model';
import { Payment } from '../payment.model';
import { Transaction } from '../transaction.model';
import { PayoutSummary } from '../payoutSummary.model';

// Mock Stripe
jest.mock('stripe');
const MockedStripe = Stripe as jest.MockedClass<typeof Stripe>;

// Mock models
jest.mock('../../Student/student.model');
jest.mock('../../Teacher/teacher.model');
jest.mock('../../Course/course.model');
jest.mock('../payment.model');
jest.mock('../transaction.model');
jest.mock('../payoutSummary.model');

describe('PaymentService', () => {
  let mockStripe: jest.Mocked<Stripe>;
  let mockSession: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Stripe instance
    mockStripe = {
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      checkout: {
        sessions: {
          list: jest.fn(),
        },
      },
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

    // Mock mongoose session
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    (mongoose.startSession as jest.Mock).mockResolvedValue(mockSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createPaymentIntent', () => {
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

    beforeEach(() => {
      (Student.findById as jest.Mock).mockResolvedValue(mockStudent);
      (Course.findById as jest.Mock).mockResolvedValue(mockCourse);
      (Teacher.findById as jest.Mock).mockResolvedValue(mockTeacher);
    });

    it('should create a payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        client_secret: 'pi_123_secret',
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent as any);
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        ...mockPaymentIntent,
        charges: [],
      } as any);

      const result = await PaymentService.createPaymentIntent('student123', 'course123', 100);

      expect(result).toEqual({
        clientSecret: 'pi_123_secret',
        paymentIntentId: 'pi_123',
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
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
    });

    it('should throw error if student not found', async () => {
      (Student.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        PaymentService.createPaymentIntent('invalid', 'course123', 100)
      ).rejects.toThrow('Student, course, or teacher not found');
    });

    it('should throw error if student already enrolled', async () => {
      const enrolledStudent = {
        ...mockStudent,
        enrolledCourses: [{ courseId: 'course123' }],
      };
      (Student.findById as jest.Mock).mockResolvedValue(enrolledStudent);

      await expect(
        PaymentService.createPaymentIntent('student123', 'course123', 100)
      ).rejects.toThrow('Already enrolled in this course');
    });

    it('should handle Stripe errors gracefully', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Stripe error'));

      await expect(
        PaymentService.createPaymentIntent('student123', 'course123', 100)
      ).rejects.toThrow('Stripe error');
    });
  });

  describe('processCheckoutSessionCompleted', () => {
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

    beforeEach(() => {
      (Student.findById as jest.Mock).mockResolvedValue(mockStudent);
      (Course.findById as jest.Mock).mockResolvedValue(mockCourse);
      (Teacher.findById as jest.Mock).mockResolvedValue(mockTeacher);
      (Payment.create as jest.Mock).mockResolvedValue([{ _id: 'payment123' }]);
      (Transaction.create as jest.Mock).mockResolvedValue([{ _id: 'transaction123' }]);
      (PayoutSummary.findOne as jest.Mock).mockResolvedValue(null);
      (PayoutSummary.create as jest.Mock).mockResolvedValue([{ _id: 'payout123' }]);
      (Student.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockStudent);
      (Course.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockCourse);
      (Teacher.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockTeacher);
    });

    it('should process checkout session successfully', async () => {
      const result = await PaymentService.processCheckoutSessionCompleted(mockCheckoutSession as any);

      expect(result).toEqual({
        success: true,
        message: 'Payment processed successfully',
      });

      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should handle missing metadata gracefully', async () => {
      const sessionWithoutMetadata = {
        ...mockCheckoutSession,
        metadata: {},
      };

      await expect(
        PaymentService.processCheckoutSessionCompleted(sessionWithoutMetadata as any)
      ).rejects.toThrow('Missing required metadata');
    });

    it('should handle already enrolled student', async () => {
      const enrolledStudent = {
        ...mockStudent,
        enrolledCourses: [{ courseId: 'course123' }],
      };
      (Student.findById as jest.Mock).mockResolvedValue(enrolledStudent);

      const result = await PaymentService.processCheckoutSessionCompleted(mockCheckoutSession as any);

      expect(result).toEqual({
        success: true,
        message: 'Student already enrolled',
      });
    });

    it('should rollback transaction on error', async () => {
      (Payment.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        PaymentService.processCheckoutSessionCompleted(mockCheckoutSession as any)
      ).rejects.toThrow('Database error');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should update existing payout summary', async () => {
      const existingPayoutSummary = {
        _id: 'existing123',
        totalEarned: 50,
        transactions: [],
        coursesSold: [],
        save: jest.fn(),
      };
      (PayoutSummary.findOne as jest.Mock).mockResolvedValue(existingPayoutSummary);

      await PaymentService.processCheckoutSessionCompleted(mockCheckoutSession as any);

      expect(existingPayoutSummary.save).toHaveBeenCalled();
      expect(existingPayoutSummary.totalEarned).toBe(120); // 50 + 70
    });
  });

  describe('validateSessionMetadata', () => {
    it('should validate correct metadata', () => {
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

      const result = PaymentService.validateSessionMetadata(session as any);

      expect(result).toEqual({
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

    it('should throw error for missing required fields', () => {
      const session = {
        id: 'cs_123',
        metadata: {
          courseId: '507f1f77bcf86cd799439011',
          // Missing studentId and teacherId
        },
      };

      expect(() => PaymentService.validateSessionMetadata(session as any))
        .toThrow('Missing required metadata');
    });

    it('should throw error for invalid ObjectIds', () => {
      const session = {
        id: 'cs_123',
        metadata: {
          courseId: 'invalid-id',
          studentId: '507f1f77bcf86cd799439012',
          teacherId: '507f1f77bcf86cd799439013',
        },
      };

      expect(() => PaymentService.validateSessionMetadata(session as any))
        .toThrow('Invalid ObjectId');
    });

    it('should warn about payment split mismatch', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
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

      PaymentService.validateSessionMetadata(session as any);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Payment split mismatch'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('retryOperation', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await PaymentService.retryOperation(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');

      const result = await PaymentService.retryOperation(operation, 3, 10);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(
        PaymentService.retryOperation(operation, 2, 10)
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
