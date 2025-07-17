import { z } from 'zod';
import {
  courseIsFree,
  courseLevel,
  courseStatus,
} from './course.constant';

const createCourseZodSchema = z.object({
  body: z.object({
    title: z
      .string({
        required_error: 'Title is required',
      })
      .min(3, { message: 'Title must be at least 3 characters' })
      .max(200, { message: 'Title must not exceed 200 characters' }),

    subtitle: z
      .string()
      .max(300, { message: 'Subtitle must not exceed 300 characters' })
      .optional(),
    description: z
      .string()
      .max(5000, { message: 'Description must not exceed 5000 characters' })
      .optional(),

    coursePrice: z
      .union([
        z.number().min(0, 'Course price cannot be negative'),
        z.string().transform((val) => {
          const num = parseFloat(val);
          if (isNaN(num)) throw new Error('Invalid price format');
          if (num < 0) throw new Error('Course price cannot be negative');
          return num;
        })
      ])
      .optional(),

    categoryId: z
      .string({
        required_error: 'Category ID is required',
      })
      .min(1, { message: 'Category ID cannot be empty' }),

    subcategoryId: z
      .string({
        required_error: 'Subcategory ID is required',
      })
      .min(1, { message: 'Subcategory ID cannot be empty' }),

    courseLevel: z.enum(courseLevel, {
      required_error: 'Course level is required',
    }),

    enrolledStudents: z.array(z.string()).optional(),

    lectures: z.array(z.string()).optional(),

    creator: z
      .string({
        required_error: 'Creator ID is required',
      })
      .optional(),

    isPublished: z.union([
      z.boolean(),
      z.string().transform((val) => val === 'true')
    ]).default(true),

    status: z.enum(courseStatus, {
      required_error: 'Status is required',
    }),
    isFree: z.enum(courseIsFree).optional(),
    courseThumbnail: z.string().optional(),
    courseThumbnailPublicId: z.string().optional(),

    learningObjectives: z.array(z.string()).optional(),
    prerequisites: z.string().optional(),
    targetAudience: z.string().optional(),
    estimatedDuration: z.string().optional(),
    language: z.string().optional(),
    hasSubtitles: z.boolean().optional(),
    hasCertificate: z.boolean().optional(),
  }),
});

const updateCourseZodSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(3, { message: 'Title must be at least 3 characters' })
      .max(200, { message: 'Title must not exceed 200 characters' })
      .optional(),

    subtitle: z
      .string()
      .max(300, { message: 'Subtitle must not exceed 300 characters' })
      .optional(),

    description: z
      .string()
      .max(5000, { message: 'Description must not exceed 5000 characters' })
      .optional(),

    coursePrice: z
      .union([
        z.number().min(0, 'Course price cannot be negative'),
        z.string().transform((val) => {
          const num = parseFloat(val);
          if (isNaN(num)) throw new Error('Invalid price format');
          if (num < 0) throw new Error('Course price cannot be negative');
          return num;
        })
      ])
      .optional(),

    categoryId: z.string().optional(),

    subcategoryId: z.string().optional(),

    courseLevel: z.enum(courseLevel).optional(),

    courseThumbnail: z.string().optional(),
    courseThumbnailPublicId: z.string().optional(),

    enrolledStudents: z.array(z.string()).optional(),

    lectures: z.array(z.string()).optional(),

    creator: z.string().optional(),

    isPublished: z.union([
      z.boolean(),
      z.string().transform((val) => val === 'true')
    ]).optional(),

    status: z.enum(courseStatus).optional(),

    isFree: z.enum(courseIsFree).optional(),

    learningObjectives: z.array(z.string()).optional(),
    prerequisites: z.string().optional(),
    targetAudience: z.string().optional(),
    estimatedDuration: z.string().optional(),
    language: z.string().optional(),
    hasSubtitles: z.boolean().optional(),
    hasCertificate: z.boolean().optional(),
  }),
});

// We can reuse the updateCourseZodSchema for editCourse since they have the same validation requirements
const editCourseZodSchema = updateCourseZodSchema;

// For delete, we don't need any body validation, just the ID from params
const deleteCourseZodSchema = z.object({});

export const CourseValidation = {
  createCourseZodSchema,
  updateCourseZodSchema,
  editCourseZodSchema,
  deleteCourseZodSchema,
};
