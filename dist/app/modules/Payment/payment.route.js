"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const payment_controller_1 = require("./payment.controller");
const payout_controller_1 = require("./payout.controller");
const router = (0, express_1.Router)();
// Checkout and payment processing
router.post('/create-checkout-session', (0, auth_1.default)(user_constant_1.USER_ROLE.student), payment_controller_1.PaymentControllers.createCheckoutSession);
// Webhook route - no auth middleware to allow Stripe to call it
router.post('/webhook', payment_controller_1.PaymentControllers.handleWebhook);
// Stripe Connect for teachers
router.post('/connect-stripe/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payment_controller_1.PaymentControllers.connectStripeAccount);
router.post('/create-onboarding-link/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payment_controller_1.PaymentControllers.createOnboardingLink);
router.get('/stripe-account-status/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payment_controller_1.PaymentControllers.checkStripeAccountStatus);
router.post('/save-stripe-details/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payment_controller_1.PaymentControllers.saveStripeAccountDetails);
// Earnings and transactions
router.get('/earnings/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payment_controller_1.PaymentControllers.getEarnings);
router.get('/payout-info/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payment_controller_1.PaymentControllers.getTeacherPayoutInfo);
router.get('/upcoming-payout/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payment_controller_1.PaymentControllers.getTeacherUpcomingPayout);
router.get('/transactions/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payment_controller_1.PaymentControllers.getTeacherTransactionSummary);
router.get('/analytics/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payment_controller_1.PaymentControllers.getTransactionAnalytics);
router.get('/transaction/:transactionId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), payment_controller_1.PaymentControllers.getTransactionById);
router.get('/session/:sessionId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), payment_controller_1.PaymentControllers.getTransactionBySessionId);
router.get('/student-transactions/:studentId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), payment_controller_1.PaymentControllers.getStudentTransactions);
// Payout routes
router.post('/payouts/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payout_controller_1.PayoutController.createPayoutRequest);
router.get('/payouts/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payout_controller_1.PayoutController.getPayoutHistory);
router.get('/payouts/details/:payoutId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payout_controller_1.PayoutController.getPayoutById);
router.put('/payouts/preferences/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payout_controller_1.PayoutController.updatePayoutPreferences);
router.get('/payouts/preferences/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), payout_controller_1.PayoutController.getPayoutPreferences);
exports.PaymentRoutes = router;
