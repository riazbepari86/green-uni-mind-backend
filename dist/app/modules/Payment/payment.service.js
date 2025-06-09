"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.PaymentServices = void 0;
const stripe_1 = __importDefault(require("stripe"));
const mongoose_1 = __importStar(require("mongoose"));
const payment_model_1 = require("./payment.model");
const student_model_1 = require("../Student/student.model");
const teacher_model_1 = require("../Teacher/teacher.model");
const course_model_1 = require("../Course/course.model");
const transaction_model_1 = require("./transaction.model");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const payoutSummary_model_1 = require("./payoutSummary.model");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-04-30.basil',
});
const createPaymentIntent = (studentId, courseId, amount) => __awaiter(void 0, void 0, void 0, function* () {
    const student = yield student_model_1.Student.findById(studentId);
    const course = yield course_model_1.Course.findById(courseId);
    const teacher = yield teacher_model_1.Teacher.findById(course === null || course === void 0 ? void 0 : course.creator);
    if (!student || !course || !teacher) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student, course, or teacher not found');
    }
    // Check if already enrolled
    if (student.enrolledCourses.some((course) => course.courseId.toString() === courseId)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Already enrolled in this course');
    }
    // Calculate shares
    const teacherShare = amount * 0.7;
    const organizationShare = amount * 0.3;
    // Create payment intent
    const paymentIntent = yield stripe.paymentIntents.create({
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
    const retrievedPaymentIntent = yield stripe.paymentIntents.retrieve(paymentIntent.id, {
        expand: ['charges'],
    });
    return {
        clientSecret: retrievedPaymentIntent.client_secret,
        paymentIntentId: retrievedPaymentIntent.id,
    };
});
// Helper function to process checkout session completed events
const processCheckoutSessionCompleted = (session) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log('Processing checkout session completed:', session.id);
    console.log('Session details:', {
        id: session.id,
        metadata: session.metadata,
        payment_intent: session.payment_intent,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        customer_details: session.customer_details,
    });
    // Extract metadata
    const { courseId, studentId, teacherId, teacherShare, platformFee } = session.metadata || {};
    console.log('Extracted metadata:', {
        courseId,
        studentId,
        teacherId,
        teacherShare,
        platformFee,
    });
    if (!courseId || !studentId || !teacherId) {
        console.error('Missing required metadata in checkout session:', session.id, 'Metadata:', session.metadata);
        throw new Error('Missing required metadata in checkout session');
    }
    // Validate ObjectIds
    try {
        new mongoose_1.Types.ObjectId(courseId);
        new mongoose_1.Types.ObjectId(studentId);
        new mongoose_1.Types.ObjectId(teacherId);
    }
    catch (error) {
        console.error('Invalid ObjectId in metadata:', error);
        throw new Error('Invalid ObjectId in metadata');
    }
    // Create payment record
    const amount = (session.amount_total || 0) / 100; // Convert from cents
    // Convert from cents to dollars and ensure we're using the teacher's 70% share
    const teacherShareAmount = (parseFloat(teacherShare || '0') / 100) || (amount * 0.7);
    const platformShareAmount = (parseFloat(platformFee || '0') / 100) || (amount * 0.3);
    console.log('Calculated amounts:', {
        amount,
        teacherShareAmount,
        platformShareAmount,
        originalTeacherShare: teacherShare,
        originalPlatformFee: platformFee,
    });
    // Start a MongoDB transaction
    const mongoSession = yield mongoose_1.default.startSession();
    mongoSession.startTransaction();
    try {
        // Get customer email from session
        const customerEmail = ((_a = session.customer_details) === null || _a === void 0 ? void 0 : _a.email) || '';
        console.log('Processing checkout session for customer:', customerEmail);
        // Check if student exists
        const student = yield student_model_1.Student.findById(studentId).session(mongoSession);
        if (!student) {
            throw new Error(`Student not found with ID: ${studentId}`);
        }
        // Check if course exists
        const course = yield course_model_1.Course.findById(courseId).session(mongoSession);
        if (!course) {
            throw new Error(`Course not found with ID: ${courseId}`);
        }
        // Check if teacher exists
        const teacher = yield teacher_model_1.Teacher.findById(teacherId).session(mongoSession);
        if (!teacher) {
            throw new Error(`Teacher not found with ID: ${teacherId}`);
        }
        // Check if student is already enrolled in this course
        const isEnrolled = student.enrolledCourses.some((enrolledCourse) => enrolledCourse.courseId.toString() === courseId);
        if (isEnrolled) {
            console.log(`Student ${studentId} is already enrolled in course ${courseId}`);
        }
        else {
            console.log(`Enrolling student ${studentId} in course ${courseId}`);
            // Create payment record
            console.log('Creating payment record with data:', {
                studentId,
                courseId,
                teacherId,
                amount,
                teacherShareAmount,
                platformShareAmount,
                paymentIntent: session.payment_intent,
                customerEmail,
                status: session.payment_status,
            });
            const payment = yield payment_model_1.Payment.create([
                {
                    studentId: new mongoose_1.Types.ObjectId(studentId),
                    courseId: new mongoose_1.Types.ObjectId(courseId),
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                    amount,
                    teacherShare: teacherShareAmount,
                    platformShare: platformShareAmount,
                    stripeAccountId: session.payment_intent,
                    stripePaymentId: session.payment_intent, // Set the stripePaymentId to avoid duplicate key error
                    stripeEmail: customerEmail,
                    status: session.payment_status === 'paid' ? 'success' : 'pending',
                    receiptUrl: '',
                },
            ], { session: mongoSession });
            // Log the created payment
            console.log('Payment record created with ID:', payment[0]._id);
            console.log('Payment record created:', payment);
            // Create transaction record
            console.log('Creating transaction record');
            const transactionData = {
                courseId: new mongoose_1.Types.ObjectId(courseId),
                studentId: new mongoose_1.Types.ObjectId(studentId),
                teacherId: new mongoose_1.Types.ObjectId(teacherId),
                totalAmount: amount,
                teacherEarning: teacherShareAmount,
                platformEarning: platformShareAmount,
                stripeInvoiceUrl: '',
                stripePdfUrl: '',
                stripeTransactionId: session.payment_intent,
                stripeTransferStatus: 'pending', // Set the transfer status
                status: 'success',
            };
            const transaction = yield transaction_model_1.Transaction.create([transactionData], {
                session: mongoSession,
            });
            console.log('Transaction record created with ID:', transaction[0]._id);
            // Update or create payout summary
            const currentDate = new Date();
            const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            const year = currentDate.getFullYear();
            console.log('Updating payout summary for teacher:', teacherId, 'month:', month, 'year:', year);
            // Find existing payout summary or create a new one
            const existingPayoutSummary = yield payoutSummary_model_1.PayoutSummary.findOne({
                teacherId: new mongoose_1.Types.ObjectId(teacherId),
                month,
                year,
            }).session(mongoSession);
            if (existingPayoutSummary) {
                console.log('Found existing payout summary:', existingPayoutSummary._id);
                // Update existing summary
                existingPayoutSummary.totalEarned += teacherShareAmount;
                existingPayoutSummary.transactions.push(transaction[0]._id);
                // Check if course already exists in coursesSold
                const existingCourseIndex = existingPayoutSummary.coursesSold.findIndex((c) => c.courseId.toString() === courseId);
                if (existingCourseIndex >= 0) {
                    // Update existing course
                    existingPayoutSummary.coursesSold[existingCourseIndex].count += 1;
                    existingPayoutSummary.coursesSold[existingCourseIndex].earnings +=
                        teacherShareAmount;
                }
                else {
                    // Add new course
                    existingPayoutSummary.coursesSold.push({
                        courseId: new mongoose_1.Types.ObjectId(courseId),
                        count: 1,
                        earnings: teacherShareAmount,
                    });
                }
                yield existingPayoutSummary.save({ session: mongoSession });
                console.log('Updated existing payout summary');
            }
            else {
                console.log('Creating new payout summary');
                // Create new summary
                const newPayoutSummary = yield payoutSummary_model_1.PayoutSummary.create([
                    {
                        teacherId: new mongoose_1.Types.ObjectId(teacherId),
                        totalEarned: teacherShareAmount,
                        month,
                        year,
                        transactions: [transaction[0]._id],
                        coursesSold: [
                            {
                                courseId: new mongoose_1.Types.ObjectId(courseId),
                                count: 1,
                                earnings: teacherShareAmount,
                            },
                        ],
                    },
                ], { session: mongoSession });
                console.log('Created new payout summary with ID:', newPayoutSummary[0]._id);
            }
            console.log('Transaction record created:', transaction);
            // Enroll student in course - use addToSet to prevent duplicates
            console.log('Enrolling student in course:', {
                studentId,
                courseId,
            });
            const studentUpdate = yield student_model_1.Student.findByIdAndUpdate(studentId, {
                $addToSet: {
                    enrolledCourses: {
                        courseId: new mongoose_1.Types.ObjectId(courseId),
                        completedLectures: [],
                        enrolledAt: new Date(),
                    },
                },
            }, { session: mongoSession, new: true });
            console.log('Student updated:', studentUpdate ? 'Success' : 'Failed');
            // Update course enrolled students and increment enrollment count
            console.log('Updating course enrolled students:', {
                courseId,
                studentId,
            });
            const courseUpdate = yield course_model_1.Course.findByIdAndUpdate(courseId, {
                $addToSet: { enrolledStudents: new mongoose_1.Types.ObjectId(studentId) },
                $inc: { totalEnrollment: 1 },
            }, { session: mongoSession, new: true });
            console.log('Course updated:', courseUpdate ? 'Success' : 'Failed');
            // Update teacher earnings and courses
            console.log('Updating teacher earnings:', {
                teacherId,
                teacherShareAmount,
            });
            // Make sure transaction is created successfully before updating teacher
            if (!transaction || !transaction[0] || !transaction[0]._id) {
                throw new Error('Transaction creation failed');
            }
            console.log('Updating teacher earnings and payments with transaction ID:', transaction[0]._id);
            const teacherUpdate = yield teacher_model_1.Teacher.findByIdAndUpdate(teacherId, {
                $inc: {
                    totalEarnings: teacherShareAmount, // Already converted to dollars
                    'earnings.total': teacherShareAmount, // Already converted to dollars
                    'earnings.monthly': teacherShareAmount, // Already converted to dollars
                    'earnings.yearly': teacherShareAmount, // Already converted to dollars
                    'earnings.weekly': teacherShareAmount, // Already converted to dollars
                },
                $addToSet: {
                    courses: new mongoose_1.Types.ObjectId(courseId),
                    payments: transaction[0]._id, // Add the transaction ID to the payments array
                },
            }, { session: mongoSession, new: true });
            if (!teacherUpdate) {
                console.error('Failed to update teacher:', teacherId);
                throw new Error('Failed to update teacher earnings');
            }
            console.log('Teacher updated successfully with earnings:', teacherShareAmount);
            console.log('Teacher updated:', teacherUpdate ? 'Success' : 'Failed');
        }
        // Commit the transaction
        yield mongoSession.commitTransaction();
        console.log('Transaction committed successfully for checkout session:', session.id);
    }
    catch (error) {
        // If an error occurs, abort the transaction
        yield mongoSession.abortTransaction();
        console.error('Transaction aborted for checkout session:', session.id, error);
        throw error;
    }
    finally {
        // End the session
        mongoSession.endSession();
    }
});
const handleStripeWebhook = (event) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                console.log('Payment intent succeeded:', paymentIntent.id);
                // Extract metadata
                const { studentId, courseId, teacherId, teacherShare, platformFee, // This is the platform fee (previously called organizationShare)
                 } = paymentIntent.metadata || {};
                // If metadata is missing, try to find the checkout session that created this payment intent
                if (!studentId || !courseId || !teacherId) {
                    console.log('Metadata missing in payment_intent.succeeded, attempting to find checkout session...');
                    try {
                        // Find sessions that might have created this payment intent
                        const sessions = yield stripe.checkout.sessions.list({
                            payment_intent: paymentIntent.id,
                            limit: 1,
                        });
                        if (sessions && sessions.data && sessions.data.length > 0) {
                            const session = sessions.data[0];
                            console.log('Found checkout session:', session.id, 'with metadata:', session.metadata);
                            // Process the checkout session directly
                            console.log('Processing checkout session directly:', session.id);
                            // Call the checkout.session.completed case directly
                            // This will ensure consistent processing
                            yield processCheckoutSessionCompleted(session);
                            return { success: true };
                        }
                        else {
                            console.error('No checkout session found for payment intent:', paymentIntent.id);
                            return {
                                success: false,
                                error: 'Missing required metadata and no checkout session found',
                            };
                        }
                    }
                    catch (error) {
                        console.error('Error finding checkout session for payment intent:', error);
                        return {
                            success: false,
                            error: 'Error finding checkout session for payment intent',
                        };
                    }
                }
                try {
                    // Start a MongoDB transaction
                    const mongoSession = yield mongoose_1.default.startSession();
                    mongoSession.startTransaction();
                    try {
                        // Get customer email from payment intent
                        let customerEmail = '';
                        if (paymentIntent.customer) {
                            try {
                                const customer = yield stripe.customers.retrieve(paymentIntent.customer);
                                if (customer && !customer.deleted && 'email' in customer) {
                                    customerEmail = customer.email || '';
                                }
                            }
                            catch (error) {
                                console.error('Error retrieving customer:', error);
                            }
                        }
                        // If no customer email, try to get it from the student
                        if (!customerEmail) {
                            const student = yield student_model_1.Student.findById(studentId);
                            customerEmail = (student === null || student === void 0 ? void 0 : student.email) || 'unknown@example.com';
                        }
                        console.log('Processing payment intent for customer:', customerEmail);
                        // Check if student exists
                        const student = yield student_model_1.Student.findById(studentId).session(mongoSession);
                        if (!student) {
                            throw new Error(`Student not found with ID: ${studentId}`);
                        }
                        // Check if course exists
                        const course = yield course_model_1.Course.findById(courseId).session(mongoSession);
                        if (!course) {
                            throw new Error(`Course not found with ID: ${courseId}`);
                        }
                        // Check if teacher exists
                        const teacher = yield teacher_model_1.Teacher.findById(teacherId).session(mongoSession);
                        if (!teacher) {
                            throw new Error(`Teacher not found with ID: ${teacherId}`);
                        }
                        // Check if student is already enrolled in this course
                        const isEnrolled = student.enrolledCourses.some((enrolledCourse) => enrolledCourse.courseId.toString() === courseId);
                        if (isEnrolled) {
                            console.log(`Student ${studentId} is already enrolled in course ${courseId}`);
                        }
                        else {
                            console.log(`Enrolling student ${studentId} in course ${courseId}`);
                            // Create payment record
                            yield payment_model_1.Payment.create([
                                {
                                    studentId: new mongoose_1.Types.ObjectId(studentId),
                                    courseId: new mongoose_1.Types.ObjectId(courseId),
                                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                                    amount: paymentIntent.amount / 100, // Convert from cents to dollars
                                    teacherShare: parseFloat(teacherShare) / 100, // Convert from cents to dollars
                                    platformShare: parseFloat(platformFee) / 100, // Convert from cents to dollars
                                    stripeAccountId: paymentIntent.id,
                                    stripePaymentId: paymentIntent.id, // Set the stripePaymentId to avoid duplicate key error
                                    stripeEmail: customerEmail,
                                    status: 'success',
                                    receiptUrl: '',
                                },
                            ], { session: mongoSession });
                            // Create transaction record
                            const transactionData = {
                                courseId: new mongoose_1.Types.ObjectId(courseId),
                                studentId: new mongoose_1.Types.ObjectId(studentId),
                                teacherId: new mongoose_1.Types.ObjectId(teacherId),
                                totalAmount: paymentIntent.amount / 100, // Convert from cents to dollars
                                teacherEarning: parseFloat(teacherShare) / 100, // Convert from cents to dollars
                                platformEarning: parseFloat(platformFee) / 100, // Convert from cents to dollars
                                stripeInvoiceUrl: '',
                                stripePdfUrl: '',
                                stripeTransactionId: paymentIntent.id,
                                stripeTransferStatus: 'pending',
                                status: 'success',
                            };
                            const transaction = yield transaction_model_1.Transaction.create([transactionData], {
                                session: mongoSession,
                            });
                            // Enroll student in course
                            yield student_model_1.Student.findByIdAndUpdate(studentId, {
                                $addToSet: {
                                    enrolledCourses: {
                                        courseId: new mongoose_1.Types.ObjectId(courseId),
                                        completedLectures: [],
                                        enrolledAt: new Date(),
                                    },
                                },
                            }, { session: mongoSession });
                            // Update course enrolled students and increment enrollment count
                            yield course_model_1.Course.findByIdAndUpdate(courseId, {
                                $addToSet: {
                                    enrolledStudents: new mongoose_1.Types.ObjectId(studentId),
                                },
                                $inc: { totalEnrollment: 1 },
                            }, { session: mongoSession });
                            // Make sure transaction is created successfully before updating teacher
                            if (!transaction || !transaction[0] || !transaction[0]._id) {
                                throw new Error('Transaction creation failed');
                            }
                            // Update teacher earnings and courses
                            yield teacher_model_1.Teacher.findByIdAndUpdate(teacherId, {
                                $inc: {
                                    totalEarnings: parseFloat(teacherShare) / 100, // Convert from cents to dollars
                                    'earnings.total': parseFloat(teacherShare) / 100, // Convert from cents to dollars
                                    'earnings.monthly': parseFloat(teacherShare) / 100, // Convert from cents to dollars
                                    'earnings.yearly': parseFloat(teacherShare) / 100, // Convert from cents to dollars
                                    'earnings.weekly': parseFloat(teacherShare) / 100, // Convert from cents to dollars
                                },
                                $addToSet: {
                                    courses: new mongoose_1.Types.ObjectId(courseId),
                                    payments: transaction[0]._id, // Add the transaction ID to the payments array
                                },
                            }, { session: mongoSession });
                        }
                        // Commit the transaction
                        yield mongoSession.commitTransaction();
                        console.log('Transaction committed successfully for payment intent:', paymentIntent.id);
                    }
                    catch (error) {
                        // If an error occurs, abort the transaction
                        yield mongoSession.abortTransaction();
                        console.error('Transaction aborted for payment intent:', paymentIntent.id, error);
                        throw error;
                    }
                    finally {
                        // End the session
                        mongoSession.endSession();
                    }
                }
                catch (error) {
                    console.error('Error processing payment_intent.succeeded:', error);
                    return {
                        success: false,
                        error: error instanceof Error
                            ? error.message
                            : 'Unknown error processing payment',
                    };
                }
                break;
            }
            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object;
                console.log('Payment intent failed:', paymentIntent.id);
                // Extract metadata
                const { studentId, courseId, teacherId, teacherShare, platformFee } = paymentIntent.metadata || {};
                if (!studentId || !courseId || !teacherId) {
                    console.error('Missing required metadata in failed payment intent:', paymentIntent.id);
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
                            const customer = yield stripe.customers.retrieve(paymentIntent.customer);
                            if (customer && !customer.deleted && 'email' in customer) {
                                customerEmail = customer.email || '';
                            }
                        }
                        catch (error) {
                            console.error('Error retrieving customer:', error);
                        }
                    }
                    // If no customer email, try to get it from the student
                    if (!customerEmail) {
                        const student = yield student_model_1.Student.findById(studentId);
                        customerEmail = (student === null || student === void 0 ? void 0 : student.email) || 'unknown@example.com';
                    }
                    // Create payment record for failed payment
                    yield payment_model_1.Payment.create({
                        studentId: new mongoose_1.Types.ObjectId(studentId),
                        courseId: new mongoose_1.Types.ObjectId(courseId),
                        teacherId: new mongoose_1.Types.ObjectId(teacherId),
                        amount: paymentIntent.amount / 100,
                        teacherShare: parseFloat(teacherShare),
                        platformShare: parseFloat(platformFee),
                        stripeAccountId: paymentIntent.id,
                        stripePaymentId: paymentIntent.id, // Set the stripePaymentId to avoid duplicate key error
                        stripeEmail: customerEmail,
                        status: 'failed',
                        receiptUrl: '',
                    });
                    console.log('Failed payment record created for payment intent:', paymentIntent.id);
                }
                catch (error) {
                    console.error('Error processing payment_intent.payment_failed:', error);
                    return {
                        success: false,
                        error: error instanceof Error
                            ? error.message
                            : 'Unknown error processing failed payment',
                    };
                }
                break;
            }
            case 'account.updated': {
                // Handle Stripe Connect account updates
                const account = event.data.object;
                // Find the teacher with this Stripe account
                const teacher = yield teacher_model_1.Teacher.findOne({ stripeAccountId: account.id });
                if (!teacher) {
                    break;
                }
                // Update teacher verification status based on account status
                if (account.charges_enabled && account.payouts_enabled) {
                    yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
                        stripeVerified: true,
                        stripeOnboardingComplete: true,
                        stripeRequirements: [],
                    });
                }
                else if ((_b = (_a = account.requirements) === null || _a === void 0 ? void 0 : _a.currently_due) === null || _b === void 0 ? void 0 : _b.length) {
                    yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
                        stripeVerified: false,
                        stripeOnboardingComplete: false,
                        stripeRequirements: account.requirements.currently_due,
                    });
                }
                break;
            }
            case 'checkout.session.completed': {
                const session = event.data.object;
                console.log('Checkout session completed event received:', session.id);
                try {
                    yield processCheckoutSessionCompleted(session);
                }
                catch (error) {
                    console.error('Error processing checkout.session.completed:', error);
                    return {
                        success: false,
                        error: error instanceof Error
                            ? error.message
                            : 'Unknown error processing checkout session',
                    };
                }
                break;
            }
            case 'checkout.session.async_payment_succeeded': {
                const session = event.data.object;
                console.log('Checkout session async payment succeeded:', session.id);
                // Update payment status if it was pending
                if (session.payment_intent) {
                    try {
                        yield payment_model_1.Payment.findOneAndUpdate({ stripePaymentId: session.payment_intent }, { status: 'success' });
                        console.log('Payment status updated to success for:', session.payment_intent);
                    }
                    catch (error) {
                        console.error('Error updating payment status for async payment succeeded:', error);
                        return {
                            success: false,
                            error: error instanceof Error
                                ? error.message
                                : 'Error updating payment status',
                        };
                    }
                }
                break;
            }
            case 'checkout.session.async_payment_failed': {
                const session = event.data.object;
                console.log('Checkout Session Async Payment Failed:', {
                    id: session.id,
                    payment_status: session.payment_status,
                });
                // Update payment status
                if (session.payment_intent) {
                    try {
                        yield payment_model_1.Payment.findOneAndUpdate({ stripePaymentId: session.payment_intent }, { status: 'failed' });
                        console.log('Payment status updated to failed for:', session.payment_intent);
                    }
                    catch (error) {
                        console.error('Error updating payment status for async payment failed:', error);
                        return {
                            success: false,
                            error: error instanceof Error
                                ? error.message
                                : 'Error updating payment status',
                        };
                    }
                }
                break;
            }
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in handleStripeWebhook:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
});
const connectTeacherStripe = (teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    // Validate teacherId
    if (!teacherId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Teacher ID is required');
    }
    // Find the teacher
    const teacher = yield teacher_model_1.Teacher.findById(teacherId);
    if (!teacher) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
    }
    // Validate teacher email
    if (!teacher.email) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Teacher email is required for Stripe account creation');
    }
    // If teacher already has a Stripe account, check its status and return the account link if needed
    if (teacher.stripeAccountId) {
        try {
            // Retrieve the Stripe account
            const account = yield stripe.accounts.retrieve(teacher.stripeAccountId);
            // Check if account needs additional verification
            if (account.requirements &&
                account.requirements.currently_due &&
                account.requirements.currently_due.length > 0) {
                // Update teacher with requirements
                yield teacher_model_1.Teacher.findByIdAndUpdate(teacherId, {
                    stripeRequirements: account.requirements.currently_due,
                    stripeVerified: false,
                    stripeOnboardingComplete: false,
                });
                // Create a new account link for completing verification
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
                console.log('Creating account link with frontend URL:', frontendUrl);
                const accountLink = yield stripe.accountLinks.create({
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
                    message: 'Your account needs additional verification to receive payments',
                };
            }
            // Check if charges are enabled
            if (account.charges_enabled) {
                // Update teacher status
                yield teacher_model_1.Teacher.findByIdAndUpdate(teacherId, {
                    stripeVerified: true,
                    stripeOnboardingComplete: true,
                    stripeRequirements: [],
                });
                // Account is fully verified
                return {
                    status: 'complete',
                    message: 'Your Stripe account is fully verified and ready to receive payments',
                };
            }
            else {
                // Create a new account link for completing verification
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
                console.log('Creating account link with frontend URL:', frontendUrl);
                const accountLink = yield stripe.accountLinks.create({
                    account: teacher.stripeAccountId,
                    refresh_url: `${frontendUrl}/teacher/earnings?status=incomplete`,
                    return_url: `${frontendUrl}/teacher/earnings?status=complete`,
                    type: 'account_onboarding',
                });
                console.log('Created account link:', accountLink.url);
                return {
                    url: accountLink.url,
                    status: 'incomplete',
                    message: 'Please complete your Stripe account setup to receive payments',
                };
            }
        }
        catch (error) {
            if (error instanceof Error) {
                // If the account doesn't exist anymore in Stripe, we'll create a new one
                if (error.message.includes('No such account')) {
                    // Continue to create a new account
                }
                else {
                    // For other Stripe errors, throw them to be handled by the controller
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, `Stripe error: ${error.message}`);
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
        };
        // Create a new Stripe account for the teacher
        const account = yield stripe.accounts.create(accountParams);
        // Update teacher with Stripe account ID
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacherId, {
            stripeAccountId: account.id,
            stripeEmail: teacher.email,
            stripeVerified: false,
            stripeOnboardingComplete: false,
        });
        // Create account link for onboarding
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        console.log('Creating new account link with frontend URL:', frontendUrl);
        const accountLink = yield stripe.accountLinks.create({
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
    }
    catch (error) {
        if (error instanceof Error) {
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to create Stripe account: ${error.message}`);
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create Stripe account due to an unknown error');
    }
});
const getTeacherEarnings = (teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    const teacher = yield teacher_model_1.Teacher.findById(teacherId);
    if (!teacher) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
    }
    // Use transactions instead of payments for more accurate data
    const transactions = yield transaction_model_1.Transaction.find({
        teacherId: new mongoose_1.Types.ObjectId(teacherId),
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
    const totalEarnings = transactions.reduce((sum, transaction) => sum + transaction.teacherEarning, 0);
    // Calculate monthly earnings (last 30 days)
    const monthlyEarnings = transactions
        .filter((transaction) => transaction.createdAt && transaction.createdAt >= oneMonthAgo)
        .reduce((sum, transaction) => sum + transaction.teacherEarning, 0);
    // Calculate yearly earnings (last 365 days)
    const yearlyEarnings = transactions
        .filter((transaction) => transaction.createdAt && transaction.createdAt >= oneYearAgo)
        .reduce((sum, transaction) => sum + transaction.teacherEarning, 0);
    // Calculate weekly earnings (last 7 days)
    const weeklyEarnings = transactions
        .filter((transaction) => transaction.createdAt && transaction.createdAt >= oneWeekAgo)
        .reduce((sum, transaction) => sum + transaction.teacherEarning, 0);
    // Count unique students
    const uniqueStudentIds = new Set(transactions.map(transaction => transaction.studentId.toString()));
    // Count unique courses
    const uniqueCourseIds = new Set(transactions.map(transaction => transaction.courseId.toString()));
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
});
const createCheckoutSession = (studentId, courseId, amount) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Validate course exists
        const course = yield course_model_1.Course.findById(courseId);
        if (!course) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Course not found');
        }
        // Find the teacher
        const teacher = yield teacher_model_1.Teacher.findById(course.creator);
        if (!teacher) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
        }
        // Check if student is already enrolled
        const student = yield student_model_1.Student.findById(studentId);
        if (!student) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student not found');
        }
        if (student.enrolledCourses.some((course) => course.courseId.toString() === courseId)) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Already enrolled in this course');
        }
        // Calculate the price and fee
        const coursePrice = amount !== undefined ? amount : course.coursePrice || 0;
        const platformFeePercent = 0.3; // 30%
        // Calculate amounts in cents
        const priceInCents = Math.round(coursePrice * 100);
        const platformFeeInCents = Math.round(priceInCents * platformFeePercent);
        const teacherShareInCents = priceInCents - platformFeeInCents;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const successUrl = `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${frontendUrl}/payment/cancel`;
        // Create session parameters
        const sessionParams = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: course.title,
                            description: course.description || 'Course enrollment',
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
                courseId: courseId,
                studentId: studentId,
                teacherId: course.creator.toString(),
                teacherShare: teacherShareInCents.toString(),
                platformFee: platformFeeInCents.toString(),
            },
        };
        let isValidStripeAccount = false;
        if (teacher.stripeAccountId) {
            try {
                // Verify the account exists and is valid
                const account = yield stripe.accounts.retrieve(teacher.stripeAccountId);
                isValidStripeAccount =
                    account.id === teacher.stripeAccountId && account.charges_enabled;
            }
            catch (error) {
                console.error('Error verifying Stripe account:', error);
                isValidStripeAccount = false;
            }
        }
        // Only add transfer data if the account is valid
        if (isValidStripeAccount) {
            sessionParams.payment_intent_data = {
                application_fee_amount: platformFeeInCents,
                transfer_data: {
                    destination: teacher.stripeAccountId,
                },
            };
        }
        else {
            console.log('Not using Stripe Connect - account invalid or not found');
        }
        const session = yield stripe.checkout.sessions.create(sessionParams);
        return session;
    }
    catch (error) {
        console.error('Error in createCheckoutSession:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        if (error instanceof Error) {
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to create checkout session: ${error.message}`);
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create checkout session');
    }
});
const saveStripeAccountDetails = (teacherId, stripeData) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const teacher = yield teacher_model_1.Teacher.findById(teacherId);
    if (!teacher) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
    }
    // Verify the Stripe account exists
    try {
        const account = yield stripe.accounts.retrieve(stripeData.stripeAccountId);
        if (!account) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid Stripe account ID');
        }
        console.log('Stripe account retrieved:', {
            id: account.id,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            requirements: (_a = account.requirements) === null || _a === void 0 ? void 0 : _a.currently_due,
        });
    }
    catch (error) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid Stripe account ID');
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
    yield teacher.save();
    return teacher;
});
exports.PaymentServices = {
    createPaymentIntent,
    handleStripeWebhook,
    connectTeacherStripe,
    getTeacherEarnings,
    createCheckoutSession,
    saveStripeAccountDetails,
};
