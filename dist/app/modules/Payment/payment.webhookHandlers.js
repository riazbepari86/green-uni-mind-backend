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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentWebhookHandlers = void 0;
const payment_model_1 = require("./payment.model");
const transaction_model_1 = require("./transaction.model");
const student_model_1 = require("../Student/student.model");
const teacher_model_1 = require("../Teacher/teacher.model");
const course_model_1 = require("../Course/course.model");
const auditLog_model_1 = require("../AuditLog/auditLog.model");
const notification_service_1 = require("../Notification/notification.service");
const auditLog_interface_1 = require("../AuditLog/auditLog.interface");
const notification_interface_1 = require("../Notification/notification.interface");
// Handle checkout.session.completed event
const handleCheckoutSessionCompleted = (event) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const startTime = Date.now();
    try {
        const checkoutSession = event.data.object;
        const { courseId, studentId, teacherId } = checkoutSession.metadata;
        if (!courseId || !studentId || !teacherId) {
            return {
                success: false,
                error: 'Missing required metadata in checkout session',
                processingTime: Date.now() - startTime,
            };
        }
        // Get related entities
        const [student, teacher, course] = yield Promise.all([
            student_model_1.Student.findById(studentId),
            teacher_model_1.Teacher.findById(teacherId),
            course_model_1.Course.findById(courseId),
        ]);
        if (!student || !teacher || !course) {
            return {
                success: false,
                error: 'Related entities not found',
                processingTime: Date.now() - startTime,
            };
        }
        // Create or update payment record
        const existingPayment = yield payment_model_1.Payment.findOne({
            stripePaymentId: checkoutSession.payment_intent
        });
        if (!existingPayment) {
            const payment = new payment_model_1.Payment({
                studentId,
                courseId,
                teacherId,
                amount: checkoutSession.amount_total / 100,
                teacherShare: (checkoutSession.amount_total * 0.8) / 100, // 80% to teacher
                platformShare: (checkoutSession.amount_total * 0.2) / 100, // 20% platform fee
                stripeAccountId: ((_a = teacher.stripeConnect) === null || _a === void 0 ? void 0 : _a.accountId) || teacher.stripeAccountId,
                stripePaymentId: checkoutSession.payment_intent,
                stripeEmail: ((_b = checkoutSession.customer_details) === null || _b === void 0 ? void 0 : _b.email) || student.email,
                status: 'completed',
                receiptUrl: checkoutSession.receipt_url,
            });
            yield payment.save();
        }
        // Create transaction record
        const existingTransaction = yield transaction_model_1.Transaction.findOne({
            stripeTransactionId: checkoutSession.payment_intent
        });
        if (!existingTransaction) {
            const transaction = new transaction_model_1.Transaction({
                courseId,
                studentId,
                teacherId,
                totalAmount: checkoutSession.amount_total / 100,
                teacherEarning: (checkoutSession.amount_total * 0.8) / 100,
                platformEarning: (checkoutSession.amount_total * 0.2) / 100,
                stripeTransactionId: checkoutSession.payment_intent,
                stripeTransferStatus: 'pending',
                paymentMethod: ((_c = checkoutSession.payment_method_types) === null || _c === void 0 ? void 0 : _c[0]) || 'card',
                currency: checkoutSession.currency || 'usd',
                metadata: {
                    checkoutSessionId: checkoutSession.id,
                    customerEmail: (_d = checkoutSession.customer_details) === null || _d === void 0 ? void 0 : _d.email,
                    paymentStatus: checkoutSession.payment_status,
                },
            });
            yield transaction.save();
        }
        // Log audit event
        yield auditLog_model_1.AuditLog.create({
            action: auditLog_interface_1.AuditLogAction.PAYMENT_COMPLETED,
            category: auditLog_interface_1.AuditLogCategory.PAYMENT,
            level: auditLog_interface_1.AuditLogLevel.INFO,
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
                studentEmail: (_e = checkoutSession.customer_details) === null || _e === void 0 ? void 0 : _e.email,
            },
            timestamp: new Date(),
        });
        // Send notifications
        yield Promise.all([
            // Notify student
            notification_service_1.NotificationService.createNotification({
                type: notification_interface_1.NotificationType.PAYMENT_RECEIVED,
                priority: notification_interface_1.NotificationPriority.NORMAL,
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
            notification_service_1.NotificationService.createNotification({
                type: notification_interface_1.NotificationType.PAYMENT_RECEIVED,
                priority: notification_interface_1.NotificationPriority.NORMAL,
                userId: teacherId,
                userType: 'teacher',
                title: 'New Sale',
                body: `You've received a new sale for "${course.title}". Your earnings: ${(checkoutSession.amount_total * 0.8) / 100} ${(_f = checkoutSession.currency) === null || _f === void 0 ? void 0 : _f.toUpperCase()}.`,
                relatedResourceType: 'course',
                relatedResourceId: courseId,
                actionUrl: `/teacher/earnings`,
                actionText: 'View Earnings',
                metadata: {
                    amount: checkoutSession.amount_total / 100,
                    teacherEarning: (checkoutSession.amount_total * 0.8) / 100,
                    currency: checkoutSession.currency,
                    courseTitle: course.title,
                    studentName: `${student.firstName} ${student.lastName}`,
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
    }
    catch (error) {
        console.error('Error handling checkout.session.completed webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Handle payment_intent.succeeded event
const handlePaymentIntentSucceeded = (event) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const startTime = Date.now();
    try {
        const paymentIntent = event.data.object;
        // Update payment status if exists
        const payment = yield payment_model_1.Payment.findOneAndUpdate({ stripePaymentId: paymentIntent.id }, {
            $set: {
                status: 'success',
                receiptUrl: (_c = (_b = (_a = paymentIntent.charges) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.receipt_url,
            },
        }, { new: true });
        if (payment) {
            // Log audit event
            yield auditLog_model_1.AuditLog.create({
                action: auditLog_interface_1.AuditLogAction.PAYMENT_COMPLETED,
                category: auditLog_interface_1.AuditLogCategory.PAYMENT,
                level: auditLog_interface_1.AuditLogLevel.INFO,
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
            affectedUserId: (_d = payment === null || payment === void 0 ? void 0 : payment.studentId) === null || _d === void 0 ? void 0 : _d.toString(),
            affectedUserType: 'student',
            relatedResourceIds: [paymentIntent.id],
        };
    }
    catch (error) {
        console.error('Error handling payment_intent.succeeded webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Handle payment_intent.payment_failed event
const handlePaymentIntentFailed = (event) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const startTime = Date.now();
    try {
        const paymentIntent = event.data.object;
        // Update payment status if exists
        const payment = yield payment_model_1.Payment.findOneAndUpdate({ stripePaymentId: paymentIntent.id }, {
            $set: {
                status: 'failed',
            },
        }, { new: true });
        if (payment) {
            // Log audit event
            yield auditLog_model_1.AuditLog.create({
                action: auditLog_interface_1.AuditLogAction.PAYMENT_FAILED,
                category: auditLog_interface_1.AuditLogCategory.PAYMENT,
                level: auditLog_interface_1.AuditLogLevel.ERROR,
                message: `Payment intent failed: ${(_a = paymentIntent.last_payment_error) === null || _a === void 0 ? void 0 : _a.message}`,
                userId: payment.studentId,
                userType: 'student',
                resourceType: 'payment_intent',
                resourceId: paymentIntent.id,
                metadata: {
                    stripeEventId: event.id,
                    paymentIntentId: paymentIntent.id,
                    amount: paymentIntent.amount / 100,
                    currency: paymentIntent.currency,
                    errorCode: (_b = paymentIntent.last_payment_error) === null || _b === void 0 ? void 0 : _b.code,
                    errorMessage: (_c = paymentIntent.last_payment_error) === null || _c === void 0 ? void 0 : _c.message,
                },
                timestamp: new Date(),
            });
            // Send failure notification
            yield notification_service_1.NotificationService.createNotification({
                type: notification_interface_1.NotificationType.PAYMENT_FAILED,
                priority: notification_interface_1.NotificationPriority.HIGH,
                userId: payment.studentId,
                userType: 'student',
                title: 'Payment Failed',
                body: `Your payment failed: ${(_d = paymentIntent.last_payment_error) === null || _d === void 0 ? void 0 : _d.message}. Please try again with a different payment method.`,
                relatedResourceType: 'payment',
                relatedResourceId: paymentIntent.id,
                metadata: {
                    amount: paymentIntent.amount / 100,
                    currency: paymentIntent.currency,
                    errorMessage: (_e = paymentIntent.last_payment_error) === null || _e === void 0 ? void 0 : _e.message,
                },
            });
        }
        return {
            success: true,
            processingTime: Date.now() - startTime,
            affectedUserId: (_f = payment === null || payment === void 0 ? void 0 : payment.studentId) === null || _f === void 0 ? void 0 : _f.toString(),
            affectedUserType: 'student',
            relatedResourceIds: [paymentIntent.id],
        };
    }
    catch (error) {
        console.error('Error handling payment_intent.payment_failed webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Placeholder handlers for other payment events
const handleChargeSucceeded = (event) => __awaiter(void 0, void 0, void 0, function* () {
    // Implementation for charge.succeeded
    return { success: true, processingTime: 0 };
});
const handleChargeFailed = (event) => __awaiter(void 0, void 0, void 0, function* () {
    // Implementation for charge.failed
    return { success: true, processingTime: 0 };
});
const handleChargeDisputeCreated = (event) => __awaiter(void 0, void 0, void 0, function* () {
    // Implementation for charge.dispute.created
    return { success: true, processingTime: 0 };
});
exports.PaymentWebhookHandlers = {
    handleCheckoutSessionCompleted,
    handlePaymentIntentSucceeded,
    handlePaymentIntentFailed,
    handleChargeSucceeded,
    handleChargeFailed,
    handleChargeDisputeCreated,
};
