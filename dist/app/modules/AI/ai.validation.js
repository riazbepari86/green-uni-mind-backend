"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIValidation = void 0;
const zod_1 = require("zod");
const enhanceTitleValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z
            .string({ required_error: 'Title is required!' })
            .min(3, 'Title must be at least 3 characters long!')
            .max(200, 'Title must not exceed 200 characters!'),
    }),
});
const enhanceSubtitleValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z
            .string({ required_error: 'Title is required!' })
            .min(3, 'Title must be at least 3 characters long!')
            .max(200, 'Title must not exceed 200 characters!'),
        subtitle: zod_1.z
            .string()
            .max(300, 'Subtitle must not exceed 300 characters!')
            .optional(),
    }),
});
const enhanceDescriptionValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z
            .string({ required_error: 'Title is required!' })
            .min(3, 'Title must be at least 3 characters long!')
            .max(200, 'Title must not exceed 200 characters!'),
        subtitle: zod_1.z
            .string()
            .max(300, 'Subtitle must not exceed 300 characters!')
            .optional(),
        description: zod_1.z
            .string()
            .max(5000, 'Description must not exceed 5000 characters!')
            .optional(),
    }),
});
const suggestCategoryValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z
            .string({ required_error: 'Title is required!' })
            .min(3, 'Title must be at least 3 characters long!')
            .max(200, 'Title must not exceed 200 characters!'),
        description: zod_1.z
            .string()
            .max(5000, 'Description must not exceed 5000 characters!')
            .optional(),
    }),
});
const generateCourseOutlineValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z
            .string({ required_error: 'Title is required!' })
            .min(3, 'Title must be at least 3 characters long!')
            .max(200, 'Title must not exceed 200 characters!'),
        description: zod_1.z
            .string()
            .max(5000, 'Description must not exceed 5000 characters!')
            .optional(),
        level: zod_1.z
            .string()
            .optional(),
    }),
});
exports.AIValidation = {
    enhanceTitleValidationSchema,
    enhanceSubtitleValidationSchema,
    enhanceDescriptionValidationSchema,
    suggestCategoryValidationSchema,
    generateCourseOutlineValidationSchema,
};
