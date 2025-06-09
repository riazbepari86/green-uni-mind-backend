"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthValidation = void 0;
const zod_1 = require("zod");
const loginValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required.' }).email(),
        password: zod_1.z.string({ required_error: 'Password is required' }),
    }),
});
const changePasswordValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        oldPassword: zod_1.z.string({
            required_error: 'Old password is required',
        }),
        newPassword: zod_1.z.string({ required_error: 'Password is required' }),
    }),
});
// More flexible refresh token validation that can accept token from multiple sources
const refreshTokenValidationSchema = zod_1.z.object({
    cookies: zod_1.z.object({
        refreshToken: zod_1.z.string().optional(),
    }).optional(),
    body: zod_1.z.object({
        refreshToken: zod_1.z.string().optional(),
    }).optional(),
    headers: zod_1.z.object({
        'x-refresh-token': zod_1.z.string().optional(),
        'authorization': zod_1.z.string().optional(),
    }).optional(),
});
const forgetPasswordValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required.' }).email(),
    }),
});
const resetpasswordValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required.' }).email(),
        newPassword: zod_1.z.string({
            required_error: 'New password is required!',
        }),
    }),
});
// Email verification validation schemas
const verifyEmailValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z
            .string({ required_error: 'Verification code is required' })
            .length(6, { message: 'Verification code must be 6 digits' })
            .regex(/^\d+$/, { message: 'Verification code must contain only digits' }),
    }),
});
const resendVerificationEmailValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z
            .string({ required_error: 'Email is required' })
            .email({ message: 'Invalid email format' }),
    }),
});
exports.AuthValidation = {
    loginValidationSchema,
    changePasswordValidationSchema,
    refreshTokenValidationSchema,
    forgetPasswordValidationSchema,
    resetpasswordValidationSchema,
    verifyEmailValidationSchema,
    resendVerificationEmailValidationSchema,
};
