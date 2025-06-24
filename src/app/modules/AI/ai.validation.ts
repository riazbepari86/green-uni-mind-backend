import { z } from 'zod';

const enhanceTitleValidationSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Title is required!' })
      .min(3, 'Title must be at least 3 characters long!')
      .max(200, 'Title must not exceed 200 characters!'),
  }),
});

const enhanceSubtitleValidationSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Title is required!' })
      .min(3, 'Title must be at least 3 characters long!')
      .max(200, 'Title must not exceed 200 characters!'),
    subtitle: z
      .string()
      .max(300, 'Subtitle must not exceed 300 characters!')
      .optional(),
  }),
});

const enhanceDescriptionValidationSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Title is required!' })
      .min(3, 'Title must be at least 3 characters long!')
      .max(200, 'Title must not exceed 200 characters!'),
    subtitle: z
      .string()
      .max(300, 'Subtitle must not exceed 300 characters!')
      .optional(),
    description: z
      .string()
      .max(5000, 'Description must not exceed 5000 characters!')
      .optional(),
  }),
});

const suggestCategoryValidationSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Title is required!' })
      .min(3, 'Title must be at least 3 characters long!')
      .max(200, 'Title must not exceed 200 characters!'),
    description: z
      .string()
      .max(5000, 'Description must not exceed 5000 characters!')
      .optional(),
  }),
});

const generateCourseOutlineValidationSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Title is required!' })
      .min(3, 'Title must be at least 3 characters long!')
      .max(200, 'Title must not exceed 200 characters!'),
    description: z
      .string()
      .max(5000, 'Description must not exceed 5000 characters!')
      .optional(),
    level: z
      .string()
      .optional(),
  }),
});

export const AIValidation = {
  enhanceTitleValidationSchema,
  enhanceSubtitleValidationSchema,
  enhanceDescriptionValidationSchema,
  suggestCategoryValidationSchema,
  generateCourseOutlineValidationSchema,
};
