"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryValidation = void 0;
const zod_1 = require("zod");
const createCategoryValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string({ required_error: 'Name is required!' })
            .min(2, { message: 'Name must be at least 2 characters long!' }),
        slug: zod_1.z
            .string()
            .optional(),
        description: zod_1.z
            .string()
            .optional(),
        icon: zod_1.z
            .string()
            .optional(),
        isActive: zod_1.z
            .boolean()
            .optional(),
    }),
});
const updateCategoryValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(2, { message: 'Name must be at least 2 characters long!' })
            .optional(),
        slug: zod_1.z
            .string()
            .optional(),
        description: zod_1.z
            .string()
            .optional(),
        icon: zod_1.z
            .string()
            .optional(),
        isActive: zod_1.z
            .boolean()
            .optional(),
    }),
});
exports.CategoryValidation = {
    createCategoryValidationSchema,
    updateCategoryValidationSchema,
};
