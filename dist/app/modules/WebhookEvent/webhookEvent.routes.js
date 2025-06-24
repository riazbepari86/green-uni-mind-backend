"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookEventRoutes = void 0;
const express_1 = __importDefault(require("express"));
const webhookEvent_controller_1 = require("./webhookEvent.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const router = express_1.default.Router();
// Main webhook endpoint for standard Stripe events (payments, etc.)
// No auth middleware - Stripe needs to call this directly
router.post('/main', webhookEvent_controller_1.WebhookEventController.handleMainWebhook);
// Connect webhook endpoint for Stripe Connect events
// No auth middleware - Stripe needs to call this directly
router.post('/connect', webhookEvent_controller_1.WebhookEventController.handleConnectWebhook);
// Admin endpoints for webhook management and statistics
router.get('/stats', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), webhookEvent_controller_1.WebhookEventController.getWebhookStats);
exports.WebhookEventRoutes = router;
