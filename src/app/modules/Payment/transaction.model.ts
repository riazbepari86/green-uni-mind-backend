import { Schema, model } from 'mongoose';
import { ITransaction } from './payment.interface';

const transactionSchema = new Schema<ITransaction>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    teacherEarning: {
      type: Number,
      required: true,
    },
    platformEarning: {
      type: Number,
      required: true,
    },
    stripeInvoiceUrl: {
      type: String,
      required: false,
    },
    stripePdfUrl: {
      type: String,
      required: false,
    },
    stripeTransactionId: {
      type: String,
      required: true,
    },
    stripeTransferStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    stripeTransferId: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending', 'completed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

export const Transaction = model<ITransaction>('Transaction', transactionSchema);
