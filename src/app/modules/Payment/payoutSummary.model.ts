import { Schema, model } from 'mongoose';
import { IPayoutSummary } from './payment.interface';

const payoutSummarySchema = new Schema<IPayoutSummary>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    totalEarned: {
      type: Number,
      required: true,
      default: 0,
    },
    month: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    transactions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Transaction',
      },
    ],
    coursesSold: [
      {
        courseId: {
          type: Schema.Types.ObjectId,
          ref: 'Course',
        },
        count: {
          type: Number,
          default: 1,
        },
        earnings: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const PayoutSummary = model<IPayoutSummary>('PayoutSummary', payoutSummarySchema);
