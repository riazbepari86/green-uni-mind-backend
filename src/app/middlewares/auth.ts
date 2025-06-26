import { NextFunction, Request, RequestHandler, Response } from 'express';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import config from '../config';
import AppError from '../errors/AppError';
import catchAsync from '../utils/catchAsync';
import { IUserRole } from '../modules/User/user.interface';
import { User } from '../modules/User/user.model';
import { JwtUserPayload } from '../interface/auth';

// Express Request type extension is now handled in types/express.d.ts

const auth = (...requiredRoles: IUserRole[]): RequestHandler => {
  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    // Extract token from Authorization header (Bearer token)
    const token = req.headers.authorization?.split(' ')[1];

    // checking if the token is missing
    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
    }

    // checking if the given token is valid
    let decoded: JwtUserPayload;
    try {
      if (!config.jwt_access_secret) {
        console.error('JWT access secret is not configured');
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'JWT configuration error');
      }

      decoded = jwt.verify(
        token,
        config.jwt_access_secret as string,
      ) as JwtUserPayload;

      console.log('Token verified successfully for user:', decoded.email);
    } catch (err) {
      console.error('JWT verification error:', err);

      // Check if it's a token expiration error
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        console.log('Token expired at:', (err as any).expiredAt);
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          `Token expired: Please refresh your authentication`
        );
      }

      if (err instanceof Error) {
        throw new AppError(httpStatus.UNAUTHORIZED, `Unauthorized: ${err.message}`);
      }

      throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const { role, email, iat } = decoded;

    // Enhanced logging for debugging
    console.log('🔍 Auth Middleware Debug Info:');
    console.log('- Decoded JWT payload:', JSON.stringify(decoded, null, 2));
    console.log('- Looking up user by email:', email);
    console.log('- User role from token:', role);
    console.log('- Token issued at:', iat ? new Date(iat * 1000).toISOString() : 'N/A');

    // checking if the user is exist
    const user = await User.isUserExists(email);

    console.log('- User lookup result:', user ? 'Found' : 'Not found');
    if (user) {
      console.log('- Found user details:', {
        id: user._id,
        email: user.email,
        role: user.role,
        isOAuthUser: user.isOAuthUser,
        isVerified: user.isVerified,
        status: user.status
      });
    }

    if (!user) {
      console.error('❌ User not found in database for email:', email);
      console.error('❌ This might indicate:');
      console.error('   1. Email mismatch between token and database');
      console.error('   2. User was deleted after token generation');
      console.error('   3. Database connection issue');
      throw new AppError(httpStatus.NOT_FOUND, 'This user is not found !');
    }

    if (
      user.passwordChangedAt &&
      User.isJWTIssuedBeforePasswordChanged(
        user.passwordChangedAt,
        iat as number,
      )
    ) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized !');
    }

    if (requiredRoles && requiredRoles.length > 0) {
      console.log(`Required roles: ${requiredRoles.join(', ')}, User role: ${role}`);

      if (!requiredRoles.includes(role)) {
        console.error(`Role mismatch: User has role "${role}" but needs one of [${requiredRoles.join(', ')}]`);
        throw new AppError(httpStatus.FORBIDDEN, `Access denied. Required role: ${requiredRoles.join(' or ')}`);
      }
    }

    // Add user ID to the decoded token
    req.user = {
      ...decoded,
      _id: user._id?.toString() || '',
    };
    next();
  });
};

export default auth;
