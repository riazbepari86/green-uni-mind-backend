import { model, Schema } from 'mongoose';
import { ILecture, VideoResolution } from './lecture.interface';

// Schema for video resolutions
const videoResolutionSchema = new Schema<VideoResolution>(
  {
    url: {
      type: String,
      required: true,
    },
    quality: {
      type: String,
      required: true,
    },
    format: {
      type: String,
    },
  },
  { _id: false }
);

const lectureSchema = new Schema<ILecture>(
  {
    lectureTitle: {
      type: String,
    },
    instruction: {
      type: String,
    },
    videoUrl: {
      type: String,
    },
    videoResolutions: {
      type: [videoResolutionSchema],
      default: [],
    },
    hlsUrl: {
      type: String,
    },
    pdfUrl: {
      type: String,
    },
    duration: {
      type: Number,
    },
    isPreviewFree: {
      type: Boolean,
      default: false,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    order: {
      type: Number,
      required: true
    }
  },
  { timestamps: true },
);

export const Lecture = model<ILecture>('Lecture', lectureSchema);
