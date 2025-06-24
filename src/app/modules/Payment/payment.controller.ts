import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PaymentServices } from './payment.service';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';
import httpStatus from 'http-status';
import { Course } from '../Course/course.model';
import { Payment } from '../Payment/payment.model';
import { Transaction } from './transaction.model';
import { Student } from '../Student/student.model';
import { Teacher } from '../Teacher/teacher.model';
import { stripe } from '../../utils/stripe';
import AppError from '../../errors/AppError';
import { Types } from 'mongoose';

const createPaymentIntent = catchAsync(async (req, res) => {
  const { studentId, courseId, amount } = req.body;

  const result = await PaymentServices.createPaymentIntent(studentId, courseId, amount);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment intent created successfully',
    data: result,
  });
});

const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const { courseId, amount } = req.body;

  // Get the user email from the JWT
  const userEmail = (req as Request & { user?: { email: string } }).user?.email;

  if (!userEmail) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized access');
  }

  console.log(`Looking up student with email: ${userEmail}`);

  // Find the student by email
  const student = await Student.findOne({ email: userEmail });

  if (!student) {
    console.error(`No student found with email: ${userEmail}`);
    throw new AppError(httpStatus.NOT_FOUND, 'Student not found. Please make sure your account is properly set up.');
  }

  // Find the course to get teacher information
  const course = await Course.findById(courseId).populate('creator');

  if (!course) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
  }

  // Check if teacher has a Stripe account
  const teacher = await Teacher.findById(course.creator);

  if (!teacher) {
    throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
  }

  if (!teacher.stripeAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'The teacher has not set up payment processing yet. Please try again later.'
    );
  }

  const studentId = student._id.toString();

  console.log(`Creating checkout session for student: ${studentId}, course: ${courseId}, amount: ${amount}`);

  try {
    console.log('Calling PaymentServices.createCheckoutSession with:', { studentId, courseId, amount });
    const session = await PaymentServices.createCheckoutSession(studentId, courseId, amount);
    console.log('Stripe session created:', {
      id: session.id,
      url: session.url,
      status: session.status
    });

    // Extract the URL from the session for the frontend to redirect to
    if (!session.url) {
      console.error('No URL in Stripe session:', session);
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create checkout URL');
    }

    const responseData = {
      url: session.url,
      sessionId: session.id
    };

    console.log('Sending response to client:', responseData);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Checkout session created successfully',
      data: responseData,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create checkout session');
  }
});

const handleWebhook = async (req: Request, res: Response) => {
  console.log('Webhook received');

  // Get the signature from the headers
  const sig = req.headers['stripe-signature'];

  // Get the webhook secret from environment variables
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(500).send('Webhook Error: Webhook secret is not configured');
  }

  if (!sig) {
    console.error('No Stripe signature found in headers');
    return res.status(400).send('Webhook Error: No Stripe signature found');
  }

  let event: Stripe.Event;

  try {
    // For Express, use the raw body
    let rawBody = req.body;

    // Log the request body type for debugging
    console.log('Webhook body type:', typeof rawBody);

    // Verify the event with Stripe - use raw body directly
    if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') {
      console.error('Raw body is not a buffer or string:', typeof rawBody);
      // Try to convert it to a string if it's an object
      if (typeof rawBody === 'object' && rawBody !== null) {
        rawBody = JSON.stringify(rawBody);
        console.log('Converted raw body to string');
      } else {
        throw new Error('Invalid request body format');
      }
    }

    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      endpointSecret
    );

    // Log the event for debugging
    console.log(`Webhook event received: ${event.type}`, {
      id: event.id,
      type: event.type,
      object: event.data.object.object,
    });

    // For checkout.session.completed events, log more details
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('CHECKOUT SESSION COMPLETED DETAILS:', {
        id: session.id,
        metadata: session.metadata,
        payment_intent: session.payment_intent,
        customer_email: session.customer_details?.email,
        amount_total: session.amount_total,
        payment_status: session.payment_status
      });
    }

    // Return a 200 response immediately to acknowledge receipt of the webhook
    res.status(200).json({ received: true });

    // Process the event asynchronously
    try {
      console.log(`Processing webhook event: ${event.type}, id: ${event.id}`);
      const result = await PaymentServices.handleStripeWebhook(event);
      console.log(`Webhook processing result:`, result);
      console.log(`Successfully processed webhook event: ${event.type}`);
    } catch (error) {
      console.error('Error processing webhook:', error);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook signature verification failed: ${errorMessage}`);
    return res.status(400).send(`Webhook Error: ${errorMessage}`);
  }
};

const connectStripeAccount = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  // Validate teacherId
  if (!teacherId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Teacher ID is required',
      data: null
    });
  }

  try {
    // Check if STRIPE_SECRET_KEY is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return sendResponse(res, {
        statusCode: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: 'Stripe API key is not configured',
        data: null
      });
    }

    // Check if FRONTEND_URL is configured
    if (!process.env.FRONTEND_URL) {
      return sendResponse(res, {
        statusCode: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: 'Frontend URL is not configured',
        data: null
      });
    }

    const result = await PaymentServices.connectTeacherStripe(teacherId);

    // Handle different status cases
    switch (result.status) {
      case 'complete':
        sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: result.message,
          data: result,
        });
        break;
      case 'incomplete':
        sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: result.message,
          data: {
            url: result.url,
            requirements: result.requirements,
          },
        });
        break;
      case 'pending':
        sendResponse(res, {
          statusCode: httpStatus.OK,
          success: true,
          message: result.message,
          data: {
            url: result.url,
          },
        });
        break;
      default:
        sendResponse(res, {
          statusCode: httpStatus.INTERNAL_SERVER_ERROR,
          success: false,
          message: 'Unknown status returned from Stripe',
          data: null
        });
    }
  } catch (error) {
    if (error instanceof AppError) {
      sendResponse(res, {
        statusCode: error.statusCode,
        success: false,
        message: error.message,
        data: null
      });
    } else if (error instanceof Error) {
      // Handle Stripe API errors
      if (error.message.includes('Stripe')) {
        sendResponse(res, {
          statusCode: httpStatus.BAD_REQUEST,
          success: false,
          message: `Stripe API error: ${error.message}`,
          data: null
        });
      } else {
        sendResponse(res, {
          statusCode: httpStatus.INTERNAL_SERVER_ERROR,
          success: false,
          message: `Failed to connect Stripe account: ${error.message}`,
          data: null
        });
      }
    } else {
      sendResponse(res, {
        statusCode: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: 'Failed to connect Stripe account',
        data: null
      });
    }
  }
});

const getEarnings = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  const result = await PaymentServices.getTeacherEarnings(teacherId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Earnings retrieved successfully',
    data: result,
  });
});

const saveStripeAccountDetails = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const {
    stripeAccountId,
    stripeEmail,
    stripeVerified,
    stripeOnboardingComplete
  } = req.body;

  console.log('Received request to save Stripe details:', {
    teacherId,
    stripeAccountId,
    stripeEmail,
    stripeVerified,
    stripeOnboardingComplete
  });

  try {
    const result = await PaymentServices.saveStripeAccountDetails(teacherId, {
      stripeAccountId,
      stripeEmail,
      stripeVerified,
      stripeOnboardingComplete
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Stripe account details saved successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error saving Stripe account details:', error);

    if (error instanceof AppError) {
      sendResponse(res, {
        statusCode: error.statusCode,
        success: false,
        message: error.message,
        data: null
      });
    } else {
      sendResponse(res, {
        statusCode: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: 'Failed to save stripe account details',
        data: null
      });
    }
  }
});

// Create an onboarding link for a teacher
const createOnboardingLink = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  const result = await StripeService.createStripeOnboardingLink(teacherId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Onboarding link created successfully',
    data: result,
  });
});

// Check the status of a teacher's Stripe account
const checkStripeAccountStatus = catchAsync(
  async (req: Request, res: Response) => {
    const { teacherId } = req.params;

    const result = await StripeService.checkStripeAccountStatus(teacherId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Stripe account status retrieved successfully',
      data: result,
    });
  }
);

// Get teacher's payout information
const getTeacherPayoutInfo = catchAsync(
  async (req: Request, res: Response) => {
    const { teacherId } = req.params;
    const { period } = req.query;

    const result = await StripeService.getTeacherPayoutInfo(
      teacherId,
      period as string
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Teacher payout information retrieved successfully',
      data: result,
    });
  }
);

// Get teacher's transaction summary
const getTeacherTransactionSummary = catchAsync(
  async (req: Request, res: Response) => {
    const { teacherId } = req.params;
    const { period } = req.query;

    const result = await StripeService.getTeacherTransactionSummary(
      teacherId,
      period as string
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Teacher transaction summary retrieved successfully',
      data: result,
    });
  }
);

// Get transaction details by ID
const getTransactionById = catchAsync(async (req: Request, res: Response) => {
  const { transactionId } = req.params;

  const transaction = await Transaction.findById(transactionId)
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

  if (!transaction) {
    return sendResponse(res, {
      statusCode: httpStatus.NOT_FOUND,
      success: false,
      message: 'Transaction not found',
      data: null,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Transaction retrieved successfully',
    data: transaction,
  });
});

// Get all transactions for a student
const getStudentTransactions = catchAsync(
  async (req: Request, res: Response) => {
    const { studentId } = req.params;

    const transactions = await Transaction.find({
      studentId: new Types.ObjectId(studentId),
    })
      .populate({
        path: 'courseId',
        select: 'title courseThumbnail',
      })
      .populate({
        path: 'teacherId',
        select: 'name email profileImg',
      })
      .sort({ createdAt: -1 });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Student transactions retrieved successfully',
      data: transactions,
    });
  }
);

// Get transaction details by session ID
const getTransactionBySessionId = catchAsync(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Session ID is required');
  }

  const transaction = await StripeService.getTransactionBySessionId(sessionId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Transaction details retrieved successfully',
    data: transaction,
  });
});

// Get teacher's upcoming payout information
const getTeacherUpcomingPayout = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  const result = await StripeService.getTeacherUpcomingPayout(teacherId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Teacher upcoming payout information retrieved successfully',
    data: result,
  });
});

// Get transaction analytics
const getTransactionAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { startDate, endDate, groupBy = 'day' } = req.query;

  const result = await StripeService.getTransactionAnalytics(
    teacherId,
    startDate as string,
    endDate as string,
    groupBy as string
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Transaction analytics retrieved successfully',
    data: result,
  });
});

// Enhanced financial analytics controllers
const getFinancialSummary = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { period } = req.query;

  // Mock implementation - replace with actual service call
  const result = {
    totalRevenue: 5000,
    growthRate: 15.5,
    totalStudents: 120,
    averageCoursePrice: 99.99,
  };

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Financial summary retrieved successfully',
    data: result,
  });
});

const getEarningsGrowth = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { period } = req.query;

  // Mock implementation - replace with actual service call
  const result = {
    currentPeriod: 3500,
    previousPeriod: 3000,
    growthRate: 16.7,
    chartData: [],
  };

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Earnings growth retrieved successfully',
    data: result,
  });
});

const getTopPerformingCourses = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { period } = req.query;

  // Mock implementation - replace with actual service call
  const result = [
    { id: '1', title: 'React Masterclass', revenue: 2500, enrollments: 50 },
    { id: '2', title: 'Node.js Complete Guide', revenue: 2000, enrollments: 40 },
  ];

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Top performing courses retrieved successfully',
    data: result,
  });
});

const getRevenueChart = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { period, groupBy } = req.query;

  // Mock implementation - replace with actual service call
  const result = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    data: [1000, 1500, 2000, 2500, 3000],
  };

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Revenue chart data retrieved successfully',
    data: result,
  });
});

const exportFinancialData = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;
  const { period } = req.query;

  // Mock implementation - replace with actual service call
  const result = {
    downloadUrl: 'https://example.com/financial-report.csv',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Financial data export initiated successfully',
    data: result,
  });
});

export const PaymentControllers = {
  createPaymentIntent,
  createCheckoutSession,
  handleWebhook,
  connectStripeAccount,
  getEarnings,
  saveStripeAccountDetails,
  createOnboardingLink,
  checkStripeAccountStatus,
  getTeacherPayoutInfo,
  getTeacherTransactionSummary,
  getTransactionById,
  getStudentTransactions,
  getTransactionBySessionId,
  getTeacherUpcomingPayout,
  getTransactionAnalytics,
  getFinancialSummary,
  getEarningsGrowth,
  getTopPerformingCourses,
  getRevenueChart,
  exportFinancialData,
};
