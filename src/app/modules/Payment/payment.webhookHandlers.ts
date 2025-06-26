import Stripe from 'stripe';
import { Payment } from './payment.model';
import { Transaction } from './transaction.model';
import { Student } from '../Student/student.model';
import { Teacher } from '../Teacher/teacher.model';
import { Course } from '../Course/course.model';
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

interface WebhookProcessingResult {
  success: boolean;
  error?: string;
  processingTime?: number;
  affectedUserId?: string;
  affectedUserType?: string;
  relatedResourceIds?: string[];
}

// Helper function to create consistent webhook processing results
const createWebhookResult = (
  success: boolean,
  processingTime?: number,
  error?: string,
  affectedUserId?: string,
  affectedUserType?: string,
  relatedResourceIds?: string[]
): WebhookProcessingResult => ({
  success,
  ...(error && { error }),
  ...(processingTime && { processingTime }),
  ...(affectedUserId && { affectedUserId }),
  ...(affectedUserType && { affectedUserType }),
  ...(relatedResourceIds && { relatedResourceIds }),
});

// Handle checkout.session.completed event
const handleCheckoutSessionCompleted = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();
  
  try {
    const checkoutSession = event.data.object as any;
    const { courseId, studentId, teacherId } = checkoutSession.metadata;
    
    if (!courseId || !studentId || !teacherId) {
      return {
        success: false,
        error: 'Missing required metadata in checkout session',
        processingTime: Date.now() - startTime,
      };
    }

    // Get related entities
    const [student, teacher, course] = await Promise.all([
      Student.findById(studentId),
      Teacher.findById(teacherId),
      Course.findById(courseId),
    ]);

    if (!student || !teacher || !course) {
      return {
        success: false,
        error: 'Related entities not found',
        processingTime: Date.now() - startTime,
      };
    }

    // Create or update payment record
    const existingPayment = await Payment.findOne({ 
      stripePaymentId: checkoutSession.payment_intent 
    });

    if (!existingPayment) {
      const payment = new Payment({
        studentId,
        courseId,
        teacherId,
        amount: checkoutSession.amount_total / 100,
        teacherShare: (checkoutSession.amount_total * 0.8) / 100, // 80% to teacher
        platformShare: (checkoutSession.amount_total * 0.2) / 100, // 20% platform fee
        stripeAccountId: teacher.stripeConnect?.accountId || teacher.stripeAccountId,
        stripePaymentId: checkoutSession.payment_intent,
        stripeEmail: checkoutSession.customer_details?.email || student.email,
        status: 'completed',
        receiptUrl: checkoutSession.receipt_url,
      });

      await payment.save();
    }

    // Create transaction record
    const existingTransaction = await Transaction.findOne({ 
      stripeTransactionId: checkoutSession.payment_intent 
    });

    if (!existingTransaction) {
      const transaction = new Transaction({
        courseId,
        studentId,
        teacherId,
        totalAmount: checkoutSession.amount_total / 100,
        teacherEarning: (checkoutSession.amount_total * 0.8) / 100,
        platformEarning: (checkoutSession.amount_total * 0.2) / 100,
        stripeTransactionId: checkoutSession.payment_intent,
        stripeTransferStatus: 'pending',
        paymentMethod: checkoutSession.payment_method_types?.[0] || 'card',
        currency: checkoutSession.currency || 'usd',
        metadata: {
          checkoutSessionId: checkoutSession.id,
          customerEmail: checkoutSession.customer_details?.email,
          paymentStatus: checkoutSession.payment_status,
        },
      });

      await transaction.save();
    }

    // Log audit event
    await AuditLog.create({
      action: AuditLogAction.PAYMENT_COMPLETED,
      category: AuditLogCategory.PAYMENT,
      level: AuditLogLevel.INFO,
      message: `Payment completed for course: ${course.title}`,
      userId: studentId,
      userType: 'student',
      resourceType: 'payment',
      resourceId: checkoutSession.payment_intent,
      metadata: {
        stripeEventId: event.id,
        checkoutSessionId: checkoutSession.id,
        paymentIntentId: checkoutSession.payment_intent,
        amount: checkoutSession.amount_total / 100,
        currency: checkoutSession.currency,
        courseId,
        teacherId,
        studentEmail: checkoutSession.customer_details?.email,
      },
      timestamp: new Date(),
    });

    // Send notifications
    await Promise.all([
      // Notify student
      NotificationService.createNotification({
        type: NotificationType.PAYMENT_RECEIVED,
        priority: NotificationPriority.NORMAL,
        userId: studentId,
        userType: 'student',
        title: 'Payment Successful',
        body: `Your payment for "${course.title}" has been processed successfully. You now have access to the course.`,
        relatedResourceType: 'course',
        relatedResourceId: courseId,
        actionUrl: `/courses/${courseId}`,
        actionText: 'Access Course',
        metadata: {
          amount: checkoutSession.amount_total / 100,
          currency: checkoutSession.currency,
          courseTitle: course.title,
        },
      }),
      
      // Notify teacher
      NotificationService.createNotification({
        type: NotificationType.PAYMENT_RECEIVED,
        priority: NotificationPriority.NORMAL,
        userId: teacherId,
        userType: 'teacher',
        title: 'New Sale',
        body: `You've received a new sale for "${course.title}". Your earnings: ${(checkoutSession.amount_total * 0.8) / 100} ${checkoutSession.currency?.toUpperCase()}.`,
        relatedResourceType: 'course',
        relatedResourceId: courseId,
        actionUrl: `/teacher/earnings`,
        actionText: 'View Earnings',
        metadata: {
          amount: checkoutSession.amount_total / 100,
          teacherEarning: (checkoutSession.amount_total * 0.8) / 100,
          currency: checkoutSession.currency,
          courseTitle: course.title,
          studentName: `${student.name.firstName} ${student.name.lastName}`,
        },
      }),
    ]);

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: studentId,
      affectedUserType: 'student',
      relatedResourceIds: [courseId, teacherId, checkoutSession.payment_intent],
    };

  } catch (error: any) {
    console.error('Error handling checkout.session.completed webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Handle payment_intent.succeeded event
const handlePaymentIntentSucceeded = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();
  
  try {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    // Update payment status if exists
    const payment = await Payment.findOneAndUpdate(
      { stripePaymentId: paymentIntent.id },
      {
        $set: {
          status: 'success',
          receiptUrl: (paymentIntent as any).charges?.data?.[0]?.receipt_url,
        },
      },
      { new: true }
    );

    if (payment) {
      // Log audit event
      await AuditLog.create({
        action: AuditLogAction.PAYMENT_COMPLETED,
        category: AuditLogCategory.PAYMENT,
        level: AuditLogLevel.INFO,
        message: `Payment intent succeeded: ${paymentIntent.amount / 100} ${paymentIntent.currency}`,
        userId: payment.studentId,
        userType: 'student',
        resourceType: 'payment_intent',
        resourceId: paymentIntent.id,
        metadata: {
          stripeEventId: event.id,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          paymentMethod: paymentIntent.payment_method,
        },
        timestamp: new Date(),
      });
    }

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: payment?.studentId?.toString(),
      affectedUserType: 'student',
      relatedResourceIds: [paymentIntent.id],
    };

  } catch (error: any) {
    console.error('Error handling payment_intent.succeeded webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Handle payment_intent.payment_failed event
const handlePaymentIntentFailed = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  const startTime = Date.now();
  
  try {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    // Update payment status if exists
    const payment = await Payment.findOneAndUpdate(
      { stripePaymentId: paymentIntent.id },
      {
        $set: {
          status: 'failed',
        },
      },
      { new: true }
    );

    if (payment) {
      // Log audit event
      await AuditLog.create({
        action: AuditLogAction.PAYMENT_FAILED,
        category: AuditLogCategory.PAYMENT,
        level: AuditLogLevel.ERROR,
        message: `Payment intent failed: ${paymentIntent.last_payment_error?.message}`,
        userId: payment.studentId,
        userType: 'student',
        resourceType: 'payment_intent',
        resourceId: paymentIntent.id,
        metadata: {
          stripeEventId: event.id,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          errorCode: paymentIntent.last_payment_error?.code,
          errorMessage: paymentIntent.last_payment_error?.message,
        },
        timestamp: new Date(),
      });

      // Send failure notification
      await NotificationService.createNotification({
        type: NotificationType.PAYMENT_FAILED,
        priority: NotificationPriority.HIGH,
        userId: payment.studentId,
        userType: 'student',
        title: 'Payment Failed',
        body: `Your payment failed: ${paymentIntent.last_payment_error?.message}. Please try again with a different payment method.`,
        relatedResourceType: 'payment',
        relatedResourceId: paymentIntent.id,
        metadata: {
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          errorMessage: paymentIntent.last_payment_error?.message,
        },
      });
    }

    return {
      success: true,
      processingTime: Date.now() - startTime,
      affectedUserId: payment?.studentId?.toString(),
      affectedUserType: 'student',
      relatedResourceIds: [paymentIntent.id],
    };

  } catch (error: any) {
    console.error('Error handling payment_intent.payment_failed webhook:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    };
  }
};

// Placeholder handlers for other payment events
const handleChargeSucceeded = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  // Implementation for charge.succeeded
  return createWebhookResult(true, 0);
};

const handleChargeFailed = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  // Implementation for charge.failed
  return createWebhookResult(true, 0);
};

const handleChargeDisputeCreated = async (event: Stripe.Event): Promise<WebhookProcessingResult> => {
  // Implementation for charge.dispute.created
  return createWebhookResult(true, 0);
};

export const PaymentWebhookHandlers = {
  handleCheckoutSessionCompleted,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handleChargeSucceeded,
  handleChargeFailed,
  handleChargeDisputeCreated,
};
