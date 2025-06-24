import Stripe from 'stripe';
import mongoose, { Types } from 'mongoose';
import { Payment } from './payment.model';
import { Student } from '../Student/student.model';
import { Teacher } from '../Teacher/teacher.model';
import { Course } from '../Course/course.model';
import { Transaction } from './transaction.model';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { PayoutSummary } from './payoutSummary.model';
import { InvoiceService } from '../Invoice/invoice.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
});

const createPaymentIntent = async (
  studentId: string,
  courseId: string,
  amount: number,
) => {
  const student = await Student.findById(studentId);
  const course = await Course.findById(courseId);
  const teacher = await Teacher.findById(course?.creator);

  if (!student || !course || !teacher) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Student, course, or teacher not found',
    );
  }

  // Check if already enrolled
  if (
    student.enrolledCourses.some(
      (course) => course.courseId.toString() === courseId,
    )
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Already enrolled in this course',
    );
  }

  // Calculate shares
  const teacherShare = amount * 0.7;
  const organizationShare = amount * 0.3;

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    metadata: {
      studentId,
      courseId,
      teacherId: teacher._id.toString(),
      teacherShare,
      organizationShare,
    },
  });

  const retrievedPaymentIntent = await stripe.paymentIntents.retrieve(
    paymentIntent.id,
    {
      expand: ['charges'],
    },
  );

  return {
    clientSecret: retrievedPaymentIntent.client_secret,
    paymentIntentId: retrievedPaymentIntent.id,
  };
};

// Enhanced retry mechanism for failed operations
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = PAYMENT_SPLIT_CONFIG.RETRY_ATTEMPTS,
  delay: number = PAYMENT_SPLIT_CONFIG.RETRY_DELAY,
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`Operation failed on attempt ${attempt}/${maxRetries}:`, lastError.message);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError!;
};

// Enhanced metadata validation
const validateSessionMetadata = (session: Stripe.Checkout.Session) => {
  const metadata = session.metadata || {};
  const { courseId, studentId, teacherId, teacherShare, platformFee, version } = metadata;

  // Check for required fields
  if (!courseId || !studentId || !teacherId) {
    throw new Error(`Missing required metadata in checkout session ${session.id}: courseId=${courseId}, studentId=${studentId}, teacherId=${teacherId}`);
  }

  // Validate ObjectIds
  try {
    new Types.ObjectId(courseId);
    new Types.ObjectId(studentId);
    new Types.ObjectId(teacherId);
  } catch (error) {
    throw new Error(`Invalid ObjectId in metadata for session ${session.id}: ${error}`);
  }

  // Validate payment amounts
  const teacherShareCents = parseInt(teacherShare || '0');
  const platformFeeCents = parseInt(platformFee || '0');
  const totalAmount = session.amount_total || 0;

  if (teacherShareCents + platformFeeCents !== totalAmount) {
    console.warn(`Payment split mismatch in session ${session.id}:`, {
      total: totalAmount,
      teacher: teacherShareCents,
      platform: platformFeeCents,
      difference: totalAmount - (teacherShareCents + platformFeeCents)
    });
  }

  return {
    courseId,
    studentId,
    teacherId,
    teacherShareCents,
    platformFeeCents,
    teacherShareDollars: teacherShareCents / 100,
    platformFeeDollars: platformFeeCents / 100,
    totalAmountDollars: totalAmount / 100,
    version: version || '1.0',
  };
};

// Helper function to process checkout session completed events with enhanced error handling
const processCheckoutSessionCompleted = async (
  session: Stripe.Checkout.Session,
) => {
  console.log('Processing checkout session completed:', session.id);
  console.log('Session details:', {
    id: session.id,
    metadata: session.metadata,
    payment_intent: session.payment_intent,
    payment_status: session.payment_status,
    amount_total: session.amount_total,
    customer_details: session.customer_details,
  });

  // Enhanced metadata validation
  const validatedData = validateSessionMetadata(session);
  console.log('Validated metadata:', validatedData);

  // Use validated data for processing
  const {
    courseId,
    studentId,
    teacherId,
    teacherShareDollars,
    platformFeeDollars,
    totalAmountDollars,
  } = validatedData;

  console.log('Processing payment with validated amounts:', {
    total: totalAmountDollars,
    teacherShare: teacherShareDollars,
    platformFee: platformFeeDollars,
    sessionId: session.id,
  });

  // Enhanced database transaction with retry mechanism
  const processPaymentTransaction = async () => {
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      // Get customer email from session
      const customerEmail = session.customer_details?.email || '';
      console.log('Processing checkout session for customer:', customerEmail);

      // Validate all entities exist with enhanced error messages
      const student = await Student.findById(studentId).session(mongoSession);
      if (!student) {
        throw new Error(`Student not found with ID: ${studentId}. Session: ${session.id}`);
      }

      const course = await Course.findById(courseId).session(mongoSession);
      if (!course) {
        throw new Error(`Course not found with ID: ${courseId}. Session: ${session.id}`);
      }

      const teacher = await Teacher.findById(teacherId).session(mongoSession);
      if (!teacher) {
        throw new Error(`Teacher not found with ID: ${teacherId}. Session: ${session.id}`);
      }

      console.log('All entities validated successfully:', {
        student: student.email,
        course: course.title,
        teacher: `${teacher.name.firstName} ${teacher.name.lastName}`,
      });

      // Check if student is already enrolled in this course
      const isEnrolled = student.enrolledCourses.some(
        (enrolledCourse) => enrolledCourse.courseId.toString() === courseId,
      );

      if (isEnrolled) {
        console.log(
          `Student ${studentId} is already enrolled in course ${courseId}`,
        );
        return { success: true, message: 'Student already enrolled' };
      }

      console.log(`Enrolling student ${studentId} in course ${courseId}`);

      // Create payment record with validated data
      console.log('Creating payment record with validated data:', {
        studentId,
        courseId,
        teacherId,
        totalAmount: totalAmountDollars,
        teacherShare: teacherShareDollars,
        platformFee: platformFeeDollars,
        paymentIntent: session.payment_intent,
        customerEmail,
        status: session.payment_status,
      });

      const payment = await Payment.create(
        [
          {
            studentId: new Types.ObjectId(studentId),
            courseId: new Types.ObjectId(courseId),
            teacherId: new Types.ObjectId(teacherId),
            amount: totalAmountDollars,
            teacherShare: teacherShareDollars,
            platformShare: platformFeeDollars,
            stripeAccountId: session.payment_intent as string,
            stripePaymentId: session.payment_intent as string,
            stripeEmail: customerEmail,
            status: session.payment_status === 'paid' ? 'success' : 'pending',
            receiptUrl: '',
          },
        ],
        { session: mongoSession },
      );

      // Log the created payment
      console.log('Payment record created with ID:', payment[0]._id);
      console.log('Payment record created:', payment);

      // Create transaction record with validated data
      console.log('Creating transaction record');
      const transactionData = {
        courseId: new Types.ObjectId(courseId),
        studentId: new Types.ObjectId(studentId),
        teacherId: new Types.ObjectId(teacherId),
        totalAmount: totalAmountDollars,
        teacherEarning: teacherShareDollars,
        platformEarning: platformFeeDollars,
        stripeInvoiceUrl: '',
        stripePdfUrl: '',
        stripeTransactionId: session.payment_intent as string,
        stripeTransferStatus: 'pending',
        status: 'success',
      };

      const transaction = await Transaction.create([transactionData], {
        session: mongoSession,
      });
      console.log('Transaction record created with ID:', transaction[0]._id);

      // Update or create payout summary
      const currentDate = new Date();
      const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const year = currentDate.getFullYear();

      console.log(
        'Updating payout summary for teacher:',
        teacherId,
        'month:',
        month,
        'year:',
        year,
      );

      // Find existing payout summary or create a new one
      const existingPayoutSummary = await PayoutSummary.findOne({
        teacherId: new Types.ObjectId(teacherId),
        month,
        year,
      }).session(mongoSession);

      if (existingPayoutSummary) {
        console.log(
          'Found existing payout summary:',
          existingPayoutSummary._id,
        );
        // Update existing summary with validated data
        existingPayoutSummary.totalEarned += teacherShareDollars;
        existingPayoutSummary.transactions.push(transaction[0]._id as unknown as Types.ObjectId);

        // Check if course already exists in coursesSold
        const existingCourseIndex = existingPayoutSummary.coursesSold.findIndex(
          (c) => c.courseId.toString() === courseId,
        );

        if (existingCourseIndex >= 0) {
          // Update existing course
          existingPayoutSummary.coursesSold[existingCourseIndex].count += 1;
          existingPayoutSummary.coursesSold[existingCourseIndex].earnings +=
            teacherShareDollars;
        } else {
          // Add new course
          existingPayoutSummary.coursesSold.push({
            courseId: new Types.ObjectId(courseId),
            count: 1,
            earnings: teacherShareDollars,
          });
        }

        await existingPayoutSummary.save({ session: mongoSession });
        console.log('Updated existing payout summary');
      } else {
        console.log('Creating new payout summary');
        // Create new summary with validated data
        const newPayoutSummary = await PayoutSummary.create(
          [
            {
              teacherId: new Types.ObjectId(teacherId),
              totalEarned: teacherShareDollars,
              month,
              year,
              transactions: [transaction[0]._id],
              coursesSold: [
                {
                  courseId: new Types.ObjectId(courseId),
                  count: 1,
                  earnings: teacherShareDollars,
                },
              ],
            },
          ],
          { session: mongoSession },
        );
        console.log(
          'Created new payout summary with ID:',
          newPayoutSummary[0]._id,
        );
      }
      console.log('Transaction record created:', transaction);

      // Enroll student in course - use addToSet to prevent duplicates
      console.log('Enrolling student in course:', {
        studentId,
        courseId,
      });

      const studentUpdate = await Student.findByIdAndUpdate(
        studentId,
        {
          $addToSet: {
            enrolledCourses: {
              courseId: new Types.ObjectId(courseId),
              completedLectures: [],
              enrolledAt: new Date(),
            },
          },
        },
        { session: mongoSession, new: true },
      );
      console.log('Student updated:', studentUpdate ? 'Success' : 'Failed');

      // Update course enrolled students and increment enrollment count
      console.log('Updating course enrolled students:', {
        courseId,
        studentId,
      });

      const courseUpdate = await Course.findByIdAndUpdate(
        courseId,
        {
          $addToSet: { enrolledStudents: new Types.ObjectId(studentId) },
          $inc: { totalEnrollment: 1 },
        },
        { session: mongoSession, new: true },
      );
      console.log('Course updated:', courseUpdate ? 'Success' : 'Failed');

      // Update teacher earnings and courses with validated data
      console.log('Updating teacher earnings:', {
        teacherId,
        teacherShare: teacherShareDollars,
      });

      // Make sure transaction is created successfully before updating teacher
      if (!transaction || !transaction[0] || !transaction[0]._id) {
        throw new Error('Transaction creation failed');
      }

      console.log(
        'Updating teacher earnings and payments with transaction ID:',
        transaction[0]._id,
      );

      const teacherUpdate = await Teacher.findByIdAndUpdate(
        teacherId,
        {
          $inc: {
            totalEarnings: teacherShareDollars,
            'earnings.total': teacherShareDollars,
            'earnings.monthly': teacherShareDollars,
            'earnings.yearly': teacherShareDollars,
            'earnings.weekly': teacherShareDollars,
          },
          $addToSet: {
            courses: new Types.ObjectId(courseId),
            payments: transaction[0]._id,
          },
        },
        { session: mongoSession, new: true },
      );

      if (!teacherUpdate) {
        console.error('Failed to update teacher:', teacherId);
        throw new Error('Failed to update teacher earnings');
      }

      console.log(
        'Teacher updated successfully with earnings:',
        teacherShareDollars,
      );

      // Commit the transaction
      await mongoSession.commitTransaction();
      console.log(
        'Transaction committed successfully for checkout session:',
        session.id,
      );

      // Generate invoice after successful payment processing
      try {
        console.log('Generating invoice for completed transaction:', transaction[0]._id);
        await InvoiceService.processInvoiceGeneration(
          studentId,
          courseId,
          transaction[0]._id.toString(),
          totalAmountDollars,
          teacher.stripeAccountId || ''
        );
        console.log('Invoice generated successfully');
      } catch (invoiceError) {
        // Log the error but don't fail the payment processing
        console.error('Failed to generate invoice (payment still successful):', invoiceError);
      }

      return { success: true, message: 'Payment processed successfully' };

    } catch (error) {
      // If an error occurs, abort the transaction
      await mongoSession.abortTransaction();
      console.error(
        'Transaction aborted for checkout session:',
        session.id,
        error,
      );
      throw error;
    } finally {
      // End the session
      mongoSession.endSession();
    }
  };

  // Execute the payment transaction with retry mechanism
  return await retryOperation(processPaymentTransaction);
};

const handleStripeWebhook = async (event: Stripe.Event) => {
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent succeeded:', paymentIntent.id);

        // Extract metadata
        const {
          studentId,
          courseId,
          teacherId,
          teacherShare,
          platformFee, // This is the platform fee (previously called organizationShare)
        } = paymentIntent.metadata || {};

        // If metadata is missing, try to find the checkout session that created this payment intent
        if (!studentId || !courseId || !teacherId) {
          console.log(
            'Metadata missing in payment_intent.succeeded, attempting to find checkout session...',
          );

          try {
            // Find sessions that might have created this payment intent
            const sessions = await stripe.checkout.sessions.list({
              payment_intent: paymentIntent.id,
              limit: 1,
            });

            if (sessions && sessions.data && sessions.data.length > 0) {
              const session = sessions.data[0];
              console.log(
                'Found checkout session:',
                session.id,
                'with metadata:',
                session.metadata,
              );

              // Process the checkout session directly
              console.log('Processing checkout session directly:', session.id);

              // Call the checkout.session.completed case directly
              // This will ensure consistent processing
              await processCheckoutSessionCompleted(session);
              return { success: true };
            } else {
              console.error(
                'No checkout session found for payment intent:',
                paymentIntent.id,
              );
              return {
                success: false,
                error:
                  'Missing required metadata and no checkout session found',
              };
            }
          } catch (error) {
            console.error(
              'Error finding checkout session for payment intent:',
              error,
            );
            return {
              success: false,
              error: 'Error finding checkout session for payment intent',
            };
          }
        }

        try {
          // Start a MongoDB transaction
          const mongoSession = await mongoose.startSession();
          mongoSession.startTransaction();

          try {
            // Get customer email from payment intent
            let customerEmail = '';
            if (paymentIntent.customer) {
              try {
                const customer = await stripe.customers.retrieve(
                  paymentIntent.customer as string,
                );
                if (customer && !customer.deleted && 'email' in customer) {
                  customerEmail = customer.email || '';
                }
              } catch (error) {
                console.error('Error retrieving customer:', error);
              }
            }

            // If no customer email, try to get it from the student
            if (!customerEmail) {
              const student = await Student.findById(studentId);
              customerEmail = student?.email || 'unknown@example.com';
            }

            console.log(
              'Processing payment intent for customer:',
              customerEmail,
            );

            // Check if student exists
            const student =
              await Student.findById(studentId).session(mongoSession);
            if (!student) {
              throw new Error(`Student not found with ID: ${studentId}`);
            }

            // Check if course exists
            const course =
              await Course.findById(courseId).session(mongoSession);
            if (!course) {
              throw new Error(`Course not found with ID: ${courseId}`);
            }

            // Check if teacher exists
            const teacher =
              await Teacher.findById(teacherId).session(mongoSession);
            if (!teacher) {
              throw new Error(`Teacher not found with ID: ${teacherId}`);
            }

            // Check if student is already enrolled in this course
            const isEnrolled = student.enrolledCourses.some(
              (enrolledCourse) =>
                enrolledCourse.courseId.toString() === courseId,
            );

            if (isEnrolled) {
              console.log(
                `Student ${studentId} is already enrolled in course ${courseId}`,
              );
            } else {
              console.log(
                `Enrolling student ${studentId} in course ${courseId}`,
              );

              // Create payment record
              await Payment.create(
                [
                  {
                    studentId: new Types.ObjectId(studentId),
                    courseId: new Types.ObjectId(courseId),
                    teacherId: new Types.ObjectId(teacherId),
                    amount: paymentIntent.amount / 100, // Convert from cents to dollars
                    teacherShare: parseFloat(teacherShare) / 100, // Convert from cents to dollars
                    platformShare: parseFloat(platformFee) / 100, // Convert from cents to dollars
                    stripeAccountId: paymentIntent.id,
                    stripePaymentId: paymentIntent.id, // Set the stripePaymentId to avoid duplicate key error
                    stripeEmail: customerEmail,
                    status: 'success',
                    receiptUrl: '',
                  },
                ],
                { session: mongoSession },
              );

              // Create transaction record
              const transactionData = {
                courseId: new Types.ObjectId(courseId),
                studentId: new Types.ObjectId(studentId),
                teacherId: new Types.ObjectId(teacherId),
                totalAmount: paymentIntent.amount / 100, // Convert from cents to dollars
                teacherEarning: parseFloat(teacherShare) / 100, // Convert from cents to dollars
                platformEarning: parseFloat(platformFee) / 100, // Convert from cents to dollars
                stripeInvoiceUrl: '',
                stripePdfUrl: '',
                stripeTransactionId: paymentIntent.id,
                stripeTransferStatus: 'pending',
                status: 'success',
              };

              const transaction = await Transaction.create([transactionData], {
                session: mongoSession,
              });

              // Enroll student in course
              await Student.findByIdAndUpdate(
                studentId,
                {
                  $addToSet: {
                    enrolledCourses: {
                      courseId: new Types.ObjectId(courseId),
                      completedLectures: [],
                      enrolledAt: new Date(),
                    },
                  },
                },
                { session: mongoSession },
              );

              // Update course enrolled students and increment enrollment count
              await Course.findByIdAndUpdate(
                courseId,
                {
                  $addToSet: {
                    enrolledStudents: new Types.ObjectId(studentId),
                  },
                  $inc: { totalEnrollment: 1 },
                },
                { session: mongoSession },
              );

              // Make sure transaction is created successfully before updating teacher
              if (!transaction || !transaction[0] || !transaction[0]._id) {
                throw new Error('Transaction creation failed');
              }

              // Update teacher earnings and courses
              await Teacher.findByIdAndUpdate(
                teacherId,
                {
                  $inc: {
                    totalEarnings: parseFloat(teacherShare) / 100, // Convert from cents to dollars
                    'earnings.total': parseFloat(teacherShare) / 100, // Convert from cents to dollars
                    'earnings.monthly': parseFloat(teacherShare) / 100, // Convert from cents to dollars
                    'earnings.yearly': parseFloat(teacherShare) / 100, // Convert from cents to dollars
                    'earnings.weekly': parseFloat(teacherShare) / 100, // Convert from cents to dollars
                  },
                  $addToSet: {
                    courses: new Types.ObjectId(courseId),
                    payments: transaction[0]._id, // Add the transaction ID to the payments array
                  },
                },
                { session: mongoSession },
              );
            }

            // Commit the transaction
            await mongoSession.commitTransaction();
            console.log(
              'Transaction committed successfully for payment intent:',
              paymentIntent.id,
            );
          } catch (error) {
            // If an error occurs, abort the transaction
            await mongoSession.abortTransaction();
            console.error(
              'Transaction aborted for payment intent:',
              paymentIntent.id,
              error,
            );
            throw error;
          } finally {
            // End the session
            mongoSession.endSession();
          }
        } catch (error) {
          console.error('Error processing payment_intent.succeeded:', error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error processing payment',
          };
        }

        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent failed:', paymentIntent.id);

        // Extract metadata
        const { studentId, courseId, teacherId, teacherShare, platformFee } =
          paymentIntent.metadata || {};

        if (!studentId || !courseId || !teacherId) {
          console.error(
            'Missing required metadata in failed payment intent:',
            paymentIntent.id,
          );
          return {
            success: false,
            error: 'Missing required metadata in failed payment intent',
          };
        }

        try {
          // Get customer email from payment intent
          let customerEmail = '';
          if (paymentIntent.customer) {
            try {
              const customer = await stripe.customers.retrieve(
                paymentIntent.customer as string,
              );
              if (customer && !customer.deleted && 'email' in customer) {
                customerEmail = customer.email || '';
              }
            } catch (error) {
              console.error('Error retrieving customer:', error);
            }
          }

          // If no customer email, try to get it from the student
          if (!customerEmail) {
            const student = await Student.findById(studentId);
            customerEmail = student?.email || 'unknown@example.com';
          }

          // Create payment record for failed payment
          await Payment.create({
            studentId: new Types.ObjectId(studentId),
            courseId: new Types.ObjectId(courseId),
            teacherId: new Types.ObjectId(teacherId),
            amount: paymentIntent.amount / 100,
            teacherShare: parseFloat(teacherShare),
            platformShare: parseFloat(platformFee),
            stripeAccountId: paymentIntent.id,
            stripePaymentId: paymentIntent.id, // Set the stripePaymentId to avoid duplicate key error
            stripeEmail: customerEmail,
            status: 'failed',
            receiptUrl: '',
          });

          console.log(
            'Failed payment record created for payment intent:',
            paymentIntent.id,
          );
        } catch (error) {
          console.error(
            'Error processing payment_intent.payment_failed:',
            error,
          );
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error processing failed payment',
          };
        }

        break;
      }
      case 'account.updated': {
        // Handle Stripe Connect account updates
        const account = event.data.object as Stripe.Account;

        // Find the teacher with this Stripe account
        const teacher = await Teacher.findOne({ stripeAccountId: account.id });
        if (!teacher) {
          break;
        }

        // Update teacher verification status based on account status
        if (account.charges_enabled && account.payouts_enabled) {
          await Teacher.findByIdAndUpdate(teacher._id, {
            stripeVerified: true,
            stripeOnboardingComplete: true,
            stripeRequirements: [],
          });
        } else if (account.requirements?.currently_due?.length) {
          await Teacher.findByIdAndUpdate(teacher._id, {
            stripeVerified: false,
            stripeOnboardingComplete: false,
            stripeRequirements: account.requirements.currently_due,
          });
        }
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed event received:', session.id);

        try {
          await processCheckoutSessionCompleted(session);
        } catch (error) {
          console.error('Error processing checkout.session.completed:', error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error processing checkout session',
          };
        }
        break;
      }
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session async payment succeeded:', session.id);

        // Update payment status if it was pending
        if (session.payment_intent) {
          try {
            await Payment.findOneAndUpdate(
              { stripePaymentId: session.payment_intent },
              { status: 'success' },
            );
            console.log(
              'Payment status updated to success for:',
              session.payment_intent,
            );
          } catch (error) {
            console.error(
              'Error updating payment status for async payment succeeded:',
              error,
            );
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Error updating payment status',
            };
          }
        }
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout Session Async Payment Failed:', {
          id: session.id,
          payment_status: session.payment_status,
        });

        // Update payment status
        if (session.payment_intent) {
          try {
            await Payment.findOneAndUpdate(
              { stripePaymentId: session.payment_intent },
              { status: 'failed' },
            );
            console.log(
              'Payment status updated to failed for:',
              session.payment_intent,
            );
          } catch (error) {
            console.error(
              'Error updating payment status for async payment failed:',
              error,
            );
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Error updating payment status',
            };
          }
        }
        break;
      }
    }
    return { success: true };
  } catch (error) {
    console.error('Error in handleStripeWebhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

const connectTeacherStripe = async (teacherId: string) => {
  // Validate teacherId
  if (!teacherId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Teacher ID is required');
  }

  // Find the teacher
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
  }

  // Validate teacher email
  if (!teacher.email) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Teacher email is required for Stripe account creation',
    );
  }

  // If teacher already has a Stripe account, check its status and return the account link if needed
  if (teacher.stripeAccountId) {
    try {
      // Retrieve the Stripe account
      const account = await stripe.accounts.retrieve(teacher.stripeAccountId);

      // Check if account needs additional verification
      if (
        account.requirements &&
        account.requirements.currently_due &&
        account.requirements.currently_due.length > 0
      ) {
        // Update teacher with requirements
        await Teacher.findByIdAndUpdate(teacherId, {
          stripeRequirements: account.requirements.currently_due,
          stripeVerified: false,
          stripeOnboardingComplete: false,
        });

        // Create a new account link for completing verification
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        console.log('Creating account link with frontend URL:', frontendUrl);
        const accountLink = await stripe.accountLinks.create({
          account: teacher.stripeAccountId,
          refresh_url: `${frontendUrl}/teacher/earnings?status=incomplete`,
          return_url: `${frontendUrl}/teacher/earnings?status=complete`,
          type: 'account_onboarding',
        });
        console.log('Created account link:', accountLink.url);

        return {
          url: accountLink.url,
          status: 'incomplete',
          requirements: account.requirements.currently_due,
          message:
            'Your account needs additional verification to receive payments',
        };
      }

      // Check if charges are enabled
      if (account.charges_enabled) {
        // Update teacher status
        await Teacher.findByIdAndUpdate(teacherId, {
          stripeVerified: true,
          stripeOnboardingComplete: true,
          stripeRequirements: [],
        });

        // Account is fully verified
        return {
          status: 'complete',
          message:
            'Your Stripe account is fully verified and ready to receive payments',
        };
      } else {
        // Create a new account link for completing verification
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        console.log('Creating account link with frontend URL:', frontendUrl);
        const accountLink = await stripe.accountLinks.create({
          account: teacher.stripeAccountId,
          refresh_url: `${frontendUrl}/teacher/earnings?status=incomplete`,
          return_url: `${frontendUrl}/teacher/earnings?status=complete`,
          type: 'account_onboarding',
        });
        console.log('Created account link:', accountLink.url);

        return {
          url: accountLink.url,
          status: 'incomplete',
          message:
            'Please complete your Stripe account setup to receive payments',
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        // If the account doesn't exist anymore in Stripe, we'll create a new one
        if (error.message.includes('No such account')) {
          // Continue to create a new account
        } else {
          // For other Stripe errors, throw them to be handled by the controller
          throw new AppError(
            httpStatus.BAD_REQUEST,
            `Stripe error: ${error.message}`,
          );
        }
      }
    }
  }

  try {
    const accountParams = {
      type: 'express',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: 'individual',
      email: String(teacher.email),
      business_profile: {
        name: `${teacher.name.firstName} ${teacher.name.lastName}`,
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'manual',
          },
        },
      },
    } as Stripe.AccountCreateParams;

    // Create a new Stripe account for the teacher
    const account = await stripe.accounts.create(accountParams);

    // Update teacher with Stripe account ID
    await Teacher.findByIdAndUpdate(teacherId, {
      stripeAccountId: account.id,
      stripeEmail: teacher.email,
      stripeVerified: false,
      stripeOnboardingComplete: false,
    });

    // Create account link for onboarding
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    console.log('Creating new account link with frontend URL:', frontendUrl);
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${frontendUrl}/teacher/earnings?status=incomplete`,
      return_url: `${frontendUrl}/teacher/earnings?status=complete`,
      type: 'account_onboarding',
    });
    console.log('Created new account link:', accountLink.url);

    return {
      url: accountLink.url,
      status: 'pending',
      message: 'Please complete your Stripe account setup to receive payments',
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to create Stripe account: ${error.message}`,
      );
    }

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create Stripe account due to an unknown error',
    );
  }
};

const getTeacherEarnings = async (teacherId: string) => {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
  }

  // Use transactions instead of payments for more accurate data
  const transactions = await Transaction.find({
    teacherId: new Types.ObjectId(teacherId),
    status: 'success',
  });

  // Get current date info for filtering
  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(now.getMonth() - 1);

  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);

  // Calculate total earnings from all successful transactions
  const totalEarnings = transactions.reduce(
    (sum, transaction) => sum + transaction.teacherEarning,
    0,
  );

  // Calculate monthly earnings (last 30 days)
  const monthlyEarnings = transactions
    .filter(
      (transaction) =>
        transaction.createdAt && transaction.createdAt >= oneMonthAgo
    )
    .reduce((sum, transaction) => sum + transaction.teacherEarning, 0);

  // Calculate yearly earnings (last 365 days)
  const yearlyEarnings = transactions
    .filter(
      (transaction) =>
        transaction.createdAt && transaction.createdAt >= oneYearAgo
    )
    .reduce((sum, transaction) => sum + transaction.teacherEarning, 0);

  // Calculate weekly earnings (last 7 days)
  const weeklyEarnings = transactions
    .filter(
      (transaction) =>
        transaction.createdAt && transaction.createdAt >= oneWeekAgo
    )
    .reduce((sum, transaction) => sum + transaction.teacherEarning, 0);

  // Count unique students
  const uniqueStudentIds = new Set(
    transactions.map(transaction => transaction.studentId.toString())
  );

  // Count unique courses
  const uniqueCourseIds = new Set(
    transactions.map(transaction => transaction.courseId.toString())
  );

  // Calculate average earnings per course
  const avgPerCourse = uniqueCourseIds.size > 0
    ? totalEarnings / uniqueCourseIds.size
    : 0;

  return {
    totalEarnings,
    monthlyEarnings,
    yearlyEarnings,
    weeklyEarnings,
    enrolledStudents: uniqueStudentIds.size,
    totalCoursesSold: uniqueCourseIds.size,
    avgPerCourse,
  };
};

// Enhanced payment split configuration
const PAYMENT_SPLIT_CONFIG = {
  TEACHER_PERCENTAGE: 0.7, // 70%
  PLATFORM_PERCENTAGE: 0.3, // 30%
  MINIMUM_AMOUNT: 1, // $1 minimum
  MAXIMUM_AMOUNT: 10000, // $10,000 maximum
  CURRENCY: 'usd',
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

// Enhanced split calculation with validation
const calculatePaymentSplits = (amount: number) => {
  // Validate amount
  if (amount < PAYMENT_SPLIT_CONFIG.MINIMUM_AMOUNT) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Amount must be at least $${PAYMENT_SPLIT_CONFIG.MINIMUM_AMOUNT}`,
    );
  }

  if (amount > PAYMENT_SPLIT_CONFIG.MAXIMUM_AMOUNT) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Amount cannot exceed $${PAYMENT_SPLIT_CONFIG.MAXIMUM_AMOUNT}`,
    );
  }

  // Calculate amounts in cents for Stripe
  const totalAmountCents = Math.round(amount * 100);
  const platformFeeCents = Math.round(totalAmountCents * PAYMENT_SPLIT_CONFIG.PLATFORM_PERCENTAGE);
  const teacherShareCents = totalAmountCents - platformFeeCents;

  // Validate splits add up correctly
  if (teacherShareCents + platformFeeCents !== totalAmountCents) {
    console.warn('Payment split calculation mismatch:', {
      total: totalAmountCents,
      teacher: teacherShareCents,
      platform: platformFeeCents,
      difference: totalAmountCents - (teacherShareCents + platformFeeCents)
    });
  }

  return {
    totalAmountCents,
    teacherShareCents,
    platformFeeCents,
    teacherShareDollars: teacherShareCents / 100,
    platformFeeDollars: platformFeeCents / 100,
    teacherPercentage: PAYMENT_SPLIT_CONFIG.TEACHER_PERCENTAGE,
    platformPercentage: PAYMENT_SPLIT_CONFIG.PLATFORM_PERCENTAGE,
  };
};

// Enhanced Stripe account validation
const validateStripeAccount = async (stripeAccountId: string) => {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);

    const validation = {
      exists: true,
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
      detailsSubmitted: account.details_submitted || false,
      requirements: account.requirements?.currently_due || [],
      isFullyVerified: false,
      canReceivePayments: false,
    };

    // Check if account is fully verified and can receive payments
    validation.isFullyVerified = validation.chargesEnabled &&
                                validation.payoutsEnabled &&
                                validation.detailsSubmitted &&
                                validation.requirements.length === 0;

    validation.canReceivePayments = validation.chargesEnabled && validation.detailsSubmitted;

    return validation;
  } catch (error) {
    console.error('Error validating Stripe account:', error);
    return {
      exists: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirements: [],
      isFullyVerified: false,
      canReceivePayments: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

const createCheckoutSession = async (
  studentId: string,
  courseId: string,
  amount?: number,
) => {
  try {
    console.log('Creating checkout session:', { studentId, courseId, amount });

    // Validate course exists
    const course = await Course.findById(courseId);
    if (!course) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
    }

    // Find the teacher
    const teacher = await Teacher.findById(course.creator);
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    // Check if student is already enrolled
    const student = await Student.findById(studentId);
    if (!student) {
      throw new AppError(httpStatus.NOT_FOUND, 'Student not found');
    }

    if (
      student.enrolledCourses.some(
        (enrolledCourse) => enrolledCourse.courseId.toString() === courseId,
      )
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Already enrolled in this course',
      );
    }

    // Calculate the price and validate
    const coursePrice = amount !== undefined ? amount : course.coursePrice || 0;

    if (coursePrice <= 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Course price must be greater than 0',
      );
    }

    // Calculate payment splits with enhanced validation
    const splits = calculatePaymentSplits(coursePrice);
    console.log('Payment splits calculated:', splits);

    // Validate teacher's Stripe account
    let stripeAccountValidation = null;
    if (teacher.stripeAccountId) {
      stripeAccountValidation = await validateStripeAccount(teacher.stripeAccountId);
      console.log('Stripe account validation:', stripeAccountValidation);

      if (!stripeAccountValidation.canReceivePayments) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Teacher\'s payment account is not ready to receive payments. Please complete account setup.',
        );
      }
    } else {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Teacher has not connected their payment account yet.',
      );
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl = `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/payment/cancel`;

    // Create enhanced session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: PAYMENT_SPLIT_CONFIG.CURRENCY,
            product_data: {
              name: course.title,
              description: course.description || 'Course enrollment',
              images: course.courseThumbnail ? [course.courseThumbnail] : [],
              metadata: {
                courseId: courseId,
                teacherId: teacher._id.toString(),
              },
            },
            unit_amount: splits.totalAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: student.email,
      metadata: {
        courseId: courseId,
        studentId: studentId,
        teacherId: teacher._id.toString(),
        teacherShare: splits.teacherShareCents.toString(),
        platformFee: splits.platformFeeCents.toString(),
        teacherPercentage: splits.teacherPercentage.toString(),
        platformPercentage: splits.platformPercentage.toString(),
        version: '2.0', // Version for tracking enhanced processing
      },
      // Enhanced payment configuration
      payment_intent_data: {
        application_fee_amount: splits.platformFeeCents,
        transfer_data: {
          destination: teacher.stripeAccountId!,
        },
        metadata: {
          courseId: courseId,
          studentId: studentId,
          teacherId: teacher._id.toString(),
          teacherShare: splits.teacherShareDollars.toString(),
          platformFee: splits.platformFeeDollars.toString(),
        },
      },
      // Enhanced session configuration
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'NO', 'DK', 'FI'],
      },
    };

    console.log('Creating Stripe checkout session with params:', {
      ...sessionParams,
      payment_intent_data: {
        ...sessionParams.payment_intent_data,
        transfer_data: {
          destination: teacher.stripeAccountId,
        },
      },
    });

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log('Checkout session created successfully:', {
      sessionId: session.id,
      url: session.url,
      amount: splits.totalAmountCents,
      teacherShare: splits.teacherShareCents,
      platformFee: splits.platformFeeCents,
    });

    return session;
  } catch (error) {
    console.error('Error in createCheckoutSession:', error);
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to create checkout session: ${error.message}`,
      );
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create checkout session',
    );
  }
};

const saveStripeAccountDetails = async (
  teacherId: string,
  stripeData: {
    stripeAccountId: string;
    stripeEmail: string;
    stripeVerified?: boolean;
    stripeOnboardingComplete?: boolean;
  },
) => {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
  }

  // Verify the Stripe account exists
  try {
    const account = await stripe.accounts.retrieve(stripeData.stripeAccountId);
    if (!account) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Stripe account ID');
    }

    console.log('Stripe account retrieved:', {
      id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements: account.requirements?.currently_due,
    });
  } catch (error) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Stripe account ID');
  }

  // Update teacher with Stripe account details and flags
  teacher.stripeAccountId = stripeData.stripeAccountId;
  teacher.stripeEmail = stripeData.stripeEmail;

  // Use provided values or defaults
  teacher.stripeVerified =
    stripeData.stripeVerified !== undefined ? stripeData.stripeVerified : true;

  teacher.stripeOnboardingComplete =
    stripeData.stripeOnboardingComplete !== undefined
      ? stripeData.stripeOnboardingComplete
      : true;

  console.log('Updating teacher with Stripe details:', {
    teacherId,
    stripeAccountId: teacher.stripeAccountId,
    stripeVerified: teacher.stripeVerified,
    stripeOnboardingComplete: teacher.stripeOnboardingComplete,
  });

  await teacher.save();

  return teacher;
};

export const PaymentServices = {
  createPaymentIntent,
  handleStripeWebhook,
  connectTeacherStripe,
  getTeacherEarnings,
  createCheckoutSession,
  saveStripeAccountDetails,
};
