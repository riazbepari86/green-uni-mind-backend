import Stripe from 'stripe';
import { Teacher } from '../Teacher/teacher.model';
import { Payout } from '../Payment/payout.model';
import { AuditLog } from '../AuditLog/auditLog.model';
import { NotificationService } from '../Notification/notification.service';
import { 
  AuditLogAction, 
  AuditLogCategory, 
  AuditLogLevel 
} from '../AuditLog/auditLog.interface';
import { 
  NotificationType,
  NotificationPriority 
} from '../Notification/notification.interface';
import { PayoutStatus, PayoutFailureCategory } from '../Payment/payout.interface';

interface WebhookProcessingResult {
  success: boolean;
  error?: string;
  processingTime?: number;
  affectedUserId?: string;
  affectedUserType?: string;
  relatedResourceIds?: string[];
}

// Handle account.updated event with comprehensive status tracking
const handleAccountUpdated = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();
  
  try {
    const account = event.data.object as Stripe.Account;
    
    const teacher = await Teacher.findOne({
      $or: [
        { stripeAccountId: account.id },
        { 'stripeConnect.accountId': account.id }
      ]
    });

    if (!teacher) {
      console.log(`Teacher not found for Stripe account: ${account.id}`);
      return {
        success: true,
        error: 'Teacher not found - skipping',
        processingTime: Date.now() - startTime,
      };
    }

    // Determine comprehensive status
    let status = 'pending';
    let statusReason = '';
    let accountHealthScore = 0;

    if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
      status = 'connected';
      statusReason = 'Account fully verified and operational';
      accountHealthScore = 100;
    } else if (account.requirements?.errors && account.requirements.errors.length > 0) {
      status = 'restricted';
      statusReason = `Account restricted: ${account.requirements.errors.map(e => e.reason).join(', ')}`;
      accountHealthScore = 25;
    } else if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
      status = 'pending';
      statusReason = `Pending verification: ${account.requirements.currently_due.join(', ')}`;
      accountHealthScore = 60;
    } else if (!account.details_submitted) {
      status = 'pending';
      statusReason = 'Onboarding not completed';
      accountHealthScore = 30;
    }

    // Update teacher with comprehensive information
    const updateResult = await Teacher.findByIdAndUpdate(teacher._id, {
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
        'stripeConnect.accountHealthScore': accountHealthScore,
        'stripeConnect.businessProfile': account.business_profile,
        'stripeConnect.settings': account.settings,
        // Legacy fields for backward compatibility
        stripeVerified: account.details_submitted && account.charges_enabled,
        stripeOnboardingComplete: account.details_submitted,
        stripeRequirements: account.requirements?.currently_due || [],
      },
      $push: {
        'stripeConnect.auditTrail': {
          action: 'account_updated',
          timestamp: new Date(),
          details: {
            event: 'account.updated',
            status,
            statusReason,
            accountHealthScore,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            requirements: account.requirements,
            capabilities: account.capabilities,
          },
        },
      },
    }, { new: true });

    // Log audit event
    await AuditLog.create({
      action: AuditLogAction.STRIPE_ACCOUNT_UPDATED,
      category: AuditLogCategory.STRIPE_CONNECT,
      level: AuditLogLevel.INFO,
      message: `Stripe account updated: ${status}`,
      userId: teacher._id,
      userType: 'teacher',
      resourceType: 'stripe_account',
      resourceId: account.id,
      metadata: {
        stripeEventId: event.id,
        stripeAccountId: account.id,
        previousStatus: teacher.stripeConnect?.status,
        newStatus: status,
        accountHealthScore,
        statusReason,
      },
      timestamp: new Date(),
    });

    // Send notification based on status change
    if (teacher.stripeConnect?.status !== status) {
      let notificationType: NotificationType;
      let priority: NotificationPriority = NotificationPriority.NORMAL;
      
      switch (status) {
        case 'connected':
          notificationType = NotificationType.STRIPE_ACCOUNT_VERIFIED;
          priority = NotificationPriority.HIGH;
          break;
        case 'restricted':
          notificationType = NotificationType.STRIPE_ACCOUNT_RESTRICTED;
          priority = NotificationPriority.URGENT;
          break;
        case 'pending':
          notificationType = NotificationType.STRIPE_ACCOUNT_REQUIREMENTS_DUE;
          priority = NotificationPriority.HIGH;
          break;
        default:
          notificationType = NotificationType.STRIPE_ACCOUNT_VERIFIED;
      }

      await NotificationService.createNotification({
        type: notificationType,
        priority,
        userId: teacher._id,
        userType: 'teacher',
        title: `Stripe Account Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        body: statusReason,
        relatedResourceType: 'stripe_account',
        relatedResourceId: account.id,
        metadata: {
          accountHealthScore,
          requirements: account.requirements?.currently_due,
          capabilities: account.capabilities,
        },
      });
    }

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: teacher._id.toString(),
      affectedUserType: 'teacher',
      relatedResourceIds: [account.id],
    };

  } catch (error: any) {
    console.error('Error handling account.updated webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Handle account.application.deauthorized event
const handleAccountDeauthorized = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();
  
  try {
    const deauthorization = event.data.object as any;
    
    const teacher = await Teacher.findOne({
      $or: [
        { stripeAccountId: deauthorization.account },
        { 'stripeConnect.accountId': deauthorization.account }
      ]
    });

    if (!teacher) {
      return {
        success: true,
        error: 'Teacher not found - skipping',
        processingTime: Date.now() - startTime,
      };
    }

    // Update teacher account status
    await Teacher.findByIdAndUpdate(teacher._id, {
      $set: {
        'stripeConnect.status': 'disconnected',
        'stripeConnect.disconnectedAt': new Date(),
        'stripeConnect.lastStatusUpdate': new Date(),
        'stripeConnect.failureReason': 'Account deauthorized by user',
        'stripeConnect.accountHealthScore': 0,
        // Clear sensitive data
        'stripeConnect.onboardingUrl': undefined,
        'stripeConnect.capabilities': undefined,
      },
      $push: {
        'stripeConnect.auditTrail': {
          action: 'account_deauthorized',
          timestamp: new Date(),
          details: {
            event: 'account.application.deauthorized',
            reason: 'Account deauthorized by user',
            accountId: deauthorization.account,
          },
        },
      },
    });

    // Log audit event
    await AuditLog.create({
      action: AuditLogAction.STRIPE_ACCOUNT_DEAUTHORIZED,
      category: AuditLogCategory.STRIPE_CONNECT,
      level: AuditLogLevel.WARNING,
      message: 'Stripe account deauthorized',
      userId: teacher._id,
      userType: 'teacher',
      resourceType: 'stripe_account',
      resourceId: deauthorization.account,
      metadata: {
        stripeEventId: event.id,
        stripeAccountId: deauthorization.account,
        reason: 'User deauthorized application',
      },
      timestamp: new Date(),
    });

    // Send notification
    await NotificationService.createNotification({
      type: NotificationType.STRIPE_ACCOUNT_DEAUTHORIZED,
      priority: NotificationPriority.URGENT,
      userId: teacher._id,
      userType: 'teacher',
      title: 'Stripe Account Disconnected',
      body: 'Your Stripe account has been disconnected. You will need to reconnect to receive payments.',
      relatedResourceType: 'stripe_account',
      relatedResourceId: deauthorization.account,
    });

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: teacher._id.toString(),
      affectedUserType: 'teacher',
      relatedResourceIds: [deauthorization.account],
    };

  } catch (error: any) {
    console.error('Error handling account.application.deauthorized webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Handle capability.updated event
const handleCapabilityUpdated = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();
  
  try {
    const capability = event.data.object as Stripe.Capability;
    
    const teacher = await Teacher.findOne({
      $or: [
        { stripeAccountId: capability.account },
        { 'stripeConnect.accountId': capability.account }
      ]
    });

    if (!teacher) {
      return {
        success: true,
        error: 'Teacher not found - skipping',
        processingTime: Date.now() - startTime,
      };
    }

    // Update specific capability
    const updateField = `stripeConnect.capabilities.${capability.id}`;
    await Teacher.findByIdAndUpdate(teacher._id, {
      $set: {
        [updateField]: capability.status,
        'stripeConnect.lastStatusUpdate': new Date(),
      },
      $push: {
        'stripeConnect.auditTrail': {
          action: 'capability_updated',
          timestamp: new Date(),
          details: {
            event: 'capability.updated',
            capability: capability.id,
            status: capability.status,
            requirements: capability.requirements,
          },
        },
      },
    });

    // Log audit event
    await AuditLog.create({
      action: AuditLogAction.STRIPE_CAPABILITY_UPDATED,
      category: AuditLogCategory.STRIPE_CONNECT,
      level: AuditLogLevel.INFO,
      message: `Capability ${capability.id} updated to ${capability.status}`,
      userId: teacher._id,
      userType: 'teacher',
      resourceType: 'stripe_capability',
      resourceId: capability.id,
      metadata: {
        stripeEventId: event.id,
        stripeAccountId: capability.account,
        capability: capability.id,
        status: capability.status,
        requirements: capability.requirements,
      },
      timestamp: new Date(),
    });

    // Send notification for important capability changes
    if (capability.status === 'active') {
      await NotificationService.createNotification({
        type: NotificationType.STRIPE_CAPABILITY_ENABLED,
        priority: NotificationPriority.NORMAL,
        userId: teacher._id,
        userType: 'teacher',
        title: `${capability.id} Capability Enabled`,
        body: `Your ${capability.id} capability is now active and ready to use.`,
        relatedResourceType: 'stripe_capability',
        relatedResourceId: capability.id,
      });
    } else if (capability.status === 'inactive') {
      await NotificationService.createNotification({
        type: NotificationType.STRIPE_CAPABILITY_DISABLED,
        priority: NotificationPriority.HIGH,
        userId: teacher._id,
        userType: 'teacher',
        title: `${capability.id} Capability Disabled`,
        body: `Your ${capability.id} capability has been disabled. Please check your account requirements.`,
        relatedResourceType: 'stripe_capability',
        relatedResourceId: capability.id,
      });
    }

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: teacher._id.toString(),
      affectedUserType: 'teacher',
      relatedResourceIds: [capability.account as string, capability.id],
    };

  } catch (error: any) {
    console.error('Error handling capability.updated webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Handle person.created and person.updated events
const handlePersonUpdated = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();

  try {
    const person = event.data.object as Stripe.Person;

    const teacher = await Teacher.findOne({
      $or: [
        { stripeAccountId: person.account },
        { 'stripeConnect.accountId': person.account }
      ]
    });

    if (!teacher) {
      return {
        success: true,
        error: 'Teacher not found - skipping',
        processingTime: Date.now() - startTime,
      };
    }

    // Update teacher with person information
    await Teacher.findByIdAndUpdate(teacher._id, {
      $set: {
        'stripeConnect.lastWebhookReceived': new Date(),
      },
      $push: {
        'stripeConnect.auditTrail': {
          action: 'person_updated',
          timestamp: new Date(),
          details: {
            event: event.type,
            person_id: person.id,
            verification: person.verification,
            requirements: person.requirements,
          },
        },
      },
    });

    // Log audit event
    await AuditLog.create({
      action: AuditLogAction.WEBHOOK_RECEIVED,
      category: AuditLogCategory.STRIPE_CONNECT,
      level: AuditLogLevel.INFO,
      message: `Person ${event.type.split('.')[1]} for account`,
      userId: teacher._id,
      userType: 'teacher',
      resourceType: 'stripe_person',
      resourceId: person.id,
      metadata: {
        stripeEventId: event.id,
        stripeAccountId: person.account,
        personId: person.id,
        verification: person.verification,
        requirements: person.requirements,
      },
      timestamp: new Date(),
    });

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: teacher._id.toString(),
      affectedUserType: 'teacher',
      relatedResourceIds: [person.account as string, person.id],
    };

  } catch (error: any) {
    console.error('Error handling person webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Handle external account events
const handleExternalAccountUpdated = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();

  try {
    const externalAccount = event.data.object as any;

    const teacher = await Teacher.findOne({
      $or: [
        { stripeAccountId: externalAccount.account },
        { 'stripeConnect.accountId': externalAccount.account }
      ]
    });

    if (!teacher) {
      return {
        success: true,
        error: 'Teacher not found - skipping',
        processingTime: Date.now() - startTime,
      };
    }

    // Update teacher with external account information
    await Teacher.findByIdAndUpdate(teacher._id, {
      $set: {
        'stripeConnect.lastWebhookReceived': new Date(),
      },
      $push: {
        'stripeConnect.auditTrail': {
          action: 'external_account_updated',
          timestamp: new Date(),
          details: {
            event: event.type,
            external_account_id: externalAccount.id,
            object: externalAccount.object,
            status: externalAccount.status,
            last4: externalAccount.last4,
            bank_name: externalAccount.bank_name,
          },
        },
      },
    });

    // Log audit event
    await AuditLog.create({
      action: AuditLogAction.STRIPE_EXTERNAL_ACCOUNT_UPDATED,
      category: AuditLogCategory.STRIPE_CONNECT,
      level: AuditLogLevel.INFO,
      message: `External account ${event.type.split('.')[2]}`,
      userId: teacher._id,
      userType: 'teacher',
      resourceType: 'stripe_external_account',
      resourceId: externalAccount.id,
      metadata: {
        stripeEventId: event.id,
        stripeAccountId: externalAccount.account,
        externalAccountId: externalAccount.id,
        accountType: externalAccount.object,
        status: externalAccount.status,
      },
      timestamp: new Date(),
    });

    // Send notification for external account changes
    if (event.type.includes('created')) {
      await NotificationService.createNotification({
        type: NotificationType.STRIPE_EXTERNAL_ACCOUNT_ADDED,
        priority: NotificationPriority.NORMAL,
        userId: teacher._id,
        userType: 'teacher',
        title: 'Bank Account Added',
        body: `A new ${externalAccount.object} has been added to your Stripe account.`,
        relatedResourceType: 'stripe_external_account',
        relatedResourceId: externalAccount.id,
      });
    } else if (event.type.includes('updated')) {
      await NotificationService.createNotification({
        type: NotificationType.STRIPE_EXTERNAL_ACCOUNT_UPDATED,
        priority: NotificationPriority.NORMAL,
        userId: teacher._id,
        userType: 'teacher',
        title: 'Bank Account Updated',
        body: `Your ${externalAccount.object} information has been updated.`,
        relatedResourceType: 'stripe_external_account',
        relatedResourceId: externalAccount.id,
      });
    }

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: teacher._id.toString(),
      affectedUserType: 'teacher',
      relatedResourceIds: [externalAccount.account, externalAccount.id],
    };

  } catch (error: any) {
    console.error('Error handling external account webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Handle payout.created event
const handlePayoutCreated = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();

  try {
    const stripePayout = event.data.object as Stripe.Payout;

    // Find the teacher by Stripe account ID
    const teacher = await Teacher.findOne({
      $or: [
        { stripeAccountId: stripePayout.destination },
        { 'stripeConnect.accountId': stripePayout.destination }
      ]
    });

    if (!teacher) {
      return {
        success: true,
        error: 'Teacher not found - skipping',
        processingTime: Date.now() - startTime,
      };
    }

    // Create or update payout record
    const existingPayout = await Payout.findOne({ stripePayoutId: stripePayout.id });

    if (!existingPayout) {
      const newPayout = new Payout({
        teacherId: teacher._id,
        amount: stripePayout.amount / 100, // Convert from cents
        currency: stripePayout.currency,
        status: PayoutStatus.SCHEDULED,
        stripePayoutId: stripePayout.id,
        stripeAccountId: stripePayout.destination as string,
        description: stripePayout.description || 'Automatic payout',
        scheduledAt: new Date(stripePayout.arrival_date * 1000),
        requestedAt: new Date(stripePayout.created * 1000),
        metadata: {
          stripeEventId: event.id,
          method: stripePayout.method,
          type: stripePayout.type,
          statement_descriptor: stripePayout.statement_descriptor,
        },
        auditTrail: [{
          action: 'payout_created',
          timestamp: new Date(),
          details: {
            stripePayoutId: stripePayout.id,
            amount: stripePayout.amount / 100,
            currency: stripePayout.currency,
            method: stripePayout.method,
          },
        }],
      });

      await newPayout.save();
    }

    // Log audit event
    await AuditLog.create({
      action: AuditLogAction.PAYOUT_CREATED,
      category: AuditLogCategory.PAYOUT,
      level: AuditLogLevel.INFO,
      message: `Payout created: ${stripePayout.amount / 100} ${stripePayout.currency}`,
      userId: teacher._id,
      userType: 'teacher',
      resourceType: 'payout',
      resourceId: stripePayout.id,
      metadata: {
        stripeEventId: event.id,
        stripePayoutId: stripePayout.id,
        amount: stripePayout.amount / 100,
        currency: stripePayout.currency,
        arrivalDate: new Date(stripePayout.arrival_date * 1000),
      },
      timestamp: new Date(),
    });

    // Send notification
    await NotificationService.createNotification({
      type: NotificationType.PAYOUT_SCHEDULED,
      priority: NotificationPriority.NORMAL,
      userId: teacher._id,
      userType: 'teacher',
      title: 'Payout Scheduled',
      body: `Your payout of ${stripePayout.amount / 100} ${stripePayout.currency.toUpperCase()} has been scheduled and will arrive on ${new Date(stripePayout.arrival_date * 1000).toLocaleDateString()}.`,
      relatedResourceType: 'payout',
      relatedResourceId: stripePayout.id,
      metadata: {
        amount: stripePayout.amount / 100,
        currency: stripePayout.currency,
        arrivalDate: new Date(stripePayout.arrival_date * 1000),
      },
    });

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: teacher._id.toString(),
      affectedUserType: 'teacher',
      relatedResourceIds: [stripePayout.id],
    };

  } catch (error: any) {
    console.error('Error handling payout.created webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Handle payout.paid event
const handlePayoutPaid = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();

  try {
    const stripePayout = event.data.object as Stripe.Payout;

    // Update payout status
    const payout = await Payout.findOneAndUpdate(
      { stripePayoutId: stripePayout.id },
      {
        $set: {
          status: PayoutStatus.COMPLETED,
          completedAt: new Date(),
          actualArrival: new Date(),
          processingDuration: Date.now() - new Date(stripePayout.created * 1000).getTime(),
        },
        $push: {
          auditTrail: {
            action: 'payout_completed',
            timestamp: new Date(),
            details: {
              stripePayoutId: stripePayout.id,
              completedAt: new Date(),
            },
          },
        },
      },
      { new: true }
    );

    if (!payout) {
      return {
        success: true,
        error: 'Payout not found - skipping',
        processingTime: Date.now() - startTime,
      };
    }

    // Log audit event
    await AuditLog.create({
      action: AuditLogAction.PAYOUT_COMPLETED,
      category: AuditLogCategory.PAYOUT,
      level: AuditLogLevel.INFO,
      message: `Payout completed: ${payout.amount} ${payout.currency}`,
      userId: payout.teacherId,
      userType: 'teacher',
      resourceType: 'payout',
      resourceId: stripePayout.id,
      metadata: {
        stripeEventId: event.id,
        stripePayoutId: stripePayout.id,
        amount: payout.amount,
        currency: payout.currency,
        processingDuration: payout.processingDuration,
      },
      timestamp: new Date(),
    });

    // Send notification
    await NotificationService.createNotification({
      type: NotificationType.PAYOUT_COMPLETED,
      priority: NotificationPriority.NORMAL,
      userId: payout.teacherId,
      userType: 'teacher',
      title: 'Payout Completed',
      body: `Your payout of ${payout.amount} ${payout.currency.toUpperCase()} has been successfully transferred to your bank account.`,
      relatedResourceType: 'payout',
      relatedResourceId: stripePayout.id,
      metadata: {
        amount: payout.amount,
        currency: payout.currency,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: payout.teacherId.toString(),
      affectedUserType: 'teacher',
      relatedResourceIds: [stripePayout.id],
    };

  } catch (error: any) {
    console.error('Error handling payout.paid webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Handle payout.failed event
const handlePayoutFailed = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();

  try {
    const stripePayout = event.data.object as Stripe.Payout;

    // Determine failure category
    let failureCategory = PayoutFailureCategory.UNKNOWN;
    const failureCode = stripePayout.failure_code;

    if (failureCode) {
      switch (failureCode) {
        case 'insufficient_funds':
          failureCategory = PayoutFailureCategory.INSUFFICIENT_FUNDS;
          break;
        case 'account_closed':
          failureCategory = PayoutFailureCategory.ACCOUNT_CLOSED;
          break;
        case 'invalid_account_number':
        case 'invalid_routing_number':
          failureCategory = PayoutFailureCategory.INVALID_ACCOUNT;
          break;
        case 'debit_not_authorized':
          failureCategory = PayoutFailureCategory.BANK_DECLINED;
          break;
        default:
          failureCategory = PayoutFailureCategory.TECHNICAL_ERROR;
      }
    }

    // Update payout status
    const payout = await Payout.findOneAndUpdate(
      { stripePayoutId: stripePayout.id },
      {
        $set: {
          status: PayoutStatus.FAILED,
          failedAt: new Date(),
          failureReason: stripePayout.failure_message || 'Payout failed',
          failureCategory,
        },
        $push: {
          auditTrail: {
            action: 'payout_failed',
            timestamp: new Date(),
            details: {
              stripePayoutId: stripePayout.id,
              failureCode: stripePayout.failure_code,
              failureMessage: stripePayout.failure_message,
              failureCategory,
            },
          },
          attempts: {
            attemptNumber: 1,
            attemptedAt: new Date(),
            status: PayoutStatus.FAILED,
            stripePayoutId: stripePayout.id,
            failureReason: stripePayout.failure_message,
            failureCategory,
          },
        },
      },
      { new: true }
    );

    if (!payout) {
      return {
        success: true,
        error: 'Payout not found - skipping',
        processingTime: Date.now() - startTime,
      };
    }

    // Log audit event
    await AuditLog.create({
      action: AuditLogAction.PAYOUT_FAILED,
      category: AuditLogCategory.PAYOUT,
      level: AuditLogLevel.ERROR,
      message: `Payout failed: ${stripePayout.failure_message}`,
      userId: payout.teacherId,
      userType: 'teacher',
      resourceType: 'payout',
      resourceId: stripePayout.id,
      metadata: {
        stripeEventId: event.id,
        stripePayoutId: stripePayout.id,
        failureCode: stripePayout.failure_code,
        failureMessage: stripePayout.failure_message,
        failureCategory,
        amount: payout.amount,
        currency: payout.currency,
      },
      timestamp: new Date(),
    });

    // Send notification
    await NotificationService.createNotification({
      type: NotificationType.PAYOUT_FAILED,
      priority: NotificationPriority.URGENT,
      userId: payout.teacherId,
      userType: 'teacher',
      title: 'Payout Failed',
      body: `Your payout of ${payout.amount} ${payout.currency.toUpperCase()} failed: ${stripePayout.failure_message}. Please check your bank account details.`,
      relatedResourceType: 'payout',
      relatedResourceId: stripePayout.id,
      metadata: {
        amount: payout.amount,
        currency: payout.currency,
        failureReason: stripePayout.failure_message,
        failureCategory,
      },
    });

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: payout.teacherId.toString(),
      affectedUserType: 'teacher',
      relatedResourceIds: [stripePayout.id],
    };

  } catch (error: any) {
    console.error('Error handling payout.failed webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Handle payout.canceled event
const handlePayoutCanceled = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();

  try {
    const stripePayout = event.data.object as Stripe.Payout;

    // Update payout status
    const payout = await Payout.findOneAndUpdate(
      { stripePayoutId: stripePayout.id },
      {
        $set: {
          status: PayoutStatus.CANCELLED,
          cancelledAt: new Date(),
        },
        $push: {
          auditTrail: {
            action: 'payout_cancelled',
            timestamp: new Date(),
            details: {
              stripePayoutId: stripePayout.id,
              cancelledAt: new Date(),
            },
          },
        },
      },
      { new: true }
    );

    if (payout) {
      // Log audit event
      await AuditLog.create({
        action: AuditLogAction.PAYOUT_CANCELLED,
        category: AuditLogCategory.PAYOUT,
        level: AuditLogLevel.WARNING,
        message: `Payout cancelled: ${payout.amount} ${payout.currency}`,
        userId: payout.teacherId,
        userType: 'teacher',
        resourceType: 'payout',
        resourceId: stripePayout.id,
        metadata: {
          stripeEventId: event.id,
          stripePayoutId: stripePayout.id,
          amount: payout.amount,
          currency: payout.currency,
        },
        timestamp: new Date(),
      });
    }

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: payout?.teacherId.toString(),
      affectedUserType: 'teacher',
      relatedResourceIds: [stripePayout.id],
    };

  } catch (error: any) {
    console.error('Error handling payout.canceled webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Placeholder handlers for transfer events
const handleTransferCreated = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  // Implementation for transfer.created
  return { success: true, processingTime: 0 };
};

const handleTransferPaid = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  // Implementation for transfer.paid
  return { success: true, processingTime: 0 };
};

const handleTransferFailed = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  // Implementation for transfer.failed
  return { success: true, processingTime: 0 };
};

const handleTransferReversed = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  // Implementation for transfer.reversed
  return { success: true, processingTime: 0 };
};

export const StripeConnectWebhookHandlers = {
  handleAccountUpdated,
  handleAccountDeauthorized,
  handleCapabilityUpdated,
  handlePersonUpdated,
  handleExternalAccountUpdated,
  handlePayoutCreated,
  handlePayoutPaid,
  handlePayoutFailed,
  handlePayoutCanceled,
  handleTransferCreated,
  handleTransferPaid,
  handleTransferFailed,
  handleTransferReversed,
};
