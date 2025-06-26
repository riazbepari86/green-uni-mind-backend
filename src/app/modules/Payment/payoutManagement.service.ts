import cron from 'node-cron';
import { Types } from 'mongoose';
import { Payout, PayoutPreference, PayoutBatch } from './payout.model';
import { Teacher } from '../Teacher/teacher.model';
import { Transaction } from './transaction.model';
import { AuditLogService } from '../AuditLog/auditLog.service';
import { NotificationService } from '../Notification/notification.service';
import { 
  PayoutStatus,
  PayoutSchedule,
  PayoutFailureCategory,
  IPayoutAnalytics,
  IPayoutRetryConfig
} from './payout.interface';
import { 
  AuditLogAction, 
  AuditLogCategory, 
  AuditLogLevel 
} from '../AuditLog/auditLog.interface';
import { 
  NotificationType,
  NotificationPriority 
} from '../Notification/notification.interface';

// Automated payout scheduling service
const scheduleAutomaticPayouts = async (): Promise<{
  scheduled: number;
  skipped: number;
  errors: number;
}> => {
  console.log('Starting automatic payout scheduling...');
  
  try {
    // Find teachers with auto-payout enabled and due for payout
    const duePreferences = await PayoutPreference.find({
      isAutoPayoutEnabled: true,
      isActive: true,
      nextScheduledPayoutDate: { $lte: new Date() },
    }).populate('teacherId');

    console.log(`Found ${duePreferences.length} teachers due for automatic payout`);

    let scheduled = 0;
    let skipped = 0;
    let errors = 0;

    for (const preference of duePreferences) {
      try {
        const teacher = preference.teacherId as any;
        
        // Check if teacher has connected Stripe account
        if (!teacher.stripeConnect?.accountId || teacher.stripeConnect.status !== 'connected') {
          console.log(`Skipping payout for teacher ${teacher._id}: Stripe account not connected`);
          skipped++;
          continue;
        }

        // Get pending earnings
        const pendingEarnings = await getPendingEarnings(teacher._id);
        
        // Check if earnings meet minimum threshold
        if (pendingEarnings.totalAmount < preference.minimumAmount) {
          console.log(`Skipping payout for teacher ${teacher._id}: Amount ${pendingEarnings.totalAmount} below minimum ${preference.minimumAmount}`);
          skipped++;
          
          // Update next scheduled date
          const nextDate = calculateNextPayoutDate(preference.schedule, preference.customSchedule, preference.customSchedule?.timezone);
          await PayoutPreference.findByIdAndUpdate(preference._id, {
            nextScheduledPayoutDate: nextDate,
          });
          continue;
        }

        // Create scheduled payout
        await createScheduledPayout(teacher._id, {
          amount: pendingEarnings.totalAmount,
          description: `Automatic ${preference.schedule} payout`,
          scheduledAt: new Date(),
        });

        // Update next scheduled date
        const nextDate = calculateNextPayoutDate(preference.schedule, preference.customSchedule, preference.customSchedule?.timezone);
        await PayoutPreference.findByIdAndUpdate(preference._id, {
          lastPayoutDate: new Date(),
          nextScheduledPayoutDate: nextDate,
        });

        scheduled++;
        console.log(`Scheduled automatic payout for teacher ${teacher._id}: $${pendingEarnings.totalAmount}`);

      } catch (error: any) {
        console.error(`Error scheduling payout for preference ${preference._id}:`, error);
        errors++;
      }
    }

    console.log(`Automatic payout scheduling completed: ${scheduled} scheduled, ${skipped} skipped, ${errors} errors`);

    return { scheduled, skipped, errors };
  } catch (error: any) {
    console.error('Error in automatic payout scheduling:', error);
    throw error;
  }
};

// Calculate next payout date based on schedule
const calculateNextPayoutDate = (
  schedule: PayoutSchedule,
  customSchedule?: any,
  timezone: string = 'UTC'
): Date => {
  const now = new Date();
  const nextPayout = new Date();

  switch (schedule) {
    case PayoutSchedule.DAILY:
      nextPayout.setDate(now.getDate() + 1);
      nextPayout.setHours(customSchedule?.hour || 9, 0, 0, 0);
      break;

    case PayoutSchedule.WEEKLY:
      const daysUntilNext = (7 + (customSchedule?.dayOfWeek || 1) - now.getDay()) % 7;
      nextPayout.setDate(now.getDate() + (daysUntilNext || 7));
      nextPayout.setHours(customSchedule?.hour || 9, 0, 0, 0);
      break;

    case PayoutSchedule.BIWEEKLY:
      nextPayout.setDate(now.getDate() + 14);
      nextPayout.setHours(customSchedule?.hour || 9, 0, 0, 0);
      break;

    case PayoutSchedule.MONTHLY:
      const targetDay = customSchedule?.dayOfMonth || 1;
      nextPayout.setMonth(now.getMonth() + 1);
      nextPayout.setDate(Math.min(targetDay, new Date(nextPayout.getFullYear(), nextPayout.getMonth() + 1, 0).getDate()));
      nextPayout.setHours(customSchedule?.hour || 9, 0, 0, 0);
      break;

    case PayoutSchedule.MANUAL:
    default:
      return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
  }

  return nextPayout;
};

// Get pending earnings for a teacher
const getPendingEarnings = async (teacherId: string | Types.ObjectId) => {
  const pipeline = [
    {
      $match: {
        teacherId: new Types.ObjectId(teacherId),
        stripeTransferStatus: 'pending',
      },
    },
    {
      $group: {
        _id: '$currency',
        totalAmount: { $sum: '$teacherEarning' },
        transactionCount: { $sum: 1 },
        transactions: { $push: '$$ROOT' },
      },
    },
  ];

  const results = await Transaction.aggregate(pipeline);
  
  if (results.length === 0) {
    return {
      totalAmount: 0,
      transactionCount: 0,
      transactions: [],
      currency: 'usd',
    };
  }

  const result = results[0];
  return {
    totalAmount: result.totalAmount,
    transactionCount: result.transactionCount,
    transactions: result.transactions,
    currency: result._id || 'usd',
  };
};

// Create scheduled payout
const createScheduledPayout = async (
  teacherId: string | Types.ObjectId,
  options: {
    amount?: number;
    description?: string;
    scheduledAt?: Date;
    batchId?: string;
  } = {}
) => {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    throw new Error('Teacher not found');
  }

  if (!teacher.stripeConnect?.accountId) {
    throw new Error('Teacher does not have a connected Stripe account');
  }

  // Get pending earnings if amount not specified
  let amount = options.amount;
  let transactions: any[] = [];
  
  if (!amount) {
    const pendingEarnings = await getPendingEarnings(teacherId);
    amount = pendingEarnings.totalAmount;
    transactions = pendingEarnings.transactions.map((t: any) => t._id);
  }

  if (!amount || amount <= 0) {
    throw new Error('No pending earnings available for payout');
  }

  // Get payout preferences
  const preferences = await PayoutPreference.findOne({ teacherId });
  const minimumAmount = preferences?.minimumAmount || 50;

  if (amount < minimumAmount) {
    throw new Error(`Payout amount ${amount} is below minimum threshold ${minimumAmount}`);
  }

  // Create payout record
  const payout = new Payout({
    teacherId,
    amount,
    currency: 'usd',
    status: PayoutStatus.SCHEDULED,
    stripeAccountId: teacher.stripeConnect.accountId,
    transactions,
    description: options.description || `Scheduled payout for ${new Date().toLocaleDateString()}`,
    scheduledAt: options.scheduledAt || new Date(),
    requestedAt: new Date(),
    batchId: options.batchId,
    retryCount: 0,
    maxRetries: preferences?.retryConfig?.maxRetries || 3,
    retryConfig: preferences?.retryConfig || {
      maxRetries: 3,
      baseDelay: 60000,
      maxDelay: 3600000,
      backoffMultiplier: 2,
      jitterEnabled: true,
    },
    complianceChecked: false,
    notificationSent: false,
    notificationsSent: [],
    auditTrail: [{
      action: 'payout_scheduled',
      timestamp: new Date(),
      details: {
        amount,
        currency: 'usd',
        scheduledAt: options.scheduledAt || new Date(),
        transactionCount: transactions.length,
      },
    }],
    metadata: {
      createdBy: 'system',
      teacherEmail: teacher.email,
      stripeAccountId: teacher.stripeConnect.accountId,
    },
  });

  await payout.save();

  // Log audit event
  await AuditLogService.createAuditLog({
    action: AuditLogAction.PAYOUT_SCHEDULED,
    category: AuditLogCategory.PAYOUT,
    level: AuditLogLevel.INFO,
    message: `Payout scheduled: ${amount} USD`,
    userId: teacherId,
    userType: 'teacher',
    resourceType: 'payout',
    resourceId: (payout._id as Types.ObjectId).toString(),
    metadata: {
      amount,
      currency: 'usd',
      scheduledAt: options.scheduledAt || new Date(),
      transactionCount: transactions.length,
      stripeAccountId: teacher.stripeConnect.accountId,
    },
  });

  // Send notification
  await NotificationService.createNotification({
    type: NotificationType.PAYOUT_SCHEDULED,
    priority: NotificationPriority.NORMAL,
    userId: teacherId,
    userType: 'teacher',
    title: 'Payout Scheduled',
    body: `Your payout of $${amount} has been scheduled and will be processed soon.`,
    relatedResourceType: 'payout',
    relatedResourceId: (payout._id as Types.ObjectId).toString(),
    metadata: {
      amount,
      currency: 'usd',
      scheduledAt: options.scheduledAt || new Date(),
    },
  });

  return payout;
};

// Initialize cron jobs for payout management
const initializePayoutJobs = (): void => {
  // Schedule automatic payouts every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await scheduleAutomaticPayouts();
    } catch (error) {
      console.error('Error in automatic payout scheduling cron job:', error);
    }
  });

  console.log('Payout management cron jobs initialized');
};

export const PayoutManagementService = {
  scheduleAutomaticPayouts,
  calculateNextPayoutDate,
  getPendingEarnings,
  createScheduledPayout,
  initializePayoutJobs,
};
