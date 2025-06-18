"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubCategoryValidation = void 0;
const zod_1 = require("zod");
const subCategoryValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        categoryId: zod_1.z
            .string({ required_error: 'Category ID is required!' }),
        name: zod_1.z
            .string({ required_error: 'Name is required!' })
            .min(2, 'Name must be at least 2 characters long!'),
        slug: zod_1.z
            .string()
            .optional(),
        description: zod_1.z
            .string()
            .optional(),
        isActive: zod_1.z
            .boolean()
            .optional(),
    }),
});
const updateSubCategoryValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        categoryId: zod_1.z
            .string()
            .optional(),
        name: zod_1.z
            .string()
            .min(2, 'Name must be at least 2 characters long!')
            .optional(),
        slug: zod_1.z
            .string()
            .optional(),
        description: zod_1.z
            .string()
            .optional(),
        isActive: zod_1.z
            .boolean()
            .optional(),
    }),
});
exports.SubCategoryValidation = {
    subCategoryValidationSchema,
    updateSubCategoryValidationSchema,
};
