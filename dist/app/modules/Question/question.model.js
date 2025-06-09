"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Question = void 0;
const mongoose_1 = require("mongoose");
const questionSchema = new mongoose_1.Schema({
    question: {
        type: String,
        required: [true, 'Question text is required'],
        trim: true,
    },
    timestamp: {
        type: Number,
        required: [true, 'Timestamp is required'],
    },
    lectureId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Lecture',
        required: [true, 'Lecture ID is required'],
    },
    studentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Student',
        required: [true, 'Student ID is required'],
    },
    answered: {
        type: Boolean,
        default: false,
    },
    answer: {
        type: String,
        trim: true,
    },
    answeredBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Teacher',
    },
    answeredAt: {
        type: Date,
    },
}, { timestamps: true });
exports.Question = (0, mongoose_1.model)('Question', questionSchema);
