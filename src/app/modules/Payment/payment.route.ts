import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';

import { PaymentControllers } from './payment.controller';
import { PayoutController } from './payout.controller';

const router = Router();

// Checkout and payment processing
router.post(
  '/create-checkout-session',
  auth(USER_ROLE.student),
  PaymentControllers.createCheckoutSession
);

// Webhook route - no auth middleware to allow Stripe to call it
router.post('/webhook', PaymentControllers.handleWebhook as any);

// Stripe Connect for teachers
router.post(
  '/connect-stripe/:teacherId',
  auth(USER_ROLE.teacher),
  PaymentControllers.connectStripeAccount
);

router.post(
  '/create-onboarding-link/:teacherId',
  auth(USER_ROLE.teacher),
  PaymentControllers.createOnboardingLink
);

router.get(
  '/stripe-account-status/:teacherId',
  auth(USER_ROLE.teacher),
  PaymentControllers.checkStripeAccountStatus
);

router.post(
  '/save-stripe-details/:teacherId',
  auth(USER_ROLE.teacher),
  PaymentControllers.saveStripeAccountDetails
);

// Earnings and transactions
router.get(
  '/earnings/:teacherId',
  auth(USER_ROLE.teacher),
  PaymentControllers.getEarnings
);

router.get(
  '/payout-info/:teacherId',
  auth(USER_ROLE.teacher),
  PaymentControllers.getTeacherPayoutInfo
);

router.get(
  '/upcoming-payout/:teacherId',
  auth(USER_ROLE.teacher),
  PaymentControllers.getTeacherUpcomingPayout
);

router.get(
  '/transactions/:teacherId',
  auth(USER_ROLE.teacher),
  PaymentControllers.getTeacherTransactionSummary
);

router.get(
  '/analytics/:teacherId',
  auth(USER_ROLE.teacher),
  PaymentControllers.getTransactionAnalytics
);

router.get(
  '/transaction/:transactionId',
  auth(USER_ROLE.teacher, USER_ROLE.student),
  PaymentControllers.getTransactionById
);

router.get(
  '/session/:sessionId',
  auth(USER_ROLE.teacher, USER_ROLE.student),
  PaymentControllers.getTransactionBySessionId
);

router.get(
  '/student-transactions/:studentId',
  auth(USER_ROLE.student),
  PaymentControllers.getStudentTransactions
);

// Payout routes
router.post(
  '/payouts/:teacherId',
  auth(USER_ROLE.teacher),
  PayoutController.createPayoutRequest
);

router.get(
  '/payouts/:teacherId',
  auth(USER_ROLE.teacher),
  PayoutController.getPayoutHistory
);

router.get(
  '/payouts/details/:payoutId',
  auth(USER_ROLE.teacher),
  PayoutController.getPayoutById
);

router.put(
  '/payouts/preferences/:teacherId',
  auth(USER_ROLE.teacher),
  PayoutController.updatePayoutPreferences
);

router.get(
  '/payouts/preferences/:teacherId',
  auth(USER_ROLE.teacher),
  PayoutController.getPayoutPreferences
);

export const PaymentRoutes = router;