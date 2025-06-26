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
exports.StripeConnectWebhook = void 0;
const stripe_1 = __importDefault(require("stripe"));
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const teacher_model_1 = require("../Teacher/teacher.model");
const config_1 = __importDefault(require("../../config"));
const stripe = new stripe_1.default(config_1.default.stripe_secret_key, {
    apiVersion: '2025-04-30.basil',
});
// Webhook endpoint secret for verification
const endpointSecret = config_1.default.stripe_webhook_secret;
// Handle Stripe Connect webhooks with enhanced processing
const handleWebhook = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const sig = req.headers['stripe-signature'];
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    let event;
    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    }
    catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, `Webhook Error: ${err.message}`);
    }
    console.log(`Received Stripe webhook event: ${event.type} for account: ${event.account || 'N/A'}`);
    try {
        // Handle the event with atomic operations
        switch (event.type) {
            case 'account.updated':
                yield handleAccountUpdated(event.data.object, ipAddress, userAgent);
                break;
            case 'account.application.deauthorized':
                yield handleAccountDeauthorized(event.data.object, ipAddress, userAgent);
                break;
            case 'capability.updated':
                yield handleCapabilityUpdated(event.data.object, ipAddress, userAgent);
                break;
            case 'person.updated':
                yield handlePersonUpdated(event.data.object, ipAddress, userAgent);
                break;
            case 'account.external_account.created':
            case 'account.external_account.updated':
                yield handleExternalAccountUpdated(event.data.object, ipAddress, userAgent);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
                // Still log unhandled events for audit purposes
                if (event.account) {
                    yield logWebhookReceipt(event.account, event.type, event.data.object, ipAddress, userAgent);
                }
        }
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Webhook processed successfully',
            data: {
                received: true,
                eventType: event.type,
                eventId: event.id,
                processedAt: new Date().toISOString()
            },
        });
    }
    catch (error) {
        console.error('Error processing webhook:', error);
        // Log webhook processing error
        if (event.account) {
            yield logWebhookError(event.account, event.type, error, ipAddress, userAgent);
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to process webhook');
    }
}));
// Handle account.updated event with atomic operations
const handleAccountUpdated = (account, ipAddress, userAgent) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: account.id },
                { 'stripeConnect.accountId': account.id }
            ]
        });
        if (!teacher) {
            console.log(`Teacher not found for Stripe account: ${account.id}`);
            return;
        }
        // Determine status based on account state with enhanced logic
        let status = 'pending';
        let statusReason = '';
        if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
            status = 'connected';
            statusReason = 'Account fully verified and operational';
        }
        else if (((_a = account.requirements) === null || _a === void 0 ? void 0 : _a.errors) && account.requirements.errors.length > 0) {
            status = 'restricted';
            statusReason = `Account restricted: ${account.requirements.errors.map(e => e.reason).join(', ')}`;
        }
        else if (((_b = account.requirements) === null || _b === void 0 ? void 0 : _b.currently_due) && account.requirements.currently_due.length > 0) {
            status = 'pending';
            statusReason = `Pending verification: ${account.requirements.currently_due.join(', ')}`;
        }
        else if (!account.details_submitted) {
            status = 'pending';
            statusReason = 'Onboarding not completed';
        }
        // Atomic update with optimistic concurrency control
        const updateResult = yield teacher_model_1.Teacher.findOneAndUpdate({
            _id: teacher._id,
            // Prevent concurrent webhook processing conflicts
            $or: [
                { 'stripeConnect.lastWebhookReceived': { $lt: new Date(Date.now() - 5000) } },
                { 'stripeConnect.lastWebhookReceived': { $exists: false } }
            ]
        }, {
            $set: {
                'stripeConnect.status': status,
                'stripeConnect.verified': account.details_submitted && account.charges_enabled,
                'stripeConnect.onboardingComplete': account.details_submitted,
                'stripeConnect.requirements': ((_c = account.requirements) === null || _c === void 0 ? void 0 : _c.currently_due) || [],
                'stripeConnect.capabilities.card_payments': (_d = account.capabilities) === null || _d === void 0 ? void 0 : _d.card_payments,
                'stripeConnect.capabilities.transfers': (_e = account.capabilities) === null || _e === void 0 ? void 0 : _e.transfers,
                'stripeConnect.lastStatusUpdate': new Date(),
                'stripeConnect.lastWebhookReceived': new Date(),
                'stripeConnect.failureReason': status === 'restricted' ? statusReason : undefined,
                // Update legacy fields for backward compatibility
                stripeVerified: account.details_submitted && account.charges_enabled,
                stripeOnboardingComplete: account.details_submitted,
                stripeRequirements: ((_f = account.requirements) === null || _f === void 0 ? void 0 : _f.currently_due) || [],
            },
            $push: {
                stripeAuditLog: {
                    action: 'webhook_received',
                    timestamp: new Date(),
                    details: {
                        event: 'account.updated',
                        status,
                        statusReason,
                        charges_enabled: account.charges_enabled,
                        payouts_enabled: account.payouts_enabled,
                        details_submitted: account.details_submitted,
                        requirements: account.requirements,
                        capabilities: account.capabilities,
                        business_profile: account.business_profile,
                    },
                    ipAddress,
                    userAgent,
                },
            },
        }, { new: true });
        if (updateResult) {
            console.log(`Successfully updated teacher ${teacher._id} with Stripe account status: ${status}`);
        }
        else {
            console.log(`Skipped update for teacher ${teacher._id} due to concurrent processing`);
        }
    }
    catch (error) {
        console.error('Error handling account.updated webhook:', error);
        throw error;
    }
});
// Handle account.application.deauthorized event
const handleAccountDeauthorized = (deauthorization, ipAddress, userAgent) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: deauthorization.account },
                { 'stripeConnect.accountId': deauthorization.account }
            ]
        });
        if (!teacher) {
            console.log(`Teacher not found for deauthorized account: ${deauthorization.account}`);
            return;
        }
        // Atomic update for account deauthorization
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            $set: {
                'stripeConnect.status': 'disconnected',
                'stripeConnect.disconnectedAt': new Date(),
                'stripeConnect.lastStatusUpdate': new Date(),
                'stripeConnect.lastWebhookReceived': new Date(),
                'stripeConnect.failureReason': 'Account deauthorized by user',
                // Clear sensitive data
                'stripeConnect.onboardingUrl': undefined,
                'stripeConnect.capabilities': undefined,
            },
            $push: {
                stripeAuditLog: {
                    action: 'webhook_received',
                    timestamp: new Date(),
                    details: {
                        event: 'account.application.deauthorized',
                        reason: 'Account deauthorized by user',
                        accountId: deauthorization.account,
                    },
                    ipAddress,
                    userAgent,
                },
            },
        });
        console.log(`Teacher ${teacher._id} Stripe account deauthorized`);
    }
    catch (error) {
        console.error('Error handling account.application.deauthorized webhook:', error);
        throw error;
    }
});
// Handle capability.updated event
const handleCapabilityUpdated = (capability, ipAddress, userAgent) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: capability.account },
                { 'stripeConnect.accountId': capability.account }
            ]
        });
        if (!teacher) {
            console.log(`Teacher not found for capability update: ${capability.account}`);
            return;
        }
        // Update specific capability with atomic operation
        const updateField = `stripeConnect.capabilities.${capability.id}`;
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            $set: {
                [updateField]: capability.status,
                'stripeConnect.lastStatusUpdate': new Date(),
                'stripeConnect.lastWebhookReceived': new Date(),
            },
            $push: {
                stripeAuditLog: {
                    action: 'webhook_received',
                    timestamp: new Date(),
                    details: {
                        event: 'capability.updated',
                        capability: capability.id,
                        status: capability.status,
                        requirements: capability.requirements,
                    },
                    ipAddress,
                    userAgent,
                },
            },
        });
        console.log(`Updated capability ${capability.id} to ${capability.status} for teacher ${teacher._id}`);
    }
    catch (error) {
        console.error('Error handling capability.updated webhook:', error);
        throw error;
    }
});
// Handle person.updated event
const handlePersonUpdated = (person, ipAddress, userAgent) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: person.account },
                { 'stripeConnect.accountId': person.account }
            ]
        });
        if (!teacher) {
            console.log(`Teacher not found for person update: ${person.account}`);
            return;
        }
        // Log person update with enhanced details
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            $set: {
                'stripeConnect.lastWebhookReceived': new Date(),
            },
            $push: {
                stripeAuditLog: {
                    action: 'webhook_received',
                    timestamp: new Date(),
                    details: {
                        event: 'person.updated',
                        person_id: person.id,
                        verification: person.verification,
                        requirements: person.requirements,
                    },
                    ipAddress,
                    userAgent,
                },
            },
        });
        console.log(`Person updated for teacher ${teacher._id}`);
    }
    catch (error) {
        console.error('Error handling person.updated webhook:', error);
        throw error;
    }
});
// Handle external account updates (bank accounts, cards)
const handleExternalAccountUpdated = (externalAccount, ipAddress, userAgent) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: externalAccount.account },
                { 'stripeConnect.accountId': externalAccount.account }
            ]
        });
        if (!teacher) {
            console.log(`Teacher not found for external account update: ${externalAccount.account}`);
            return;
        }
        // Log external account update
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            $set: {
                'stripeConnect.lastWebhookReceived': new Date(),
            },
            $push: {
                stripeAuditLog: {
                    action: 'webhook_received',
                    timestamp: new Date(),
                    details: {
                        event: 'external_account.updated',
                        external_account_id: externalAccount.id,
                        object: externalAccount.object,
                        status: externalAccount.status,
                    },
                    ipAddress,
                    userAgent,
                },
            },
        });
        console.log(`External account updated for teacher ${teacher._id}`);
    }
    catch (error) {
        console.error('Error handling external account webhook:', error);
        throw error;
    }
});
// Log webhook receipt for audit trail
const logWebhookReceipt = (accountId, eventType, eventData, ipAddress, userAgent) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: accountId },
                { 'stripeConnect.accountId': accountId }
            ]
        });
        if (teacher) {
            yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
                $set: {
                    'stripeConnect.lastWebhookReceived': new Date(),
                },
                $push: {
                    stripeAuditLog: {
                        action: 'webhook_received',
                        timestamp: new Date(),
                        details: {
                            event: eventType,
                            unhandled: true,
                            eventData: eventData ? { id: eventData.id, object: eventData.object } : null,
                        },
                        ipAddress,
                        userAgent,
                    },
                },
            });
        }
    }
    catch (error) {
        console.error('Error logging webhook receipt:', error);
    }
});
// Log webhook processing errors
const logWebhookError = (accountId, eventType, error, ipAddress, userAgent) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: accountId },
                { 'stripeConnect.accountId': accountId }
            ]
        });
        if (teacher) {
            yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
                $push: {
                    stripeAuditLog: {
                        action: 'error_occurred',
                        timestamp: new Date(),
                        details: {
                            event: eventType,
                            error: error.message,
                            stack: error.stack,
                            webhookProcessingError: true,
                        },
                        ipAddress,
                        userAgent,
                    },
                },
            });
        }
    }
    catch (logError) {
        console.error('Error logging webhook error:', logError);
    }
});
exports.StripeConnectWebhook = {
    handleWebhook,
};
