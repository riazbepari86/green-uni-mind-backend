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
exports.PayoutEmailService = exports.sendPayoutStatusChangeNotification = exports.sendAllUpcomingPayoutNotifications = exports.sendPayoutProcessedNotification = exports.sendUpcomingPayoutNotification = void 0;
const email_service_1 = require("./email.service");
const teacher_model_1 = require("../Teacher/teacher.model");
const payout_model_1 = require("../Payment/payout.model");
const payout_interface_1 = require("../Payment/payout.interface");
const date_fns_1 = require("date-fns");
/**
 * Send email notification for upcoming payout
 */
const sendUpcomingPayoutNotification = (payoutId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find the payout
        const payout = yield payout_model_1.Payout.findById(payoutId);
        if (!payout) {
            console.error(`Payout not found: ${payoutId}`);
            return false;
        }
        // Find the teacher
        const teacher = yield teacher_model_1.Teacher.findById(payout.teacherId);
        if (!teacher || !teacher.email) {
            console.error(`Teacher not found or missing email: ${payout.teacherId}`);
            return false;
        }
        // Format the payout date
        const payoutDate = payout.scheduledAt || new Date();
        const formattedDate = (0, date_fns_1.format)(payoutDate, 'MMMM dd, yyyy');
        // Send the email
        const success = yield email_service_1.EmailService.sendUpcomingPayoutNotification(teacher.email, `${teacher.name.firstName} ${teacher.name.lastName}`, payout.amount, payoutDate, payout.stripePayoutId || payout._id.toString());
        // Mark notification as sent
        if (success) {
            yield payout_model_1.Payout.findByIdAndUpdate(payoutId, {
                notificationSent: true
            });
        }
        return success;
    }
    catch (error) {
        console.error('Error sending upcoming payout notification:', error);
        return false;
    }
});
exports.sendUpcomingPayoutNotification = sendUpcomingPayoutNotification;
/**
 * Send email notification for processed payout
 */
const sendPayoutProcessedNotification = (payoutId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find the payout
        const payout = yield payout_model_1.Payout.findById(payoutId);
        if (!payout) {
            console.error(`Payout not found: ${payoutId}`);
            return false;
        }
        // Find the teacher
        const teacher = yield teacher_model_1.Teacher.findById(payout.teacherId);
        if (!teacher || !teacher.email) {
            console.error(`Teacher not found or missing email: ${payout.teacherId}`);
            return false;
        }
        // Format the payout date
        const processedDate = payout.processedAt || new Date();
        // Send the email
        const success = yield email_service_1.EmailService.sendPayoutProcessedNotification(teacher.email, `${teacher.name.firstName} ${teacher.name.lastName}`, payout.amount, processedDate, payout.stripePayoutId || payout._id.toString());
        return success;
    }
    catch (error) {
        console.error('Error sending payout processed notification:', error);
        return false;
    }
});
exports.sendPayoutProcessedNotification = sendPayoutProcessedNotification;
/**
 * Send notifications for all upcoming payouts
 */
const sendAllUpcomingPayoutNotifications = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get all pending payouts scheduled within the next 2 days that haven't had notifications sent
        const twoDaysFromNow = (0, date_fns_1.addDays)(new Date(), 2);
        const upcomingPayouts = yield payout_model_1.Payout.find({
            status: payout_interface_1.PayoutStatus.PENDING,
            scheduledAt: { $lte: twoDaysFromNow },
            notificationSent: { $ne: true }
        });
        console.log(`Found ${upcomingPayouts.length} upcoming payouts to send notifications for`);
        let sent = 0;
        let failed = 0;
        // Send notifications for each payout
        for (const payout of upcomingPayouts) {
            const success = yield (0, exports.sendUpcomingPayoutNotification)(payout._id.toString());
            if (success) {
                sent++;
            }
            else {
                failed++;
            }
        }
        return {
            total: upcomingPayouts.length,
            sent,
            failed
        };
    }
    catch (error) {
        console.error('Error sending all upcoming payout notifications:', error);
        return {
            total: 0,
            sent: 0,
            failed: 0
        };
    }
});
exports.sendAllUpcomingPayoutNotifications = sendAllUpcomingPayoutNotifications;
/**
 * Send notification when payout status changes to completed
 */
const sendPayoutStatusChangeNotification = (payoutId, oldStatus, newStatus) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Only send notification when status changes to completed
        if (newStatus === payout_interface_1.PayoutStatus.COMPLETED && oldStatus !== payout_interface_1.PayoutStatus.COMPLETED) {
            return yield (0, exports.sendPayoutProcessedNotification)(payoutId);
        }
        return false;
    }
    catch (error) {
        console.error('Error sending payout status change notification:', error);
        return false;
    }
});
exports.sendPayoutStatusChangeNotification = sendPayoutStatusChangeNotification;
exports.PayoutEmailService = {
    sendUpcomingPayoutNotification: exports.sendUpcomingPayoutNotification,
    sendPayoutProcessedNotification: exports.sendPayoutProcessedNotification,
    sendAllUpcomingPayoutNotifications: exports.sendAllUpcomingPayoutNotifications,
    sendPayoutStatusChangeNotification: exports.sendPayoutStatusChangeNotification
};
