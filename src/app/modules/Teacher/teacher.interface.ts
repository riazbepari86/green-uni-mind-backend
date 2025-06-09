import { Model, Types } from 'mongoose';

export interface ITeacherUserName {
  firstName: string;
  middleName?: string;
  lastName: string;
}

export interface ITeacher {
  user: Types.ObjectId;
  name: ITeacherUserName;
  gender: 'male' | 'female' | 'other';
  email: string;
  profileImg?: string;
  isDeleted?: boolean;
  stripeAccountId?: string;
  stripeEmail?: string;
  stripeVerified?: boolean;
  stripeOnboardingComplete?: boolean;
  stripeRequirements?: string[];
  earnings: {
    total: number;
    monthly: number;
    yearly: number;
    weekly: number;
  };
  totalEarnings?: number;
  payments?: Types.ObjectId[];
  courses: Types.ObjectId[];
  averageRating?: number;
  payoutInfo?: {
    availableBalance?: number;
    pendingBalance?: number;
    lastSyncedAt?: Date;
    nextPayoutDate?: Date;
    nextPayoutAmount?: number;
  };
}

export interface TeacherModel extends Model<ITeacher> {
  isUserExists(email: string): Promise<ITeacher | null>;
}
