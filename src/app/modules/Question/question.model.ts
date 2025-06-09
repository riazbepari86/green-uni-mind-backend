import { model, Schema } from 'mongoose';
import { IQuestion } from './question.interface';

const questionSchema = new Schema<IQuestion>(
  {
    question: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    timestamp: {
      type: Number,
      required: [true, 'Timestamp is required'],
    },
    lectureId: {
      type: Schema.Types.ObjectId,
      ref: 'Lecture',
      required: [true, 'Lecture ID is required'],
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student ID is required'],
    },
    answered: {
      type: Boolean,
      default: false,
    },
    answer: {
      type: String,
      trim: true,
    },
    answeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    answeredAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

export const Question = model<IQuestion>('Question', questionSchema);
