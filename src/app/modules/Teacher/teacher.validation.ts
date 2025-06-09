import { z } from 'zod';

const createTeacherNameValidationSchema = z.object({
  firstName: z
    .string()
    .min(1)
    .max(20)
    .refine((value) => /^[A-Z]/.test(value), {
      message: 'First Name must start with a capital letter',
    }),
  middleName: z.string().optional(),
  lastName: z.string(),
});

export const createTeacherValidationSchema = z.object({
  body: z.object({
    password: z.string().max(20).optional(),
    teacher: z.object({
      name: createTeacherNameValidationSchema,
      gender: z.enum(['male', 'female', 'other']),
      email: z.string().email(),
    }),
  }),
});


const updateTeacherNameValidationSchema = z.object({
  firstName: z.string().min(1).max(20).optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
});

export const updateTeacherValidationSchema = z.object({
  body: z.object({
    password: z.string().max(20).optional(),
    teacher: z.object({
      name: updateTeacherNameValidationSchema.optional(),
      gender: z.enum(['male', 'female', 'other']).optional(),
      email: z.string().email().optional(),
    }),
  }),
});

export const studentValidations = {
  createTeacherValidationSchema,
  updateTeacherValidationSchema,
};
