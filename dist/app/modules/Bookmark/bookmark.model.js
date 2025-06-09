"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bookmark = void 0;
const mongoose_1 = require("mongoose");
const bookmarkSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, 'Bookmark title is required'],
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
    isShared: {
        type: Boolean,
        default: false,
    },
    sharedWith: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Student',
        }],
    category: {
        type: String,
        trim: true,
    },
    tags: [{
            type: String,
            trim: true,
        }],
    notes: {
        type: String,
        trim: true,
    },
}, { timestamps: true });
// Create a compound index to ensure a student can't create duplicate bookmarks at the same timestamp
bookmarkSchema.index({ studentId: 1, lectureId: 1, timestamp: 1 }, { unique: true });
exports.Bookmark = (0, mongoose_1.model)('Bookmark', bookmarkSchema);
