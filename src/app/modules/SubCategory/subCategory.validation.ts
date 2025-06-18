import { z } from 'zod';

const subCategoryValidationSchema = z.object({
  body: z.object({
    categoryId: z
      .string({ required_error: 'Category ID is required!' }),
    name: z
      .string({ required_error: 'Name is required!' })
      .min(2, 'Name must be at least 2 characters long!'),
    slug: z
      .string()
      .optional(),
    description: z
      .string()
      .optional(),
    isActive: z
      .boolean()
      .optional(),
  }),
});

const updateSubCategoryValidationSchema = z.object({
  body: z.object({
    categoryId: z
      .string()
      .optional(),
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters long!')
      .optional(),
    slug: z
      .string()
      .optional(),
    description: z
      .string()
      .optional(),
    isActive: z
      .boolean()
      .optional(),
  }),
});

export const SubCategoryValidation = {
  subCategoryValidationSchema,
  updateSubCategoryValidationSchema,
};
