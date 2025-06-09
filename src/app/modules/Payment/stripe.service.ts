import Stripe from 'stripe';
import mongoose, { Types } from 'mongoose';
import config from '../../config';
import { Teacher } from '../Teacher/teacher.model';
import { Student } from '../Student/student.model';
import { Course } from '../Course/course.model';
import { Transaction } from './transaction.model';
import { PayoutSummary } from './payoutSummary.model';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

// Initialize Stripe with the secret key
const stripe = new Stripe(config.stripe_secret_key, {
  apiVersion: '2025-04-30.basil',
});

/**
 * Create a Stripe Connect Express account for a teacher
 */
const createStripeAccountForTeacher = async (teacherId: string) => {
  try {
    // Find the teacher
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    // Check if teacher already has a Stripe account
    if (teacher.stripeAccountId) {
      // Retrieve the account to check its status
      const account = await stripe.accounts.retrieve(teacher.stripeAccountId);

      // If account exists and is active, return it
      if (account && !account.deleted) {
        return {
          status: 'complete',
          message: 'Stripe account already exists',
          accountId: teacher.stripeAccountId,
          detailsSubmitted: account.details_submitted,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
        };
      }
    }

    // Create a new Stripe account for the teacher
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // Default to US, can be made configurable
      email: teacher.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      business_profile: {
        name: `${teacher.name.firstName} ${teacher.name.lastName}`,
        url: `${config.frontend_url}/teacher/${teacherId}`,
      },
      metadata: {
        teacherId: teacherId,
      },
    });

    // Update teacher with Stripe account ID
    await Teacher.findByIdAndUpdate(teacherId, {
      stripeAccountId: account.id,
      stripeEmail: teacher.email,
    });

    return {
      status: 'pending',
      message: 'Stripe account created successfully',
      accountId: account.id,
    };
  } catch (error) {
    console.error('Error creating Stripe account:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create Stripe account'
    );
  }
};

/**
 * Create an onboarding link for a teacher's Stripe account
 */
const createStripeOnboardingLink = async (teacherId: string) => {
  try {
    // Find the teacher
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    // Check if teacher has a Stripe account
    if (!teacher.stripeAccountId) {
      // Create a new account if one doesn't exist
      const accountResult = await createStripeAccountForTeacher(teacherId);
      if (accountResult.status !== 'pending' && accountResult.status !== 'complete') {
        throw new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to create Stripe account'
        );
      }
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: teacher.stripeAccountId!,
      refresh_url: `${config.frontend_url}/teacher/earnings?status=incomplete`,
      return_url: `${config.frontend_url}/teacher/earnings?status=complete`,
      type: 'account_onboarding',
    });

    return {
      status: 'pending',
      message: 'Onboarding link created successfully',
      url: accountLink.url,
    };
  } catch (error) {
    console.error('Error creating onboarding link:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create onboarding link'
    );
  }
};

/**
 * Check the status of a teacher's Stripe account
 */
const checkStripeAccountStatus = async (teacherId: string) => {
  try {
    // Find the teacher
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    console.log('Checking Stripe account status for teacher:', {
      teacherId,
      stripeAccountId: teacher.stripeAccountId,
      stripeVerified: teacher.stripeVerified,
      stripeOnboardingComplete: teacher.stripeOnboardingComplete
    });

    // Check if teacher has a Stripe account
    if (!teacher.stripeAccountId) {
      return {
        status: 'not_created',
        message: 'Stripe account not created',
      };
    }

    // Retrieve the account to check its status
    const account = await stripe.accounts.retrieve(teacher.stripeAccountId);

    // Check if the account is fully set up
    const isComplete = account.details_submitted && account.charges_enabled && account.payouts_enabled;

    // Get any pending requirements
    const requirements = account.requirements?.currently_due || [];

    // If the account is complete in Stripe but not marked as verified in our database, update it
    if (isComplete && (!teacher.stripeVerified || !teacher.stripeOnboardingComplete)) {

      await Teacher.findByIdAndUpdate(teacherId, {
        stripeVerified: true,
        stripeOnboardingComplete: true,
        stripeRequirements: []
      });
    }

    return {
      status: isComplete ? 'complete' : 'incomplete',
      message: isComplete ? 'Stripe account is fully set up' : 'Stripe account setup is incomplete',
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirements,
      teacherStatus: {
        stripeVerified: teacher.stripeVerified,
        stripeOnboardingComplete: teacher.stripeOnboardingComplete
      }
    };
  } catch (error) {
    console.error('Error checking Stripe account status:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to check Stripe account status'
    );
  }
};

/**
 * Create a checkout session for a course purchase
 */
const createCheckoutSession = async (
  studentId: string,
  courseId: string,
  amount?: number
) => {
  try {
    // Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      throw new AppError(httpStatus.NOT_FOUND, 'Student not found');
    }

    // Find the course
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
    if (
      student.enrolledCourses.some(
        (course) => course.courseId.toString() === courseId
      )
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Already enrolled in this course'
      );
    }

    // Calculate the price and fee
    const coursePrice = amount !== undefined ? amount : course.coursePrice || 0;
    const platformFeePercent = 0.3; // 30%

    // Calculate amounts in cents
    const priceInCents = Math.round(coursePrice * 100);
    const platformFeeInCents = Math.round(priceInCents * platformFeePercent);
    const teacherShareInCents = priceInCents - platformFeeInCents;

    // Use frontend URL from config
    const frontendUrl = config.frontend_url;
    const successUrl = `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/payment/cancel`;

    // Create session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: course.title,
              description: course.description || 'Course enrollment',
              images: course.courseThumbnail ? [course.courseThumbnail] : [],
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        studentId: studentId,
        courseId: courseId,
        teacherId: teacher._id.toString(),
        teacherShare: (teacherShareInCents / 100).toString(), // Convert back to dollars for readability
        platformFee: (platformFeeInCents / 100).toString(), // Convert back to dollars for readability
      },
      customer_email: student.email,
    };

    // Check if teacher has a valid Stripe account
    let isValidStripeAccount = false;

    if (teacher.stripeAccountId) {
      try {
        // Verify the account exists and is valid
        const account = await stripe.accounts.retrieve(teacher.stripeAccountId);
        isValidStripeAccount =
          account.id === teacher.stripeAccountId && account.charges_enabled;
      } catch (error) {
        console.error('Error verifying Stripe account:', error);
        isValidStripeAccount = false;
      }
    }

    // Set up payment_intent_data with metadata
    sessionParams.payment_intent_data = {
      metadata: {
        studentId: studentId,
        courseId: courseId,
        teacherId: teacher._id.toString(),
        teacherShare: (teacherShareInCents / 100).toString(),
        platformFee: (platformFeeInCents / 100).toString(),
      }
    };

    // Only add transfer data if the account is valid
    if (isValidStripeAccount) {
      sessionParams.payment_intent_data.application_fee_amount = platformFeeInCents;
      sessionParams.payment_intent_data.transfer_data = {
        destination: teacher.stripeAccountId!,
      };
    } else {
      console.log('Not using Stripe Connect - account invalid or not found');
    }

    // Create the checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create checkout session'
    );
  }
};

/**
 * Handle webhook events from Stripe
 */
const handleWebhookEvent = async (event: Stripe.Event) => {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event);
        break;
      case 'account.updated':
        await handleAccountUpdated(event);
        break;
      // Add more event handlers as needed
    }
  } catch (error) {
    console.error(`Error handling webhook event ${event.type}:`, error);
    throw error;
  }
};

/**
 * Handle checkout.session.completed event
 */
const handleCheckoutSessionCompleted = async (event: Stripe.Event) => {
  const session = event.data.object as Stripe.Checkout.Session;
  console.log('Processing checkout.session.completed:', session.id);

  // Extract metadata
  const { courseId, studentId, teacherId, teacherShare, platformFee } =
    session.metadata || {};

  if (!courseId || !studentId || !teacherId) {
    console.error('Missing required metadata in checkout session:', session.id);
    return;
  }

  // Start a MongoDB transaction
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    // 1. Fetch invoice details
    const paymentIntentId = session.payment_intent as string;
    console.log('Retrieving payment intent:', paymentIntentId);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Get the charge ID to use for transfer
    const chargeId = paymentIntent.latest_charge as string;

    // Get the invoice
    let invoiceUrl = '';
    let invoicePdfUrl = '';

    if (session.invoice) {
      try {
        const invoice = await stripe.invoices.retrieve(session.invoice as string);
        invoiceUrl = invoice.hosted_invoice_url || '';
        invoicePdfUrl = invoice.invoice_pdf || '';
      } catch (error) {
        console.error('Error retrieving invoice:', error);
      }
    }

    // 2. Create transaction record
    const amount = (session.amount_total || 0) / 100; // Convert from cents to dollars
    // Convert from cents to dollars and ensure we're using the teacher's 70% share
    const teacherShareAmount = (parseFloat(teacherShare || '0') / 100) || (amount * 0.7);
    const platformShareAmount = (parseFloat(platformFee || '0') / 100) || (amount * 0.3);

    console.log('Calculated amounts:', {
      amount,
      teacherShareAmount,
      platformShareAmount,
      originalTeacherShare: teacherShare,
      originalPlatformFee: platformFee
    });

    console.log('Creating transaction record with data:', {
      courseId,
      studentId,
      teacherId,
      amount,
      teacherShareAmount,
      platformShareAmount,
      paymentIntentId
    });

    const transactionData = {
      courseId: new Types.ObjectId(courseId),
      studentId: new Types.ObjectId(studentId),
      teacherId: new Types.ObjectId(teacherId),
      totalAmount: amount,
      teacherEarning: teacherShareAmount,
      platformEarning: platformShareAmount,
      stripeInvoiceUrl: invoiceUrl,
      stripePdfUrl: invoicePdfUrl,
      stripeTransactionId: paymentIntentId,
      status: 'success',
    };

    // Create the transaction
    const transaction = await Transaction.create([transactionData], { session: mongoSession });
    // Get the transaction ID as a Types.ObjectId to avoid type issues
    const transactionId = transaction[0]._id as Types.ObjectId;

    console.log('Transaction created:', transactionId.toString());

    // 3. Update student's enrolled courses - use addToSet to prevent duplicates
    console.log('Updating student enrolled courses for student:', studentId);
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
      { session: mongoSession }
    );

    // 4. Update course's enrolled students and total enrollment
    console.log('Updating course enrolled students for course:', courseId);
    await Course.findByIdAndUpdate(
      courseId,
      {
        $addToSet: { enrolledStudents: new Types.ObjectId(studentId) },
        $inc: { totalEnrollment: 1 },
      },
      { session: mongoSession }
    );

    // 5. Update teacher's earnings
    console.log('Updating teacher earnings for teacher:', teacherId);
    await Teacher.findByIdAndUpdate(
      teacherId,
      {
        $push: { payments: transactionId },
        $inc: {
          totalEarnings: teacherShareAmount,
          'earnings.total': teacherShareAmount,
          'earnings.monthly': teacherShareAmount,
          'earnings.yearly': teacherShareAmount,
          'earnings.weekly': teacherShareAmount,
        },
      },
      { session: mongoSession }
    );

    // 6. Update or create payout summary
    const currentDate = new Date();
    const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const year = currentDate.getFullYear();

    console.log('Updating payout summary for teacher:', teacherId);

    // Find existing payout summary or create a new one
    let payoutSummary = await PayoutSummary.findOne({
      teacherId: new Types.ObjectId(teacherId),
      month,
      year,
    });

    if (payoutSummary) {
      // Update existing summary
      payoutSummary.totalEarned += teacherShareAmount;
      payoutSummary.transactions.push(transactionId);

      // Check if course already exists in coursesSold
      const existingCourseIndex = payoutSummary.coursesSold.findIndex(
        (c) => c.courseId.toString() === courseId
      );

      if (existingCourseIndex >= 0) {
        // Update existing course
        payoutSummary.coursesSold[existingCourseIndex].count += 1;
        payoutSummary.coursesSold[existingCourseIndex].earnings += teacherShareAmount;
      } else {
        // Add new course
        payoutSummary.coursesSold.push({
          courseId: new Types.ObjectId(courseId),
          count: 1,
          earnings: teacherShareAmount,
        });
      }

      await payoutSummary.save({ session: mongoSession });
    } else {
      // Create new summary
      await PayoutSummary.create(
        [{
          teacherId: new Types.ObjectId(teacherId),
          totalEarned: teacherShareAmount,
          month,
          year,
          transactions: [transactionId],
          coursesSold: [
            {
              courseId: new Types.ObjectId(courseId),
              count: 1,
              earnings: teacherShareAmount,
            },
          ],
        }],
        { session: mongoSession }
      );
    }

    // 7. Create transfer to teacher if they have a valid Stripe account
    const teacher = await Teacher.findById(teacherId);
    if (teacher?.stripeAccountId) {
      try {
        console.log('Creating transfer to teacher Stripe account:', teacher.stripeAccountId);
        const transfer = await stripe.transfers.create({
          // Stripe requires amount in cents, so we need to convert back to cents
          // If teacherShare is provided, use it, otherwise calculate 70% of the amount
          amount: parseInt(teacherShare || '0') || Math.round(amount * 100 * 0.7), // Convert to cents and take 70%
          currency: 'usd',
          destination: teacher.stripeAccountId,
          transfer_group: `course_${courseId}`,
          source_transaction: chargeId,
          metadata: {
            courseId,
            studentId,
            teacherId,
            transactionId: transactionId.toString(),
          },
        });

        console.log('Transfer created:', transfer.id);

        // Update transaction with transfer info
        await Transaction.findByIdAndUpdate(
          transactionId,
          {
            stripeTransferId: transfer.id,
            stripeTransferStatus: 'completed',
          },
          { session: mongoSession }
        );
      } catch (error) {
        console.error('Error creating transfer:', error);
        // Update transaction with failed transfer status
        await Transaction.findByIdAndUpdate(
          transactionId,
          {
            stripeTransferStatus: 'failed',
          },
          { session: mongoSession }
        );
      }
    } else {
      console.log('Teacher does not have a valid Stripe account, skipping transfer');
    }

    // Commit the transaction
    await mongoSession.commitTransaction();
    mongoSession.endSession();
    console.log('MongoDB transaction committed successfully');

    return transaction[0];
  } catch (error) {
    // Abort the transaction on error
    await mongoSession.abortTransaction();
    mongoSession.endSession();
    console.error('Error processing checkout session:', error);
    throw error;
  }
};

/**
 * Handle account.updated event
 */
const handleAccountUpdated = async (event: Stripe.Event) => {
  const account = event.data.object as Stripe.Account;

  // Find the teacher with this Stripe account
  const teacher = await Teacher.findOne({ stripeAccountId: account.id });
  if (!teacher) {
    console.log(`No teacher found with Stripe account ID: ${account.id}`);
    return;
  }

  // Update teacher's Stripe account status
  await Teacher.findByIdAndUpdate(teacher._id, {
    stripeVerified: account.details_submitted,
    stripeOnboardingComplete: account.charges_enabled,
  });
};

/**
 * Get teacher's payout information
 */
const getTeacherPayoutInfo = async (teacherId: string, period?: string) => {
  try {
    // Find the teacher
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    // Get current date info
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const currentYear = currentDate.getFullYear();

    // Determine period to query
    let monthToQuery = currentMonth;
    let yearToQuery = currentYear;

    if (period) {
      const [year, month] = period.split('-');
      if (year && month) {
        monthToQuery = `${year}-${month.padStart(2, '0')}`;
        yearToQuery = parseInt(year);
      }
    }

    // Get payout summary for the specified period
    const payoutSummary = await PayoutSummary.findOne({
      teacherId: new Types.ObjectId(teacherId),
      month: monthToQuery,
      year: yearToQuery,
    }).populate({
      path: 'coursesSold.courseId',
      select: 'title courseThumbnail',
    });

    // If no payout summary is found, try to get transaction data directly
    let currentPeriodData = {
      month: monthToQuery,
      year: yearToQuery,
      earnings: payoutSummary?.totalEarned || 0,
      coursesSold: payoutSummary?.coursesSold || [],
    };

    if (!payoutSummary) {
      console.log('No payout summary found, getting transaction data directly');

      // Build query for transactions in the specified period
      const startDate = new Date(yearToQuery, parseInt(monthToQuery.split('-')[1]) - 1, 1);
      const endDate = new Date(yearToQuery, parseInt(monthToQuery.split('-')[1]), 0);

      const transactions = await Transaction.find({
        teacherId: new Types.ObjectId(teacherId),
        status: 'success',
        createdAt: { $gte: startDate, $lte: endDate }
      }).populate({
        path: 'courseId',
        select: 'title courseThumbnail'
      });

      console.log(`Found ${transactions.length} transactions for period ${monthToQuery}`);

      if (transactions.length > 0) {
        // Calculate total earnings
        const totalEarnings = transactions.reduce((sum, t) => sum + t.teacherEarning, 0);

        // Group transactions by course
        const courseMap = new Map();

        transactions.forEach(transaction => {
          const courseId = transaction.courseId._id.toString();
          if (!courseMap.has(courseId)) {
            courseMap.set(courseId, {
              courseId: transaction.courseId,
              count: 1,
              earnings: transaction.teacherEarning
            });
          } else {
            const course = courseMap.get(courseId);
            course.count += 1;
            course.earnings += transaction.teacherEarning;
          }
        });

        // Update current period data
        currentPeriodData = {
          month: monthToQuery,
          year: yearToQuery,
          earnings: totalEarnings,
          coursesSold: Array.from(courseMap.values())
        };
      }
    }

    // Get all payout summaries for monthly breakdown
    const allPayoutSummaries = await PayoutSummary.find({
      teacherId: new Types.ObjectId(teacherId),
      year: yearToQuery,
    }).sort({ month: 1 });

    // If no payout summaries are found, try to get monthly data from transactions
    let monthlyBreakdown = allPayoutSummaries.map((summary) => ({
      month: summary.month,
      earnings: summary.totalEarned,
      coursesSold: summary.coursesSold.reduce((total, course) => total + course.count, 0),
    }));

    if (monthlyBreakdown.length === 0) {
      console.log('No monthly breakdown found, getting transaction data directly');

      // Get all transactions for the year
      const yearStart = new Date(yearToQuery, 0, 1);
      const yearEnd = new Date(yearToQuery, 11, 31);

      const yearTransactions = await Transaction.find({
        teacherId: new Types.ObjectId(teacherId),
        status: 'success',
        createdAt: { $gte: yearStart, $lte: yearEnd }
      });

      console.log(`Found ${yearTransactions.length} transactions for year ${yearToQuery}`);

      if (yearTransactions.length > 0) {
        // Group transactions by month
        const monthMap = new Map();

        yearTransactions.forEach(transaction => {
          // Make sure createdAt is not undefined
          if (transaction.createdAt) {
            const date = new Date(transaction.createdAt);
            const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthMap.has(month)) {
              monthMap.set(month, {
                month,
                earnings: transaction.teacherEarning,
                coursesSold: 1
              });
            } else {
              const monthData = monthMap.get(month);
              monthData.earnings += transaction.teacherEarning;
              monthData.coursesSold += 1;
            }
          }
        });

        // Convert map to array
        monthlyBreakdown = Array.from(monthMap.values());
      }
    }

    return {
      teacherId,
      totalEarnings: teacher.totalEarnings || 0,
      currentPeriod: currentPeriodData,
      monthlyBreakdown,
      stripeAccountId: teacher.stripeAccountId,
      stripeVerified: teacher.stripeVerified,
      stripeOnboardingComplete: teacher.stripeOnboardingComplete,
    };
  } catch (error) {
    console.error('Error getting teacher payout info:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to get teacher payout information'
    );
  }
};

/**
 * Get teacher's transaction summary
 */
const getTeacherTransactionSummary = async (teacherId: string, period?: string) => {
  try {
    // Find the teacher
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    // Build query based on period
    const query: any = {
      teacherId: new Types.ObjectId(teacherId),
      status: 'success' // Only get successful transactions
    };

    if (period) {
      const [year, month] = period.split('-');
      if (year && month) {
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0);
        query.createdAt = { $gte: startDate, $lte: endDate };
      }
    }

    console.log('Transaction query:', JSON.stringify(query));

    // Get transactions
    const transactions = await Transaction.find(query)
      .populate({
        path: 'courseId',
        select: 'title courseThumbnail',
      })
      .populate({
        path: 'studentId',
        select: 'name email profileImg',
      })
      .sort({ createdAt: -1 });

    return {
      teacherId,
      transactions,
      totalTransactions: transactions.length,
      totalEarnings: transactions.reduce((sum, t) => sum + t.teacherEarning, 0),
    };
  } catch (error) {
    console.error('Error getting teacher transaction summary:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to get teacher transaction summary'
    );
  }
};

/**
 * Get transaction by Stripe session ID
 */
const getTransactionBySessionId = async (sessionId: string) => {
  try {
    // Verify the session ID is valid
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      throw new AppError(httpStatus.NOT_FOUND, 'Session not found');
    }

    // Find the transaction in our database using the payment intent ID
    const transaction = await Transaction.findOne({
      stripeTransactionId: session.payment_intent as string,
    })
      .populate({
        path: 'courseId',
        select: 'title courseThumbnail',
      })
      .populate({
        path: 'studentId',
        select: 'name email profileImg',
      })
      .populate({
        path: 'teacherId',
        select: 'name email profileImg',
      });

    // If no transaction is found, create a basic response with session data
    if (!transaction) {
      return {
        sessionId,
        paymentIntentId: session.payment_intent,
        amount: (session.amount_total || 0) / 100,
        status: session.payment_status,
        customerEmail: session.customer_details?.email,
        createdAt: new Date(session.created * 1000).toISOString(),
      };
    }

    return transaction;
  } catch (error) {
    console.error('Error getting transaction by session ID:', error);
    if (error instanceof Stripe.errors.StripeError) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Stripe error: ${error.message}`
      );
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to get transaction details'
    );
  }
};

/**
 * Get teacher's upcoming payout information from Stripe
 */
const getTeacherUpcomingPayout = async (teacherId: string) => {
  try {
    // Find the teacher
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    // Check if teacher has a Stripe account
    if (!teacher.stripeAccountId) {
      return {
        status: 'not_connected',
        message: 'Teacher does not have a connected Stripe account',
        upcomingPayout: null,
        balance: null,
      };
    }

    // Get the Stripe account balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: teacher.stripeAccountId,
    });

    // Get available and pending balances in dollars (convert from cents)
    const availableBalance = balance.available.reduce(
      (sum, balance) => sum + balance.amount / 100,
      0
    );

    const pendingBalance = balance.pending.reduce(
      (sum, balance) => sum + balance.amount / 100,
      0
    );

    // Get payout schedule
    const account = await stripe.accounts.retrieve(teacher.stripeAccountId);

    // Get upcoming payouts if any
    let upcomingPayout = null;

    try {
      // List payouts with a limit of 1 to get the most recent
      const payouts = await stripe.payouts.list(
        { limit: 10, status: 'pending' },
        { stripeAccount: teacher.stripeAccountId }
      );

      if (payouts.data.length > 0) {
        // Get the most recent pending payout
        upcomingPayout = {
          id: payouts.data[0].id,
          amount: payouts.data[0].amount / 100, // Convert from cents to dollars
          currency: payouts.data[0].currency,
          arrivalDate: new Date(payouts.data[0].arrival_date * 1000).toISOString(),
          status: payouts.data[0].status,
        };
      }
    } catch (error) {
      console.error('Error getting upcoming payouts:', error);
      // Continue without upcoming payout data
    }

    // Get payout schedule information
    const payoutSchedule = account.settings?.payouts?.schedule || {};

    // Update teacher's payout information
    await Teacher.findByIdAndUpdate(teacherId, {
      $set: {
        'payoutInfo.availableBalance': availableBalance,
        'payoutInfo.pendingBalance': pendingBalance,
        'payoutInfo.lastSyncedAt': new Date(),
        'payoutInfo.nextPayoutDate': upcomingPayout ? new Date(upcomingPayout.arrivalDate) : undefined,
        'payoutInfo.nextPayoutAmount': upcomingPayout ? upcomingPayout.amount : 0,
      },
    });

    return {
      status: 'success',
      balance: {
        available: availableBalance,
        pending: pendingBalance,
        currency: balance.available[0]?.currency || 'usd',
      },
      upcomingPayout,
      payoutSchedule: {
        interval: (payoutSchedule as any).interval || 'manual',
        monthlyAnchor: (payoutSchedule as any).monthly_anchor,
        weeklyAnchor: (payoutSchedule as any).weekly_anchor,
        delayDays: (payoutSchedule as any).delay_days,
      },
    };
  } catch (error) {
    console.error('Error getting teacher upcoming payout info:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to get teacher upcoming payout information'
    );
  }
};

/**
 * Get transaction analytics for a teacher
 */
const getTransactionAnalytics = async (
  teacherId: string,
  startDate?: string,
  endDate?: string,
  groupBy: string = 'day'
) => {
  try {
    // Find the teacher
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    // Set end date to end of day
    end.setHours(23, 59, 59, 999);

    // Build query for transactions in the date range
    const query = {
      teacherId: new Types.ObjectId(teacherId),
      status: 'success',
      createdAt: { $gte: start, $lte: end }
    };

    // Get all transactions in the date range
    const transactions = await Transaction.find(query)
      .populate({
        path: 'courseId',
        select: 'title courseThumbnail'
      })
      .sort({ createdAt: 1 });

    // Calculate summary metrics
    const totalSales = transactions.length;
    const totalRevenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalEarnings = transactions.reduce((sum, t) => sum + t.teacherEarning, 0);

    // Calculate growth metrics by comparing to previous period
    const previousPeriodStart = new Date(start);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    const previousPeriodQuery = {
      teacherId: new Types.ObjectId(teacherId),
      status: 'success',
      createdAt: { $gte: previousPeriodStart, $lt: start }
    };

    const previousTransactions = await Transaction.find(previousPeriodQuery);
    const previousSales = previousTransactions.length;
    const previousRevenue = previousTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const previousEarnings = previousTransactions.reduce((sum, t) => sum + t.teacherEarning, 0);

    // Calculate growth percentages
    const salesGrowth = previousSales > 0
      ? Math.round(((totalSales - previousSales) / previousSales) * 100)
      : null;

    const revenueGrowth = previousRevenue > 0
      ? Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100)
      : null;

    const earningsGrowth = previousEarnings > 0
      ? Math.round(((totalEarnings - previousEarnings) / previousEarnings) * 100)
      : null;

    // Group transactions by course
    const courseMap = new Map();

    transactions.forEach(transaction => {
      // Check if courseId is populated and has the expected properties
      if (transaction.courseId && typeof transaction.courseId === 'object') {
        const courseIdObj = transaction.courseId as any;
        const courseId = courseIdObj._id ? courseIdObj._id.toString() : '';
        const courseTitle = courseIdObj.title || 'Unknown Course';
        const courseThumbnail = courseIdObj.courseThumbnail || '';

        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, {
            courseId,
            courseTitle,
            courseThumbnail,
            count: 1,
            amount: transaction.totalAmount,
            teacherEarnings: transaction.teacherEarning
          });
        } else {
          const course = courseMap.get(courseId);
          course.count += 1;
          course.amount += transaction.totalAmount;
          course.teacherEarnings += transaction.teacherEarning;
        }
      }
    });

    // Convert course map to array and sort by earnings
    const courseBreakdown = Array.from(courseMap.values())
      .sort((a, b) => b.teacherEarnings - a.teacherEarnings);

    // Group transactions by time period (day, week, month)
    const timeSeriesMap = new Map();

    transactions.forEach(transaction => {
      const date = new Date(transaction.createdAt || new Date());
      let period;

      switch (groupBy) {
        case 'week':
          // Get the week number and year
          const weekNumber = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);
          period = `${date.getFullYear()}-W${weekNumber}`;
          break;
        case 'month':
          // Format: YYYY-MM
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'day':
        default:
          // Format: YYYY-MM-DD
          period = date.toISOString().split('T')[0];
      }

      if (!timeSeriesMap.has(period)) {
        timeSeriesMap.set(period, {
          period,
          count: 1,
          amount: transaction.totalAmount,
          teacherEarnings: transaction.teacherEarning
        });
      } else {
        const timePeriod = timeSeriesMap.get(period);
        timePeriod.count += 1;
        timePeriod.amount += transaction.totalAmount;
        timePeriod.teacherEarnings += transaction.teacherEarning;
      }
    });

    // Convert time series map to array and sort by period
    const timeSeriesData = Array.from(timeSeriesMap.values())
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      summary: {
        totalSales,
        totalRevenue,
        totalEarnings,
        salesGrowth,
        revenueGrowth,
        earningsGrowth,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      },
      courseBreakdown,
      timeSeriesData
    };
  } catch (error) {
    console.error('Error getting transaction analytics:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to get transaction analytics'
    );
  }
};

export const StripeService = {
  createStripeAccountForTeacher,
  createStripeOnboardingLink,
  checkStripeAccountStatus,
  createCheckoutSession,
  handleWebhookEvent,
  getTeacherPayoutInfo,
  getTeacherTransactionSummary,
  getTransactionBySessionId,
  getTeacherUpcomingPayout,
  getTransactionAnalytics,
};
