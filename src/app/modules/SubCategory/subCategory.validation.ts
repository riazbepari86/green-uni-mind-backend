import { z } from 'zod';

const subCategoryValidationSchema = z.object({
  body: z.object({
    categoryId: z.string().optional(),
    name: z
      .string({ required_error: 'Name is required!' })
      .min(2, 'Name must be at least 2 characters long!'),
  }),
});

export const SubCategoryValidation = {
  subCategoryValidationSchema,
};
