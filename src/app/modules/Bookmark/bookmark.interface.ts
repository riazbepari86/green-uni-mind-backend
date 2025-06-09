import { Types } from 'mongoose';

export interface IBookmark {
  title: string;
  timestamp: number;
  lectureId: Types.ObjectId;
  studentId: Types.ObjectId;
  isShared: boolean;
  sharedWith?: Types.ObjectId[];
  category?: string;
  tags?: string[];
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
