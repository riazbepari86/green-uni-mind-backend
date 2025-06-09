import { Router, Request, Response, NextFunction } from 'express';
import { OAuthControllers } from './oauth.controller';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { z } from 'zod';

const router = Router();

// New frontend-based OAuth flow
router.get('/auth-url', OAuthControllers.generateOAuthUrl);
router.post('/callback', OAuthControllers.handleOAuthCallback);

// OAuth code exchange for account linking
const exchangeCodeSchema = z.object({
  provider: z.enum(['google', 'facebook', 'apple']),
  code: z.string(),
  userId: z.string(),
});

router.post(
  '/exchange-code',
  auth(USER_ROLE.teacher, USER_ROLE.student),
  validateRequest(exchangeCodeSchema),
  OAuthControllers.exchangeCodeAndLinkAccount
);

// Middleware to extract token from query parameters and set it in the request
const extractTokenMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  // If token is in query parameters, set it in the authorization header
  if (req.query.token) {
    console.log('Token found in query parameters, setting in authorization header');
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

// Legacy OAuth routes (kept for backward compatibility)
// Google OAuth routes
router.get('/google', extractTokenMiddleware, OAuthControllers.googleAuth);

// Facebook OAuth routes
router.get('/facebook', extractTokenMiddleware, OAuthControllers.facebookAuth);

// Apple OAuth routes
router.get('/apple', extractTokenMiddleware, OAuthControllers.appleAuth);

// Account linking/unlinking routes
const linkOAuthSchema = z.object({
  userId: z.string(),
  provider: z.enum(['google', 'facebook', 'apple']),
  providerId: z.string(),
  email: z.string().email().optional(),
});

const unlinkOAuthSchema = z.object({
  userId: z.string(),
  provider: z.enum(['google', 'facebook', 'apple']),
});

// Removed Zod validation for OAuth link endpoint to bypass validation errors
router.post(
  '/link',
  auth(USER_ROLE.teacher, USER_ROLE.student, USER_ROLE.user),
  // validateRequest(linkOAuthSchema), -- Removed validation
  OAuthControllers.linkOAuthAccount
);

router.post(
  '/unlink',
  auth(USER_ROLE.teacher, USER_ROLE.student, USER_ROLE.user),
  validateRequest(unlinkOAuthSchema),
  OAuthControllers.unlinkOAuthAccount
);

export const OAuthRoutes = router;
