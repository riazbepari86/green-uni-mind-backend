import Stripe from 'stripe';
import { Request } from 'express';
import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import config from '../../config';
import { WebhookEvent } from './webhookEvent.model';
import { AuditLog } from '../AuditLog/auditLog.model';
import { 
  IWebhookEvent, 
  WebhookEventType, 
  WebhookEventStatus, 
  WebhookEventSource,
  IWebhookRetryConfig 
} from './webhookEvent.interface';
import { 
  AuditLogAction, 
  AuditLogCategory, 
  AuditLogLevel 
} from '../AuditLog/auditLog.interface';

const stripe = new Stripe(config.stripe_secret_key as string, {
  apiVersion: '2024-06-20',
});

// Default retry configuration
const DEFAULT_RETRY_CONFIG: IWebhookRetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 300000, // 5 minutes
  backoffMultiplier: 2,
  jitterEnabled: true,
  retryableStatuses: ['failed'],
  nonRetryableStatuses: ['duplicate', 'skipped'],
};

// Webhook signature verification
const verifyWebhookSignature = (
  payload: string | Buffer,
  signature: string,
  secret: string,
  source: WebhookEventSource
): Stripe.Event => {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Webhook signature verification failed for ${source}: ${error.message}`
    );
  }
};

// Process incoming webhook with comprehensive tracking
const processIncomingWebhook = async (
  req: Request,
  source: WebhookEventSource
): Promise<{ event: Stripe.Event; webhookEvent: IWebhookEvent }> => {
  const signature = req.headers['stripe-signature'] as string;
  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent');
  
  if (!signature) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Missing Stripe signature header');
  }

  // Determine which webhook secret to use
  const webhookSecret = source === WebhookEventSource.STRIPE_CONNECT 
    ? config.stripe_connect_webhook_secret 
    : config.stripe_webhook_secret;

  // Verify webhook signature
  const event = verifyWebhookSignature(req.body, signature, webhookSecret, source);
  
  // Check for duplicate events
  const existingEvent = await WebhookEvent.findOne({ stripeEventId: event.id });
  if (existingEvent) {
    await logAuditEvent(AuditLogAction.WEBHOOK_RECEIVED, {
      level: AuditLogLevel.WARNING,
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
      webhookEvent: await WebhookEvent.findByIdAndUpdate(
        existingEvent._id,
        { 
          status: WebhookEventStatus.DUPLICATE,
          'metadata.duplicateOfEventId': existingEvent._id.toString(),
        },
        { new: true }
      ) as IWebhookEvent
    };
  }

  // Create webhook event record
  const webhookEvent = new WebhookEvent({
    eventType: event.type as WebhookEventType,
    source,
    status: WebhookEventStatus.PENDING,
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

  await webhookEvent.save();

  // Log audit event
  await logAuditEvent(AuditLogAction.WEBHOOK_RECEIVED, {
    level: AuditLogLevel.INFO,
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
};

// Mark webhook event as processed
const markWebhookProcessed = async (
  webhookEventId: string,
  processingResult: {
    success: boolean;
    error?: string;
    processingTime?: number;
    affectedUserId?: string;
    affectedUserType?: string;
    relatedResourceIds?: string[];
  }
): Promise<void> => {
  const updateData: any = {
    processedAt: new Date(),
    'metadata.processingEndTime': new Date(),
  };

  if (processingResult.success) {
    updateData.status = WebhookEventStatus.PROCESSED;
    updateData['metadata.affectedUserId'] = processingResult.affectedUserId;
    updateData['metadata.affectedUserType'] = processingResult.affectedUserType;
    updateData['metadata.relatedResourceIds'] = processingResult.relatedResourceIds;
  } else {
    updateData.status = WebhookEventStatus.FAILED;
    updateData.failedAt = new Date();
    updateData['metadata.errorMessage'] = processingResult.error;
  }

  if (processingResult.processingTime) {
    updateData['metadata.processingDuration'] = processingResult.processingTime;
  }

  await WebhookEvent.findByIdAndUpdate(webhookEventId, updateData);

  // Log audit event
  await logAuditEvent(
    processingResult.success ? AuditLogAction.WEBHOOK_PROCESSED : AuditLogAction.WEBHOOK_FAILED,
    {
      level: processingResult.success ? AuditLogLevel.INFO : AuditLogLevel.ERROR,
      message: `Webhook event ${processingResult.success ? 'processed successfully' : 'failed'}: ${webhookEventId}`,
      metadata: {
        webhookEventId,
        processingTime: processingResult.processingTime,
        error: processingResult.error,
        affectedUserId: processingResult.affectedUserId,
        affectedUserType: processingResult.affectedUserType,
      },
    }
  );
};

// Schedule webhook retry with exponential backoff
const scheduleWebhookRetry = async (
  webhookEventId: string,
  error: string,
  retryConfig: IWebhookRetryConfig = DEFAULT_RETRY_CONFIG
): Promise<void> => {
  const webhookEvent = await WebhookEvent.findById(webhookEventId);
  if (!webhookEvent) {
    throw new AppError(httpStatus.NOT_FOUND, 'Webhook event not found');
  }

  if (webhookEvent.retryCount >= retryConfig.maxRetries) {
    await WebhookEvent.findByIdAndUpdate(webhookEventId, {
      status: WebhookEventStatus.FAILED,
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

  await WebhookEvent.findByIdAndUpdate(webhookEventId, {
    status: WebhookEventStatus.FAILED,
    retryCount: webhookEvent.retryCount + 1,
    nextRetryAt,
    'metadata.errorMessage': error,
    'metadata.retryAttempts': webhookEvent.retryCount + 1,
  });

  // Log audit event
  await logAuditEvent(AuditLogAction.WEBHOOK_RETRY_ATTEMPTED, {
    level: AuditLogLevel.WARNING,
    message: `Webhook retry scheduled: ${webhookEventId}`,
    metadata: {
      webhookEventId,
      retryCount: webhookEvent.retryCount + 1,
      maxRetries: retryConfig.maxRetries,
      nextRetryAt: nextRetryAt.toISOString(),
      error,
    },
  });
};

// Get pending webhook retries
const getPendingRetries = async (): Promise<IWebhookEvent[]> => {
  return await WebhookEvent.find({
    status: WebhookEventStatus.FAILED,
    nextRetryAt: { $lte: new Date() },
    $expr: { $lt: ['$retryCount', '$maxRetries'] }
  }).sort({ nextRetryAt: 1 });
};

// Helper function to log audit events
const logAuditEvent = async (
  action: AuditLogAction,
  data: {
    level: AuditLogLevel;
    message: string;
    metadata: any;
    userId?: string;
    userType?: string;
  }
): Promise<void> => {
  try {
    await AuditLog.create({
      action,
      category: AuditLogCategory.WEBHOOK,
      level: data.level,
      message: data.message,
      userId: data.userId,
      userType: data.userType,
      resourceType: 'webhook_event',
      metadata: data.metadata,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};

export const WebhookEventService = {
  processIncomingWebhook,
  markWebhookProcessed,
  scheduleWebhookRetry,
  getPendingRetries,
  verifyWebhookSignature,
};
