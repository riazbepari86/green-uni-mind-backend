"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserValidation = void 0;
const zod_1 = require("zod");
const registerUserValidationSchema = zod_1.z.object({
    password: zod_1.z
        .string({
        invalid_type_error: 'Password must be a valid string.',
    })
        .min(8, { message: 'Password must be at least 8 characters long.' })
        .max(20, { message: 'Password must not exceed 20 characters.' })
        .regex(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&^_\-])[A-Za-z\d@$!%*#?&^_\-]+$/, {
        message: 'Password must include at least one letter, one number, and one special character.',
    })
        .optional(),
});
const editProfileValidationSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
});
exports.UserValidation = {
    registerUserValidationSchema,
    editProfileValidationSchema,
};
