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
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
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

    // checking if the user is exist
    const user = await User.isUserExists(email);

    if (!user) {
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
