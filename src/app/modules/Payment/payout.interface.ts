import { Document, Types } from 'mongoose';

export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum PayoutSchedule {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  MANUAL = 'manual',
}

export interface IPayout extends Document {
  teacherId: Types.ObjectId;
  amount: number;
  currency: string;
  status: PayoutStatus;
  stripePayoutId?: string;
  stripeTransferId?: string;
  transactions: Types.ObjectId[];
  description?: string;
  metadata?: Record<string, any>;
  scheduledAt?: Date;
  processedAt?: Date;
  failureReason?: string;
  notificationSent?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPayoutPreference extends Document {
  teacherId: Types.ObjectId;
  schedule: PayoutSchedule;
  minimumAmount: number;
  isAutoPayoutEnabled: boolean;
  lastPayoutDate?: Date;
  nextScheduledPayoutDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
