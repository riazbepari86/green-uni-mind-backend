import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { Teacher } from '../Teacher/teacher.model';
import { PayoutSchedule } from './payout.interface';
import { PayoutPreference } from './payout.model';
import { PayoutService } from './payout.service';

/**
 * Helper function to validate and resolve teacher ID
 * Handles cases where frontend passes user._id instead of teacher._id
 */
const validateAndResolveTeacherId = async (
  teacherId: string,
  authenticatedUser: any,
): Promise<string> => {
  console.log('🔍 validateAndResolveTeacherId called with:', {
    teacherId,
    userRole: authenticatedUser.role,
    userId: authenticatedUser._id,
  });

  if (authenticatedUser.role !== 'teacher') {
    console.log('✅ Non-teacher user, returning original teacherId');
    return teacherId; // For non-teacher users, return as-is
  }

  // Try to find teacher by the provided ID first
  console.log('🔍 Looking for teacher by ID:', teacherId);
  let teacher = await Teacher.findById(teacherId);
  console.log('📊 Teacher.findById result:', teacher ? 'Found' : 'Not found');

  // If not found, try to find by user ID (common case when frontend passes user._id)
  if (!teacher) {
    console.log('🔍 Looking for teacher by user ID:', teacherId);
    teacher = await Teacher.findOne({ user: teacherId });
    console.log(
      '📊 Teacher.findOne({user}) result:',
      teacher ? 'Found' : 'Not found',
    );
  }

  // Validate that the teacher belongs to the authenticated user
  if (!teacher) {
    console.log('❌ No teacher found for ID:', teacherId);
    throw new AppError(httpStatus.FORBIDDEN, 'Teacher not found');
  }

  console.log('🔍 Teacher found:', {
    teacherId: teacher._id,
    userId: teacher.user,
  });

  if (teacher.user.toString() !== authenticatedUser._id) {
    console.log('❌ Teacher user mismatch:', {
      teacherUserId: teacher.user.toString(),
      authenticatedUserId: authenticatedUser._id,
    });
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only access your own data',
    );
  }

  console.log(
    '✅ Teacher validation successful, returning teacher ID:',
    teacher._id.toString(),
  );
  return teacher._id.toString();
};

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

  // Validate teacher ID matches authenticated user
  const user = (req as any).user;
  const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

  const result = await PayoutService.getPayoutHistory(actualTeacherId);

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
const updatePayoutPreferences = catchAsync(
  async (req: Request, res: Response) => {
    const { teacherId } = req.params;
    const { schedule, minimumAmount, isAutoPayoutEnabled } = req.body;

    // Validate schedule
    if (
      schedule &&
      !Object.values(PayoutSchedule).includes(schedule as PayoutSchedule)
    ) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid payout schedule');
    }

    // Validate minimum amount
    if (
      minimumAmount !== undefined &&
      (isNaN(minimumAmount) || minimumAmount < 0)
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Minimum amount must be a non-negative number',
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
      { upsert: true, new: true },
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Payout preferences updated successfully',
      data: preferences,
    });
  },
);

/**
 * Get payout preferences for a teacher
 */
const getPayoutPreferences = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  // Set no-cache headers for real-time payout preferences
  res.setHeader(
    'Cache-Control',
    'no-cache, no-store, must-revalidate, private',
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());
  res.setHeader('ETag', `"${Date.now()}"`);

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
