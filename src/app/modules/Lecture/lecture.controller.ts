import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { LectureService } from './lecture.service';
import httpStatus from 'http-status';
import { VideoResolution } from './lecture.interface';
import EnterpriseCacheService from '../../services/cache/EnterpriseCache';
import LectureUpdateCacheInvalidator from '../../services/cache/LectureUpdateCacheInvalidator';

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

  // Validate required parameters
  if (!courseId || courseId === 'undefined' || courseId === 'null') {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Valid course ID is required',
      data: null,
    });
  }

  if (!lectureId || lectureId === 'undefined' || lectureId === 'null') {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Valid lecture ID is required',
      data: null,
    });
  }

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

  // COMPREHENSIVE CACHE INVALIDATION - SOLUTION TO YOUR ISSUE
  // This ensures immediate updates in creator courses endpoint
  try {
    console.log('🎯 Starting comprehensive cache invalidation for lecture update:', {
      lectureId,
      courseId,
      updatedFields: Object.keys(payload)
    });

    // Use both enterprise cache service and specialized invalidator
    const [enterpriseCache, cacheInvalidator] = [
      new EnterpriseCacheService(),
      LectureUpdateCacheInvalidator.getInstance()
    ];

    // Run both invalidation strategies in parallel for maximum effectiveness
    await Promise.all([
      enterpriseCache.invalidateLectureUpdate(lectureId, courseId, Object.keys(payload)),
      cacheInvalidator.invalidateAfterLectureUpdate(lectureId, courseId)
    ]);

    // Validate that cache invalidation worked
    const isInvalidated = await cacheInvalidator.validateCacheInvalidation(lectureId, courseId);
    console.log('🔍 Cache invalidation validation:', isInvalidated ? 'SUCCESS' : 'PARTIAL');

    console.log('✅ Comprehensive cache invalidation completed successfully');
  } catch (cacheError) {
    console.error('❌ Cache invalidation failed:', cacheError);
    
    // Emergency fallback - clear all course caches
    try {
      console.log('🚨 Attempting emergency cache clear...');
      await LectureUpdateCacheInvalidator.getInstance().emergencyClearAllCourseCaches();
      console.log('🚨 Emergency cache clear completed');
    } catch (emergencyError) {
      console.error('❌ Emergency cache clear also failed:', emergencyError);
    }
    
    // Don't fail the request if cache invalidation fails
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lecture updated successfully',
    data: updated,
  });
});

const deleteLecture = catchAsync(async (req, res) => {
  const { courseId, lectureId } = req.params;

  // Validate required parameters
  if (!courseId || courseId === 'undefined' || courseId === 'null') {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Valid course ID is required',
      data: null,
    });
  }

  if (!lectureId || lectureId === 'undefined' || lectureId === 'null') {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Valid lecture ID is required',
      data: null,
    });
  }

  const result = await LectureService.deleteLecture(courseId, lectureId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lecture deleted successfully',
    data: result,
  });
});

export const LectureController = {
  createLecture,
  getLectureById,
  getLecturesByCourseId,
  updateLectureOrder,
  updateLecture,
  deleteLecture,
};
