import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { StripeConnectService } from './stripeConnect.service';
import AppError from '../../errors/AppError';

// Create Stripe Connect account with enhanced tracking
const createAccount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { type, country, email, business_type } = req.body;
  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent');

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User ID not found');
  }

  if (!type || !country) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Missing required fields: type, country'
    );
  }

  const result = await StripeConnectService.createStripeAccount(userId, {
    type,
    country,
    email, // Optional - will use teacher's email if not provided
    business_type,
    ipAddress,
    userAgent,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Stripe account created successfully',
    data: result,
  });
});

// Create account link for onboarding with enhanced URLs
const createAccountLink = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { type, refreshUrl, returnUrl } = req.body;
  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent');

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User ID not found');
  }

  // Set default URLs with success/failure handling if not provided
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const defaultRefreshUrl = refreshUrl || `${baseUrl}/teacher/stripe-connect?success=false&reason=refresh`;
  const defaultReturnUrl = returnUrl || `${baseUrl}/teacher/stripe-connect?success=true`;

  if (!type) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Missing required field: type'
    );
  }

  const result = await StripeConnectService.createAccountLink(userId, {
    type,
    refreshUrl: defaultRefreshUrl,
    returnUrl: defaultReturnUrl,
    ipAddress,
    userAgent,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Account link created successfully',
    data: result,
  });
});

// Get account status
const getAccountStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User ID not found');
  }

  const result = await StripeConnectService.getAccountStatus(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Account status retrieved successfully',
    data: result,
  });
});

// Update account information
const updateAccount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const updateData = req.body;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User ID not found');
  }

  const result = await StripeConnectService.updateAccount(userId, updateData);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Account updated successfully',
    data: result,
  });
});

// Disconnect account
const disconnectAccount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User ID not found');
  }

  const result = await StripeConnectService.disconnectAccount(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Account disconnected successfully',
    data: result,
  });
});

// Retry failed connection
const retryConnection = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent');

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User ID not found');
  }

  const result = await StripeConnectService.retryConnection(userId, {
    ipAddress,
    userAgent,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

// Get audit log for compliance
const getAuditLog = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { limit, offset, action } = req.query;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User ID not found');
  }

  const result = await StripeConnectService.getAuditLog(userId, {
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
    action: action as string,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Audit log retrieved successfully',
    data: result,
  });
});

// Enhanced disconnect with options
const disconnectAccountEnhanced = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { reason } = req.body;
  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent');

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User ID not found');
  }

  const result = await StripeConnectService.disconnectAccount(userId, {
    reason,
    ipAddress,
    userAgent,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

export const StripeConnectController = {
  createAccount,
  createAccountLink,
  getAccountStatus,
  updateAccount,
  disconnectAccount,
  retryConnection,
  getAuditLog,
  disconnectAccountEnhanced,
};
