import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import { TwoFactorService } from './twoFactor.service';

/**
 * Set up two-factor authentication for a user
 */
const setupTwoFactor = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId;

  // Ensure the user is only setting up 2FA for themselves
  if (!userId || (req.user && userId !== req.user._id)) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message: 'You can only set up 2FA for your own account',
      data: null,
    });
  }

  const result = await TwoFactorService.setupTwoFactor(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Two-factor authentication setup initiated',
    data: result,
  });
});

/**
 * Verify and enable two-factor authentication for a user
 */
const verifyAndEnableTwoFactor = catchAsync(async (req: Request, res: Response) => {
  const { token, userId, secret } = req.body;

  // Ensure the user is only enabling 2FA for themselves
  if (!userId || (req.user && userId !== req.user._id)) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message: 'You can only enable 2FA for your own account',
      data: null,
    });
  }

  const result = await TwoFactorService.verifyAndEnableTwoFactor(token, userId, secret);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Two-factor authentication enabled successfully',
    data: result,
  });
});

/**
 * Verify a two-factor authentication token during login
 */
const verifyTwoFactorToken = catchAsync(async (req: Request, res: Response) => {
  const { token, userId } = req.body;

  const isValid = await TwoFactorService.verifyTwoFactorToken(token, userId);

  if (!isValid) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: 'Invalid verification code',
      data: null,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Two-factor authentication verified successfully',
    data: { verified: true },
  });
});

/**
 * Disable two-factor authentication for a user
 */
const disableTwoFactor = catchAsync(async (req: Request, res: Response) => {
  const { userId, password } = req.body;

  // Ensure the user is only disabling 2FA for themselves
  if (!userId || (req.user && userId !== req.user._id)) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message: 'You can only disable 2FA for your own account',
      data: null,
    });
  }

  const result = await TwoFactorService.disableTwoFactor(userId, password);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Two-factor authentication disabled successfully',
    data: result,
  });
});

export const TwoFactorController = {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  verifyTwoFactorToken,
  disableTwoFactor,
};
