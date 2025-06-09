import Stripe from 'stripe';
import mongoose, { Types } from 'mongoose';
import { Payout, PayoutPreference } from './payout.model';
import { PayoutSchedule, PayoutStatus } from './payout.interface';
import { Teacher } from '../Teacher/teacher.model';
import { Transaction } from './transaction.model';
import { PayoutSummary } from './payoutSummary.model';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import config from '../../config';
import { stripe } from '../../utils/stripe';

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

export const PayoutService = {
  createPayoutRequest,
  getPayoutHistory,
  getPayoutById,
};
