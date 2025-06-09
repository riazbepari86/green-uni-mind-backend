"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transaction = void 0;
const mongoose_1 = require("mongoose");
const transactionSchema = new mongoose_1.Schema({
    courseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    studentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
    },
    teacherId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true,
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    teacherEarning: {
        type: Number,
        required: true,
    },
    platformEarning: {
        type: Number,
        required: true,
    },
    stripeInvoiceUrl: {
        type: String,
        required: false,
    },
    stripePdfUrl: {
        type: String,
        required: false,
    },
    stripeTransactionId: {
        type: String,
        required: true,
    },
    stripeTransferStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    stripeTransferId: {
        type: String,
        required: false,
    },
    status: {
        type: String,
        enum: ['success', 'failed', 'pending', 'completed'],
        default: 'pending',
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
exports.Transaction = (0, mongoose_1.model)('Transaction', transactionSchema);
