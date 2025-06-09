import { Router } from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { AuthValidation } from './auth.validation';
import { AuthControllers } from './auth.controller';
import { TwoFactorController } from './twoFactor.controller';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import { z } from 'zod';

const router = Router();

router.post(
  '/login',
  validateRequest(AuthValidation.loginValidationSchema),
  AuthControllers.loginUser,
);

router.post(
  '/change-password',
  auth( USER_ROLE.teacher, USER_ROLE.student),
  validateRequest(AuthValidation.changePasswordValidationSchema),
  AuthControllers.changePassword,
);

router.post(
  '/refresh-token',
  validateRequest(AuthValidation.refreshTokenValidationSchema),
  AuthControllers.refreshToken,
);

router.post(
  '/forget-password',
  validateRequest(AuthValidation.forgetPasswordValidationSchema),
  AuthControllers.forgetPassword,
);

router.post(
  '/reset-password',
  validateRequest(AuthValidation.resetpasswordValidationSchema),
  AuthControllers.resetPassword,
);

router.post('/logout', AuthControllers.logoutUser);

// Email verification routes
router.post(
  '/verify-email',
  validateRequest(AuthValidation.verifyEmailValidationSchema),
  AuthControllers.verifyEmail,
);

router.post(
  '/resend-verification',
  validateRequest(AuthValidation.resendVerificationEmailValidationSchema),
  AuthControllers.resendVerificationEmail,
);

// Two-factor authentication routes
const setupTwoFactorSchema = z.object({
  params: z.object({
    userId: z.string(),
  }),
});

const verifyTwoFactorSchema = z.object({
  body: z.object({
    token: z.string(),
    userId: z.string(),
    secret: z.string(),
  }),
});

const verifyLoginTwoFactorSchema = z.object({
  body: z.object({
    token: z.string(),
    userId: z.string(),
  }),
});

const disableTwoFactorSchema = z.object({
  body: z.object({
    userId: z.string(),
    password: z.string(),
  }),
});

router.get(
  '/2fa/setup/:userId',
  auth(USER_ROLE.teacher, USER_ROLE.student),
  validateRequest(setupTwoFactorSchema),
  TwoFactorController.setupTwoFactor,
);

router.post(
  '/2fa/verify',
  auth(USER_ROLE.teacher, USER_ROLE.student),
  validateRequest(verifyTwoFactorSchema),
  TwoFactorController.verifyAndEnableTwoFactor,
);

router.post(
  '/2fa/login-verify',
  validateRequest(verifyLoginTwoFactorSchema),
  TwoFactorController.verifyTwoFactorToken,
);

router.post(
  '/2fa/disable',
  auth(USER_ROLE.teacher, USER_ROLE.student),
  validateRequest(disableTwoFactorSchema),
  TwoFactorController.disableTwoFactor,
);

export const AuthRoutes = router;
