import Stripe from 'stripe';
import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { Teacher } from '../Teacher/teacher.model';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

// Create Stripe Connect account with email pre-population
const createStripeAccount = async (userId: string, accountData: {
  type: 'express' | 'standard';
  country: string;
  email?: string; // Make email optional since we'll use teacher's email
  business_type?: 'individual' | 'company';
  ipAddress?: string;
  userAgent?: string;
}) => {
  let teacher: any = null;

  try {
    console.log('Creating Stripe account for user:', userId);

    // Check if teacher already has a Stripe account
    teacher = await Teacher.findOne({ user: userId }).populate('user');
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    // Check if teacher already has a connected Stripe account
    if (teacher.stripeConnect?.status === 'connected' || teacher.stripeAccountId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Teacher already has a connected Stripe account');
    }

    // Use teacher's email for Stripe account creation
    const emailToUse = accountData.email || teacher.email;

    // Update teacher status to pending
    await Teacher.findByIdAndUpdate(teacher._id, {
      'stripeConnect.status': 'pending',
      'stripeConnect.lastStatusUpdate': new Date(),
      $push: {
        stripeAuditLog: {
          action: 'account_created',
          timestamp: new Date(),
          details: { type: accountData.type, country: accountData.country },
          ipAddress: accountData.ipAddress,
          userAgent: accountData.userAgent,
        },
      },
    });

    // Create Stripe Express account with enhanced configuration
    const account = await stripe.accounts.create({
      type: accountData.type,
      country: accountData.country,
      email: emailToUse, // Pre-populate with teacher's email
      business_type: accountData.business_type || 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'daily',
          },
        },
      },
      metadata: {
        teacherId: teacher._id.toString(),
        userId: userId,
        platform: 'LMS',
        createdAt: new Date().toISOString(),
      },
    });

    // Update teacher with comprehensive Stripe information
    await Teacher.findByIdAndUpdate(teacher._id, {
      stripeAccountId: account.id, // Legacy field
      stripeEmail: emailToUse, // Legacy field
      'stripeConnect.accountId': account.id,
      'stripeConnect.email': emailToUse,
      'stripeConnect.status': 'pending',
      'stripeConnect.onboardingComplete': false,
      'stripeConnect.verified': false,
      'stripeConnect.lastStatusUpdate': new Date(),
      'stripeConnect.connectedAt': new Date(),
    });

    console.log('Stripe account created successfully:', account.id);

    return {
      success: true,
      accountId: account.id,
      email: emailToUse,
      status: 'pending',
      isConnected: true,
      isVerified: account.details_submitted && account.charges_enabled,
      canReceivePayments: account.charges_enabled && account.payouts_enabled,
      requirements: account.requirements,
      message: 'Stripe account created successfully. Please complete onboarding.',
    };
  } catch (error: any) {
    console.error('Error creating Stripe account:', error);

    // Log the error in audit trail
    if (teacher) {
      await Teacher.findByIdAndUpdate(teacher._id, {
        'stripeConnect.status': 'failed',
        'stripeConnect.failureReason': error.message,
        'stripeConnect.lastStatusUpdate': new Date(),
        $push: {
          stripeAuditLog: {
            action: 'error_occurred',
            timestamp: new Date(),
            details: { error: error.message, stack: error.stack },
            ipAddress: accountData.ipAddress,
            userAgent: accountData.userAgent,
          },
        },
      });
    }

    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create Stripe account: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

// Create account link for onboarding with enhanced tracking
const createAccountLink = async (userId: string, linkData: {
  type: 'account_onboarding' | 'account_update';
  refreshUrl: string;
  returnUrl: string;
  ipAddress?: string;
  userAgent?: string;
}) => {
  try {
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher || !teacher.stripeAccountId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'No Stripe account found for this teacher');
    }

    // Create account link with enhanced return URLs for success/failure handling
    const accountLink = await stripe.accountLinks.create({
      account: teacher.stripeAccountId,
      refresh_url: linkData.refreshUrl,
      return_url: linkData.returnUrl,
      type: linkData.type,
    });

    // Update teacher with onboarding URL and log the action
    await Teacher.findByIdAndUpdate(teacher._id, {
      'stripeConnect.onboardingUrl': accountLink.url,
      'stripeConnect.lastStatusUpdate': new Date(),
      $push: {
        stripeAuditLog: {
          action: 'onboarding_started',
          timestamp: new Date(),
          details: {
            type: linkData.type,
            expiresAt: accountLink.expires_at,
            url: accountLink.url
          },
          ipAddress: linkData.ipAddress,
          userAgent: linkData.userAgent,
        },
      },
    });

    return {
      url: accountLink.url,
      expiresAt: accountLink.expires_at,
      success: true,
      message: 'Onboarding link created successfully',
    };
  } catch (error) {
    console.error('Error creating account link:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create account link: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

// Get comprehensive account status
const getAccountStatus = async (userId: string) => {
  try {
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    if (!teacher.stripeAccountId) {
      return {
        isConnected: false,
        isVerified: false,
        canReceivePayments: false,
        accountId: null,
        requirements: null,
        status: teacher.stripeConnect?.status || 'not_connected',
        onboardingComplete: false,
        lastStatusUpdate: teacher.stripeConnect?.lastStatusUpdate,
        failureReason: teacher.stripeConnect?.failureReason,
      };
    }

    const account = await stripe.accounts.retrieve(teacher.stripeAccountId);

    // Determine current status based on Stripe account state
    let currentStatus = 'pending';
    if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
      currentStatus = 'connected';
    } else if (account.requirements?.errors && account.requirements.errors.length > 0) {
      currentStatus = 'restricted';
    }

    // Update teacher status if it has changed
    if (teacher.stripeConnect?.status !== currentStatus) {
      await Teacher.findByIdAndUpdate(teacher._id, {
        'stripeConnect.status': currentStatus,
        'stripeConnect.verified': account.details_submitted && account.charges_enabled,
        'stripeConnect.onboardingComplete': account.details_submitted,
        'stripeConnect.requirements': account.requirements?.currently_due || [],
        'stripeConnect.capabilities.card_payments': account.capabilities?.card_payments,
        'stripeConnect.capabilities.transfers': account.capabilities?.transfers,
        'stripeConnect.lastStatusUpdate': new Date(),
        // Update legacy fields for backward compatibility
        stripeVerified: account.details_submitted && account.charges_enabled,
        stripeOnboardingComplete: account.details_submitted,
        stripeRequirements: account.requirements?.currently_due || [],
      });
    }

    return {
      isConnected: true,
      isVerified: account.details_submitted && account.charges_enabled,
      canReceivePayments: account.charges_enabled && account.payouts_enabled,
      accountId: account.id,
      status: currentStatus,
      onboardingComplete: account.details_submitted,
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        eventually_due: account.requirements?.eventually_due || [],
        past_due: account.requirements?.past_due || [],
        pending_verification: account.requirements?.pending_verification || [],
        errors: account.requirements?.errors || [],
      },
      capabilities: account.capabilities,
      country: account.country,
      defaultCurrency: account.default_currency,
      email: account.email,
      businessProfile: account.business_profile,
      lastStatusUpdate: new Date(),
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
    };
  } catch (error) {
    console.error('Error getting account status:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to get account status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

// Update account information
const updateAccount = async (userId: string, updateData: any) => {
  try {
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher || !teacher.stripeAccountId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'No Stripe account found for this teacher');
    }

    const updatedAccount = await stripe.accounts.update(
      teacher.stripeAccountId,
      updateData
    );

    return {
      accountId: updatedAccount.id,
      businessProfile: updatedAccount.business_profile,
      capabilities: updatedAccount.capabilities,
      requirements: updatedAccount.requirements,
    };
  } catch (error) {
    console.error('Error updating account:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to update account: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

// Delete/disconnect account with comprehensive cleanup
const disconnectAccount = async (userId: string, options?: {
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}) => {
  try {
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher || !teacher.stripeAccountId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'No Stripe account found for this teacher');
    }

    // Delete the Stripe account
    await stripe.accounts.del(teacher.stripeAccountId);

    // Update teacher with comprehensive cleanup
    await Teacher.findByIdAndUpdate(teacher._id, {
      // Update status fields
      'stripeConnect.status': 'disconnected',
      'stripeConnect.disconnectedAt': new Date(),
      'stripeConnect.lastStatusUpdate': new Date(),
      'stripeConnect.onboardingComplete': false,
      'stripeConnect.verified': false,
      // Clear legacy fields
      stripeVerified: false,
      stripeOnboardingComplete: false,
      $unset: {
        // Legacy fields
        stripeAccountId: 1,
        stripeEmail: 1,
        // New fields
        'stripeConnect.accountId': 1,
        'stripeConnect.email': 1,
        'stripeConnect.onboardingUrl': 1,
        'stripeConnect.capabilities': 1,
      },
      $push: {
        stripeAuditLog: {
          action: 'account_disconnected',
          timestamp: new Date(),
          details: {
            reason: options?.reason || 'Manual disconnection',
            accountId: teacher.stripeAccountId
          },
          ipAddress: options?.ipAddress,
          userAgent: options?.userAgent,
        },
      },
    });

    return {
      success: true,
      message: 'Stripe account disconnected successfully',
      status: 'disconnected',
      disconnectedAt: new Date(),
    };
  } catch (error) {
    console.error('Error disconnecting account:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to disconnect account: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

// Retry failed connection
const retryConnection = async (userId: string, options?: {
  ipAddress?: string;
  userAgent?: string;
}) => {
  try {
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    if (teacher.stripeConnect?.status !== 'failed') {
      throw new AppError(httpStatus.BAD_REQUEST, 'No failed connection to retry');
    }

    // Reset status to allow retry
    await Teacher.findByIdAndUpdate(teacher._id, {
      'stripeConnect.status': 'not_connected',
      'stripeConnect.failureReason': undefined,
      'stripeConnect.lastStatusUpdate': new Date(),
      $push: {
        stripeAuditLog: {
          action: 'account_created',
          timestamp: new Date(),
          details: { action: 'retry_connection' },
          ipAddress: options?.ipAddress,
          userAgent: options?.userAgent,
        },
      },
    });

    return {
      success: true,
      message: 'Connection reset successfully. You can now try connecting again.',
      status: 'not_connected',
    };
  } catch (error) {
    console.error('Error retrying connection:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to retry connection: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

// Get audit log for compliance
const getAuditLog = async (userId: string, options?: {
  limit?: number;
  offset?: number;
  action?: string;
}) => {
  try {
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    let auditLog = teacher.stripeAuditLog || [];

    // Filter by action if specified
    if (options?.action) {
      auditLog = auditLog.filter(log => log.action === options.action);
    }

    // Sort by timestamp (newest first)
    auditLog.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;
    const paginatedLog = auditLog.slice(offset, offset + limit);

    return {
      success: true,
      auditLog: paginatedLog,
      total: auditLog.length,
      offset,
      limit,
    };
  } catch (error) {
    console.error('Error getting audit log:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to get audit log: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

export const StripeConnectService = {
  createStripeAccount,
  createAccountLink,
  getAccountStatus,
  updateAccount,
  disconnectAccount,
  retryConnection,
  getAuditLog,
};
