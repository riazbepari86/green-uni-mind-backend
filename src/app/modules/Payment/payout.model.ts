import { Schema, model } from 'mongoose';
import { IPayout, IPayoutPreference, PayoutSchedule, PayoutStatus } from './payout.interface';

const payoutSchema = new Schema<IPayout>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'usd',
    },
    status: {
      type: String,
      enum: Object.values(PayoutStatus),
      default: PayoutStatus.PENDING,
    },
    stripePayoutId: {
      type: String,
    },
    stripeTransferId: {
      type: String,
    },
    transactions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Transaction',
      },
    ],
    description: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    scheduledAt: {
      type: Date,
    },
    processedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
    notificationSent: {
      type: Boolean,
      default: false,
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

const payoutPreferenceSchema = new Schema<IPayoutPreference>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      unique: true,
    },
    schedule: {
      type: String,
      enum: Object.values(PayoutSchedule),
      default: PayoutSchedule.MONTHLY,
    },
    minimumAmount: {
      type: Number,
      default: 50, // Default minimum payout amount in USD
    },
    isAutoPayoutEnabled: {
      type: Boolean,
      default: true,
    },
    lastPayoutDate: {
      type: Date,
    },
    nextScheduledPayoutDate: {
      type: Date,
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

export const Payout = model<IPayout>('Payout', payoutSchema);
export const PayoutPreference = model<IPayoutPreference>('PayoutPreference', payoutPreferenceSchema);
