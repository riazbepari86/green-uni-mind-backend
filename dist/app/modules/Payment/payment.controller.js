"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentControllers = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const stripe_1 = require("../../utils/stripe");
const course_model_1 = require("../Course/course.model");
const student_model_1 = require("../Student/student.model");
const teacher_model_1 = require("../Teacher/teacher.model");
const payment_service_1 = require("./payment.service");
const stripe_service_1 = require("./stripe.service");
const transaction_model_1 = require("./transaction.model");
/**
 * Helper function to validate and resolve teacher ID
 * Handles cases where frontend passes user._id instead of teacher._id
 */
const validateAndResolveTeacherId = (teacherId, authenticatedUser) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔍 validateAndResolveTeacherId called with:', {
        teacherId,
        userRole: authenticatedUser.role,
        userId: authenticatedUser._id,
    });
    if (authenticatedUser.role !== 'teacher') {
        console.log('✅ Non-teacher user, returning original teacherId');
        return teacherId; // For non-teacher users, return as-is
    }
    // Try to find teacher by the provided ID first
    console.log('🔍 Looking for teacher by ID:', teacherId);
    let teacher = yield teacher_model_1.Teacher.findById(teacherId);
    console.log('📊 Teacher.findById result:', teacher ? 'Found' : 'Not found');
    // If not found, try to find by user ID (common case when frontend passes user._id)
    if (!teacher) {
        console.log('🔍 Looking for teacher by user ID:', teacherId);
        teacher = yield teacher_model_1.Teacher.findOne({ user: teacherId });
        console.log('📊 Teacher.findOne({user}) result:', teacher ? 'Found' : 'Not found');
    }
    // Validate that the teacher belongs to the authenticated user
    if (!teacher) {
        console.log('❌ No teacher found for ID:', teacherId);
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Teacher not found');
    }
    console.log('🔍 Teacher found:', {
        teacherId: teacher._id,
        userId: teacher.user,
    });
    if (teacher.user.toString() !== authenticatedUser._id) {
        console.log('❌ Teacher user mismatch:', {
            teacherUserId: teacher.user.toString(),
            authenticatedUserId: authenticatedUser._id,
        });
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own data');
    }
    console.log('✅ Teacher validation successful, returning teacher ID:', teacher._id.toString());
    return teacher._id.toString();
});
const createPaymentIntent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId, courseId, amount } = req.body;
    const result = yield payment_service_1.PaymentServices.createPaymentIntent(studentId, courseId, amount);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Payment intent created successfully',
        data: result,
    });
}));
const createCheckoutSession = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { courseId, amount } = req.body;
    // Get the user email from the JWT
    const userEmail = (_a = req.user) === null || _a === void 0 ? void 0 : _a.email;
    if (!userEmail) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Unauthorized access');
    }
    console.log(`Looking up student with email: ${userEmail}`);
    // Find the student by email
    const student = yield student_model_1.Student.findOne({ email: userEmail });
    if (!student) {
        console.error(`No student found with email: ${userEmail}`);
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student not found. Please make sure your account is properly set up.');
    }
    // Find the course to get teacher information
    const course = yield course_model_1.Course.findById(courseId).populate('creator');
    if (!course) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Course not found');
    }
    // Check if teacher has a Stripe account
    const teacher = yield teacher_model_1.Teacher.findById(course.creator);
    if (!teacher) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
    }
    if (!teacher.stripeAccountId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'The teacher has not set up payment processing yet. Please try again later.');
    }
    const studentId = student._id.toString();
    console.log(`Creating checkout session for student: ${studentId}, course: ${courseId}, amount: ${amount}`);
    try {
        console.log('Calling PaymentServices.createCheckoutSession with:', {
            studentId,
            courseId,
            amount,
        });
        const session = yield payment_service_1.PaymentServices.createCheckoutSession(studentId, courseId, amount);
        console.log('Stripe session created:', {
            id: session.id,
            url: session.url,
            status: session.status,
        });
        // Extract the URL from the session for the frontend to redirect to
        if (!session.url) {
            console.error('No URL in Stripe session:', session);
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create checkout URL');
        }
        const responseData = {
            url: session.url,
            sessionId: session.id,
        };
        console.log('Sending response to client:', responseData);
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Checkout session created successfully',
            data: responseData,
        });
    }
    catch (error) {
        console.error('Error creating checkout session:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create checkout session');
    }
}));
const handleWebhook = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log('Webhook received');
    // Get the signature from the headers
    const sig = req.headers['stripe-signature'];
    // Get the webhook secret from environment variables
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is not configured');
        return res
            .status(500)
            .send('Webhook Error: Webhook secret is not configured');
    }
    if (!sig) {
        console.error('No Stripe signature found in headers');
        return res.status(400).send('Webhook Error: No Stripe signature found');
    }
    let event;
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
            }
            else {
                throw new Error('Invalid request body format');
            }
        }
        event = stripe_1.stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
        // Log the event for debugging
        console.log(`Webhook event received: ${event.type}`, {
            id: event.id,
            type: event.type,
            object: event.data.object.object,
        });
        // For checkout.session.completed events, log more details
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            console.log('CHECKOUT SESSION COMPLETED DETAILS:', {
                id: session.id,
                metadata: session.metadata,
                payment_intent: session.payment_intent,
                customer_email: (_a = session.customer_details) === null || _a === void 0 ? void 0 : _a.email,
                amount_total: session.amount_total,
                payment_status: session.payment_status,
            });
        }
        // Return a 200 response immediately to acknowledge receipt of the webhook
        res.status(200).json({ received: true });
        // Process the event asynchronously
        try {
            console.log(`Processing webhook event: ${event.type}, id: ${event.id}`);
            const result = yield payment_service_1.PaymentServices.handleStripeWebhook(event);
            console.log(`Webhook processing result:`, result);
            console.log(`Successfully processed webhook event: ${event.type}`);
        }
        catch (error) {
            console.error('Error processing webhook:', error);
        }
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Webhook signature verification failed: ${errorMessage}`);
        return res.status(400).send(`Webhook Error: ${errorMessage}`);
    }
});
const connectStripeAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    // Validate teacherId
    if (!teacherId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Teacher ID is required',
            data: null,
        });
    }
    try {
        // Check if STRIPE_SECRET_KEY is configured
        if (!process.env.STRIPE_SECRET_KEY) {
            return (0, sendResponse_1.default)(res, {
                statusCode: http_status_1.default.INTERNAL_SERVER_ERROR,
                success: false,
                message: 'Stripe API key is not configured',
                data: null,
            });
        }
        // Check if FRONTEND_URL is configured
        if (!process.env.FRONTEND_URL) {
            return (0, sendResponse_1.default)(res, {
                statusCode: http_status_1.default.INTERNAL_SERVER_ERROR,
                success: false,
                message: 'Frontend URL is not configured',
                data: null,
            });
        }
        const result = yield payment_service_1.PaymentServices.connectTeacherStripe(teacherId);
        // Handle different status cases
        switch (result.status) {
            case 'complete':
                (0, sendResponse_1.default)(res, {
                    statusCode: http_status_1.default.OK,
                    success: true,
                    message: result.message,
                    data: result,
                });
                break;
            case 'incomplete':
                (0, sendResponse_1.default)(res, {
                    statusCode: http_status_1.default.OK,
                    success: true,
                    message: result.message,
                    data: {
                        url: result.url,
                        requirements: result.requirements,
                    },
                });
                break;
            case 'pending':
                (0, sendResponse_1.default)(res, {
                    statusCode: http_status_1.default.OK,
                    success: true,
                    message: result.message,
                    data: {
                        url: result.url,
                    },
                });
                break;
            default:
                (0, sendResponse_1.default)(res, {
                    statusCode: http_status_1.default.INTERNAL_SERVER_ERROR,
                    success: false,
                    message: 'Unknown status returned from Stripe',
                    data: null,
                });
        }
    }
    catch (error) {
        if (error instanceof AppError_1.default) {
            (0, sendResponse_1.default)(res, {
                statusCode: error.statusCode,
                success: false,
                message: error.message,
                data: null,
            });
        }
        else if (error instanceof Error) {
            // Handle Stripe API errors
            if (error.message.includes('Stripe')) {
                (0, sendResponse_1.default)(res, {
                    statusCode: http_status_1.default.BAD_REQUEST,
                    success: false,
                    message: `Stripe API error: ${error.message}`,
                    data: null,
                });
            }
            else {
                (0, sendResponse_1.default)(res, {
                    statusCode: http_status_1.default.INTERNAL_SERVER_ERROR,
                    success: false,
                    message: `Failed to connect Stripe account: ${error.message}`,
                    data: null,
                });
            }
        }
        else {
            (0, sendResponse_1.default)(res, {
                statusCode: http_status_1.default.INTERNAL_SERVER_ERROR,
                success: false,
                message: 'Failed to connect Stripe account',
                data: null,
            });
        }
    }
}));
const getEarnings = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    const actualTeacherId = yield validateAndResolveTeacherId(teacherId, user);
    // Set no-cache headers for real-time financial data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('ETag', `"${Date.now()}"`);
    const result = yield payment_service_1.PaymentServices.getTeacherEarnings(actualTeacherId);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Earnings retrieved successfully',
        data: result,
    });
}));
const saveStripeAccountDetails = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { stripeAccountId, stripeEmail, stripeVerified, stripeOnboardingComplete, } = req.body;
    console.log('Received request to save Stripe details:', {
        teacherId,
        stripeAccountId,
        stripeEmail,
        stripeVerified,
        stripeOnboardingComplete,
    });
    try {
        const result = yield payment_service_1.PaymentServices.saveStripeAccountDetails(teacherId, {
            stripeAccountId,
            stripeEmail,
            stripeVerified,
            stripeOnboardingComplete,
        });
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: 'Stripe account details saved successfully',
            data: result,
        });
    }
    catch (error) {
        console.error('Error saving Stripe account details:', error);
        if (error instanceof AppError_1.default) {
            (0, sendResponse_1.default)(res, {
                statusCode: error.statusCode,
                success: false,
                message: error.message,
                data: null,
            });
        }
        else {
            (0, sendResponse_1.default)(res, {
                statusCode: http_status_1.default.INTERNAL_SERVER_ERROR,
                success: false,
                message: 'Failed to save stripe account details',
                data: null,
            });
        }
    }
}));
// Create an onboarding link for a teacher
const createOnboardingLink = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const result = yield stripe_service_1.StripeService.createStripeOnboardingLink(teacherId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Onboarding link created successfully',
        data: result,
    });
}));
// Check the status of a teacher's Stripe account
const checkStripeAccountStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const result = yield stripe_service_1.StripeService.checkStripeAccountStatus(teacherId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Stripe account status retrieved successfully',
        data: result,
    });
}));
// Get teacher's payout information
const getTeacherPayoutInfo = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period } = req.query;
    const result = yield stripe_service_1.StripeService.getTeacherPayoutInfo(teacherId, period);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Teacher payout information retrieved successfully',
        data: result,
    });
}));
// Get teacher's transaction summary
const getTeacherTransactionSummary = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period } = req.query;
    const result = yield stripe_service_1.StripeService.getTeacherTransactionSummary(teacherId, period);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Teacher transaction summary retrieved successfully',
        data: result,
    });
}));
// Get transaction details by ID
const getTransactionById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { transactionId } = req.params;
    const transaction = yield transaction_model_1.Transaction.findById(transactionId)
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
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.NOT_FOUND,
            success: false,
            message: 'Transaction not found',
            data: null,
        });
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Transaction retrieved successfully',
        data: transaction,
    });
}));
// Get all transactions for a student
const getStudentTransactions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId } = req.params;
    const transactions = yield transaction_model_1.Transaction.find({
        studentId: new mongoose_1.Types.ObjectId(studentId),
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
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Student transactions retrieved successfully',
        data: transactions,
    });
}));
// Get transaction details by session ID
const getTransactionBySessionId = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sessionId } = req.params;
    if (!sessionId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Session ID is required');
    }
    const transaction = yield stripe_service_1.StripeService.getTransactionBySessionId(sessionId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Transaction details retrieved successfully',
        data: transaction,
    });
}));
// Get teacher's upcoming payout information
const getTeacherUpcomingPayout = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    // Set no-cache headers for real-time payout data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('ETag', `"${Date.now()}"`);
    const result = yield stripe_service_1.StripeService.getTeacherUpcomingPayout(teacherId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Teacher upcoming payout information retrieved successfully',
        data: result,
    });
}));
// Get transaction analytics
const getTransactionAnalytics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { startDate, endDate, groupBy = 'day' } = req.query;
    // Set no-cache headers for real-time analytics data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('ETag', `"${Date.now()}"`);
    const result = yield stripe_service_1.StripeService.getTransactionAnalytics(teacherId, startDate, endDate, groupBy);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Transaction analytics retrieved successfully',
        data: result,
    });
}));
// Enhanced financial analytics controllers
const getFinancialSummary = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period } = req.query;
    // Set no-cache headers for real-time financial data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('ETag', `"${Date.now()}"`);
    // Mock implementation - replace with actual service call
    const result = {
        totalRevenue: 5000,
        growthRate: 15.5,
        totalStudents: 120,
        averageCoursePrice: 99.99,
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Financial summary retrieved successfully',
        data: result,
    });
}));
const getEarningsGrowth = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period } = req.query;
    // Mock implementation - replace with actual service call
    const result = {
        currentPeriod: 3500,
        previousPeriod: 3000,
        growthRate: 16.7,
        chartData: [],
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Earnings growth retrieved successfully',
        data: result,
    });
}));
const getTopPerformingCourses = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period } = req.query;
    // Mock implementation - replace with actual service call
    const result = [
        { id: '1', title: 'React Masterclass', revenue: 2500, enrollments: 50 },
        {
            id: '2',
            title: 'Node.js Complete Guide',
            revenue: 2000,
            enrollments: 40,
        },
    ];
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Top performing courses retrieved successfully',
        data: result,
    });
}));
const getRevenueChart = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period, groupBy } = req.query;
    // Mock implementation - replace with actual service call
    const result = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        data: [1000, 1500, 2000, 2500, 3000],
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Revenue chart data retrieved successfully',
        data: result,
    });
}));
const exportFinancialData = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { period } = req.query;
    // Mock implementation - replace with actual service call
    const result = {
        downloadUrl: 'https://example.com/financial-report.csv',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Financial data export initiated successfully',
        data: result,
    });
}));
exports.PaymentControllers = {
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
