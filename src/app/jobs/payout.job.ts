import Agenda from 'agenda';
import mongoose from 'mongoose';
import { PayoutPreference } from '../modules/Payment/payout.model';
import {
  PayoutSchedule,
  PayoutStatus,
} from '../modules/Payment/payout.interface';
import { Teacher } from '../modules/Teacher/teacher.model';
import { Transaction } from '../modules/Payment/transaction.model';
import { Payout } from '../modules/Payment/payout.model';
import { stripe } from '../utils/stripe';
// import { EmailService } from '../modules/Email/email.service';
import { PayoutEmailService } from '../modules/Email/payout-email.service';
import config from '../config';

// Initialize Agenda
const agenda = new Agenda({
  db: {
    address: config.database_url as string,
    collection: 'agendaJobs',
  },
  processEvery: '1 minute',
});

// Define job to schedule payouts
agenda.define('schedule-payouts', async (_job: any) => {
  console.log('Running schedule-payouts job');

  try {
    // Get all teachers with auto-payout enabled
    const preferences = await PayoutPreference.find({
      isAutoPayoutEnabled: true,
    });

    console.log('Payout job running with detailed logging enabled');

    console.log(
      `Found ${preferences.length} teachers with auto-payout enabled`,
    );

    for (const preference of preferences) {
      try {
        const teacherId = preference.teacherId.toString();

        // Check if it's time for a payout based on schedule
        const shouldProcessPayout = await shouldSchedulePayout(preference);

        if (!shouldProcessPayout) {
          console.log(
            `Skipping payout for teacher ${teacherId} - not scheduled yet`,
          );
          continue;
        }

        console.log(`Processing payout for teacher ${teacherId}`);

        // Get teacher details
        const teacher = await Teacher.findById(teacherId);
        if (!teacher || !teacher.stripeAccountId || !teacher.stripeVerified) {
          console.log(
            `Skipping payout for teacher ${teacherId} - invalid Stripe account`,
          );
          continue;
        }

        // Get unpaid transactions
        const unpaidTransactions = await Transaction.find({
          teacherId: new mongoose.Types.ObjectId(teacherId),
          status: 'success',
          stripeTransferStatus: 'completed',
          // Not included in any payout yet
          _id: {
            $nin: await Payout.distinct('transactions', {
              teacherId: new mongoose.Types.ObjectId(teacherId),
            }),
          },
        });

        if (unpaidTransactions.length === 0) {
          console.log(`No unpaid transactions for teacher ${teacherId}`);
          continue;
        }

        // Calculate total amount
        const totalAmount = unpaidTransactions.reduce(
          (sum, transaction) => sum + transaction.teacherEarning,
          0,
        );

        // Check if amount meets minimum threshold
        if (totalAmount < preference.minimumAmount) {
          console.log(
            `Amount ${totalAmount} is below minimum threshold ${preference.minimumAmount} for teacher ${teacherId}`,
          );
          continue;
        }

        // Start a MongoDB transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Create a payout in Stripe
          const stripePayout = await stripe.payouts.create(
            {
              amount: Math.round(totalAmount * 100), // Convert to cents
              currency: 'usd',
              destination: teacher.stripeAccountId,
              metadata: {
                teacherId,
                isAutomated: 'true',
                schedule: preference.schedule,
              },
            },
            {
              stripeAccount: teacher.stripeAccountId, // Create on the connected account
            },
          );

          // Create a payout record in our database
          const payout = await Payout.create(
            [
              {
                teacherId: new mongoose.Types.ObjectId(teacherId),
                amount: totalAmount,
                currency: 'usd',
                status: PayoutStatus.PROCESSING,
                stripePayoutId: stripePayout.id,
                transactions: unpaidTransactions.map((t) => t._id),
                description: `Automated ${preference.schedule} payout of $${totalAmount} to ${teacher.name.firstName} ${teacher.name.lastName}`,
                scheduledAt: new Date(),
                metadata: {
                  isAutomated: true,
                  schedule: preference.schedule,
                },
              },
            ],
            { session },
          );

          // Update payout preference with last payout date
          await PayoutPreference.findByIdAndUpdate(
            preference._id,
            {
              lastPayoutDate: new Date(),
              nextScheduledPayoutDate: calculateNextPayoutDate(
                preference.schedule,
              ),
            },
            { session },
          );

          // Commit the transaction
          await session.commitTransaction();
          session.endSession();

          console.log(
            `Successfully created payout ${payout[0]._id} for teacher ${teacherId}`,
          );
        } catch (error) {
          // Abort the transaction on error
          await session.abortTransaction();
          session.endSession();
          console.error(
            `Error creating payout for teacher ${teacherId}:`,
            error,
          );
        }
      } catch (error) {
        console.error(
          `Error processing teacher ${preference.teacherId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error('Error in schedule-payouts job:', error);
  }
});

// Define job to check payout statuses
agenda.define('check-payout-statuses', async (_job: any) => {
  console.log('Running check-payout-statuses job');

  try {
    // Get all processing payouts
    const processingPayouts = await Payout.find({
      status: PayoutStatus.PROCESSING,
    });

    console.log(`Found ${processingPayouts.length} processing payouts`);

    for (const payout of processingPayouts) {
      try {
        const teacherId = payout.teacherId.toString();
        const payoutId = payout._id as string;

        // Get teacher details
        const teacher = await Teacher.findById(teacherId);
        if (!teacher || !teacher.stripeAccountId) {
          console.log(
            `Skipping payout status check for ${payoutId} - invalid teacher`,
          );
          continue;
        }

        // Check payout status in Stripe
        const stripePayout = await stripe.payouts.retrieve(
          payout.stripePayoutId!,
          {
            stripeAccount: teacher.stripeAccountId,
          },
        );

        // Update status based on Stripe status
        let newStatus = payout.status;
        if (stripePayout.status === 'paid') {
          newStatus = PayoutStatus.COMPLETED;
        } else if (stripePayout.status === 'failed') {
          newStatus = PayoutStatus.FAILED;
        }

        // Update payout if status changed
        if (newStatus !== payout.status) {
          await Payout.findByIdAndUpdate(
            payoutId,
            {
              status: newStatus,
              processedAt:
                newStatus === PayoutStatus.COMPLETED ? new Date() : undefined,
              failureReason: stripePayout.failure_message || undefined,
            },
            { new: true },
          );

          console.log(`Updated payout ${payoutId} status to ${newStatus}`);

          // Send email notification if payout status changed to completed
          if (newStatus === PayoutStatus.COMPLETED && payout.status !== PayoutStatus.COMPLETED) {
            try {
              console.log(`Sending payout processed notification for payout ${payoutId}`);

              const success = await PayoutEmailService.sendPayoutStatusChangeNotification(
                payoutId,
                payout.status,
                newStatus
              );

              if (success) {
                console.log(`Successfully sent payout processed notification for payout ${payoutId}`);
              } else {
                console.log(`Failed to send payout processed notification for payout ${payoutId}`);
              }
            } catch (emailError) {
              console.error(`Error sending payout status change notification:`, emailError);
            }
          }
        }
      } catch (error) {
        console.error(`Error checking payout ${payout._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in check-payout-statuses job:', error);
  }
});

// Helper function to determine if a payout should be scheduled
async function shouldSchedulePayout(preference: any): Promise<boolean> {
  // If no last payout date, schedule a payout
  if (!preference.lastPayoutDate) {
    return true;
  }

  const lastPayoutDate = new Date(preference.lastPayoutDate);
  const now = new Date();

  // Calculate the next payout date based on the schedule
  const nextPayoutDate = preference.nextScheduledPayoutDate
    ? new Date(preference.nextScheduledPayoutDate)
    : calculateNextPayoutDate(preference.schedule, lastPayoutDate);

  // If next payout date is in the past or today, schedule a payout
  return nextPayoutDate <= now;
}

// Helper function to calculate the next payout date
function calculateNextPayoutDate(
  schedule: string,
  fromDate: Date = new Date(),
): Date {
  const nextDate = new Date(fromDate);

  switch (schedule) {
    case PayoutSchedule.DAILY:
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case PayoutSchedule.WEEKLY:
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case PayoutSchedule.BIWEEKLY:
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case PayoutSchedule.MONTHLY:
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      // For manual, set to far future
      nextDate.setFullYear(nextDate.getFullYear() + 10);
  }

  return nextDate;
}

// Define job to send upcoming payout notifications
agenda.define('send-upcoming-payout-notifications', async (_job: any) => {
  console.log('Running send-upcoming-payout-notifications job');

  try {
    // Use the PayoutEmailService to send all upcoming payout notifications
    const result = await PayoutEmailService.sendAllUpcomingPayoutNotifications();

    console.log(`Payout notification job completed: ${result.sent} sent, ${result.failed} failed out of ${result.total} total`);
  } catch (error) {
    console.error('Error in send-upcoming-payout-notifications job:', error);
  }
});

// Start agenda
export async function startPayoutJobs() {
  await agenda.start();

  // Schedule jobs
  await agenda.every('1 day', 'schedule-payouts');
  await agenda.every('1 hour', 'check-payout-statuses');
  await agenda.every('1 day', 'send-upcoming-payout-notifications');

  console.log('Payout jobs scheduled');
}

export { agenda };
