import { Schema, model } from 'mongoose';
import { IPayment } from './payment.interface';

const paymentSchema = new Schema<IPayment>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    teacherShare: {
      type: Number,
      required: true,
    },
    platformShare: {
      type: Number,
      required: true,
    },
    stripeAccountId: {
      type: String,
      required: true,
    },
    stripePaymentId: {
      type: String,
      default: null,
    },
    stripeEmail: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending', 'completed'],
      default: 'pending',
    },
    receiptUrl: {
      type: String,
      required: false,
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

export const Payment = model<IPayment>('Payment', paymentSchema);