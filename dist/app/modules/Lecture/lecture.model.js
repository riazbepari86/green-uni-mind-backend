"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lecture = void 0;
const mongoose_1 = require("mongoose");
// Schema for video resolutions
const videoResolutionSchema = new mongoose_1.Schema({
    url: {
        type: String,
        required: true,
    },
    quality: {
        type: String,
        required: true,
    },
    format: {
        type: String,
    },
}, { _id: false });
const lectureSchema = new mongoose_1.Schema({
    lectureTitle: {
        type: String,
    },
    instruction: {
        type: String,
    },
    videoUrl: {
        type: String,
    },
    videoResolutions: {
        type: [videoResolutionSchema],
        default: [],
    },
    hlsUrl: {
        type: String,
    },
    pdfUrl: {
        type: String,
    },
    duration: {
        type: Number,
    },
    isPreviewFree: {
        type: Boolean,
        default: false,
    },
    courseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    order: {
        type: Number,
        required: true
    }
}, { timestamps: true });
exports.Lecture = (0, mongoose_1.model)('Lecture', lectureSchema);
