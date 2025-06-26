import { Request, Response } from 'express';
import Stripe from 'stripe';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import AppError from '../../errors/AppError';
import { Teacher } from '../Teacher/teacher.model';
import config from '../../config';

const stripe = new Stripe(config.stripe_secret_key as string, {
  apiVersion: '2025-04-30.basil',
});

// Webhook endpoint secret for verification
const endpointSecret = config.stripe_webhook_secret as string;

// Handle Stripe Connect webhooks with enhanced processing
const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent');
  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    throw new AppError(httpStatus.BAD_REQUEST, `Webhook Error: ${err.message}`);
  }

  console.log(`Received Stripe webhook event: ${event.type} for account: ${event.account || 'N/A'}`);

  try {
    // Handle the event with atomic operations
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account, ipAddress, userAgent);
        break;

      case 'account.application.deauthorized':
        await handleAccountDeauthorized(event.data.object as any, ipAddress, userAgent);
        break;

      case 'capability.updated':
        await handleCapabilityUpdated(event.data.object as Stripe.Capability, ipAddress, userAgent);
        break;

      case 'person.updated':
        await handlePersonUpdated(event.data.object as Stripe.Person, ipAddress, userAgent);
        break;

      case 'account.external_account.created':
      case 'account.external_account.updated':
        await handleExternalAccountUpdated(event.data.object as any, ipAddress, userAgent);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
        // Still log unhandled events for audit purposes
        if (event.account) {
          await logWebhookReceipt(event.account, event.type, event.data.object, ipAddress, userAgent);
        }
    }

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Webhook processed successfully',
      data: {
        received: true,
        eventType: event.type,
        eventId: event.id,
        processedAt: new Date().toISOString()
      },
    });
  } catch (error: any) {
    console.error('Error processing webhook:', error);

    // Log webhook processing error
    if (event.account) {
      await logWebhookError(event.account, event.type, error, ipAddress, userAgent);
    }

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to process webhook'
    );
  }
});

// Handle account.updated event with atomic operations
const handleAccountUpdated = async (account: Stripe.Account, ipAddress?: string, userAgent?: string) => {
  try {
    const teacher = await Teacher.findOne({
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
    } else if (account.requirements?.errors && account.requirements.errors.length > 0) {
      status = 'restricted';
      statusReason = `Account restricted: ${account.requirements.errors.map(e => e.reason).join(', ')}`;
    } else if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
      status = 'pending';
      statusReason = `Pending verification: ${account.requirements.currently_due.join(', ')}`;
    } else if (!account.details_submitted) {
      status = 'pending';
      statusReason = 'Onboarding not completed';
    }

    // Atomic update with optimistic concurrency control
    const updateResult = await Teacher.findOneAndUpdate(
      {
        _id: teacher._id,
        // Prevent concurrent webhook processing conflicts
        $or: [
          { 'stripeConnect.lastWebhookReceived': { $lt: new Date(Date.now() - 5000) } },
          { 'stripeConnect.lastWebhookReceived': { $exists: false } }
        ]
      },
      {
        $set: {
          'stripeConnect.status': status,
          'stripeConnect.verified': account.details_submitted && account.charges_enabled,
          'stripeConnect.onboardingComplete': account.details_submitted,
          'stripeConnect.requirements': account.requirements?.currently_due || [],
          'stripeConnect.capabilities.card_payments': account.capabilities?.card_payments,
          'stripeConnect.capabilities.transfers': account.capabilities?.transfers,
          'stripeConnect.lastStatusUpdate': new Date(),
          'stripeConnect.lastWebhookReceived': new Date(),
          'stripeConnect.failureReason': status === 'restricted' ? statusReason : undefined,
          // Update legacy fields for backward compatibility
          stripeVerified: account.details_submitted && account.charges_enabled,
          stripeOnboardingComplete: account.details_submitted,
          stripeRequirements: account.requirements?.currently_due || [],
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
      },
      { new: true }
    );

    if (updateResult) {
      console.log(`Successfully updated teacher ${teacher._id} with Stripe account status: ${status}`);
    } else {
      console.log(`Skipped update for teacher ${teacher._id} due to concurrent processing`);
    }
  } catch (error) {
    console.error('Error handling account.updated webhook:', error);
    throw error;
  }
};

// Handle account.application.deauthorized event
const handleAccountDeauthorized = async (deauthorization: any, ipAddress?: string, userAgent?: string) => {
  try {
    const teacher = await Teacher.findOne({
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
    await Teacher.findByIdAndUpdate(teacher._id, {
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
  } catch (error) {
    console.error('Error handling account.application.deauthorized webhook:', error);
    throw error;
  }
};

// Handle capability.updated event
const handleCapabilityUpdated = async (capability: Stripe.Capability, ipAddress?: string, userAgent?: string) => {
  try {
    const teacher = await Teacher.findOne({
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
    await Teacher.findByIdAndUpdate(teacher._id, {
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
  } catch (error) {
    console.error('Error handling capability.updated webhook:', error);
    throw error;
  }
};

// Handle person.updated event
const handlePersonUpdated = async (person: Stripe.Person, ipAddress?: string, userAgent?: string) => {
  try {
    const teacher = await Teacher.findOne({
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
    await Teacher.findByIdAndUpdate(teacher._id, {
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
  } catch (error) {
    console.error('Error handling person.updated webhook:', error);
    throw error;
  }
};

// Handle external account updates (bank accounts, cards)
const handleExternalAccountUpdated = async (externalAccount: any, ipAddress?: string, userAgent?: string) => {
  try {
    const teacher = await Teacher.findOne({
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
    await Teacher.findByIdAndUpdate(teacher._id, {
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
  } catch (error) {
    console.error('Error handling external account webhook:', error);
    throw error;
  }
};

// Log webhook receipt for audit trail
const logWebhookReceipt = async (accountId: string, eventType: string, eventData: any, ipAddress?: string, userAgent?: string) => {
  try {
    const teacher = await Teacher.findOne({
      $or: [
        { stripeAccountId: accountId },
        { 'stripeConnect.accountId': accountId }
      ]
    });

    if (teacher) {
      await Teacher.findByIdAndUpdate(teacher._id, {
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
  } catch (error) {
    console.error('Error logging webhook receipt:', error);
  }
};

// Log webhook processing errors
const logWebhookError = async (accountId: string, eventType: string, error: any, ipAddress?: string, userAgent?: string) => {
  try {
    const teacher = await Teacher.findOne({
      $or: [
        { stripeAccountId: accountId },
        { 'stripeConnect.accountId': accountId }
      ]
    });

    if (teacher) {
      await Teacher.findByIdAndUpdate(teacher._id, {
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
  } catch (logError) {
    console.error('Error logging webhook error:', logError);
  }
};

export const StripeConnectWebhook = {
  handleWebhook,
};
