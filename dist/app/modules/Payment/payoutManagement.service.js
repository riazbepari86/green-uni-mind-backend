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
exports.PayoutManagementService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const mongoose_1 = require("mongoose");
const payout_model_1 = require("./payout.model");
const teacher_model_1 = require("../Teacher/teacher.model");
const transaction_model_1 = require("./transaction.model");
const auditLog_service_1 = require("../AuditLog/auditLog.service");
const notification_service_1 = require("../Notification/notification.service");
const payout_interface_1 = require("./payout.interface");
const auditLog_interface_1 = require("../AuditLog/auditLog.interface");
const notification_interface_1 = require("../Notification/notification.interface");
// Automated payout scheduling service
const scheduleAutomaticPayouts = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    console.log('Starting automatic payout scheduling...');
    try {
        // Find teachers with auto-payout enabled and due for payout
        const duePreferences = yield payout_model_1.PayoutPreference.find({
            isAutoPayoutEnabled: true,
            isActive: true,
            nextScheduledPayoutDate: { $lte: new Date() },
        }).populate('teacherId');
        console.log(`Found ${duePreferences.length} teachers due for automatic payout`);
        let scheduled = 0;
        let skipped = 0;
        let errors = 0;
        for (const preference of duePreferences) {
            try {
                const teacher = preference.teacherId;
                // Check if teacher has connected Stripe account
                if (!((_a = teacher.stripeConnect) === null || _a === void 0 ? void 0 : _a.accountId) || teacher.stripeConnect.status !== 'connected') {
                    console.log(`Skipping payout for teacher ${teacher._id}: Stripe account not connected`);
                    skipped++;
                    continue;
                }
                // Get pending earnings
                const pendingEarnings = yield getPendingEarnings(teacher._id);
                // Check if earnings meet minimum threshold
                if (pendingEarnings.totalAmount < preference.minimumAmount) {
                    console.log(`Skipping payout for teacher ${teacher._id}: Amount ${pendingEarnings.totalAmount} below minimum ${preference.minimumAmount}`);
                    skipped++;
                    // Update next scheduled date
                    const nextDate = calculateNextPayoutDate(preference.schedule, preference.customSchedule, (_b = preference.customSchedule) === null || _b === void 0 ? void 0 : _b.timezone);
                    yield payout_model_1.PayoutPreference.findByIdAndUpdate(preference._id, {
                        nextScheduledPayoutDate: nextDate,
                    });
                    continue;
                }
                // Create scheduled payout
                yield createScheduledPayout(teacher._id, {
                    amount: pendingEarnings.totalAmount,
                    description: `Automatic ${preference.schedule} payout`,
                    scheduledAt: new Date(),
                });
                // Update next scheduled date
                const nextDate = calculateNextPayoutDate(preference.schedule, preference.customSchedule, (_c = preference.customSchedule) === null || _c === void 0 ? void 0 : _c.timezone);
                yield payout_model_1.PayoutPreference.findByIdAndUpdate(preference._id, {
                    lastPayoutDate: new Date(),
                    nextScheduledPayoutDate: nextDate,
                });
                scheduled++;
                console.log(`Scheduled automatic payout for teacher ${teacher._id}: $${pendingEarnings.totalAmount}`);
            }
            catch (error) {
                console.error(`Error scheduling payout for preference ${preference._id}:`, error);
                errors++;
            }
        }
        console.log(`Automatic payout scheduling completed: ${scheduled} scheduled, ${skipped} skipped, ${errors} errors`);
        return { scheduled, skipped, errors };
    }
    catch (error) {
        console.error('Error in automatic payout scheduling:', error);
        throw error;
    }
});
// Calculate next payout date based on schedule
const calculateNextPayoutDate = (schedule, customSchedule, timezone = 'UTC') => {
    const now = new Date();
    const nextPayout = new Date();
    switch (schedule) {
        case payout_interface_1.PayoutSchedule.DAILY:
            nextPayout.setDate(now.getDate() + 1);
            nextPayout.setHours((customSchedule === null || customSchedule === void 0 ? void 0 : customSchedule.hour) || 9, 0, 0, 0);
            break;
        case payout_interface_1.PayoutSchedule.WEEKLY:
            const daysUntilNext = (7 + ((customSchedule === null || customSchedule === void 0 ? void 0 : customSchedule.dayOfWeek) || 1) - now.getDay()) % 7;
            nextPayout.setDate(now.getDate() + (daysUntilNext || 7));
            nextPayout.setHours((customSchedule === null || customSchedule === void 0 ? void 0 : customSchedule.hour) || 9, 0, 0, 0);
            break;
        case payout_interface_1.PayoutSchedule.BIWEEKLY:
            nextPayout.setDate(now.getDate() + 14);
            nextPayout.setHours((customSchedule === null || customSchedule === void 0 ? void 0 : customSchedule.hour) || 9, 0, 0, 0);
            break;
        case payout_interface_1.PayoutSchedule.MONTHLY:
            const targetDay = (customSchedule === null || customSchedule === void 0 ? void 0 : customSchedule.dayOfMonth) || 1;
            nextPayout.setMonth(now.getMonth() + 1);
            nextPayout.setDate(Math.min(targetDay, new Date(nextPayout.getFullYear(), nextPayout.getMonth() + 1, 0).getDate()));
            nextPayout.setHours((customSchedule === null || customSchedule === void 0 ? void 0 : customSchedule.hour) || 9, 0, 0, 0);
            break;
        case payout_interface_1.PayoutSchedule.MANUAL:
        default:
            return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
    }
    return nextPayout;
};
// Get pending earnings for a teacher
const getPendingEarnings = (teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    const pipeline = [
        {
            $match: {
                teacherId: new mongoose_1.Types.ObjectId(teacherId),
                stripeTransferStatus: 'pending',
            },
        },
        {
            $group: {
                _id: '$currency',
                totalAmount: { $sum: '$teacherEarning' },
                transactionCount: { $sum: 1 },
                transactions: { $push: '$$ROOT' },
            },
        },
    ];
    const results = yield transaction_model_1.Transaction.aggregate(pipeline);
    if (results.length === 0) {
        return {
            totalAmount: 0,
            transactionCount: 0,
            transactions: [],
            currency: 'usd',
        };
    }
    const result = results[0];
    return {
        totalAmount: result.totalAmount,
        transactionCount: result.transactionCount,
        transactions: result.transactions,
        currency: result._id || 'usd',
    };
});
// Create scheduled payout
const createScheduledPayout = (teacherId_1, ...args_1) => __awaiter(void 0, [teacherId_1, ...args_1], void 0, function* (teacherId, options = {}) {
    var _a, _b;
    const teacher = yield teacher_model_1.Teacher.findById(teacherId);
    if (!teacher) {
        throw new Error('Teacher not found');
    }
    if (!((_a = teacher.stripeConnect) === null || _a === void 0 ? void 0 : _a.accountId)) {
        throw new Error('Teacher does not have a connected Stripe account');
    }
    // Get pending earnings if amount not specified
    let amount = options.amount;
    let transactions = [];
    if (!amount) {
        const pendingEarnings = yield getPendingEarnings(teacherId);
        amount = pendingEarnings.totalAmount;
        transactions = pendingEarnings.transactions.map((t) => t._id);
    }
    if (!amount || amount <= 0) {
        throw new Error('No pending earnings available for payout');
    }
    // Get payout preferences
    const preferences = yield payout_model_1.PayoutPreference.findOne({ teacherId });
    const minimumAmount = (preferences === null || preferences === void 0 ? void 0 : preferences.minimumAmount) || 50;
    if (amount < minimumAmount) {
        throw new Error(`Payout amount ${amount} is below minimum threshold ${minimumAmount}`);
    }
    // Create payout record
    const payout = new payout_model_1.Payout({
        teacherId,
        amount,
        currency: 'usd',
        status: payout_interface_1.PayoutStatus.SCHEDULED,
        stripeAccountId: teacher.stripeConnect.accountId,
        transactions,
        description: options.description || `Scheduled payout for ${new Date().toLocaleDateString()}`,
        scheduledAt: options.scheduledAt || new Date(),
        requestedAt: new Date(),
        batchId: options.batchId,
        retryCount: 0,
        maxRetries: ((_b = preferences === null || preferences === void 0 ? void 0 : preferences.retryConfig) === null || _b === void 0 ? void 0 : _b.maxRetries) || 3,
        retryConfig: (preferences === null || preferences === void 0 ? void 0 : preferences.retryConfig) || {
            maxRetries: 3,
            baseDelay: 60000,
            maxDelay: 3600000,
            backoffMultiplier: 2,
            jitterEnabled: true,
        },
        complianceChecked: false,
        notificationSent: false,
        notificationsSent: [],
        auditTrail: [{
                action: 'payout_scheduled',
                timestamp: new Date(),
                details: {
                    amount,
                    currency: 'usd',
                    scheduledAt: options.scheduledAt || new Date(),
                    transactionCount: transactions.length,
                },
            }],
        metadata: {
            createdBy: 'system',
            teacherEmail: teacher.email,
            stripeAccountId: teacher.stripeConnect.accountId,
        },
    });
    yield payout.save();
    // Log audit event
    yield auditLog_service_1.AuditLogService.createAuditLog({
        action: auditLog_interface_1.AuditLogAction.PAYOUT_SCHEDULED,
        category: auditLog_interface_1.AuditLogCategory.PAYOUT,
        level: auditLog_interface_1.AuditLogLevel.INFO,
        message: `Payout scheduled: ${amount} USD`,
        userId: teacherId,
        userType: 'teacher',
        resourceType: 'payout',
        resourceId: payout._id.toString(),
        metadata: {
            amount,
            currency: 'usd',
            scheduledAt: options.scheduledAt || new Date(),
            transactionCount: transactions.length,
            stripeAccountId: teacher.stripeConnect.accountId,
        },
    });
    // Send notification
    yield notification_service_1.NotificationService.createNotification({
        type: notification_interface_1.NotificationType.PAYOUT_SCHEDULED,
        priority: notification_interface_1.NotificationPriority.NORMAL,
        userId: teacherId,
        userType: 'teacher',
        title: 'Payout Scheduled',
        body: `Your payout of $${amount} has been scheduled and will be processed soon.`,
        relatedResourceType: 'payout',
        relatedResourceId: payout._id.toString(),
        metadata: {
            amount,
            currency: 'usd',
            scheduledAt: options.scheduledAt || new Date(),
        },
    });
    return payout;
});
// Initialize cron jobs for payout management
const initializePayoutJobs = () => {
    // Schedule automatic payouts every hour
    node_cron_1.default.schedule('0 * * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield scheduleAutomaticPayouts();
        }
        catch (error) {
            console.error('Error in automatic payout scheduling cron job:', error);
        }
    }));
    console.log('Payout management cron jobs initialized');
};
exports.PayoutManagementService = {
    scheduleAutomaticPayouts,
    calculateNextPayoutDate,
    getPendingEarnings,
    createScheduledPayout,
    initializePayoutJobs,
};
