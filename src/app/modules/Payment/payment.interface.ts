import { Document, Types } from 'mongoose';

export interface IPayment extends Document {
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  teacherId: Types.ObjectId;
  amount: number;
  teacherShare: number;
  platformShare: number;
  stripeAccountId: string; // This is used for the payment intent ID
  stripePaymentId?: string; // Adding this field to match the index in the database
  stripeEmail: string;
  status: 'success' | 'failed' | 'pending' | 'completed';
  receiptUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITransaction extends Document {
  courseId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  totalAmount: number;
  teacherEarning: number;
  platformEarning: number;
  stripeInvoiceUrl?: string;
  stripePdfUrl?: string;
  stripeTransactionId: string;
  stripeTransferStatus: 'pending' | 'completed' | 'failed';
  stripeTransferId?: string;
  status: 'success' | 'failed' | 'pending' | 'completed';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPayoutSummary extends Document {
  teacherId: Types.ObjectId;
  totalEarned: number;
  month: string; // Format: "YYYY-MM"
  year: number;
  transactions: Types.ObjectId[];
  coursesSold: Array<{
    courseId: Types.ObjectId;
    count: number;
    earnings: number;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IReview {
  student: Types.ObjectId;
  course: Types.ObjectId;
  teacher: Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}