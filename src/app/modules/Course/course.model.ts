import { model, Schema } from 'mongoose';
import { ICourse } from './course.interface';
import {
  courseLevel,
  courseCategories,
  courseStatus,
  courseIsFree,
} from './course.constant';

const courseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: {
        values: courseCategories,
        message: 'Invalid course category',
      },
      required: [true, 'Course category is required'],
    },
    courseLevel: {
      type: String,
      enum: {
        values: courseLevel,
        message: 'Invalid course level',
      },
      required: [true, 'Course level is required'],
    },
    coursePrice: {
      type: Number,
      min: [0, 'Course price cannot be negative'],
    },
    courseThumbnail: {
      type: String,
      trim: true,
    },
    courseThumbnailPublicId: {
      type: String,
    },
    enrolledStudents: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
    totalEnrollment: {
      type: Number,
      default: 0,
    },
    lectures: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Lecture',
      },
    ],
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Course creator (teacher) is required'],
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: {
        values: courseStatus,
        message: 'Invalid course status',
      },
      required: [true, 'Course status is required'],
    },
    isFree: {
      type: String,
      enum: {
        values: courseIsFree,
        message: 'Invalid course Is Free',
      },
    },
  },
  { timestamps: true },
);

// Optionally create an index for better searching
courseSchema.index({ title: 'text', category: 'text' });

export const Course = model<ICourse>('Course', courseSchema);
