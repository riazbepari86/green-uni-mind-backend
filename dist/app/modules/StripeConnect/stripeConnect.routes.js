"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeConnectRoutes = void 0;
const express_1 = __importDefault(require("express"));
const stripeConnect_controller_1 = require("./stripeConnect.controller");
const stripeConnect_webhook_1 = require("./stripeConnect.webhook");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const zod_1 = require("zod");
const router = express_1.default.Router();
// Validation schemas
const createAccountSchema = zod_1.z.object({
    body: zod_1.z.object({
        type: zod_1.z.enum(['express', 'standard']),
        country: zod_1.z.string().min(2, 'Country code is required'),
        email: zod_1.z.string().email('Valid email is required').optional(), // Optional - will use teacher's email
        business_type: zod_1.z.enum(['individual', 'company']).optional(),
    }),
});
const createAccountLinkSchema = zod_1.z.object({
    body: zod_1.z.object({
        type: zod_1.z.enum(['account_onboarding', 'account_update']),
        refreshUrl: zod_1.z.string().url('Valid refresh URL is required').optional(), // Will use default if not provided
        returnUrl: zod_1.z.string().url('Valid return URL is required').optional(), // Will use default if not provided
    }),
});
const updateAccountSchema = zod_1.z.object({
    body: zod_1.z.object({
        business_profile: zod_1.z.object({
            name: zod_1.z.string().optional(),
            url: zod_1.z.string().url().optional(),
            support_phone: zod_1.z.string().optional(),
            support_email: zod_1.z.string().email().optional(),
        }).optional(),
        settings: zod_1.z.object({
            payouts: zod_1.z.object({
                schedule: zod_1.z.object({
                    interval: zod_1.z.enum(['manual', 'daily', 'weekly', 'monthly']).optional(),
                }).optional(),
            }).optional(),
        }).optional(),
    }),
});
// Create Stripe Connect account
router.post('/create-account', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(createAccountSchema), stripeConnect_controller_1.StripeConnectController.createAccount);
// Create account link for onboarding
router.post('/create-account-link', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(createAccountLinkSchema), stripeConnect_controller_1.StripeConnectController.createAccountLink);
// Get account status
router.get('/account-status', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.admin), stripeConnect_controller_1.StripeConnectController.getAccountStatus);
// Update account information
router.post('/update-account', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(updateAccountSchema), stripeConnect_controller_1.StripeConnectController.updateAccount);
// Disconnect account
router.delete('/disconnect-account', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), stripeConnect_controller_1.StripeConnectController.disconnectAccount);
// Enterprise features
// Retry failed connection
router.post('/retry-connection', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), stripeConnect_controller_1.StripeConnectController.retryConnection);
// Get audit log for compliance
router.get('/audit-log', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.admin), stripeConnect_controller_1.StripeConnectController.getAuditLog);
// Enhanced disconnect with tracking
router.delete('/disconnect-enhanced', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), stripeConnect_controller_1.StripeConnectController.disconnectAccountEnhanced);
// Webhook endpoint (no auth required - Stripe handles verification)
router.post('/webhook', stripeConnect_webhook_1.StripeConnectWebhook.handleWebhook);
exports.StripeConnectRoutes = router;
