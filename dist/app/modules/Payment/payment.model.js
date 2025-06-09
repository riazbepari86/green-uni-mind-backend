"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = void 0;
const mongoose_1 = require("mongoose");
const paymentSchema = new mongoose_1.Schema({
    studentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
    },
    courseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    teacherId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    teacherShare: {
        type: Number,
        required: true,
    },
    platformShare: {
        type: Number,
        required: true,
    },
    stripeAccountId: {
        type: String,
        required: true,
    },
    stripePaymentId: {
        type: String,
        default: null,
    },
    stripeEmail: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['success', 'failed', 'pending', 'completed'],
        default: 'pending',
    },
    receiptUrl: {
        type: String,
        required: false,
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
exports.Payment = (0, mongoose_1.model)('Payment', paymentSchema);
