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
exports.PayoutService = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const payout_model_1 = require("./payout.model");
const payout_interface_1 = require("./payout.interface");
const teacher_model_1 = require("../Teacher/teacher.model");
const transaction_model_1 = require("./transaction.model");
const auditLog_service_1 = require("../AuditLog/auditLog.service");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const stripe_1 = require("../../utils/stripe");
const auditLog_interface_1 = require("../AuditLog/auditLog.interface");
/**
 * Create a payout request for a teacher
 */
const createPayoutRequest = (teacherId, amount) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find the teacher
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
        }
        // Check if teacher has a Stripe account
        if (!teacher.stripeAccountId) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Teacher does not have a connected Stripe account');
        }
        // Check if teacher has verified their Stripe account
        if (!teacher.stripeVerified) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Teacher has not completed Stripe verification');
        }
        // Get teacher's available balance
        const availableBalance = teacher.totalEarnings || 0;
        // If amount is not specified, use the entire available balance
        const payoutAmount = amount || availableBalance;
        // Validate payout amount
        if (payoutAmount <= 0) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Payout amount must be greater than zero');
        }
        if (payoutAmount > availableBalance) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Payout amount exceeds available balance');
        }
        // Get unpaid transactions
        const unpaidTransactions = yield transaction_model_1.Transaction.find({
            teacherId: new mongoose_1.Types.ObjectId(teacherId),
            status: 'success',
            stripeTransferStatus: 'completed',
            // Not included in any payout yet
            _id: {
                $nin: yield payout_model_1.Payout.distinct('transactions', {
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                }),
            },
        });
        if (unpaidTransactions.length === 0) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'No eligible transactions found for payout');
        }
        // Calculate total amount from unpaid transactions
        const totalUnpaidAmount = unpaidTransactions.reduce((sum, transaction) => sum + transaction.teacherEarning, 0);
        // Validate against unpaid transactions
        if (payoutAmount > totalUnpaidAmount) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Payout amount exceeds total unpaid transactions');
        }
        // Start a MongoDB transaction
        const session = yield mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // Create a payout in Stripe
            const stripePayout = yield stripe_1.stripe.payouts.create({
                amount: Math.round(payoutAmount * 100), // Convert to cents
                currency: 'usd',
                destination: teacher.stripeAccountId,
                metadata: {
                    teacherId: teacherId,
                },
            }, {
                stripeAccount: teacher.stripeAccountId, // Create on the connected account
            });
            // Create a payout record in our database
            const payout = yield payout_model_1.Payout.create([
                {
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                    amount: payoutAmount,
                    currency: 'usd',
                    status: payout_interface_1.PayoutStatus.PROCESSING,
                    stripePayoutId: stripePayout.id,
                    transactions: unpaidTransactions.map((t) => t._id),
                    description: `Payout of $${payoutAmount} to ${teacher.name.firstName} ${teacher.name.lastName}`,
                    scheduledAt: new Date(),
                },
            ], { session });
            // Update teacher's payout preference with last payout date
            yield payout_model_1.PayoutPreference.findOneAndUpdate({ teacherId: new mongoose_1.Types.ObjectId(teacherId) }, {
                lastPayoutDate: new Date(),
                $unset: { nextScheduledPayoutDate: 1 },
            }, { upsert: true, session });
            // Commit the transaction
            yield session.commitTransaction();
            session.endSession();
            return {
                success: true,
                payoutId: payout[0]._id,
                stripePayoutId: stripePayout.id,
                amount: payoutAmount,
                status: payout_interface_1.PayoutStatus.PROCESSING,
            };
        }
        catch (error) {
            // Abort the transaction on error
            yield session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
    catch (error) {
        console.error('Error creating payout request:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create payout request');
    }
});
/**
 * Get payout history for a teacher
 */
const getPayoutHistory = (teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find the teacher
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
        }
        // Get all payouts for the teacher
        const payouts = yield payout_model_1.Payout.find({ teacherId: new mongoose_1.Types.ObjectId(teacherId) })
            .sort({ createdAt: -1 })
            .populate({
            path: 'transactions',
            select: 'courseId studentId totalAmount teacherEarning createdAt',
            populate: [
                {
                    path: 'courseId',
                    select: 'title courseThumbnail',
                },
                {
                    path: 'studentId',
                    select: 'name email',
                },
            ],
        });
        // Get unpaid transactions to calculate available balance
        const unpaidTransactions = yield transaction_model_1.Transaction.find({
            teacherId: new mongoose_1.Types.ObjectId(teacherId),
            status: 'success',
            stripeTransferStatus: 'completed',
            // Not included in any payout yet
            _id: {
                $nin: yield payout_model_1.Payout.distinct('transactions', {
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                }),
            },
        });
        // Calculate available balance
        const availableBalance = unpaidTransactions.reduce((sum, transaction) => sum + transaction.teacherEarning, 0);
        return {
            teacherId,
            payouts,
            availableBalance,
        };
    }
    catch (error) {
        console.error('Error getting payout history:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to get payout history');
    }
});
/**
 * Get payout details by ID
 */
const getPayoutById = (payoutId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payout = yield payout_model_1.Payout.findById(payoutId).populate({
            path: 'transactions',
            select: 'courseId studentId totalAmount teacherEarning createdAt',
            populate: [
                {
                    path: 'courseId',
                    select: 'title courseThumbnail',
                },
                {
                    path: 'studentId',
                    select: 'name email',
                },
            ],
        });
        if (!payout) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Payout not found');
        }
        return payout;
    }
    catch (error) {
        console.error('Error getting payout details:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to get payout details');
    }
});
/**
 * Create or update payout preferences for a teacher
 */
const createOrUpdatePayoutPreferences = (teacherId, preferences) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findById(teacherId);
        if (!teacher) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
        }
        const existingPreferences = yield payout_model_1.PayoutPreference.findOne({ teacherId });
        if (existingPreferences) {
            Object.assign(existingPreferences, preferences);
            yield existingPreferences.save();
            yield auditLog_service_1.AuditLogService.createAuditLog({
                action: auditLog_interface_1.AuditLogAction.USER_PROFILE_UPDATED,
                category: auditLog_interface_1.AuditLogCategory.PAYOUT,
                level: auditLog_interface_1.AuditLogLevel.INFO,
                message: 'Payout preferences updated',
                userId: teacherId,
                userType: 'teacher',
                resourceType: 'payout_preferences',
                resourceId: existingPreferences._id.toString(),
                metadata: {
                    updatedFields: Object.keys(preferences),
                    previousSchedule: existingPreferences.schedule,
                    newSchedule: preferences.schedule,
                },
            });
            return existingPreferences;
        }
        else {
            const newPreferences = new payout_model_1.PayoutPreference(Object.assign({ teacherId }, preferences));
            yield newPreferences.save();
            yield auditLog_service_1.AuditLogService.createAuditLog({
                action: auditLog_interface_1.AuditLogAction.PAYOUT_CREATED,
                category: auditLog_interface_1.AuditLogCategory.PAYOUT,
                level: auditLog_interface_1.AuditLogLevel.INFO,
                message: 'Payout preferences created',
                userId: teacherId,
                userType: 'teacher',
                resourceType: 'payout_preferences',
                resourceId: newPreferences._id.toString(),
                metadata: {
                    schedule: preferences.schedule,
                    minimumAmount: preferences.minimumAmount,
                    isAutoPayoutEnabled: preferences.isAutoPayoutEnabled,
                },
            });
            return newPreferences;
        }
    }
    catch (error) {
        console.error('Error creating/updating payout preferences:', error);
        throw error;
    }
});
/**
 * Get pending earnings for a teacher
 */
const getPendingEarnings = (teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
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
    }
    catch (error) {
        console.error('Error getting pending earnings:', error);
        throw error;
    }
});
/**
 * Get payout analytics for a teacher
 */
const getPayoutAnalytics = (teacherId, startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pipeline = [
            {
                $match: {
                    teacherId: new mongoose_1.Types.ObjectId(teacherId),
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $facet: {
                    totalStats: [
                        {
                            $group: {
                                _id: null,
                                totalPayouts: { $sum: 1 },
                                totalAmount: { $sum: '$amount' },
                                avgAmount: { $avg: '$amount' },
                                avgProcessingTime: { $avg: '$processingDuration' },
                            },
                        },
                    ],
                    statusStats: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                            },
                        },
                    ],
                    failureStats: [
                        {
                            $match: { status: payout_interface_1.PayoutStatus.FAILED },
                        },
                        {
                            $group: {
                                _id: '$failureCategory',
                                count: { $sum: 1 },
                            },
                        },
                    ],
                    dailyTrends: [
                        {
                            $group: {
                                _id: {
                                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                                },
                                count: { $sum: 1 },
                                amount: { $sum: '$amount' },
                            },
                        },
                        { $sort: { _id: 1 } },
                    ],
                },
            },
        ];
        const [result] = yield payout_model_1.Payout.aggregate(pipeline);
        const totalStats = result.totalStats[0] || {
            totalPayouts: 0,
            totalAmount: 0,
            avgAmount: 0,
            avgProcessingTime: 0,
        };
        const statusStats = {};
        result.statusStats.forEach((item) => {
            if (item._id && typeof item._id === 'string') {
                statusStats[item._id] = item.count;
            }
        });
        const failureStats = {};
        result.failureStats.forEach((item) => {
            if (item._id && typeof item._id === 'string') {
                failureStats[item._id] = item.count;
            }
        });
        const successfulPayouts = statusStats[payout_interface_1.PayoutStatus.COMPLETED] || 0;
        const successRate = totalStats.totalPayouts > 0
            ? (successfulPayouts / totalStats.totalPayouts) * 100
            : 0;
        return {
            totalPayouts: totalStats.totalPayouts,
            totalAmount: totalStats.totalAmount,
            currency: 'usd',
            averageAmount: totalStats.avgAmount,
            successRate,
            averageProcessingTime: totalStats.avgProcessingTime,
            payoutsByStatus: statusStats,
            payoutsBySchedule: {}, // Would need to be calculated separately
            failuresByCategory: failureStats,
            timeRange: { start: startDate, end: endDate },
            trends: {
                daily: result.dailyTrends.map((item) => ({
                    date: item._id,
                    count: item.count,
                    amount: item.amount,
                })),
                weekly: [], // Would need separate aggregation
                monthly: [], // Would need separate aggregation
            },
        };
    }
    catch (error) {
        console.error('Error getting payout analytics:', error);
        throw error;
    }
});
exports.PayoutService = {
    createPayoutRequest,
    getPayoutHistory,
    getPayoutById,
    createOrUpdatePayoutPreferences,
    getPendingEarnings,
    getPayoutAnalytics,
};
