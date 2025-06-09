import { Model, Types } from 'mongoose';

export interface IUserName {
  firstName: string;
  middleName?: string;
  lastName: string;
}

export interface ICourseProgress {
  courseId: Types.ObjectId;
  completedLectures: Types.ObjectId[];
  certificateGenerated?: boolean;
  enrolledAt?: Date;
}

export interface IStudent {
  user: Types.ObjectId;
  name: IUserName;
  gender: 'male' | 'female' | 'other';
  email: string;
  profileImg?: string;
  isDeleted: boolean;

  enrolledCourses: ICourseProgress[];
}

export interface StudentModel extends Model<IStudent> {
  isUserExists(email: string): Promise<IStudent | null>;
}
