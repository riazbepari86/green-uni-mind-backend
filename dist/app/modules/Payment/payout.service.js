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
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const stripe_1 = require("../../utils/stripe");
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
exports.PayoutService = {
    createPayoutRequest,
    getPayoutHistory,
    getPayoutById,
};
