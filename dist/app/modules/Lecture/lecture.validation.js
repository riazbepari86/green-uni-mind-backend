"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LectureValidation = void 0;
const zod_1 = require("zod");
// Schema for video resolution
const videoResolutionSchema = zod_1.z.object({
    url: zod_1.z
        .string({
        required_error: 'Video URL is required',
    })
        .url('Invalid video URL format'),
    quality: zod_1.z
        .string({
        required_error: 'Video quality is required',
    })
        .min(1, 'Video quality cannot be empty'),
    format: zod_1.z.string().optional(),
});
const createLectureZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        lectureTitle: zod_1.z
            .string({
            required_error: 'Lecture title is required',
        })
            .min(3, 'Lecture title must be at least 3 characters')
            .max(200, 'Lecture title must not exceed 200 characters'),
        instruction: zod_1.z
            .string()
            .max(5000, 'Instruction must not exceed 5000 characters')
            .optional(),
        videoUrl: zod_1.z
            .string()
            .url('Invalid video URL format')
            .optional(),
        videoResolutions: zod_1.z.array(videoResolutionSchema).optional(),
        hlsUrl: zod_1.z
            .string()
            .url('Invalid HLS URL format')
            .optional(),
        pdfUrl: zod_1.z
            .string()
            .url('Invalid PDF URL format')
            .optional(),
        isPreviewFree: zod_1.z.boolean().default(false).optional(),
    }),
});
const updateLectureOrderZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        lectures: zod_1.z
            .array(zod_1.z.object({
            lectureId: zod_1.z.string(),
            order: zod_1.z.number().min(1),
        }))
            .min(1),
    }),
});
const updateLectureZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        lectureTitle: zod_1.z
            .string()
            .min(5, 'Title must be at least 5 characters')
            .optional(),
        instruction: zod_1.z.string().optional(),
        videoUrl: zod_1.z.string().optional(),
        videoResolutions: zod_1.z.array(videoResolutionSchema).optional(),
        hlsUrl: zod_1.z.string().optional(),
        pdfUrl: zod_1.z.string().optional(),
        isPreviewFree: zod_1.z.boolean().optional(),
    }),
});
const deleteLectureZodSchema = zod_1.z.object({
    params: zod_1.z.object({
        courseId: zod_1.z.string().min(1, 'Course ID is required'),
        lectureId: zod_1.z.string().min(1, 'Lecture ID is required'),
    }),
});
exports.LectureValidation = {
    createLectureZodSchema,
    updateLectureOrderZodSchema,
    updateLectureZodSchema,
    deleteLectureZodSchema,
};
