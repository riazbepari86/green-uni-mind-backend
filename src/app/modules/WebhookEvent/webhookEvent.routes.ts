import express from 'express';
import { WebhookEventController } from './webhookEvent.controller';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';

const router = express.Router();

// Main webhook endpoint for standard Stripe events (payments, etc.)
// No auth middleware - Stripe needs to call this directly
router.post('/main', WebhookEventController.handleMainWebhook);

// Connect webhook endpoint for Stripe Connect events
// No auth middleware - Stripe needs to call this directly
router.post('/connect', WebhookEventController.handleConnectWebhook);

// Admin endpoints for webhook management and statistics
router.get(
  '/stats',
  auth(USER_ROLE.admin),
  WebhookEventController.getWebhookStats
);

export const WebhookEventRoutes = router;
