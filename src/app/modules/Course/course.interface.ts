import { Types } from 'mongoose';
import {
  courseIsFree,
  courseLevel,
  courseStatus,
} from './course.constant';

export interface ICourse {
  title: string;
  subtitle?: string;
  description?: string;
  categoryId: Types.ObjectId;
  subcategoryId: Types.ObjectId;
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
