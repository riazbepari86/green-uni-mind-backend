import { Types } from 'mongoose';
import {
  courseCategories,
  courseIsFree,
  courseLevel,
  courseStatus,
} from './course.constant';

export interface ICourse {
  title: string;
  subtitle?: string;
  description?: string;
  category: keyof typeof courseCategories;
  courseLevel: keyof typeof courseLevel;
  coursePrice?: number;
  courseThumbnail?: string;
  enrolledStudents?: Types.ObjectId[];
  totalEnrollment?: number;
  lectures?: Types.ObjectId[];
  creator: Types.ObjectId;
  isPublished: boolean;
  status: keyof typeof courseStatus;
  courseThumbnailPublicId?: string;
  isFree?: keyof typeof courseIsFree;
}
