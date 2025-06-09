import { z } from 'zod';

const loginValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required.' }).email(),
    password: z.string({ required_error: 'Password is required' }),
  }),
});

const changePasswordValidationSchema = z.object({
  body: z.object({
    oldPassword: z.string({
      required_error: 'Old password is required',
    }),
    newPassword: z.string({ required_error: 'Password is required' }),
  }),
});

// More flexible refresh token validation that can accept token from multiple sources
const refreshTokenValidationSchema = z.object({
  cookies: z.object({
    refreshToken: z.string().optional(),
  }).optional(),
  body: z.object({
    refreshToken: z.string().optional(),
  }).optional(),
  headers: z.object({
    'x-refresh-token': z.string().optional(),
    'authorization': z.string().optional(),
  }).optional(),
});

const forgetPasswordValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required.' }).email(),
  }),
});

const resetpasswordValidationSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email is required.' }).email(),
    newPassword: z.string({
      required_error: 'New password is required!',
    }),
  }),
});

// Email verification validation schemas
const verifyEmailValidationSchema = z.object({
  body: z.object({
    code: z
      .string({ required_error: 'Verification code is required' })
      .length(6, { message: 'Verification code must be 6 digits' })
      .regex(/^\d+$/, { message: 'Verification code must contain only digits' }),
  }),
});

const resendVerificationEmailValidationSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email({ message: 'Invalid email format' }),
  }),
});

export const AuthValidation = {
  loginValidationSchema,
  changePasswordValidationSchema,
  refreshTokenValidationSchema,
  forgetPasswordValidationSchema,
  resetpasswordValidationSchema,
  verifyEmailValidationSchema,
  resendVerificationEmailValidationSchema,
};
