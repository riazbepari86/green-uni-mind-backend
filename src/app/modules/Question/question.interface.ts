import { Types } from 'mongoose';

export interface IQuestion {
  question: string;
  timestamp: number;
  lectureId: Types.ObjectId;
  studentId: Types.ObjectId;
  answered: boolean;
  answer?: string;
  answeredBy?: Types.ObjectId; // Teacher ID
  answeredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
