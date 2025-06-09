"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutPreference = exports.Payout = void 0;
const mongoose_1 = require("mongoose");
const payout_interface_1 = require("./payout.interface");
const payoutSchema = new mongoose_1.Schema({
    teacherId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'usd',
    },
    status: {
        type: String,
        enum: Object.values(payout_interface_1.PayoutStatus),
        default: payout_interface_1.PayoutStatus.PENDING,
    },
    stripePayoutId: {
        type: String,
    },
    stripeTransferId: {
        type: String,
    },
    transactions: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Transaction',
        },
    ],
    description: {
        type: String,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    scheduledAt: {
        type: Date,
    },
    processedAt: {
        type: Date,
    },
    failureReason: {
        type: String,
    },
    notificationSent: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
    toObject: {
        virtuals: true,
    },
});
const payoutPreferenceSchema = new mongoose_1.Schema({
    teacherId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true,
        unique: true,
    },
    schedule: {
        type: String,
        enum: Object.values(payout_interface_1.PayoutSchedule),
        default: payout_interface_1.PayoutSchedule.MONTHLY,
    },
    minimumAmount: {
        type: Number,
        default: 50, // Default minimum payout amount in USD
    },
    isAutoPayoutEnabled: {
        type: Boolean,
        default: true,
    },
    lastPayoutDate: {
        type: Date,
    },
    nextScheduledPayoutDate: {
        type: Date,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
    toObject: {
        virtuals: true,
    },
});
exports.Payout = (0, mongoose_1.model)('Payout', payoutSchema);
exports.PayoutPreference = (0, mongoose_1.model)('PayoutPreference', payoutPreferenceSchema);
