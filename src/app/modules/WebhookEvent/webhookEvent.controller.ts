import { Request, Response } from 'express';
import { Types } from 'mongoose';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import AppError from '../../errors/AppError';
import { WebhookEventService } from './webhookEvent.service';
import { StripeConnectWebhookHandlers } from '../StripeConnect/stripeConnect.webhookHandlers';
import { PaymentWebhookHandlers } from '../Payment/payment.webhookHandlers';
import { WebhookEventSource } from './webhookEvent.interface';

// Main webhook endpoint for standard Stripe events (payments, etc.)
const handleMainWebhook = catchAsync(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Process incoming webhook with comprehensive tracking
    const { event, webhookEvent } = await WebhookEventService.processIncomingWebhook(
      req, 
      WebhookEventSource.STRIPE_MAIN
    );

    // Immediately acknowledge receipt to Stripe
    sendResponse(res, {
      statusCode: httpStatus.OK,
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
    setImmediate(async () => {
      try {
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

        // Route to appropriate handler based on event type
        switch (event.type) {
          case 'checkout.session.completed':
            processingResult = await PaymentWebhookHandlers.handleCheckoutSessionCompleted(event);
            break;
          
          case 'payment_intent.succeeded':
            processingResult = await PaymentWebhookHandlers.handlePaymentIntentSucceeded(event);
            break;
          
          case 'payment_intent.payment_failed':
            processingResult = await PaymentWebhookHandlers.handlePaymentIntentFailed(event);
            break;
          
          case 'charge.succeeded':
            processingResult = await PaymentWebhookHandlers.handleChargeSucceeded(event);
            break;
          
          case 'charge.failed':
            processingResult = await PaymentWebhookHandlers.handleChargeFailed(event);
            break;
          
          case 'charge.dispute.created':
            processingResult = await PaymentWebhookHandlers.handleChargeDisputeCreated(event);
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

        // Ensure all required fields are present
        const completeResult = {
          success: processingResult.success,
          error: processingResult.error || '',
          processingTime: processingResult.processingTime || Date.now() - startTime,
          affectedUserId: processingResult.affectedUserId || '',
          affectedUserType: processingResult.affectedUserType || '',
          relatedResourceIds: processingResult.relatedResourceIds || [],
        };

        // Mark webhook as processed
        await WebhookEventService.markWebhookProcessed(
          (webhookEvent._id as Types.ObjectId).toString(),
          completeResult
        );

      } catch (processingError: any) {
        console.error('Error processing main webhook:', processingError);
        
        // Schedule retry if appropriate
        await WebhookEventService.scheduleWebhookRetry(
          (webhookEvent._id as Types.ObjectId).toString(),
          processingError.message
        );
      }
    });

  } catch (error: any) {
    console.error('Error handling main webhook:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to process main webhook: ${error.message}`
    );
  }
});

// Connect webhook endpoint for Stripe Connect events
const handleConnectWebhook = catchAsync(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Process incoming webhook with comprehensive tracking
    const { event, webhookEvent } = await WebhookEventService.processIncomingWebhook(
      req, 
      WebhookEventSource.STRIPE_CONNECT
    );

    // Immediately acknowledge receipt to Stripe
    sendResponse(res, {
      statusCode: httpStatus.OK,
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
    setImmediate(async () => {
      try {
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

        // Route to appropriate handler based on event type
        switch (event.type) {
          case 'account.updated':
            processingResult = await StripeConnectWebhookHandlers.handleAccountUpdated(event);
            break;
          
          case 'account.application.deauthorized':
            processingResult = await StripeConnectWebhookHandlers.handleAccountDeauthorized(event);
            break;
          
          case 'capability.updated':
            processingResult = await StripeConnectWebhookHandlers.handleCapabilityUpdated(event);
            break;
          
          case 'person.created':
          case 'person.updated':
            processingResult = await StripeConnectWebhookHandlers.handlePersonUpdated(event);
            break;
          
          case 'account.external_account.created':
          case 'account.external_account.updated':
          case 'account.external_account.deleted':
            processingResult = await StripeConnectWebhookHandlers.handleExternalAccountUpdated(event);
            break;
          
          case 'payout.created':
            processingResult = await StripeConnectWebhookHandlers.handlePayoutCreated(event);
            break;
          
          case 'payout.paid':
            processingResult = await StripeConnectWebhookHandlers.handlePayoutPaid(event);
            break;
          
          case 'payout.failed':
            processingResult = await StripeConnectWebhookHandlers.handlePayoutFailed(event);
            break;
          
          case 'payout.canceled':
            processingResult = await StripeConnectWebhookHandlers.handlePayoutCanceled(event);
            break;
          
          case 'transfer.created':
            processingResult = await StripeConnectWebhookHandlers.handleTransferCreated(event);
            break;
          
          // Note: transfer.paid and transfer.failed are not in Stripe's official event types
          // but keeping handlers for potential future use
          default:
            if ((event.type as string) === 'transfer.paid') {
              processingResult = await StripeConnectWebhookHandlers.handleTransferPaid(event);
            } else if ((event.type as string) === 'transfer.failed') {
              processingResult = await StripeConnectWebhookHandlers.handleTransferFailed(event);
            } else {
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
            break;
          
          case 'transfer.reversed':
            processingResult = await StripeConnectWebhookHandlers.handleTransferReversed(event);
            break;
        }

        processingResult.processingTime = Date.now() - startTime;

        // Ensure all required fields are present
        const completeResult = {
          success: processingResult.success,
          error: processingResult.error || '',
          processingTime: processingResult.processingTime || Date.now() - startTime,
          affectedUserId: processingResult.affectedUserId || '',
          affectedUserType: processingResult.affectedUserType || '',
          relatedResourceIds: processingResult.relatedResourceIds || [],
        };

        // Mark webhook as processed
        await WebhookEventService.markWebhookProcessed(
          (webhookEvent._id as Types.ObjectId).toString(),
          completeResult
        );

      } catch (processingError: any) {
        console.error('Error processing connect webhook:', processingError);
        
        // Schedule retry if appropriate
        await WebhookEventService.scheduleWebhookRetry(
          (webhookEvent._id as Types.ObjectId).toString(),
          processingError.message
        );
      }
    });

  } catch (error: any) {
    console.error('Error handling connect webhook:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to process connect webhook: ${error.message}`
    );
  }
});

// Get webhook event statistics (admin endpoint)
const getWebhookStats = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate, source, eventType } = req.query;
  
  // Build aggregation pipeline for statistics
  const matchStage: any = {};
  
  if (startDate || endDate) {
    matchStage.receivedAt = {};
    if (startDate) matchStage.receivedAt.$gte = new Date(startDate as string);
    if (endDate) matchStage.receivedAt.$lte = new Date(endDate as string);
  }
  
  if (source) matchStage.source = source;
  if (eventType) matchStage.eventType = eventType;

  // This would be implemented with proper aggregation pipeline
  // For now, returning a placeholder response
  sendResponse(res, {
    statusCode: httpStatus.OK,
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
});

export const WebhookEventController = {
  handleMainWebhook,
  handleConnectWebhook,
  getWebhookStats,
};
