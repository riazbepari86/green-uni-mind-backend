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
exports.RetryService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const webhookEvent_model_1 = require("../modules/WebhookEvent/webhookEvent.model");
const payout_model_1 = require("../modules/Payment/payout.model");
const webhookEvent_service_1 = require("../modules/WebhookEvent/webhookEvent.service");
const stripeConnect_webhookHandlers_1 = require("../modules/StripeConnect/stripeConnect.webhookHandlers");
const payment_webhookHandlers_1 = require("../modules/Payment/payment.webhookHandlers");
const auditLog_service_1 = require("../modules/AuditLog/auditLog.service");
const webhookEvent_interface_1 = require("../modules/WebhookEvent/webhookEvent.interface");
const payout_interface_1 = require("../modules/Payment/payout.interface");
const auditLog_interface_1 = require("../modules/AuditLog/auditLog.interface");
// Retry failed webhook events
const retryFailedWebhooks = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Starting webhook retry process...');
    try {
        const pendingRetries = yield webhookEvent_service_1.WebhookEventService.getPendingRetries();
        console.log(`Found ${pendingRetries.length} webhooks pending retry`);
        let succeeded = 0;
        let failed = 0;
        let rescheduled = 0;
        for (const webhookEvent of pendingRetries) {
            try {
                console.log(`Retrying webhook: ${webhookEvent.stripeEventId} (attempt ${webhookEvent.retryCount + 1})`);
                // Parse the event data
                const event = JSON.parse(webhookEvent.rawPayload);
                const startTime = Date.now();
                let processingResult = {
                    success: false,
                    error: '',
                    processingTime: 0,
                    affectedUserId: '',
                    affectedUserType: '',
                    relatedResourceIds: [],
                };
                // Route to appropriate handler based on source and event type
                if (webhookEvent.source === webhookEvent_interface_1.WebhookEventSource.STRIPE_CONNECT) {
                    processingResult = yield handleConnectWebhookRetry(event);
                }
                else {
                    processingResult = yield handleMainWebhookRetry(event);
                }
                processingResult.processingTime = Date.now() - startTime;
                if (processingResult.success) {
                    // Ensure all required fields are present
                    const completeResult = {
                        success: processingResult.success,
                        error: processingResult.error || '',
                        processingTime: processingResult.processingTime || Date.now() - startTime,
                        affectedUserId: processingResult.affectedUserId || '',
                        affectedUserType: processingResult.affectedUserType || '',
                        relatedResourceIds: processingResult.relatedResourceIds || [],
                    };
                    // Mark as processed
                    yield webhookEvent_service_1.WebhookEventService.markWebhookProcessed(webhookEvent._id.toString(), completeResult);
                    succeeded++;
                    // Log successful retry
                    yield auditLog_service_1.AuditLogService.createAuditLog({
                        action: auditLog_interface_1.AuditLogAction.WEBHOOK_RETRY_ATTEMPTED,
                        category: auditLog_interface_1.AuditLogCategory.WEBHOOK,
                        level: auditLog_interface_1.AuditLogLevel.INFO,
                        message: `Webhook retry succeeded: ${webhookEvent.stripeEventId}`,
                        metadata: {
                            webhookEventId: webhookEvent._id.toString(),
                            stripeEventId: webhookEvent.stripeEventId,
                            retryAttempt: webhookEvent.retryCount + 1,
                            processingTime: processingResult.processingTime,
                        },
                    });
                }
                else {
                    // Schedule next retry or mark as permanently failed
                    if (webhookEvent.retryCount + 1 >= webhookEvent.maxRetries) {
                        yield webhookEvent_model_1.WebhookEvent.findByIdAndUpdate(webhookEvent._id, {
                            status: webhookEvent_interface_1.WebhookEventStatus.FAILED,
                            failedAt: new Date(),
                            'metadata.errorMessage': `Max retries exceeded: ${processingResult.error}`,
                        });
                        failed++;
                    }
                    else {
                        yield webhookEvent_service_1.WebhookEventService.scheduleWebhookRetry(webhookEvent._id.toString(), processingResult.error || 'Retry failed');
                        rescheduled++;
                    }
                }
            }
            catch (error) {
                console.error(`Error retrying webhook ${webhookEvent.stripeEventId}:`, error);
                // Schedule next retry
                yield webhookEvent_service_1.WebhookEventService.scheduleWebhookRetry(webhookEvent._id.toString(), error.message);
                rescheduled++;
            }
        }
        console.log(`Webhook retry process completed: ${succeeded} succeeded, ${failed} failed, ${rescheduled} rescheduled`);
        return {
            processed: pendingRetries.length,
            succeeded,
            failed,
            rescheduled,
        };
    }
    catch (error) {
        console.error('Error in webhook retry process:', error);
        throw error;
    }
});
// Handle Connect webhook retry
const handleConnectWebhookRetry = (event) => __awaiter(void 0, void 0, void 0, function* () {
    switch (event.type) {
        case 'account.updated':
            return yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleAccountUpdated(event);
        case 'account.application.deauthorized':
            return yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleAccountDeauthorized(event);
        case 'capability.updated':
            return yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleCapabilityUpdated(event);
        case 'person.created':
        case 'person.updated':
            return yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handlePersonUpdated(event);
        case 'account.external_account.created':
        case 'account.external_account.updated':
        case 'account.external_account.deleted':
            return yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handleExternalAccountUpdated(event);
        case 'payout.created':
            return yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handlePayoutCreated(event);
        case 'payout.paid':
            return yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handlePayoutPaid(event);
        case 'payout.failed':
            return yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handlePayoutFailed(event);
        case 'payout.canceled':
            return yield stripeConnect_webhookHandlers_1.StripeConnectWebhookHandlers.handlePayoutCanceled(event);
        default:
            return { success: true, processingTime: 0 };
    }
});
// Handle main webhook retry
const handleMainWebhookRetry = (event) => __awaiter(void 0, void 0, void 0, function* () {
    switch (event.type) {
        case 'checkout.session.completed':
            return yield payment_webhookHandlers_1.PaymentWebhookHandlers.handleCheckoutSessionCompleted(event);
        case 'payment_intent.succeeded':
            return yield payment_webhookHandlers_1.PaymentWebhookHandlers.handlePaymentIntentSucceeded(event);
        case 'payment_intent.payment_failed':
            return yield payment_webhookHandlers_1.PaymentWebhookHandlers.handlePaymentIntentFailed(event);
        case 'charge.succeeded':
            return yield payment_webhookHandlers_1.PaymentWebhookHandlers.handleChargeSucceeded(event);
        case 'charge.failed':
            return yield payment_webhookHandlers_1.PaymentWebhookHandlers.handleChargeFailed(event);
        case 'charge.dispute.created':
            return yield payment_webhookHandlers_1.PaymentWebhookHandlers.handleChargeDisputeCreated(event);
        default:
            return { success: true, processingTime: 0 };
    }
});
// Retry failed payouts
const retryFailedPayouts = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Starting payout retry process...');
    try {
        const failedPayouts = yield payout_model_1.Payout.find({
            status: payout_interface_1.PayoutStatus.FAILED,
            nextRetryAt: { $lte: new Date() },
            $expr: { $lt: ['$retryCount', '$maxRetries'] }
        }).sort({ nextRetryAt: 1 });
        console.log(`Found ${failedPayouts.length} payouts pending retry`);
        let succeeded = 0;
        let failed = 0;
        let rescheduled = 0;
        for (const payout of failedPayouts) {
            try {
                console.log(`Retrying payout: ${payout._id} (attempt ${payout.retryCount + 1})`);
                // Determine if payout should be retried based on failure category
                if (!shouldRetryPayout(payout.failureCategory)) {
                    yield payout_model_1.Payout.findByIdAndUpdate(payout._id, {
                        status: payout_interface_1.PayoutStatus.FAILED,
                        'metadata.permanentFailure': true,
                    });
                    failed++;
                    continue;
                }
                // Attempt to recreate the payout in Stripe
                const retryResult = yield retryPayoutInStripe(payout);
                if (retryResult.success) {
                    yield payout_model_1.Payout.findByIdAndUpdate(payout._id, {
                        status: payout_interface_1.PayoutStatus.SCHEDULED,
                        retryCount: payout.retryCount + 1,
                        nextRetryAt: undefined,
                        $push: {
                            attempts: {
                                attemptNumber: payout.retryCount + 1,
                                attemptedAt: new Date(),
                                status: payout_interface_1.PayoutStatus.SCHEDULED,
                                metadata: { retrySuccess: true },
                            },
                        },
                    });
                    succeeded++;
                }
                else {
                    if (payout.retryCount + 1 >= payout.maxRetries) {
                        yield payout_model_1.Payout.findByIdAndUpdate(payout._id, {
                            status: payout_interface_1.PayoutStatus.FAILED,
                            failureReason: `Max retries exceeded: ${retryResult.error}`,
                        });
                        failed++;
                    }
                    else {
                        // Schedule next retry
                        const nextRetryAt = calculateNextRetryTime(payout.retryCount + 1, payout.retryConfig);
                        yield payout_model_1.Payout.findByIdAndUpdate(payout._id, {
                            retryCount: payout.retryCount + 1,
                            nextRetryAt,
                            $push: {
                                attempts: {
                                    attemptNumber: payout.retryCount + 1,
                                    attemptedAt: new Date(),
                                    status: payout_interface_1.PayoutStatus.FAILED,
                                    failureReason: retryResult.error,
                                },
                            },
                        });
                        rescheduled++;
                    }
                }
            }
            catch (error) {
                console.error(`Error retrying payout ${payout._id}:`, error);
                rescheduled++;
            }
        }
        console.log(`Payout retry process completed: ${succeeded} succeeded, ${failed} failed, ${rescheduled} rescheduled`);
        return {
            processed: failedPayouts.length,
            succeeded,
            failed,
            rescheduled,
        };
    }
    catch (error) {
        console.error('Error in payout retry process:', error);
        throw error;
    }
});
// Helper functions
const shouldRetryPayout = (failureCategory) => {
    const nonRetryableCategories = [
        payout_interface_1.PayoutFailureCategory.ACCOUNT_CLOSED,
        payout_interface_1.PayoutFailureCategory.INVALID_ACCOUNT,
        payout_interface_1.PayoutFailureCategory.COMPLIANCE_ISSUE,
    ];
    return !failureCategory || !nonRetryableCategories.includes(failureCategory);
};
const retryPayoutInStripe = (payout) => __awaiter(void 0, void 0, void 0, function* () {
    // This would implement the actual Stripe payout retry logic
    // For now, returning a placeholder
    return {
        success: false,
        error: 'Payout retry not implemented yet',
    };
});
const calculateNextRetryTime = (retryCount, retryConfig) => {
    const baseDelay = (retryConfig === null || retryConfig === void 0 ? void 0 : retryConfig.baseDelay) || 60000; // 1 minute
    const maxDelay = (retryConfig === null || retryConfig === void 0 ? void 0 : retryConfig.maxDelay) || 3600000; // 1 hour
    const backoffMultiplier = (retryConfig === null || retryConfig === void 0 ? void 0 : retryConfig.backoffMultiplier) || 2;
    const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, retryCount), maxDelay);
    const jitter = (retryConfig === null || retryConfig === void 0 ? void 0 : retryConfig.jitterEnabled) ? Math.random() * 0.1 * delay : 0;
    return new Date(Date.now() + delay + jitter);
};
// Initialize cron jobs for automatic retries
const initializeRetryJobs = () => {
    // Retry failed webhooks every 5 minutes
    node_cron_1.default.schedule('*/5 * * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield retryFailedWebhooks();
        }
        catch (error) {
            console.error('Error in webhook retry cron job:', error);
        }
    }));
    // Retry failed payouts every 15 minutes
    node_cron_1.default.schedule('*/15 * * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield retryFailedPayouts();
        }
        catch (error) {
            console.error('Error in payout retry cron job:', error);
        }
    }));
    console.log('Retry service cron jobs initialized');
};
exports.RetryService = {
    retryFailedWebhooks,
    retryFailedPayouts,
    initializeRetryJobs,
};
