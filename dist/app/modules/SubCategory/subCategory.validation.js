"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubCategoryValidation = void 0;
const zod_1 = require("zod");
const subCategoryValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        categoryId: zod_1.z.string().optional(),
        name: zod_1.z
            .string({ required_error: 'Name is required!' })
            .min(2, 'Name must be at least 2 characters long!'),
    }),
});
exports.SubCategoryValidation = {
    subCategoryValidationSchema,
};
