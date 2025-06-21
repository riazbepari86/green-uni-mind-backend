import config from '../../config';
import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthServices } from './auth.service';
import httpStatus from 'http-status';

const loginUser = catchAsync(async (req, res) => {
  const result = await AuthServices.loginUser(req.body);
  const { refreshToken, accessToken, user } = result;

  
  const origin = req.get('origin');
  let domain;

  if (origin && config.NODE_ENV === 'production') {
    try {
      
      domain = new URL(origin || '').hostname;
      
      if (!domain.includes('localhost')) {
        const parts = domain.split('.');
        if (parts.length > 2) {
          domain = parts.slice(-2).join('.');
        }
      }
    } catch (error) {
      console.error('Error parsing origin for cookie domain:', error);
    }
  }

  // Enhanced cookie security configuration
  const cookieOptions = {
    httpOnly: true, // Prevent XSS attacks
    secure: config.NODE_ENV === 'production', // HTTPS only in production
    sameSite: config.NODE_ENV === 'production' ? 'strict' as const : 'lax' as const, // CSRF protection
    domain: domain || undefined,
    maxAge: config.NODE_ENV === 'production' ?
      1000 * 60 * 60 * 24 : // 1 day in production
      1000 * 60 * 60 * 24 * 7, // 7 days in development
    path: '/', // Restrict to root path
  };

  // Sign the refresh token for additional security
  const signedRefreshToken = config.NODE_ENV === 'production' ?
    `${refreshToken}.${Buffer.from(refreshToken).toString('base64')}` :
    refreshToken;

  res.cookie('refreshToken', signedRefreshToken, cookieOptions);

 
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User is logged in successfully!',
    data: {
      accessToken,
      refreshToken, 
      user,
    },
  });
});

const changePassword = catchAsync(async (req, res) => {
  const { ...passwordData } = req.body;

  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const result = await AuthServices.changePassword(req.user, passwordData);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password is updated successfully!',
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  
  const tokenFromCookie = req.cookies?.refreshToken;
  const tokenFromBody = req.body?.refreshToken;
  const tokenFromHeader = req.headers['x-refresh-token'];

  
  const authHeader = req.headers?.authorization;
  let tokenFromBearer;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    tokenFromBearer = authHeader.split(' ')[1];
  }

  const refreshToken = tokenFromCookie || tokenFromBody || tokenFromHeader || tokenFromBearer;

  if (!refreshToken) {
     return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: 'Refresh token is required!',
      data: null,
    });
  }



  try {
    
    const cleanToken = refreshToken.trim();

    if (!cleanToken || cleanToken.length < 10) {
      throw new Error('Invalid refresh token format');
    }

    const result = await AuthServices.refreshToken(cleanToken);

    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: req.get('origin') ? new URL(req.get('origin') || '').hostname : undefined,
        maxAge: 1000 * 60 * 60 * 24 * 30, 
      });
    }

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Access token is retrieved successfully!',
      data: result,
    });
  } catch (error) {
    console.error('Error refreshing token:', error);

    res.clearCookie('refreshToken', {
      secure: true,
      httpOnly: true,
      sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: error instanceof Error ? error.message : 'Invalid refresh token',
      data: null,
    });
  }
});

const forgetPassword = catchAsync(async (req, res) => {
  const email = req.body.email;

  const result = await AuthServices.forgetPassword(email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset link is sent to your email!',
    data: result,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  const token = req.headers.authorization;

  const result = await AuthServices.resetPassword(req.body, token as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset successfully!',
    data: result,
  });
});

const logoutUser = catchAsync(async (req, res) => {
  const { refreshToken } = req.cookies;

  await AuthServices.logoutUser(refreshToken);

  const origin = req.get('origin');
  let domain;

  if (origin && config.NODE_ENV === 'production') {
    try {
      domain = new URL(origin || '').hostname;
      if (!domain.includes('localhost')) {
        const parts = domain.split('.');
        if (parts.length > 2) {
          domain = parts.slice(-2).join('.');
        }
      }
    } catch (error) {
      console.error('Error parsing origin for cookie domain:', error);
    }
  }

  console.log(`Clearing refresh token cookie with domain: ${domain || 'not set'}, sameSite: ${config.NODE_ENV === 'production' ? 'none' : 'lax'}`);

  res.clearCookie('refreshToken', {
    secure: true,
    httpOnly: true,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax', 
    domain: domain || undefined, 
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User is logged out successfully!',
    data: null,
  });
});


const verifyEmail = catchAsync(async (req, res) => {
  const { email, code } = req.body;

  const result = await AuthServices.verifyEmail(email, code);

  // Enhanced cookie security configuration for email verification
  const cookieOptions = {
    httpOnly: true, // Prevent XSS attacks
    secure: config.NODE_ENV === 'production', // HTTPS only in production
    sameSite: config.NODE_ENV === 'production' ? 'strict' as const : 'lax' as const, // CSRF protection
    maxAge: config.NODE_ENV === 'production' ?
      1000 * 60 * 60 * 24 : // 1 day in production
      1000 * 60 * 60 * 24 * 7, // 7 days in development
    path: '/', // Restrict to root path
  };

  // Sign the refresh token for additional security
  const signedRefreshToken = config.NODE_ENV === 'production' ?
    `${result.refreshToken}.${Buffer.from(result.refreshToken).toString('base64')}` :
    result.refreshToken;

  // Set refresh token as secure cookie
  res.cookie('refreshToken', signedRefreshToken, cookieOptions);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

const resendVerificationEmail = catchAsync(async (req, res) => {
  const { email } = req.body;

  const result = await AuthServices.resendVerificationEmail(email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Verification email sent successfully!',
    data: result,
  });
});

const getRateLimitStatus = catchAsync(async (req, res) => {
  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Email is required');
  }

  const result = await AuthServices.getRateLimitStatus(email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Rate limit status retrieved successfully',
    data: result.data,
  });
});

export const AuthControllers = {
  loginUser,
  changePassword,
  refreshToken,
  forgetPassword,
  resetPassword,
  logoutUser,
  verifyEmail,
  resendVerificationEmail,
  getRateLimitStatus,
};
