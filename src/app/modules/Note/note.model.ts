import { model, Schema } from 'mongoose';
import { INote } from './note.interface';

const noteSchema = new Schema<INote>(
  {
    content: {
      type: String,
      required: [true, 'Note content is required'],
      trim: true,
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
    isShared: {
      type: Boolean,
      default: false,
    },
    sharedWith: [{
      type: Schema.Types.ObjectId,
      ref: 'Student',
    }],
    isRichText: {
      type: Boolean,
      default: false,
    },
    tags: [{
      type: String,
      trim: true,
    }],
  },
  { timestamps: true },
);

// Create a compound index to ensure a student can only have one note per lecture
noteSchema.index({ studentId: 1, lectureId: 1 }, { unique: true });

export const Note = model<INote>('Note', noteSchema);
