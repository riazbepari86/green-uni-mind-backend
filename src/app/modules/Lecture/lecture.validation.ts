import { z } from 'zod';

// Schema for video resolution
const videoResolutionSchema = z.object({
  url: z
    .string({
      required_error: 'Video URL is required',
    })
    .url('Invalid video URL format'),
  quality: z
    .string({
      required_error: 'Video quality is required',
    })
    .min(1, 'Video quality cannot be empty'),
  format: z.string().optional(),
});

const createLectureZodSchema = z.object({
  body: z.object({
    lectureTitle: z
      .string({
        required_error: 'Lecture title is required',
      })
      .min(3, 'Lecture title must be at least 3 characters')
      .max(200, 'Lecture title must not exceed 200 characters'),
    instruction: z
      .string()
      .max(5000, 'Instruction must not exceed 5000 characters')
      .optional(),
    videoUrl: z
      .string()
      .url('Invalid video URL format')
      .optional(),
    videoResolutions: z.array(videoResolutionSchema).optional(),
    hlsUrl: z
      .string()
      .url('Invalid HLS URL format')
      .optional(),
    pdfUrl: z
      .string()
      .url('Invalid PDF URL format')
      .optional(),
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

const deleteLectureZodSchema = z.object({
  params: z.object({
    courseId: z.string().min(1, 'Course ID is required'),
    lectureId: z.string().min(1, 'Lecture ID is required'),
  }),
});

export const LectureValidation = {
  createLectureZodSchema,
  updateLectureOrderZodSchema,
  updateLectureZodSchema,
  deleteLectureZodSchema,
};
