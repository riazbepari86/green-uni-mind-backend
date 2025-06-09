import config from '../../config';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthServices } from './auth.service';
import httpStatus from 'http-status';
import { createToken } from './auth.utils';
import { StringValue } from './auth.constant';

const loginUser = catchAsync(async (req, res) => {
  const result = await AuthServices.loginUser(req.body);
  const { refreshToken, accessToken, user } = result;

  // Get domain from request origin or use default
  const origin = req.get('origin');
  let domain;

  if (origin && config.NODE_ENV === 'production') {
    try {
      // Extract domain from origin (e.g., https://example.com -> example.com)
      domain = new URL(origin || '').hostname;
      // If it's not localhost, ensure we have the root domain for cookies
      if (!domain.includes('localhost')) {
        // Handle subdomains by getting the root domain
        const parts = domain.split('.');
        if (parts.length > 2) {
          domain = parts.slice(-2).join('.');
        }
      }
    } catch (error) {
      console.error('Error parsing origin for cookie domain:', error);
    }
  }

  console.log(`Setting refresh token cookie with domain: ${domain || 'not set'}, sameSite: ${config.NODE_ENV === 'production' ? 'none' : 'lax'}`);

  res.cookie('refreshToken', refreshToken, {
    secure: true, // Always use secure in modern browsers
    httpOnly: true,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' for cross-site in production
    domain: domain || undefined, // Set domain in production
    maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
  });

  // Also include the refresh token in the response for the client to store as a fallback
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User is logged in successfully!',
    data: {
      accessToken,
      refreshToken, // Include refresh token in response for client-side storage
      user,
    },
  });
});

const changePassword = catchAsync(async (req, res) => {
  const { ...passwordData } = req.body;

  const result = await AuthServices.changePassword(req.user, passwordData);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password is updated successfully!',
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  // Try to get refresh token from multiple sources
  const tokenFromCookie = req.cookies?.refreshToken;
  const tokenFromBody = req.body?.refreshToken;
  const tokenFromHeader = req.headers['x-refresh-token'];

  // Also check for Authorization header with Bearer format
  const authHeader = req.headers?.authorization;
  let tokenFromBearer;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    tokenFromBearer = authHeader.split(' ')[1];
  }

  const refreshToken = tokenFromCookie || tokenFromBody || tokenFromHeader || tokenFromBearer;

  if (!refreshToken) {
    console.error('Refresh token missing from all sources');
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Cookies:', JSON.stringify(req.cookies));
    console.log('Body:', JSON.stringify(req.body));

    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: 'Refresh token is required!',
      data: null,
    });
  }

  const tokenSource = tokenFromCookie ? 'cookie' :
    tokenFromBody ? 'body' :
    tokenFromBearer ? 'bearer' :
    'header';

  console.log(`Refresh token source: ${tokenSource}, token length: ${refreshToken.length}`);

  try {
    // Trim the token to remove any whitespace
    const cleanToken = refreshToken.trim();

    if (!cleanToken || cleanToken.length < 10) {
      throw new Error('Invalid refresh token format');
    }

    const result = await AuthServices.refreshToken(cleanToken);

    // Set the refresh token in a cookie as well for redundancy
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: req.get('origin') ? new URL(req.get('origin') || '').hostname : undefined,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
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

    // Clear the invalid refresh token cookie
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

  // Get domain from request origin or use default
  const origin = req.get('origin');
  let domain;

  if (origin && config.NODE_ENV === 'production') {
    try {
      // Extract domain from origin (e.g., https://example.com -> example.com)
      domain = new URL(origin || '').hostname;
      // If it's not localhost, ensure we have the root domain for cookies
      if (!domain.includes('localhost')) {
        // Handle subdomains by getting the root domain
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
    secure: true, // Always use secure in modern browsers
    httpOnly: true,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' for cross-site in production
    domain: domain || undefined, // Set domain in production
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User is logged out successfully!',
    data: null,
  });
});


const verifyEmail = catchAsync(async (req, res) => {
  const { code } = req.body;

  const result = await AuthServices.verifyEmail(code);

  // Generate access and refresh tokens for the verified user
  const { user } = result;

  if (user) {
    const jwtPayload = {
      email: user.email,
      role: user.role,
      _id: user._id?.toString(),
    };

    const accessToken = createToken(
      jwtPayload,
      config.jwt_access_secret as string,
      config.jwt_access_expires_in as StringValue,
    );

    const refreshToken = createToken(
      jwtPayload,
      config.jwt_refresh_secret as string,
      config.jwt_refresh_expires_in as StringValue,
    );

    // Set refresh token as cookie
    res.cookie('refreshToken', refreshToken, {
      secure: config.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Email verified successfully!',
      data: {
        ...result,
        accessToken,
      },
    });
  } else {
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Email verified successfully!',
      data: result,
    });
  }
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

export const AuthControllers = {
  loginUser,
  changePassword,
  refreshToken,
  forgetPassword,
  resetPassword,
  logoutUser,
  verifyEmail,
  resendVerificationEmail,
};
