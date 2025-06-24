"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourseValidation = void 0;
const zod_1 = require("zod");
const course_constant_1 = require("./course.constant");
const createCourseZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z
            .string({
            required_error: 'Title is required',
        })
            .min(1, { message: 'Title cannot be empty' }),
        subtitle: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        categoryId: zod_1.z
            .string({
            required_error: 'Category ID is required',
        })
            .min(1, { message: 'Category ID cannot be empty' }),
        subcategoryId: zod_1.z
            .string({
            required_error: 'Subcategory ID is required',
        })
            .min(1, { message: 'Subcategory ID cannot be empty' }),
        courseLevel: zod_1.z.enum(course_constant_1.courseLevel, {
            required_error: 'Course level is required',
        }),
        enrolledStudents: zod_1.z.array(zod_1.z.string()).optional(),
        lectures: zod_1.z.array(zod_1.z.string()).optional(),
        creator: zod_1.z
            .string({
            required_error: 'Creator ID is required',
        })
            .optional(),
        isPublished: zod_1.z.union([
            zod_1.z.boolean(),
            zod_1.z.string().transform((val) => val === 'true')
        ]).default(true),
        status: zod_1.z.enum(course_constant_1.courseStatus, {
            required_error: 'Status is required',
        }),
        isFree: zod_1.z.enum(course_constant_1.courseIsFree).optional(),
        courseThumbnail: zod_1.z.string().optional(),
        courseThumbnailPublicId: zod_1.z.string().optional(),
        learningObjectives: zod_1.z.array(zod_1.z.string()).optional(),
        prerequisites: zod_1.z.string().optional(),
        targetAudience: zod_1.z.string().optional(),
        estimatedDuration: zod_1.z.string().optional(),
        language: zod_1.z.string().optional(),
        hasSubtitles: zod_1.z.boolean().optional(),
        hasCertificate: zod_1.z.boolean().optional(),
    }),
});
const updateCourseZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, { message: 'Title cannot be empty' }).optional(),
        subtitle: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        categoryId: zod_1.z.string().optional(),
        subcategoryId: zod_1.z.string().optional(),
        courseLevel: zod_1.z.enum(course_constant_1.courseLevel).optional(),
        courseThumbnail: zod_1.z.string().optional(),
        courseThumbnailPublicId: zod_1.z.string().optional(),
        enrolledStudents: zod_1.z.array(zod_1.z.string()).optional(),
        lectures: zod_1.z.array(zod_1.z.string()).optional(),
        creator: zod_1.z.string().optional(),
        isPublished: zod_1.z.union([
            zod_1.z.boolean(),
            zod_1.z.string().transform((val) => val === 'true')
        ]).optional(),
        status: zod_1.z.enum(course_constant_1.courseStatus).optional(),
        isFree: zod_1.z.enum(course_constant_1.courseIsFree).optional(),
        learningObjectives: zod_1.z.array(zod_1.z.string()).optional(),
        prerequisites: zod_1.z.string().optional(),
        targetAudience: zod_1.z.string().optional(),
        estimatedDuration: zod_1.z.string().optional(),
        language: zod_1.z.string().optional(),
        hasSubtitles: zod_1.z.boolean().optional(),
        hasCertificate: zod_1.z.boolean().optional(),
    }),
});
// We can reuse the updateCourseZodSchema for editCourse since they have the same validation requirements
const editCourseZodSchema = updateCourseZodSchema;
// For delete, we don't need any body validation, just the ID from params
const deleteCourseZodSchema = zod_1.z.object({});
exports.CourseValidation = {
    createCourseZodSchema,
    updateCourseZodSchema,
    editCourseZodSchema,
    deleteCourseZodSchema,
};
