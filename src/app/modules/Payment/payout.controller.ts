import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PayoutService } from './payout.service';
import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { PayoutPreference } from './payout.model';
import { Types } from 'mongoose';
import { PayoutSchedule } from './payout.interface';

/**
 * Create a payout request
 */
const createPayoutRequest = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { amount } = req.body;

  const result = await PayoutService.createPayoutRequest(teacherId, amount);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payout request created successfully',
    data: result,
  });
});

/**
 * Get payout history for a teacher
 */
const getPayoutHistory = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  const result = await PayoutService.getPayoutHistory(teacherId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payout history retrieved successfully',
    data: result,
  });
});

/**
 * Get payout details by ID
 */
const getPayoutById = catchAsync(async (req: Request, res: Response) => {
  const { payoutId } = req.params;

  const result = await PayoutService.getPayoutById(payoutId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payout details retrieved successfully',
    data: result,
  });
});

/**
 * Update payout preferences for a teacher
 */
const updatePayoutPreferences = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { schedule, minimumAmount, isAutoPayoutEnabled } = req.body;

  // Validate schedule
  if (schedule && !Object.values(PayoutSchedule).includes(schedule as PayoutSchedule)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid payout schedule'
    );
  }

  // Validate minimum amount
  if (minimumAmount !== undefined && (isNaN(minimumAmount) || minimumAmount < 0)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Minimum amount must be a non-negative number'
    );
  }

  // Update or create payout preferences
  const preferences = await PayoutPreference.findOneAndUpdate(
    { teacherId: new Types.ObjectId(teacherId) },
    {
      ...(schedule && { schedule }),
      ...(minimumAmount !== undefined && { minimumAmount }),
      ...(isAutoPayoutEnabled !== undefined && { isAutoPayoutEnabled }),
    },
    { upsert: true, new: true }
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payout preferences updated successfully',
    data: preferences,
  });
});

/**
 * Get payout preferences for a teacher
 */
const getPayoutPreferences = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  const preferences = await PayoutPreference.findOne({
    teacherId: new Types.ObjectId(teacherId),
  });

  // If no preferences exist, return default values
  const result = preferences || {
    teacherId,
    schedule: PayoutSchedule.MONTHLY,
    minimumAmount: 50,
    isAutoPayoutEnabled: true,
  };

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payout preferences retrieved successfully',
    data: result,
  });
});

export const PayoutController = {
  createPayoutRequest,
  getPayoutHistory,
  getPayoutById,
  updatePayoutPreferences,
  getPayoutPreferences,
};
