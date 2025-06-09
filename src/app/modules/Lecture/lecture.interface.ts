import { Types } from 'mongoose';

export interface VideoResolution {
  url: string;
  quality: string; // e.g., '1080p', '720p', '480p', etc.
  format?: string; // e.g., 'mp4', 'webm', etc.
}

export interface ILecture {
  lectureTitle: string;
  instruction?: string;
  videoUrl?: string; // Legacy field for backward compatibility
  videoResolutions?: VideoResolution[]; // New field for adaptive streaming
  pdfUrl?: string;
  duration?: number;
  isPreviewFree?: boolean;
  courseId: Types.ObjectId;
  order: number;
  hlsUrl?: string; // URL for HLS streaming
}
