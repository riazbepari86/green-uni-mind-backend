import Stripe from 'stripe';
import cron from 'node-cron';
import mongoose, { Types } from 'mongoose';
import { Payout, PayoutPreference, PayoutBatch } from './payout.model';
import {
  PayoutSchedule,
  PayoutStatus,
  PayoutFailureCategory,
  IPayoutAnalytics,
  IPayoutQuery,
  IPayoutRetryConfig
} from './payout.interface';
import { Teacher } from '../Teacher/teacher.model';
import { Transaction } from './transaction.model';
import { PayoutSummary } from './payoutSummary.model';
import { AuditLogService } from '../AuditLog/auditLog.service';
import { NotificationService } from '../Notification/notification.service';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import config from '../../config';
import { stripe } from '../../utils/stripe';
import {
  AuditLogAction,
  AuditLogCategory,
  AuditLogLevel
} from '../AuditLog/auditLog.interface';
import {
  NotificationType,
  NotificationPriority
} from '../Notification/notification.interface';

/**
 * Create a payout request for a teacher
 */
const createPayoutRequest = async (teacherId: string, amount?: number) => {
  try {
    // Find the teacher
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    // Check if teacher has a Stripe account
    if (!teacher.stripeAccountId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Teacher does not have a connected Stripe account'
      );
    }

    // Check if teacher has verified their Stripe account
    if (!teacher.stripeVerified) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Teacher has not completed Stripe verification'
      );
    }

    // Get teacher's available balance
    const availableBalance = teacher.totalEarnings || 0;

    // If amount is not specified, use the entire available balance
    const payoutAmount = amount || availableBalance;

    // Validate payout amount
    if (payoutAmount <= 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Payout amount must be greater than zero'
      );
    }

    if (payoutAmount > availableBalance) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Payout amount exceeds available balance'
      );
    }

    // Get unpaid transactions
    const unpaidTransactions = await Transaction.find({
      teacherId: new Types.ObjectId(teacherId),
      status: 'success',
      stripeTransferStatus: 'completed',
      // Not included in any payout yet
      _id: {
        $nin: await Payout.distinct('transactions', {
          teacherId: new Types.ObjectId(teacherId),
        }),
      },
    });

    if (unpaidTransactions.length === 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'No eligible transactions found for payout'
      );
    }

    // Calculate total amount from unpaid transactions
    const totalUnpaidAmount = unpaidTransactions.reduce(
      (sum, transaction) => sum + transaction.teacherEarning,
      0
    );

    // Validate against unpaid transactions
    if (payoutAmount > totalUnpaidAmount) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Payout amount exceeds total unpaid transactions'
      );
    }

    // Start a MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create a payout in Stripe
      const stripePayout = await stripe.payouts.create(
        {
          amount: Math.round(payoutAmount * 100), // Convert to cents
          currency: 'usd',
          destination: teacher.stripeAccountId,
          metadata: {
            teacherId: teacherId,
          },
        },
        {
          stripeAccount: teacher.stripeAccountId, // Create on the connected account
        }
      );

      // Create a payout record in our database
      const payout = await Payout.create(
        [
          {
            teacherId: new Types.ObjectId(teacherId),
            amount: payoutAmount,
            currency: 'usd',
            status: PayoutStatus.PROCESSING,
            stripePayoutId: stripePayout.id,
            transactions: unpaidTransactions.map((t) => t._id),
            description: `Payout of $${payoutAmount} to ${teacher.name.firstName} ${teacher.name.lastName}`,
            scheduledAt: new Date(),
          },
        ],
        { session }
      );

      // Update teacher's payout preference with last payout date
      await PayoutPreference.findOneAndUpdate(
        { teacherId: new Types.ObjectId(teacherId) },
        {
          lastPayoutDate: new Date(),
          $unset: { nextScheduledPayoutDate: 1 },
        },
        { upsert: true, session }
      );

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return {
        success: true,
        payoutId: payout[0]._id,
        stripePayoutId: stripePayout.id,
        amount: payoutAmount,
        status: PayoutStatus.PROCESSING,
      };
    } catch (error) {
      // Abort the transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error creating payout request:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create payout request'
    );
  }
};

/**
 * Get payout history for a teacher
 */
const getPayoutHistory = async (teacherId: string) => {
  try {
    // Find the teacher
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    // Get all payouts for the teacher
    const payouts = await Payout.find({ teacherId: new Types.ObjectId(teacherId) })
      .sort({ createdAt: -1 })
      .populate({
        path: 'transactions',
        select: 'courseId studentId totalAmount teacherEarning createdAt',
        populate: [
          {
            path: 'courseId',
            select: 'title courseThumbnail',
          },
          {
            path: 'studentId',
            select: 'name email',
          },
        ],
      });

    // Get unpaid transactions to calculate available balance
    const unpaidTransactions = await Transaction.find({
      teacherId: new Types.ObjectId(teacherId),
      status: 'success',
      stripeTransferStatus: 'completed',
      // Not included in any payout yet
      _id: {
        $nin: await Payout.distinct('transactions', {
          teacherId: new Types.ObjectId(teacherId),
        }),
      },
    });

    // Calculate available balance
    const availableBalance = unpaidTransactions.reduce(
      (sum, transaction) => sum + transaction.teacherEarning,
      0
    );

    return {
      teacherId,
      payouts,
      availableBalance,
    };
  } catch (error) {
    console.error('Error getting payout history:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to get payout history'
    );
  }
};

/**
 * Get payout details by ID
 */
const getPayoutById = async (payoutId: string) => {
  try {
    const payout = await Payout.findById(payoutId).populate({
      path: 'transactions',
      select: 'courseId studentId totalAmount teacherEarning createdAt',
      populate: [
        {
          path: 'courseId',
          select: 'title courseThumbnail',
        },
        {
          path: 'studentId',
          select: 'name email',
        },
      ],
    });

    if (!payout) {
      throw new AppError(httpStatus.NOT_FOUND, 'Payout not found');
    }

    return payout;
  } catch (error) {
    console.error('Error getting payout details:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to get payout details'
    );
  }
};

/**
 * Create or update payout preferences for a teacher
 */
const createOrUpdatePayoutPreferences = async (
  teacherId: string | Types.ObjectId,
  preferences: Partial<any>
) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    const existingPreferences = await PayoutPreference.findOne({ teacherId });

    if (existingPreferences) {
      Object.assign(existingPreferences, preferences);
      await existingPreferences.save();

      await AuditLogService.createAuditLog({
        action: AuditLogAction.USER_PROFILE_UPDATED,
        category: AuditLogCategory.PAYOUT,
        level: AuditLogLevel.INFO,
        message: 'Payout preferences updated',
        userId: teacherId,
        userType: 'teacher',
        resourceType: 'payout_preferences',
        resourceId: (existingPreferences._id as Types.ObjectId).toString(),
        metadata: {
          updatedFields: Object.keys(preferences),
          previousSchedule: existingPreferences.schedule,
          newSchedule: preferences.schedule,
        },
      });

      return existingPreferences;
    } else {
      const newPreferences = new PayoutPreference({
        teacherId,
        ...preferences,
      });

      await newPreferences.save();

      await AuditLogService.createAuditLog({
        action: AuditLogAction.PAYOUT_CREATED,
        category: AuditLogCategory.PAYOUT,
        level: AuditLogLevel.INFO,
        message: 'Payout preferences created',
        userId: teacherId,
        userType: 'teacher',
        resourceType: 'payout_preferences',
        resourceId: (newPreferences._id as Types.ObjectId).toString(),
        metadata: {
          schedule: preferences.schedule,
          minimumAmount: preferences.minimumAmount,
          isAutoPayoutEnabled: preferences.isAutoPayoutEnabled,
        },
      });

      return newPreferences;
    }
  } catch (error: any) {
    console.error('Error creating/updating payout preferences:', error);
    throw error;
  }
};

/**
 * Get pending earnings for a teacher
 */
const getPendingEarnings = async (teacherId: string | Types.ObjectId) => {
  try {
    const pipeline = [
      {
        $match: {
          teacherId: new Types.ObjectId(teacherId),
          stripeTransferStatus: 'pending',
        },
      },
      {
        $group: {
          _id: '$currency',
          totalAmount: { $sum: '$teacherEarning' },
          transactionCount: { $sum: 1 },
          transactions: { $push: '$$ROOT' },
        },
      },
    ];

    const results = await Transaction.aggregate(pipeline);

    if (results.length === 0) {
      return {
        totalAmount: 0,
        transactionCount: 0,
        transactions: [],
        currency: 'usd',
      };
    }

    const result = results[0];
    return {
      totalAmount: result.totalAmount,
      transactionCount: result.transactionCount,
      transactions: result.transactions,
      currency: result._id || 'usd',
    };
  } catch (error: any) {
    console.error('Error getting pending earnings:', error);
    throw error;
  }
};

/**
 * Get payout analytics for a teacher
 */
const getPayoutAnalytics = async (
  teacherId: string | Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<IPayoutAnalytics> => {
  try {
    const pipeline: any[] = [
      {
        $match: {
          teacherId: new Types.ObjectId(teacherId),
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $facet: {
          totalStats: [
            {
              $group: {
                _id: null,
                totalPayouts: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
                avgAmount: { $avg: '$amount' },
                avgProcessingTime: { $avg: '$processingDuration' },
              },
            },
          ],
          statusStats: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
          failureStats: [
            {
              $match: { status: PayoutStatus.FAILED },
            },
            {
              $group: {
                _id: '$failureCategory',
                count: { $sum: 1 },
              },
            },
          ],
          dailyTrends: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                count: { $sum: 1 },
                amount: { $sum: '$amount' },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ];

    const [result] = await Payout.aggregate(pipeline);

    const totalStats = result.totalStats[0] || {
      totalPayouts: 0,
      totalAmount: 0,
      avgAmount: 0,
      avgProcessingTime: 0,
    };

    const statusStats: Record<PayoutStatus, number> = {} as any;
    result.statusStats.forEach((item: any) => {
      if (item._id && typeof item._id === 'string') {
        statusStats[item._id as PayoutStatus] = item.count;
      }
    });

    const failureStats: Record<PayoutFailureCategory, number> = {} as any;
    result.failureStats.forEach((item: any) => {
      if (item._id && typeof item._id === 'string') {
        failureStats[item._id as PayoutFailureCategory] = item.count;
      }
    });

    const successfulPayouts = statusStats[PayoutStatus.COMPLETED] || 0;
    const successRate = totalStats.totalPayouts > 0
      ? (successfulPayouts / totalStats.totalPayouts) * 100
      : 0;

    return {
      totalPayouts: totalStats.totalPayouts,
      totalAmount: totalStats.totalAmount,
      currency: 'usd',
      averageAmount: totalStats.avgAmount,
      successRate,
      averageProcessingTime: totalStats.avgProcessingTime,
      payoutsByStatus: statusStats,
      payoutsBySchedule: {} as any, // Would need to be calculated separately
      failuresByCategory: failureStats,
      timeRange: { start: startDate, end: endDate },
      trends: {
        daily: result.dailyTrends.map((item: any) => ({
          date: item._id,
          count: item.count,
          amount: item.amount,
        })),
        weekly: [], // Would need separate aggregation
        monthly: [], // Would need separate aggregation
      },
    };
  } catch (error: any) {
    console.error('Error getting payout analytics:', error);
    throw error;
  }
};

export const PayoutService = {
  createPayoutRequest,
  getPayoutHistory,
  getPayoutById,
  createOrUpdatePayoutPreferences,
  getPendingEarnings,
  getPayoutAnalytics,
};
