"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentValidations = exports.updateStudentValidationSchema = exports.createStudentValidationSchema = void 0;
const zod_1 = require("zod");
const createUserNameValidationSchema = zod_1.z.object({
    firstName: zod_1.z
        .string()
        .min(1)
        .max(20)
        .refine((value) => /^[A-Z]/.test(value), {
        message: 'First Name must start with a capital letter',
    }),
    middleName: zod_1.z.string().optional(),
    lastName: zod_1.z.string(),
});
exports.createStudentValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string().max(20).optional(),
        student: zod_1.z.object({
            name: createUserNameValidationSchema,
            gender: zod_1.z.enum(['male', 'female', 'other']),
            email: zod_1.z.string().email(),
        }),
    }),
});
const updateUserNameValidationSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).max(20).optional(),
    middleName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
});
exports.updateStudentValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string().max(20).optional(),
        student: zod_1.z.object({
            name: updateUserNameValidationSchema.optional(),
            gender: zod_1.z.enum(['male', 'female', 'other']).optional(),
            email: zod_1.z.string().email().optional(),
        }),
    }),
});
exports.studentValidations = {
    createStudentValidationSchema: exports.createStudentValidationSchema,
    updateStudentValidationSchema: exports.updateStudentValidationSchema,
};
