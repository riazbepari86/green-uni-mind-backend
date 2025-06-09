"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Note = void 0;
const mongoose_1 = require("mongoose");
const noteSchema = new mongoose_1.Schema({
    content: {
        type: String,
        required: [true, 'Note content is required'],
        trim: true,
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
    isRichText: {
        type: Boolean,
        default: false,
    },
    tags: [{
            type: String,
            trim: true,
        }],
}, { timestamps: true });
// Create a compound index to ensure a student can only have one note per lecture
noteSchema.index({ studentId: 1, lectureId: 1 }, { unique: true });
exports.Note = (0, mongoose_1.model)('Note', noteSchema);
