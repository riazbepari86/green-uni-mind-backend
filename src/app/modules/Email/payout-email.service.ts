import { EmailService } from './email.service';
import { Teacher } from '../Teacher/teacher.model';
import { Payout } from '../Payment/payout.model';
import { PayoutStatus } from '../Payment/payout.interface';
import { format, addDays } from 'date-fns';
import { Types } from 'mongoose';

/**
 * Send email notification for upcoming payout
 */
export const sendUpcomingPayoutNotification = async (payoutId: string): Promise<boolean> => {
  try {
    // Find the payout
    const payout = await Payout.findById(payoutId);
    if (!payout) {
      console.error(`Payout not found: ${payoutId}`);
      return false;
    }

    // Find the teacher
    const teacher = await Teacher.findById(payout.teacherId);
    if (!teacher || !teacher.email) {
      console.error(`Teacher not found or missing email: ${payout.teacherId}`);
      return false;
    }

    // Format the payout date
    const payoutDate = payout.scheduledAt || new Date();
    const formattedDate = format(payoutDate, 'MMMM dd, yyyy');

    // Send the email
    const success = await EmailService.sendUpcomingPayoutNotification(
      teacher.email,
      `${teacher.name.firstName} ${teacher.name.lastName}`,
      payout.amount,
      payoutDate,
      payout.stripePayoutId || (payout._id as Types.ObjectId).toString()
    );

    // Mark notification as sent
    if (success) {
      await Payout.findByIdAndUpdate(payoutId, {
        notificationSent: true
      });
    }

    return success;
  } catch (error) {
    console.error('Error sending upcoming payout notification:', error);
    return false;
  }
};

/**
 * Send email notification for processed payout
 */
export const sendPayoutProcessedNotification = async (payoutId: string): Promise<boolean> => {
  try {
    // Find the payout
    const payout = await Payout.findById(payoutId);
    if (!payout) {
      console.error(`Payout not found: ${payoutId}`);
      return false;
    }

    // Find the teacher
    const teacher = await Teacher.findById(payout.teacherId);
    if (!teacher || !teacher.email) {
      console.error(`Teacher not found or missing email: ${payout.teacherId}`);
      return false;
    }

    // Format the payout date
    const processedDate = payout.processedAt || new Date();

    // Send the email
    const success = await EmailService.sendPayoutProcessedNotification(
      teacher.email,
      `${teacher.name.firstName} ${teacher.name.lastName}`,
      payout.amount,
      processedDate,
      payout.stripePayoutId || (payout._id as Types.ObjectId).toString()
    );

    return success;
  } catch (error) {
    console.error('Error sending payout processed notification:', error);
    return false;
  }
};

/**
 * Send notifications for all upcoming payouts
 */
export const sendAllUpcomingPayoutNotifications = async (): Promise<{
  total: number;
  sent: number;
  failed: number;
}> => {
  try {
    // Get all pending payouts scheduled within the next 2 days that haven't had notifications sent
    const twoDaysFromNow = addDays(new Date(), 2);

    const upcomingPayouts = await Payout.find({
      status: PayoutStatus.PENDING,
      scheduledAt: { $lte: twoDaysFromNow },
      notificationSent: { $ne: true }
    });

    console.log(`Found ${upcomingPayouts.length} upcoming payouts to send notifications for`);

    let sent = 0;
    let failed = 0;

    // Send notifications for each payout
    for (const payout of upcomingPayouts) {
      const success = await sendUpcomingPayoutNotification((payout._id as Types.ObjectId).toString());
      if (success) {
        sent++;
      } else {
        failed++;
      }
    }

    return {
      total: upcomingPayouts.length,
      sent,
      failed
    };
  } catch (error) {
    console.error('Error sending all upcoming payout notifications:', error);
    return {
      total: 0,
      sent: 0,
      failed: 0
    };
  }
};

/**
 * Send notification when payout status changes to completed
 */
export const sendPayoutStatusChangeNotification = async (
  payoutId: string,
  oldStatus: PayoutStatus,
  newStatus: PayoutStatus
): Promise<boolean> => {
  try {
    // Only send notification when status changes to completed
    if (newStatus === PayoutStatus.COMPLETED && oldStatus !== PayoutStatus.COMPLETED) {
      return await sendPayoutProcessedNotification(payoutId);
    }
    return false;
  } catch (error) {
    console.error('Error sending payout status change notification:', error);
    return false;
  }
};

export const PayoutEmailService = {
  sendUpcomingPayoutNotification,
  sendPayoutProcessedNotification,
  sendAllUpcomingPayoutNotifications,
  sendPayoutStatusChangeNotification
};
