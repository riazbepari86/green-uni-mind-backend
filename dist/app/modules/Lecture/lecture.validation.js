"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LectureValidation = void 0;
const zod_1 = require("zod");
// Schema for video resolution
const videoResolutionSchema = zod_1.z.object({
    url: zod_1.z.string(),
    quality: zod_1.z.string(),
    format: zod_1.z.string().optional(),
});
const createLectureZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        lectureTitle: zod_1.z.string(),
        instruction: zod_1.z.string().optional(),
        videoUrl: zod_1.z.string().optional(),
        videoResolutions: zod_1.z.array(videoResolutionSchema).optional(),
        hlsUrl: zod_1.z.string().optional(),
        pdfUrl: zod_1.z.string().optional(),
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
exports.LectureValidation = {
    createLectureZodSchema,
    updateLectureOrderZodSchema,
    updateLectureZodSchema,
};
