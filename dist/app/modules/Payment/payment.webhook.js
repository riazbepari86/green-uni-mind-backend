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
exports.PaymentWebhook = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const course_model_1 = require("../Course/course.model");
const student_model_1 = require("../Student/student.model");
const teacher_model_1 = require("../Teacher/teacher.model");
const payment_model_1 = require("./payment.model");
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const stripe_1 = require("../../utils/stripe");
const handleStripeWebhook = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripe_1.stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    }
    catch (err) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Webhook signature verification failed');
    }
    // Return a 200 response immediately to acknowledge receipt of the webhook
    res.json({ received: true });
    try {
        if (event.type === 'checkout.session.completed') {
            const checkoutSession = event.data.object;
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
            const mongoSession = yield mongoose_1.default.startSession();
            mongoSession.startTransaction();
            try {
                // Update course
                yield course_model_1.Course.findByIdAndUpdate(courseId, { $addToSet: { enrolledStudents: new mongoose_1.Types.ObjectId(studentId) } }, { session: mongoSession });
                // Update student
                yield student_model_1.Student.findByIdAndUpdate(studentId, {
                    $push: {
                        enrolledCourses: {
                            courseId: new mongoose_1.Types.ObjectId(courseId),
                            completedLectures: [],
                            enrolledAt: new Date(),
                        },
                    },
                }, { session: mongoSession });
                // Create payment record
                yield payment_model_1.Payment.create([{
                        studentId: new mongoose_1.Types.ObjectId(studentId),
                        courseId: new mongoose_1.Types.ObjectId(courseId),
                        teacherId: new mongoose_1.Types.ObjectId(teacherId),
                        amount,
                        teacherShare,
                        platformShare,
                        stripeAccountId: checkoutSession.payment_intent,
                        stripeEmail: ((_a = checkoutSession.customer_details) === null || _a === void 0 ? void 0 : _a.email) || '',
                        status: 'success',
                        receiptUrl: checkoutSession.receipt_url,
                    }], { session: mongoSession });
                // Update teacher earnings
                yield teacher_model_1.Teacher.findByIdAndUpdate(teacherId, {
                    $inc: {
                        'earnings.total': teacherShare,
                        'earnings.monthly': teacherShare,
                        'earnings.yearly': teacherShare,
                        'earnings.weekly': teacherShare,
                    },
                    $addToSet: { courses: new mongoose_1.Types.ObjectId(courseId) }
                }, { session: mongoSession });
                // Commit the transaction
                yield mongoSession.commitTransaction();
                console.log('Successfully processed checkout.session.completed with transaction');
            }
            catch (error) {
                // If an error occurs, abort the transaction
                yield mongoSession.abortTransaction();
                console.error('Transaction aborted:', error);
                throw error;
            }
            finally {
                // End the session
                mongoSession.endSession();
            }
        }
    }
    catch (error) {
        console.error('Error processing webhook:', error);
    }
});
exports.PaymentWebhook = {
    handleStripeWebhook,
};
