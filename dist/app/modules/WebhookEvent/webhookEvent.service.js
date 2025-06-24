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
exports.WebhookEventService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const config_1 = __importDefault(require("../../config"));
const webhookEvent_model_1 = require("./webhookEvent.model");
const auditLog_model_1 = require("../AuditLog/auditLog.model");
const webhookEvent_interface_1 = require("./webhookEvent.interface");
const auditLog_interface_1 = require("../AuditLog/auditLog.interface");
const stripe = new stripe_1.default(config_1.default.stripe_secret_key, {
    apiVersion: '2024-06-20',
});
// Default retry configuration
const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 300000, // 5 minutes
    backoffMultiplier: 2,
    jitterEnabled: true,
    retryableStatuses: ['failed'],
    nonRetryableStatuses: ['duplicate', 'skipped'],
};
// Webhook signature verification
const verifyWebhookSignature = (payload, signature, secret, source) => {
    try {
        return stripe.webhooks.constructEvent(payload, signature, secret);
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, `Webhook signature verification failed for ${source}: ${error.message}`);
    }
};
// Process incoming webhook with comprehensive tracking
const processIncomingWebhook = (req, source) => __awaiter(void 0, void 0, void 0, function* () {
    const signature = req.headers['stripe-signature'];
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    if (!signature) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing Stripe signature header');
    }
    // Determine which webhook secret to use
    const webhookSecret = source === webhookEvent_interface_1.WebhookEventSource.STRIPE_CONNECT
        ? config_1.default.stripe_connect_webhook_secret
        : config_1.default.stripe_webhook_secret;
    // Verify webhook signature
    const event = verifyWebhookSignature(req.body, signature, webhookSecret, source);
    // Check for duplicate events
    const existingEvent = yield webhookEvent_model_1.WebhookEvent.findOne({ stripeEventId: event.id });
    if (existingEvent) {
        yield logAuditEvent(auditLog_interface_1.AuditLogAction.WEBHOOK_RECEIVED, {
            level: auditLog_interface_1.AuditLogLevel.WARNING,
            message: `Duplicate webhook event received: ${event.type}`,
            metadata: {
                stripeEventId: event.id,
                stripeAccountId: event.account,
                duplicateOfEventId: existingEvent._id.toString(),
                ipAddress,
                userAgent,
            },
        });
        return {
            event,
            webhookEvent: yield webhookEvent_model_1.WebhookEvent.findByIdAndUpdate(existingEvent._id, {
                status: webhookEvent_interface_1.WebhookEventStatus.DUPLICATE,
                'metadata.duplicateOfEventId': existingEvent._id.toString(),
            }, { new: true })
        };
    }
    // Create webhook event record
    const webhookEvent = new webhookEvent_model_1.WebhookEvent({
        eventType: event.type,
        source,
        status: webhookEvent_interface_1.WebhookEventStatus.PENDING,
        stripeEventId: event.id,
        stripeAccountId: event.account,
        stripeApiVersion: event.api_version,
        eventData: event.data,
        rawPayload: JSON.stringify(event),
        receivedAt: new Date(),
        retryCount: 0,
        maxRetries: DEFAULT_RETRY_CONFIG.maxRetries,
        retryBackoffMultiplier: DEFAULT_RETRY_CONFIG.backoffMultiplier,
        metadata: {
            stripeEventId: event.id,
            stripeAccountId: event.account,
            apiVersion: event.api_version,
            ipAddress,
            userAgent,
            requestHeaders: {
                'stripe-signature': signature,
                'user-agent': userAgent,
                'x-forwarded-for': req.get('x-forwarded-for'),
            },
            processingStartTime: new Date(),
        },
        tags: [event.type, source],
    });
    yield webhookEvent.save();
    // Log audit event
    yield logAuditEvent(auditLog_interface_1.AuditLogAction.WEBHOOK_RECEIVED, {
        level: auditLog_interface_1.AuditLogLevel.INFO,
        message: `Webhook event received: ${event.type}`,
        metadata: {
            stripeEventId: event.id,
            stripeAccountId: event.account,
            eventType: event.type,
            source,
            ipAddress,
            userAgent,
        },
    });
    return { event, webhookEvent };
});
// Mark webhook event as processed
const markWebhookProcessed = (webhookEventId, processingResult) => __awaiter(void 0, void 0, void 0, function* () {
    const updateData = {
        processedAt: new Date(),
        'metadata.processingEndTime': new Date(),
    };
    if (processingResult.success) {
        updateData.status = webhookEvent_interface_1.WebhookEventStatus.PROCESSED;
        updateData['metadata.affectedUserId'] = processingResult.affectedUserId;
        updateData['metadata.affectedUserType'] = processingResult.affectedUserType;
        updateData['metadata.relatedResourceIds'] = processingResult.relatedResourceIds;
    }
    else {
        updateData.status = webhookEvent_interface_1.WebhookEventStatus.FAILED;
        updateData.failedAt = new Date();
        updateData['metadata.errorMessage'] = processingResult.error;
    }
    if (processingResult.processingTime) {
        updateData['metadata.processingDuration'] = processingResult.processingTime;
    }
    yield webhookEvent_model_1.WebhookEvent.findByIdAndUpdate(webhookEventId, updateData);
    // Log audit event
    yield logAuditEvent(processingResult.success ? auditLog_interface_1.AuditLogAction.WEBHOOK_PROCESSED : auditLog_interface_1.AuditLogAction.WEBHOOK_FAILED, {
        level: processingResult.success ? auditLog_interface_1.AuditLogLevel.INFO : auditLog_interface_1.AuditLogLevel.ERROR,
        message: `Webhook event ${processingResult.success ? 'processed successfully' : 'failed'}: ${webhookEventId}`,
        metadata: {
            webhookEventId,
            processingTime: processingResult.processingTime,
            error: processingResult.error,
            affectedUserId: processingResult.affectedUserId,
            affectedUserType: processingResult.affectedUserType,
        },
    });
});
// Schedule webhook retry with exponential backoff
const scheduleWebhookRetry = (webhookEventId_1, error_1, ...args_1) => __awaiter(void 0, [webhookEventId_1, error_1, ...args_1], void 0, function* (webhookEventId, error, retryConfig = DEFAULT_RETRY_CONFIG) {
    const webhookEvent = yield webhookEvent_model_1.WebhookEvent.findById(webhookEventId);
    if (!webhookEvent) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Webhook event not found');
    }
    if (webhookEvent.retryCount >= retryConfig.maxRetries) {
        yield webhookEvent_model_1.WebhookEvent.findByIdAndUpdate(webhookEventId, {
            status: webhookEvent_interface_1.WebhookEventStatus.FAILED,
            failedAt: new Date(),
            'metadata.errorMessage': `Max retries exceeded: ${error}`,
        });
        return;
    }
    // Calculate next retry time with exponential backoff and jitter
    const baseDelay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, webhookEvent.retryCount);
    const delay = Math.min(baseDelay, retryConfig.maxDelay);
    const jitter = retryConfig.jitterEnabled ? Math.random() * 0.1 * delay : 0;
    const nextRetryAt = new Date(Date.now() + delay + jitter);
    yield webhookEvent_model_1.WebhookEvent.findByIdAndUpdate(webhookEventId, {
        status: webhookEvent_interface_1.WebhookEventStatus.FAILED,
        retryCount: webhookEvent.retryCount + 1,
        nextRetryAt,
        'metadata.errorMessage': error,
        'metadata.retryAttempts': webhookEvent.retryCount + 1,
    });
    // Log audit event
    yield logAuditEvent(auditLog_interface_1.AuditLogAction.WEBHOOK_RETRY_ATTEMPTED, {
        level: auditLog_interface_1.AuditLogLevel.WARNING,
        message: `Webhook retry scheduled: ${webhookEventId}`,
        metadata: {
            webhookEventId,
            retryCount: webhookEvent.retryCount + 1,
            maxRetries: retryConfig.maxRetries,
            nextRetryAt: nextRetryAt.toISOString(),
            error,
        },
    });
});
// Get pending webhook retries
const getPendingRetries = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield webhookEvent_model_1.WebhookEvent.find({
        status: webhookEvent_interface_1.WebhookEventStatus.FAILED,
        nextRetryAt: { $lte: new Date() },
        $expr: { $lt: ['$retryCount', '$maxRetries'] }
    }).sort({ nextRetryAt: 1 });
});
// Helper function to log audit events
const logAuditEvent = (action, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield auditLog_model_1.AuditLog.create({
            action,
            category: auditLog_interface_1.AuditLogCategory.WEBHOOK,
            level: data.level,
            message: data.message,
            userId: data.userId,
            userType: data.userType,
            resourceType: 'webhook_event',
            metadata: data.metadata,
            timestamp: new Date(),
        });
    }
    catch (error) {
        console.error('Failed to log audit event:', error);
    }
});
exports.WebhookEventService = {
    processIncomingWebhook,
    markWebhookProcessed,
    scheduleWebhookRetry,
    getPendingRetries,
    verifyWebhookSignature,
};
