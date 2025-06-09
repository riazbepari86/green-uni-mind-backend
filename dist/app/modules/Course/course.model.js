"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Course = void 0;
const mongoose_1 = require("mongoose");
const course_constant_1 = require("./course.constant");
const courseSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, 'Course title is required'],
        trim: true,
    },
    subtitle: {
        type: String,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    category: {
        type: String,
        enum: {
            values: course_constant_1.courseCategories,
            message: 'Invalid course category',
        },
        required: [true, 'Course category is required'],
    },
    courseLevel: {
        type: String,
        enum: {
            values: course_constant_1.courseLevel,
            message: 'Invalid course level',
        },
        required: [true, 'Course level is required'],
    },
    coursePrice: {
        type: Number,
        min: [0, 'Course price cannot be negative'],
    },
    courseThumbnail: {
        type: String,
        trim: true,
    },
    courseThumbnailPublicId: {
        type: String,
    },
    enrolledStudents: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Student',
        },
    ],
    totalEnrollment: {
        type: Number,
        default: 0,
    },
    lectures: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Lecture',
        },
    ],
    creator: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: [true, 'Course creator (teacher) is required'],
    },
    isPublished: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: {
            values: course_constant_1.courseStatus,
            message: 'Invalid course status',
        },
        required: [true, 'Course status is required'],
    },
    isFree: {
        type: String,
        enum: {
            values: course_constant_1.courseIsFree,
            message: 'Invalid course Is Free',
        },
    },
}, { timestamps: true });
// Optionally create an index for better searching
courseSchema.index({ title: 'text', category: 'text' });
exports.Course = (0, mongoose_1.model)('Course', courseSchema);
