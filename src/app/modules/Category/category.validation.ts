import { z } from 'zod';

const createCategoryValidationSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Name is required!' })
      .min(2, { message: 'Name must be at least 2 characters long!' }),
    slug: z
      .string()
      .optional(),
    description: z
      .string()
      .optional(),
    icon: z
      .string()
      .optional(),
    isActive: z
      .boolean()
      .optional(),
  }),
});

const updateCategoryValidationSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, { message: 'Name must be at least 2 characters long!' })
      .optional(),
    slug: z
      .string()
      .optional(),
    description: z
      .string()
      .optional(),
    icon: z
      .string()
      .optional(),
    isActive: z
      .boolean()
      .optional(),
  }),
});

export const CategoryValidation = {
  createCategoryValidationSchema,
  updateCategoryValidationSchema,
};
