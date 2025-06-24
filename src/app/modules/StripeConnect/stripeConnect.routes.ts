import express from 'express';
import { StripeConnectController } from './stripeConnect.controller';
import { StripeConnectWebhook } from './stripeConnect.webhook';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const createAccountSchema = z.object({
  body: z.object({
    type: z.enum(['express', 'standard']),
    country: z.string().min(2, 'Country code is required'),
    email: z.string().email('Valid email is required').optional(), // Optional - will use teacher's email
    business_type: z.enum(['individual', 'company']).optional(),
  }),
});

const createAccountLinkSchema = z.object({
  body: z.object({
    type: z.enum(['account_onboarding', 'account_update']),
    refreshUrl: z.string().url('Valid refresh URL is required').optional(), // Will use default if not provided
    returnUrl: z.string().url('Valid return URL is required').optional(), // Will use default if not provided
  }),
});

const updateAccountSchema = z.object({
  body: z.object({
    business_profile: z.object({
      name: z.string().optional(),
      url: z.string().url().optional(),
      support_phone: z.string().optional(),
      support_email: z.string().email().optional(),
    }).optional(),
    settings: z.object({
      payouts: z.object({
        schedule: z.object({
          interval: z.enum(['manual', 'daily', 'weekly', 'monthly']).optional(),
        }).optional(),
      }).optional(),
    }).optional(),
  }),
});

// Create Stripe Connect account
router.post(
  '/create-account',
  auth(USER_ROLE.teacher),
  validateRequest(createAccountSchema),
  StripeConnectController.createAccount
);

// Create account link for onboarding
router.post(
  '/create-account-link',
  auth(USER_ROLE.teacher),
  validateRequest(createAccountLinkSchema),
  StripeConnectController.createAccountLink
);

// Get account status
router.get(
  '/account-status',
  auth(USER_ROLE.teacher, USER_ROLE.admin),
  StripeConnectController.getAccountStatus
);

// Update account information
router.post(
  '/update-account',
  auth(USER_ROLE.teacher),
  validateRequest(updateAccountSchema),
  StripeConnectController.updateAccount
);

// Disconnect account
router.delete(
  '/disconnect-account',
  auth(USER_ROLE.teacher),
  StripeConnectController.disconnectAccount
);

// Enterprise features
// Retry failed connection
router.post(
  '/retry-connection',
  auth(USER_ROLE.teacher),
  StripeConnectController.retryConnection
);

// Get audit log for compliance
router.get(
  '/audit-log',
  auth(USER_ROLE.teacher, USER_ROLE.admin),
  StripeConnectController.getAuditLog
);

// Enhanced disconnect with tracking
router.delete(
  '/disconnect-enhanced',
  auth(USER_ROLE.teacher),
  StripeConnectController.disconnectAccountEnhanced
);

// Webhook endpoint (no auth required - Stripe handles verification)
router.post('/webhook', StripeConnectWebhook.handleWebhook);

export const StripeConnectRoutes = router;
