"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutSummary = void 0;
const mongoose_1 = require("mongoose");
const payoutSummarySchema = new mongoose_1.Schema({
    teacherId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true,
    },
    totalEarned: {
        type: Number,
        required: true,
        default: 0,
    },
    month: {
        type: String,
        required: true,
    },
    year: {
        type: Number,
        required: true,
    },
    transactions: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Transaction',
        },
    ],
    coursesSold: [
        {
            courseId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'Course',
            },
            count: {
                type: Number,
                default: 1,
            },
            earnings: {
                type: Number,
                default: 0,
            },
        },
    ],
}, {
    timestamps: true,
});
exports.PayoutSummary = (0, mongoose_1.model)('PayoutSummary', payoutSummarySchema);
