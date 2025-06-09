import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { LectureService } from './lecture.service';
import httpStatus from 'http-status';
import { VideoResolution } from './lecture.interface';

const createLecture = catchAsync(async (req, res) => {
  const { courseId } = req.params;

  // Process the request body to handle adaptive streaming data
  const lectureData = req.body;

  // Ensure videoResolutions is properly formatted if present
  if (lectureData.videoResolutions && Array.isArray(lectureData.videoResolutions)) {
    // Make sure each resolution has the required fields
    lectureData.videoResolutions = lectureData.videoResolutions.map((resolution: {
      url: string;
      quality: string;
      format?: string;
    }) => ({
      url: resolution.url,
      quality: resolution.quality,
      format: resolution.format || undefined
    }));
  }

  const newLecture = await LectureService.createLecture(
    lectureData,
    courseId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Lecture created successfully',
    data: newLecture,
  });
});

const getLecturesByCourseId = catchAsync(async (req, res) => {
  const { courseId } = req.params;

  const lectures = await LectureService.getLecturesByCourseId(courseId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All lectures fetched for the course',
    data: lectures,
  });
});

const getLectureById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const lecture = await LectureService.getLectureById(id, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lecture fetched successfully',
    data: lecture,
  });
});

const updateLectureOrder = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const { lectures } = req.body;

  const updatedLectures = await LectureService.updateLectureOrder(
    courseId,
    lectures,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lecture order updated successfully',
    data: updatedLectures,
  });
});

const updateLecture = catchAsync(async (req, res) => {
  const { courseId, lectureId } = req.params;
  const payload = req.body;

  // Process the payload to handle adaptive streaming data
  if (payload.videoResolutions && Array.isArray(payload.videoResolutions)) {
    // Make sure each resolution has the required fields
    payload.videoResolutions = payload.videoResolutions.map((resolution: {
      url: string;
      quality: string;
      format?: string;
    }) => ({
      url: resolution.url,
      quality: resolution.quality,
      format: resolution.format || undefined
    }));
  }

  const updated = await LectureService.updateLecture(
    courseId,
    lectureId,
    payload,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lecture updated successfully',
    data: updated,
  });
});

export const LectureController = {
  createLecture,
  getLectureById,
  getLecturesByCourseId,
  updateLectureOrder,
  updateLecture,
};
