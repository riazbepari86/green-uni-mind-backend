"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentValidations = exports.updateTeacherValidationSchema = exports.createTeacherValidationSchema = void 0;
const zod_1 = require("zod");
const createTeacherNameValidationSchema = zod_1.z.object({
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
exports.createTeacherValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string().max(20).optional(),
        teacher: zod_1.z.object({
            name: createTeacherNameValidationSchema,
            gender: zod_1.z.enum(['male', 'female', 'other']),
            email: zod_1.z.string().email(),
        }),
    }),
});
const updateTeacherNameValidationSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).max(20).optional(),
    middleName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
});
exports.updateTeacherValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string().max(20).optional(),
        teacher: zod_1.z.object({
            name: updateTeacherNameValidationSchema.optional(),
            gender: zod_1.z.enum(['male', 'female', 'other']).optional(),
            email: zod_1.z.string().email().optional(),
        }),
    }),
});
exports.studentValidations = {
    createTeacherValidationSchema: exports.createTeacherValidationSchema,
    updateTeacherValidationSchema: exports.updateTeacherValidationSchema,
};
