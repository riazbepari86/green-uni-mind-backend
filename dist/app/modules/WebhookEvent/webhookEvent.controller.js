"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookEventController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const webhookEvent_service_1 = require("./webhookEvent.service");
const stripeConnect_webhookHandlers_1 = require("../StripeConnect/stripeConnect.webhookHandlers");
const payment_webhookHandlers_1 = require("../Payment/payment.webhookHandlers");
const webhookEvent_interface_1 = require("./webhookEvent.interface");
// Main webhook endpoint for standard Stripe events (payments, etc.)
const handleMainWebhook = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        // Process incoming webhook with comprehensive tracking
        const { event, webhookEvent } = yield webhookEvent_service_1.WebhookEventService.processIncomingWebhook(req, webhookEvent_interface_1.WebhookEventSource.STRIPE_MAIN);
        // Immediately acknowledge receipt to Stripe
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Webhook received',
            data: {
                received: true,
                eventId: event.id,
                eventType: event.type,
                webhookEventId: webhookEvent._id,
                receivedAt: new Date().toISOString(),
            },
        });
        // Process the webhook asynchronously to avoid timeout
        setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                let processingResult = {
                    success: false,
                    error: '',
                    processingTime: 0,
                    affectedUserId: '',
                    affectedUserType: '',
                    relatedResourceIds: [],
                };
                // Route to appropriate handler based on event type
                switch (event.type) {
                    case 'checkout.session.completed':
                        processingResult = yield payment_webhookHandlers_1.PaymentWebhookHandlers.handleCheckoutSessionCompleted(event);
                        break;
                    case 'payment_intent.succeeded':
                        processingResult = yield payment_webhookHandlers_1.PaymentWebhookHandlers.handlePaymentIntentSucceeded(event);
                        break;
                    case 'payment_intent.payment_failed':
                        processingResult = yield payment_webhookHandlers_1.PaymentWebhookHandlers.handlePaymentIntentFailed(event);
                        break;
                    case 'charge.succeeded':
                        processingResult = yield payment_webhookHandlers_1.PaymentWebhookHandlers.handleChargeSucceeded(event);
                        break;
                    case 'charge.failed':
                        processingResult = yield payment_webhookHandlers_1.PaymentWebhookHandlers.handleChargeFailed(event);
                        break;
                    case 'charge.dispute.created':
                        processingResult = yield payment_webhookHandlers_1.PaymentWebhookHandlers.handleChargeDisputeCreated(event);
                        break;
                    default:
                        console.log(`Unhandled main webhook event type: ${event.type}`);
                        processingResult = {
                            success: true,
                            error: '',
                            processingTime: Date.now() - startTime,
                            affectedUserId: '',
                            affectedUserType: '',
                            relatedResourceIds: [],
                        };
                }
                processingResult.processingTime = Date.now() - startTime;
                // Mark webhook as processed
                yield webhookEvent_service_1.WebhookEventService.markWebhookProcessed(webhookEvent._id.toString(), processingResult);
            }
            catch (processingError) {
                console.error('Error processing main webhook:', processingError);
                // Schedule retry if appropriate
                yield webhookEvent_service_1.WebhookEventService.scheduleWebhookRetry(webhookEvent._id.toString(), processingError.message);
            }
        }));
    }
    catch (error) {
        console.error('Error handling main webhook:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to process main webhook: ${error.message}`);
    }
}));
// Connect webhook endpoint for Stripe Connect events
const handleConnectWebhook = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        // Process incoming webhook with comprehensive tracking
        const { event, webhookEvent } = yield webhookEvent_service_1.WebhookEventService.processIncomingWebhook(req, webhookEvent_interface_1.WebhookEventSource.STRIPE_CONNECT);
        // Immediately acknowledge receipt to Stripe
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Connect webhook received',
            data: {
                received: true,
                eventId: event.id,
                eventType: event.type,
                accountId: event.account,
                webhookEventId: webhookEvent._id,
                receivedAt: new Date().toISOString(),
            },
        });
        // Process the webhook asynchronously to avoid timeout
        setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                let processingResult = {
                    success: false,
                    error: '',
                    processingTime: 0,
                    affectedUserId: '',
                    affectedUserType: '',
                    relatedResourceIds: [],
                };
                // Route to appropriate handler based on event type
                switch (event.type) {
                    case 'account.updated':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleAccountUpdated(event);
                        break;
                    case 'account.application.deauthorized':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleAccountDeauthorized(event);
                        break;
                    case 'capability.updated':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleCapabilityUpdated(event);
                        break;
                    case 'person.created':
                    case 'person.updated':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handlePersonUpdated(event);
                        break;
                    case 'account.external_account.created':
                    case 'account.external_account.updated':
                    case 'account.external_account.deleted':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleExternalAccountUpdated(event);
                        break;
                    case 'payout.created':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handlePayoutCreated(event);
                        break;
                    case 'payout.paid':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handlePayoutPaid(event);
                        break;
                    case 'payout.failed':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handlePayoutFailed(event);
                        break;
                    case 'payout.canceled':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handlePayoutCanceled(event);
                        break;
                    case 'transfer.created':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleTransferCreated(event);
                        break;
                    case 'transfer.paid':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleTransferPaid(event);
                        break;
                    case 'transfer.failed':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleTransferFailed(event);
                        break;
                    case 'transfer.reversed':
                        processingResult = yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleTransferReversed(event);
                        break;
                    default:
                        console.log(`Unhandled connect webhook event type: ${event.type}`);
                        processingResult = {
                            success: true,
                            error: '',
                            processingTime: Date.now() - startTime,
                            affectedUserId: '',
                            affectedUserType: '',
                            relatedResourceIds: [],
                        };
                }
                processingResult.processingTime = Date.now() - startTime;
                // Mark webhook as processed
                yield webhookEvent_service_1.WebhookEventService.markWebhookProcessed(webhookEvent._id.toString(), processingResult);
            }
            catch (processingError) {
                console.error('Error processing connect webhook:', processingError);
                // Schedule retry if appropriate
                yield webhookEvent_service_1.WebhookEventService.scheduleWebhookRetry(webhookEvent._id.toString(), processingError.message);
            }
        }));
    }
    catch (error) {
        console.error('Error handling connect webhook:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to process connect webhook: ${error.message}`);
    }
}));
// Get webhook event statistics (admin endpoint)
const getWebhookStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { startDate, endDate, source, eventType } = req.query;
    // Build aggregation pipeline for statistics
    const matchStage = {};
    if (startDate || endDate) {
        matchStage.receivedAt = {};
        if (startDate)
            matchStage.receivedAt.$gte = new Date(startDate);
        if (endDate)
            matchStage.receivedAt.$lte = new Date(endDate);
    }
    if (source)
        matchStage.source = source;
    if (eventType)
        matchStage.eventType = eventType;
    // This would be implemented with proper aggregation pipeline
    // For now, returning a placeholder response
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Webhook statistics retrieved successfully',
        data: {
            totalEvents: 0,
            eventsByType: {},
            eventsByStatus: {},
            successRate: 0,
            averageProcessingTime: 0,
            // ... more stats
        },
    });
}));
exports.WebhookEventController = {
    handleMainWebhook,
    handleConnectWebhook,
    getWebhookStats,
};
