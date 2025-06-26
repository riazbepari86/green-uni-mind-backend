import cron from 'node-cron';
import { Types } from 'mongoose';
import { WebhookEvent } from '../modules/WebhookEvent/webhookEvent.model';
import { Payout } from '../modules/Payment/payout.model';
import { WebhookEventService } from '../modules/WebhookEvent/webhookEvent.service';
import { StripeConnectWebhookHandlers } from '../modules/StripeConnect/stripeConnect.webhookHandlers';
import { PaymentWebhookHandlers } from '../modules/Payment/payment.webhookHandlers';
import { AuditLogService } from '../modules/AuditLog/auditLog.service';
import { 
  WebhookEventStatus, 
  WebhookEventSource, 
  WebhookEventType 
} from '../modules/WebhookEvent/webhookEvent.interface';
import { 
  PayoutStatus, 
  PayoutFailureCategory 
} from '../modules/Payment/payout.interface';
import { 
  AuditLogAction, 
  AuditLogCategory, 
  AuditLogLevel 
} from '../modules/AuditLog/auditLog.interface';

interface RetryResult {
  success: boolean;
  error?: string;
  retryScheduled?: boolean;
  nextRetryAt?: Date;
}

// Retry failed webhook events
const retryFailedWebhooks = async (): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  rescheduled: number;
}> => {
  console.log('Starting webhook retry process...');
  
  try {
    const pendingRetries = await WebhookEventService.getPendingRetries();
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

        let processingResult: {
          success: boolean;
          error?: string;
          processingTime?: number;
          affectedUserId?: string;
          affectedUserType?: string;
          relatedResourceIds?: string[];
        } = {
          success: false,
          error: '',
          processingTime: 0,
          affectedUserId: '',
          affectedUserType: '',
          relatedResourceIds: [] as string[],
        };

        // Route to appropriate handler based on source and event type
        if (webhookEvent.source === WebhookEventSource.STRIPE_CONNECT) {
          processingResult = await handleConnectWebhookRetry(event);
        } else {
          processingResult = await handleMainWebhookRetry(event);
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
          await WebhookEventService.markWebhookProcessed(
            (webhookEvent._id as Types.ObjectId).toString(),
            completeResult
          );
          succeeded++;

          // Log successful retry
          await AuditLogService.createAuditLog({
            action: AuditLogAction.WEBHOOK_RETRY_ATTEMPTED,
            category: AuditLogCategory.WEBHOOK,
            level: AuditLogLevel.INFO,
            message: `Webhook retry succeeded: ${webhookEvent.stripeEventId}`,
            metadata: {
              webhookEventId: (webhookEvent._id as Types.ObjectId).toString(),
              stripeEventId: webhookEvent.stripeEventId,
              retryAttempt: webhookEvent.retryCount + 1,
              processingTime: processingResult.processingTime,
            },
          });
        } else {
          // Schedule next retry or mark as permanently failed
          if (webhookEvent.retryCount + 1 >= webhookEvent.maxRetries) {
            await WebhookEvent.findByIdAndUpdate(webhookEvent._id, {
              status: WebhookEventStatus.FAILED,
              failedAt: new Date(),
              'metadata.errorMessage': `Max retries exceeded: ${processingResult.error}`,
            });
            failed++;
          } else {
            await WebhookEventService.scheduleWebhookRetry(
              (webhookEvent._id as Types.ObjectId).toString(),
              processingResult.error || 'Retry failed'
            );
            rescheduled++;
          }
        }

      } catch (error: any) {
        console.error(`Error retrying webhook ${webhookEvent.stripeEventId}:`, error);
        
        // Schedule next retry
        await WebhookEventService.scheduleWebhookRetry(
          (webhookEvent._id as Types.ObjectId).toString(),
          error.message
        );
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

  } catch (error: any) {
    console.error('Error in webhook retry process:', error);
    throw error;
  }
};

// Handle Connect webhook retry
const handleConnectWebhookRetry = async (event: any) => {
  switch (event.type) {
    case 'account.updated':
      return await StripeConnectWebhookHandlers.handleAccountUpdated(event);
    case 'account.application.deauthorized':
      return await StripeConnectWebhookHandlers.handleAccountDeauthorized(event);
    case 'capability.updated':
      return await StripeConnectWebhookHandlers.handleCapabilityUpdated(event);
    case 'person.created':
    case 'person.updated':
      return await StripeConnectWebhookHandlers.handlePersonUpdated(event);
    case 'account.external_account.created':
    case 'account.external_account.updated':
    case 'account.external_account.deleted':
      return await StripeConnectWebhookHandlers.handleExternalAccountUpdated(event);
    case 'payout.created':
      return await StripeConnectWebhookHandlers.handlePayoutCreated(event);
    case 'payout.paid':
      return await StripeConnectWebhookHandlers.handlePayoutPaid(event);
    case 'payout.failed':
      return await StripeConnectWebhookHandlers.handlePayoutFailed(event);
    case 'payout.canceled':
      return await StripeConnectWebhookHandlers.handlePayoutCanceled(event);
    default:
      return { success: true, processingTime: 0 };
  }
};

// Handle main webhook retry
const handleMainWebhookRetry = async (event: any) => {
  switch (event.type) {
    case 'checkout.session.completed':
      return await PaymentWebhookHandlers.handleCheckoutSessionCompleted(event);
    case 'payment_intent.succeeded':
      return await PaymentWebhookHandlers.handlePaymentIntentSucceeded(event);
    case 'payment_intent.payment_failed':
      return await PaymentWebhookHandlers.handlePaymentIntentFailed(event);
    case 'charge.succeeded':
      return await PaymentWebhookHandlers.handleChargeSucceeded(event);
    case 'charge.failed':
      return await PaymentWebhookHandlers.handleChargeFailed(event);
    case 'charge.dispute.created':
      return await PaymentWebhookHandlers.handleChargeDisputeCreated(event);
    default:
      return { success: true, processingTime: 0 };
  }
};

// Retry failed payouts
const retryFailedPayouts = async (): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  rescheduled: number;
}> => {
  console.log('Starting payout retry process...');
  
  try {
    const failedPayouts = await Payout.find({
      status: PayoutStatus.FAILED,
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
          await Payout.findByIdAndUpdate(payout._id, {
            status: PayoutStatus.FAILED,
            'metadata.permanentFailure': true,
          });
          failed++;
          continue;
        }

        // Attempt to recreate the payout in Stripe
        const retryResult = await retryPayoutInStripe(payout);

        if (retryResult.success) {
          await Payout.findByIdAndUpdate(payout._id, {
            status: PayoutStatus.SCHEDULED,
            retryCount: payout.retryCount + 1,
            nextRetryAt: undefined,
            $push: {
              attempts: {
                attemptNumber: payout.retryCount + 1,
                attemptedAt: new Date(),
                status: PayoutStatus.SCHEDULED,
                metadata: { retrySuccess: true },
              },
            },
          });
          succeeded++;
        } else {
          if (payout.retryCount + 1 >= payout.maxRetries) {
            await Payout.findByIdAndUpdate(payout._id, {
              status: PayoutStatus.FAILED,
              failureReason: `Max retries exceeded: ${retryResult.error}`,
            });
            failed++;
          } else {
            // Schedule next retry
            const nextRetryAt = calculateNextRetryTime(payout.retryCount + 1, payout.retryConfig);
            await Payout.findByIdAndUpdate(payout._id, {
              retryCount: payout.retryCount + 1,
              nextRetryAt,
              $push: {
                attempts: {
                  attemptNumber: payout.retryCount + 1,
                  attemptedAt: new Date(),
                  status: PayoutStatus.FAILED,
                  failureReason: retryResult.error,
                },
              },
            });
            rescheduled++;
          }
        }

      } catch (error: any) {
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

  } catch (error: any) {
    console.error('Error in payout retry process:', error);
    throw error;
  }
};

// Helper functions
const shouldRetryPayout = (failureCategory?: PayoutFailureCategory): boolean => {
  const nonRetryableCategories = [
    PayoutFailureCategory.ACCOUNT_CLOSED,
    PayoutFailureCategory.INVALID_ACCOUNT,
    PayoutFailureCategory.COMPLIANCE_ISSUE,
  ];
  
  return !failureCategory || !nonRetryableCategories.includes(failureCategory);
};

const retryPayoutInStripe = async (payout: any): Promise<RetryResult> => {
  // This would implement the actual Stripe payout retry logic
  // For now, returning a placeholder
  return {
    success: false,
    error: 'Payout retry not implemented yet',
  };
};

const calculateNextRetryTime = (retryCount: number, retryConfig: any): Date => {
  const baseDelay = retryConfig?.baseDelay || 60000; // 1 minute
  const maxDelay = retryConfig?.maxDelay || 3600000; // 1 hour
  const backoffMultiplier = retryConfig?.backoffMultiplier || 2;
  
  const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, retryCount), maxDelay);
  const jitter = retryConfig?.jitterEnabled ? Math.random() * 0.1 * delay : 0;
  
  return new Date(Date.now() + delay + jitter);
};

// Initialize cron jobs for automatic retries
const initializeRetryJobs = (): void => {
  // Retry failed webhooks every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await retryFailedWebhooks();
    } catch (error) {
      console.error('Error in webhook retry cron job:', error);
    }
  });

  // Retry failed payouts every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await retryFailedPayouts();
    } catch (error) {
      console.error('Error in payout retry cron job:', error);
    }
  });

  console.log('Retry service cron jobs initialized');
};

export const RetryService = {
  retryFailedWebhooks,
  retryFailedPayouts,
  initializeRetryJobs,
};
