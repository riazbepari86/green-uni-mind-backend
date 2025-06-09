import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { Course } from '../Course/course.model';
import { Student } from '../Student/student.model';
import { Teacher } from '../Teacher/teacher.model';
import { Payment } from './payment.model';
import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { stripe } from '../../utils/stripe';

const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, endpointSecret);
  } catch (err) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Webhook signature verification failed');
  }

  // Return a 200 response immediately to acknowledge receipt of the webhook
  res.json({ received: true });

  try {
    if (event.type === 'checkout.session.completed') {
      const checkoutSession = event.data.object as any;
      console.log('Processing checkout.session.completed:', {
        id: checkoutSession.id,
        amount_total: checkoutSession.amount_total,
        metadata: checkoutSession.metadata,
        payment_intent: checkoutSession.payment_intent,
        transfer_data: checkoutSession.transfer_data
      });

      const { courseId, studentId, teacherId } = checkoutSession.metadata;
      
      if (!courseId || !studentId || !teacherId) {
        console.log('Missing required metadata in checkout session');
        return;
      }

      const amount = checkoutSession.amount_total / 100; // Convert from cents to dollars
      const teacherShare = parseFloat(checkoutSession.metadata.teacherShare) / 100 || amount * 0.7;
      const platformShare = parseFloat(checkoutSession.metadata.platformFee) / 100 || amount * 0.3;

      // Start a MongoDB transaction
      const mongoSession = await mongoose.startSession();
      mongoSession.startTransaction();

      try {
        // Update course
        await Course.findByIdAndUpdate(
          courseId,
          { $addToSet: { enrolledStudents: new Types.ObjectId(studentId) } },
          { session: mongoSession }
        );

        // Update student
        await Student.findByIdAndUpdate(
          studentId,
          {
            $push: {
              enrolledCourses: {
                courseId: new Types.ObjectId(courseId),
                completedLectures: [],
                enrolledAt: new Date(),
              },
            },
          },
          { session: mongoSession }
        );

        // Create payment record
        await Payment.create(
          [{
            studentId: new Types.ObjectId(studentId),
            courseId: new Types.ObjectId(courseId),
            teacherId: new Types.ObjectId(teacherId),
            amount,
            teacherShare,
            platformShare,
            stripeAccountId: checkoutSession.payment_intent,
            stripeEmail: checkoutSession.customer_details?.email || '',
            status: 'success',
            receiptUrl: checkoutSession.receipt_url,
          }],
          { session: mongoSession }
        );

        // Update teacher earnings
        await Teacher.findByIdAndUpdate(
          teacherId,
          {
            $inc: {
              'earnings.total': teacherShare,
              'earnings.monthly': teacherShare,
              'earnings.yearly': teacherShare,
              'earnings.weekly': teacherShare,
            },
            $addToSet: { courses: new Types.ObjectId(courseId) }
          },
          { session: mongoSession }
        );

        // Commit the transaction
        await mongoSession.commitTransaction();
        console.log('Successfully processed checkout.session.completed with transaction');
      } catch (error) {
        // If an error occurs, abort the transaction
        await mongoSession.abortTransaction();
        console.error('Transaction aborted:', error);
        throw error;
      } finally {
        // End the session
        mongoSession.endSession();
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
  }
};

export const PaymentWebhook = {
  handleStripeWebhook,
}; 
