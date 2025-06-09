import { z } from 'zod';
import {
  courseCategories,
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
      .min(1, { message: 'Title cannot be empty' }),

    subtitle: z.string().optional(),
    description: z.string().optional(),

    category: z.enum(courseCategories, {
      required_error: 'Category is required',
    }),

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
  }),
});

const updateCourseZodSchema = z.object({
  body: z.object({
    title: z.string().min(1, { message: 'Title cannot be empty' }).optional(),

    subtitle: z.string().optional(),

    description: z.string().optional(),

    category: z.enum(courseCategories).optional(),

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
