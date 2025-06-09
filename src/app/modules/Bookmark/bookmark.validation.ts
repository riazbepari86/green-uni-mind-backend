import { z } from 'zod';

const createBookmarkZodSchema = z.object({
  body: z.object({
    title: z.string({
      required_error: 'Title is required',
    }),
    timestamp: z.number({
      required_error: 'Timestamp is required',
    }),
    lectureId: z.string({
      required_error: 'Lecture ID is required',
    }),
    isShared: z.boolean().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }),
});

const updateBookmarkZodSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    timestamp: z.number().optional(),
    isShared: z.boolean().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }),
});

const shareBookmarkZodSchema = z.object({
  body: z.object({
    studentIds: z.array(z.string(), {
      required_error: 'Student IDs are required',
    }),
  }),
});

const getBookmarksByTagsZodSchema = z.object({
  body: z.object({
    tags: z.array(z.string(), {
      required_error: 'Tags are required',
    }),
  }),
});

export const BookmarkValidation = {
  createBookmarkZodSchema,
  updateBookmarkZodSchema,
  shareBookmarkZodSchema,
  getBookmarksByTagsZodSchema,
};
