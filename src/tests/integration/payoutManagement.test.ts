import request from 'supertest';
import { app } from '../../app';
import { Payout, PayoutPreference } from '../../app/modules/Payment/payout.model';
import { Teacher } from '../../app/modules/Teacher/teacher.model';
import { Transaction } from '../../app/modules/Payment/transaction.model';
import { connectDB, disconnectDB } from '../setup/database';
import { createTestTeacher, createTestPayout, createTestTransaction } from '../helpers/testData';
import { PayoutStatus, PayoutSchedule } from '../../app/modules/Payment/payout.interface';
import { PayoutManagementService } from '../../app/modules/Payment/payoutManagement.service';

describe('Payout Management Integration Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await Payout.deleteMany({});
    await PayoutPreference.deleteMany({});
    await Teacher.deleteMany({});
    await Transaction.deleteMany({});
  });

  describe('Automatic Payout Scheduling', () => {
    it('should schedule automatic payout for eligible teacher', async () => {
      const teacher = await createTestTeacher({
        stripeConnect: {
          accountId: 'acct_test123',
          status: 'connected',
          verified: true,
        },
      });

      // Create payout preferences
      await PayoutPreference.create({
        teacherId: teacher._id,
        schedule: PayoutSchedule.WEEKLY,
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
      await createTestTransaction({
        teacherId: teacher._id,
        teacherEarning: 75,
        stripeTransferStatus: 'pending',
      });

      const result = await PayoutManagementService.scheduleAutomaticPayouts();

      expect(result.scheduled).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);

      // Verify payout was created
      const payout = await Payout.findOne({ teacherId: teacher._id });
      expect(payout).toBeTruthy();
      expect(payout?.status).toBe(PayoutStatus.SCHEDULED);
      expect(payout?.amount).toBe(75);
    });

    it('should skip payout if amount below minimum threshold', async () => {
      const teacher = await createTestTeacher({
        stripeConnect: {
          accountId: 'acct_test123',
          status: 'connected',
        },
      });

      await PayoutPreference.create({
        teacherId: teacher._id,
        schedule: PayoutSchedule.WEEKLY,
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
      await createTestTransaction({
        teacherId: teacher._id,
        teacherEarning: 25,
        stripeTransferStatus: 'pending',
      });

      const result = await PayoutManagementService.scheduleAutomaticPayouts();

      expect(result.scheduled).toBe(0);
      expect(result.skipped).toBe(1);

      // Verify no payout was created
      const payout = await Payout.findOne({ teacherId: teacher._id });
      expect(payout).toBeFalsy();
    });

    it('should skip payout if teacher account not connected', async () => {
      const teacher = await createTestTeacher({
        stripeConnect: {
          accountId: 'acct_test123',
          status: 'pending',
          verified: false,
        },
      });

      await PayoutPreference.create({
        teacherId: teacher._id,
        schedule: PayoutSchedule.WEEKLY,
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

      await createTestTransaction({
        teacherId: teacher._id,
        teacherEarning: 75,
        stripeTransferStatus: 'pending',
      });

      const result = await PayoutManagementService.scheduleAutomaticPayouts();

      expect(result.scheduled).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe('Payout Schedule Calculation', () => {
    it('should calculate next weekly payout date correctly', async () => {
      const nextDate = PayoutManagementService.calculateNextPayoutDate(
        PayoutSchedule.WEEKLY,
        { dayOfWeek: 1, hour: 9 }, // Monday at 9 AM
        'UTC'
      );

      expect(nextDate).toBeInstanceOf(Date);
      expect(nextDate.getDay()).toBe(1); // Monday
      expect(nextDate.getHours()).toBe(9);
    });

    it('should calculate next monthly payout date correctly', async () => {
      const nextDate = PayoutManagementService.calculateNextPayoutDate(
        PayoutSchedule.MONTHLY,
        { dayOfMonth: 15, hour: 10 }, // 15th of month at 10 AM
        'UTC'
      );

      expect(nextDate).toBeInstanceOf(Date);
      expect(nextDate.getDate()).toBe(15);
      expect(nextDate.getHours()).toBe(10);
    });

    it('should handle end-of-month edge cases', async () => {
      const nextDate = PayoutManagementService.calculateNextPayoutDate(
        PayoutSchedule.MONTHLY,
        { dayOfMonth: 31, hour: 9 }, // 31st of month
        'UTC'
      );

      expect(nextDate).toBeInstanceOf(Date);
      // Should handle months with fewer than 31 days
      expect(nextDate.getDate()).toBeLessThanOrEqual(31);
    });
  });

  describe('Pending Earnings Calculation', () => {
    it('should calculate pending earnings correctly', async () => {
      const teacher = await createTestTeacher();

      // Create multiple pending transactions
      await createTestTransaction({
        teacherId: teacher._id,
        teacherEarning: 50,
        currency: 'usd',
        stripeTransferStatus: 'pending',
      });

      await createTestTransaction({
        teacherId: teacher._id,
        teacherEarning: 75,
        currency: 'usd',
        stripeTransferStatus: 'pending',
      });

      // Create completed transaction (should not be included)
      await createTestTransaction({
        teacherId: teacher._id,
        teacherEarning: 25,
        currency: 'usd',
        stripeTransferStatus: 'completed',
      });

      const earnings = await PayoutManagementService.getPendingEarnings(teacher._id);

      expect(earnings.totalAmount).toBe(125);
      expect(earnings.transactionCount).toBe(2);
      expect(earnings.currency).toBe('usd');
    });

    it('should return zero for teacher with no pending earnings', async () => {
      const teacher = await createTestTeacher();

      const earnings = await PayoutManagementService.getPendingEarnings(teacher._id);

      expect(earnings.totalAmount).toBe(0);
      expect(earnings.transactionCount).toBe(0);
      expect(earnings.currency).toBe('usd');
    });
  });

  describe('Manual Payout Creation', () => {
    it('should create manual payout successfully', async () => {
      const teacher = await createTestTeacher({
        stripeConnect: {
          accountId: 'acct_test123',
          status: 'connected',
        },
      });

      await createTestTransaction({
        teacherId: teacher._id,
        teacherEarning: 100,
        stripeTransferStatus: 'pending',
      });

      const payout = await PayoutManagementService.createScheduledPayout(teacher._id, {
        amount: 100,
        description: 'Manual payout request',
      });

      expect(payout).toBeTruthy();
      expect(payout.amount).toBe(100);
      expect(payout.status).toBe(PayoutStatus.SCHEDULED);
      expect(payout.description).toBe('Manual payout request');
    });

    it('should reject payout if teacher not found', async () => {
      await expect(
        PayoutManagementService.createScheduledPayout('nonexistent_id', {
          amount: 100,
        })
      ).rejects.toThrow('Teacher not found');
    });

    it('should reject payout if no Stripe account connected', async () => {
      const teacher = await createTestTeacher({
        stripeConnect: undefined,
      });

      await expect(
        PayoutManagementService.createScheduledPayout(teacher._id, {
          amount: 100,
        })
      ).rejects.toThrow('does not have a connected Stripe account');
    });

    it('should reject payout if amount below minimum', async () => {
      const teacher = await createTestTeacher({
        stripeConnect: {
          accountId: 'acct_test123',
          status: 'connected',
        },
      });

      await PayoutPreference.create({
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

      await expect(
        PayoutManagementService.createScheduledPayout(teacher._id, {
          amount: 50,
        })
      ).rejects.toThrow('below minimum threshold');
    });
  });

  describe('Payout API Endpoints', () => {
    it('should get payout summary for teacher', async () => {
      const teacher = await createTestTeacher();

      // Create test data
      await createTestPayout({
        teacherId: teacher._id,
        amount: 100,
        status: PayoutStatus.COMPLETED,
      });

      await createTestTransaction({
        teacherId: teacher._id,
        teacherEarning: 50,
        stripeTransferStatus: 'pending',
      });

      const response = await request(app)
        .get(`/api/v1/payouts/summary/${teacher._id}`)
        .set('Authorization', 'Bearer teacher_token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pendingEarnings');
      expect(response.body.data).toHaveProperty('payoutHistory');
      expect(response.body.data).toHaveProperty('analytics');
    });

    it('should create payout request via API', async () => {
      const teacher = await createTestTeacher({
        stripeConnect: {
          accountId: 'acct_test123',
          status: 'connected',
        },
      });

      await createTestTransaction({
        teacherId: teacher._id,
        teacherEarning: 100,
        stripeTransferStatus: 'pending',
      });

      const response = await request(app)
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
      expect(response.body.data).toHaveProperty('status', PayoutStatus.SCHEDULED);
    });

    it('should get payout preferences for teacher', async () => {
      const teacher = await createTestTeacher();

      await PayoutPreference.create({
        teacherId: teacher._id,
        schedule: PayoutSchedule.WEEKLY,
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

      const response = await request(app)
        .get(`/api/v1/payouts/preferences/${teacher._id}`)
        .set('Authorization', 'Bearer teacher_token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('schedule', PayoutSchedule.WEEKLY);
      expect(response.body.data).toHaveProperty('minimumAmount', 50);
      expect(response.body.data).toHaveProperty('isAutoPayoutEnabled', true);
    });

    it('should update payout preferences via API', async () => {
      const teacher = await createTestTeacher();

      const response = await request(app)
        .put(`/api/v1/payouts/preferences/${teacher._id}`)
        .set('Authorization', 'Bearer teacher_token')
        .send({
          schedule: PayoutSchedule.MONTHLY,
          minimumAmount: 100,
          isAutoPayoutEnabled: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('schedule', PayoutSchedule.MONTHLY);
      expect(response.body.data).toHaveProperty('minimumAmount', 100);
      expect(response.body.data).toHaveProperty('isAutoPayoutEnabled', false);
    });
  });
});
