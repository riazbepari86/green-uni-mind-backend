import { z } from 'zod';

const createCategoryValidationSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Name is required!' })
      .min(2, { message: 'Name must be at least 2 characters long!' }),
  }),
});

export const CategoryValidation = {
  createCategoryValidationSchema,
};
