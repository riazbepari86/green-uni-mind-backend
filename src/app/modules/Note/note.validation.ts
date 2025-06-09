import { z } from 'zod';

const createOrUpdateNoteZodSchema = z.object({
  body: z.object({
    content: z.string({
      required_error: 'Note content is required',
    }),
    lectureId: z.string({
      required_error: 'Lecture ID is required',
    }),
    isShared: z.boolean().optional(),
    isRichText: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const shareNoteZodSchema = z.object({
  body: z.object({
    studentIds: z.array(z.string(), {
      required_error: 'Student IDs are required',
    }),
  }),
});

export const NoteValidation = {
  createOrUpdateNoteZodSchema,
  shareNoteZodSchema,
};
