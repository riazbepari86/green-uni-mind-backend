import { z } from 'zod';

const registerUserValidationSchema = z.object({
  password: z
    .string({
      invalid_type_error: 'Password must be a valid string.',
    })
    .min(8, { message: 'Password must be at least 8 characters long.' })
    .max(20, { message: 'Password must not exceed 20 characters.' })
    .regex(
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&^_\-])[A-Za-z\d@$!%*#?&^_\-]+$/,
      {
        message:
          'Password must include at least one letter, one number, and one special character.',
      },
    )
    .optional(),
});

const editProfileValidationSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
});

export const UserValidation = {
  registerUserValidationSchema,
  editProfileValidationSchema,
};
