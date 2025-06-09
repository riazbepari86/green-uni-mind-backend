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
exports.agenda = void 0;
exports.startPayoutJobs = startPayoutJobs;
const agenda_1 = __importDefault(require("agenda"));
const mongoose_1 = __importDefault(require("mongoose"));
const payout_model_1 = require("../modules/Payment/payout.model");
const payout_interface_1 = require("../modules/Payment/payout.interface");
const teacher_model_1 = require("../modules/Teacher/teacher.model");
const transaction_model_1 = require("../modules/Payment/transaction.model");
const payout_model_2 = require("../modules/Payment/payout.model");
const stripe_1 = require("../utils/stripe");
// import { EmailService } from '../modules/Email/email.service';
const payout_email_service_1 = require("../modules/Email/payout-email.service");
const config_1 = __importDefault(require("../config"));
// Initialize Agenda
const agenda = new agenda_1.default({
    db: {
        address: config_1.default.database_url,
        collection: 'agendaJobs',
    },
    processEvery: '1 minute',
});
exports.agenda = agenda;
// Define job to schedule payouts
agenda.define('schedule-payouts', (_job) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Running schedule-payouts job');
    try {
        // Get all teachers with auto-payout enabled
        const preferences = yield payout_model_1.PayoutPreference.find({
            isAutoPayoutEnabled: true,
        });
        console.log('Payout job running with detailed logging enabled');
        console.log(`Found ${preferences.length} teachers with auto-payout enabled`);
        for (const preference of preferences) {
            try {
                const teacherId = preference.teacherId.toString();
                // Check if it's time for a payout based on schedule
                const shouldProcessPayout = yield shouldSchedulePayout(preference);
                if (!shouldProcessPayout) {
                    console.log(`Skipping payout for teacher ${teacherId} - not scheduled yet`);
                    continue;
                }
                console.log(`Processing payout for teacher ${teacherId}`);
                // Get teacher details
                const teacher = yield teacher_model_1.Teacher.findById(teacherId);
                if (!teacher || !teacher.stripeAccountId || !teacher.stripeVerified) {
                    console.log(`Skipping payout for teacher ${teacherId} - invalid Stripe account`);
                    continue;
                }
                // Get unpaid transactions
                const unpaidTransactions = yield transaction_model_1.Transaction.find({
                    teacherId: new mongoose_1.default.Types.ObjectId(teacherId),
                    status: 'success',
                    stripeTransferStatus: 'completed',
                    // Not included in any payout yet
                    _id: {
                        $nin: yield payout_model_2.Payout.distinct('transactions', {
                            teacherId: new mongoose_1.default.Types.ObjectId(teacherId),
                        }),
                    },
                });
                if (unpaidTransactions.length === 0) {
                    console.log(`No unpaid transactions for teacher ${teacherId}`);
                    continue;
                }
                // Calculate total amount
                const totalAmount = unpaidTransactions.reduce((sum, transaction) => sum + transaction.teacherEarning, 0);
                // Check if amount meets minimum threshold
                if (totalAmount < preference.minimumAmount) {
                    console.log(`Amount ${totalAmount} is below minimum threshold ${preference.minimumAmount} for teacher ${teacherId}`);
                    continue;
                }
                // Start a MongoDB transaction
                const session = yield mongoose_1.default.startSession();
                session.startTransaction();
                try {
                    // Create a payout in Stripe
                    const stripePayout = yield stripe_1.stripe.payouts.create({
                        amount: Math.round(totalAmount * 100), // Convert to cents
                        currency: 'usd',
                        destination: teacher.stripeAccountId,
                        metadata: {
                            teacherId,
                            isAutomated: 'true',
                            schedule: preference.schedule,
                        },
                    }, {
                        stripeAccount: teacher.stripeAccountId, // Create on the connected account
                    });
                    // Create a payout record in our database
                    const payout = yield payout_model_2.Payout.create([
                        {
                            teacherId: new mongoose_1.default.Types.ObjectId(teacherId),
                            amount: totalAmount,
                            currency: 'usd',
                            status: payout_interface_1.PayoutStatus.PROCESSING,
                            stripePayoutId: stripePayout.id,
                            transactions: unpaidTransactions.map((t) => t._id),
                            description: `Automated ${preference.schedule} payout of $${totalAmount} to ${teacher.name.firstName} ${teacher.name.lastName}`,
                            scheduledAt: new Date(),
                            metadata: {
                                isAutomated: true,
                                schedule: preference.schedule,
                            },
                        },
                    ], { session });
                    // Update payout preference with last payout date
                    yield payout_model_1.PayoutPreference.findByIdAndUpdate(preference._id, {
                        lastPayoutDate: new Date(),
                        nextScheduledPayoutDate: calculateNextPayoutDate(preference.schedule),
                    }, { session });
                    // Commit the transaction
                    yield session.commitTransaction();
                    session.endSession();
                    console.log(`Successfully created payout ${payout[0]._id} for teacher ${teacherId}`);
                }
                catch (error) {
                    // Abort the transaction on error
                    yield session.abortTransaction();
                    session.endSession();
                    console.error(`Error creating payout for teacher ${teacherId}:`, error);
                }
            }
            catch (error) {
                console.error(`Error processing teacher ${preference.teacherId}:`, error);
            }
        }
    }
    catch (error) {
        console.error('Error in schedule-payouts job:', error);
    }
}));
// Define job to check payout statuses
agenda.define('check-payout-statuses', (_job) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Running check-payout-statuses job');
    try {
        // Get all processing payouts
        const processingPayouts = yield payout_model_2.Payout.find({
            status: payout_interface_1.PayoutStatus.PROCESSING,
        });
        console.log(`Found ${processingPayouts.length} processing payouts`);
        for (const payout of processingPayouts) {
            try {
                const teacherId = payout.teacherId.toString();
                const payoutId = payout._id;
                // Get teacher details
                const teacher = yield teacher_model_1.Teacher.findById(teacherId);
                if (!teacher || !teacher.stripeAccountId) {
                    console.log(`Skipping payout status check for ${payoutId} - invalid teacher`);
                    continue;
                }
                // Check payout status in Stripe
                const stripePayout = yield stripe_1.stripe.payouts.retrieve(payout.stripePayoutId, {
                    stripeAccount: teacher.stripeAccountId,
                });
                // Update status based on Stripe status
                let newStatus = payout.status;
                if (stripePayout.status === 'paid') {
                    newStatus = payout_interface_1.PayoutStatus.COMPLETED;
                }
                else if (stripePayout.status === 'failed') {
                    newStatus = payout_interface_1.PayoutStatus.FAILED;
                }
                // Update payout if status changed
                if (newStatus !== payout.status) {
                    yield payout_model_2.Payout.findByIdAndUpdate(payoutId, {
                        status: newStatus,
                        processedAt: newStatus === payout_interface_1.PayoutStatus.COMPLETED ? new Date() : undefined,
                        failureReason: stripePayout.failure_message || undefined,
                    }, { new: true });
                    console.log(`Updated payout ${payoutId} status to ${newStatus}`);
                    // Send email notification if payout status changed to completed
                    if (newStatus === payout_interface_1.PayoutStatus.COMPLETED && payout.status !== payout_interface_1.PayoutStatus.COMPLETED) {
                        try {
                            console.log(`Sending payout processed notification for payout ${payoutId}`);
                            const success = yield payout_email_service_1.PayoutEmailService.sendPayoutStatusChangeNotification(payoutId, payout.status, newStatus);
                            if (success) {
                                console.log(`Successfully sent payout processed notification for payout ${payoutId}`);
                            }
                            else {
                                console.log(`Failed to send payout processed notification for payout ${payoutId}`);
                            }
                        }
                        catch (emailError) {
                            console.error(`Error sending payout status change notification:`, emailError);
                        }
                    }
                }
            }
            catch (error) {
                console.error(`Error checking payout ${payout._id}:`, error);
            }
        }
    }
    catch (error) {
        console.error('Error in check-payout-statuses job:', error);
    }
}));
// Helper function to determine if a payout should be scheduled
function shouldSchedulePayout(preference) {
    return __awaiter(this, void 0, void 0, function* () {
        // If no last payout date, schedule a payout
        if (!preference.lastPayoutDate) {
            return true;
        }
        const lastPayoutDate = new Date(preference.lastPayoutDate);
        const now = new Date();
        // Calculate the next payout date based on the schedule
        const nextPayoutDate = preference.nextScheduledPayoutDate
            ? new Date(preference.nextScheduledPayoutDate)
            : calculateNextPayoutDate(preference.schedule, lastPayoutDate);
        // If next payout date is in the past or today, schedule a payout
        return nextPayoutDate <= now;
    });
}
// Helper function to calculate the next payout date
function calculateNextPayoutDate(schedule, fromDate = new Date()) {
    const nextDate = new Date(fromDate);
    switch (schedule) {
        case payout_interface_1.PayoutSchedule.DAILY:
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case payout_interface_1.PayoutSchedule.WEEKLY:
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case payout_interface_1.PayoutSchedule.BIWEEKLY:
            nextDate.setDate(nextDate.getDate() + 14);
            break;
        case payout_interface_1.PayoutSchedule.MONTHLY:
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        default:
            // For manual, set to far future
            nextDate.setFullYear(nextDate.getFullYear() + 10);
    }
    return nextDate;
}
// Define job to send upcoming payout notifications
agenda.define('send-upcoming-payout-notifications', (_job) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Running send-upcoming-payout-notifications job');
    try {
        // Use the PayoutEmailService to send all upcoming payout notifications
        const result = yield payout_email_service_1.PayoutEmailService.sendAllUpcomingPayoutNotifications();
        console.log(`Payout notification job completed: ${result.sent} sent, ${result.failed} failed out of ${result.total} total`);
    }
    catch (error) {
        console.error('Error in send-upcoming-payout-notifications job:', error);
    }
}));
// Start agenda
function startPayoutJobs() {
    return __awaiter(this, void 0, void 0, function* () {
        yield agenda.start();
        // Schedule jobs
        yield agenda.every('1 day', 'schedule-payouts');
        yield agenda.every('1 hour', 'check-payout-statuses');
        yield agenda.every('1 day', 'send-upcoming-payout-notifications');
        console.log('Payout jobs scheduled');
    });
}
