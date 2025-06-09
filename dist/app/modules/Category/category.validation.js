"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryValidation = void 0;
const zod_1 = require("zod");
const createCategoryValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string({ required_error: 'Name is required!' })
            .min(2, { message: 'Name must be at least 2 characters long!' }),
    }),
});
exports.CategoryValidation = {
    createCategoryValidationSchema,
};
