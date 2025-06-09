import { Types } from 'mongoose';

export interface INote {
  content: string;
  lectureId: Types.ObjectId;
  studentId: Types.ObjectId;
  isShared: boolean;
  sharedWith?: Types.ObjectId[];
  isRichText?: boolean;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
