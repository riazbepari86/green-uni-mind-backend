import { z } from 'zod';

// Schema for video resolution
const videoResolutionSchema = z.object({
  url: z.string(),
  quality: z.string(),
  format: z.string().optional(),
});

const createLectureZodSchema = z.object({
  body: z.object({
    lectureTitle: z.string(),
    instruction: z.string().optional(),
    videoUrl: z.string().optional(),
    videoResolutions: z.array(videoResolutionSchema).optional(),
    hlsUrl: z.string().optional(),
    pdfUrl: z.string().optional(),
    isPreviewFree: z.boolean().default(false).optional(),
  }),
});

const updateLectureOrderZodSchema = z.object({
  body: z.object({
    lectures: z
      .array(
        z.object({
          lectureId: z.string(),
          order: z.number().min(1),
        }),
      )
      .min(1),
  }),
});
const updateLectureZodSchema = z.object({
  body: z.object({
    lectureTitle: z
      .string()
      .min(5, 'Title must be at least 5 characters')
      .optional(),
    instruction: z.string().optional(),
    videoUrl: z.string().optional(),
    videoResolutions: z.array(videoResolutionSchema).optional(),
    hlsUrl: z.string().optional(),
    pdfUrl: z.string().optional(),
    isPreviewFree: z.boolean().optional(),
  }),
});

export const LectureValidation = {
  createLectureZodSchema,
  updateLectureOrderZodSchema,
  updateLectureZodSchema,
};
