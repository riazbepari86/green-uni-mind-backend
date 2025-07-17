import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { CourseServices } from './course.service';

const createCourse = catchAsync(async (req, res) => {
  const { id } = req.params;
  const file = req.file;

  // Validate required parameters
  if (!id || id === 'undefined' || id === 'null') {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Valid teacher ID is required',
      data: null,
    });
  }

  const result = await CourseServices.createCourse(req.body, id, file);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Course created successfully',
    data: result,
  });
});

const searchCourse = catchAsync(async (req, res) => {
  const result = await CourseServices.searchCourse(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course are retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

const getPublishedCourse = catchAsync(async (req, res) => {
  const result = await CourseServices.getPublishedCourse(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course are retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

const getCreatorCourse = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Validate the ID parameter
  if (!id || id === 'undefined' || id === 'null') {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Valid creator ID is required',
      data: null,
    });
  }

  const result = await CourseServices.getCreatorCourse(id);

  // Set Cache-Control headers to prevent caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course are retrieved successfully',
    data: result,
  });
});

const getCourseById = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Validate required parameters
  if (!id || id === 'undefined' || id === 'null') {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Valid course ID is required',
      data: null,
    });
  }

  const result = await CourseServices.getCourseById(id);

  // Set Cache-Control headers to prevent caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course retrieved successfully',
    data: result,
  });
});

const updateCourse = catchAsync(async (req, res) => {
  const { id } = req.params;
  const file = req.file;

  // Validate required parameters
  if (!id || id === 'undefined' || id === 'null') {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Valid course ID is required',
      data: null,
    });
  }

  const result = await CourseServices.editCourse(id, req.body, file);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course updated successfully',
    data: result,
  });
});

const getCourseByEnrolledStudentId = catchAsync(async (req, res) => {
  const studentId = req.params.studentId;

  const result = await CourseServices.getCourseByEnrolledStudentId(studentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course are retrieved successfully',
    data: result,
  });
});

const getPopularCourses = catchAsync(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;

  const result = await CourseServices.getPopularCourses(limit);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Popular courses retrieved successfully',
    data: result,
  });
});

const editCourse = catchAsync(async (req, res) => {
  const { id } = req.params;
  const file = req.file;

  console.log('🎯 EditCourse Controller - Course ID:', id);
  console.log(
    '📥 EditCourse Controller - Request body:',
    JSON.stringify(req.body, null, 2),
  );
  console.log(
    '📁 EditCourse Controller - File:',
    file ? `${file.originalname} (${file.size} bytes)` : 'No file',
  );

  const result = await CourseServices.editCourse(id, req.body, file);

  // Set Cache-Control headers to prevent caching of updated course data
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());
  res.setHeader('ETag', `"${Date.now()}"`);

  console.log(
    '✅ EditCourse Controller - Sending response with course title:',
    result?.title,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course edited successfully',
    data: result,
  });
});

const deleteCourse = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await CourseServices.deleteCourse(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course and all associated resources deleted successfully',
    data: result,
  });
});

const getAllCourses = catchAsync(async (req, res) => {
  const result = await CourseServices.getAllCourses(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All courses retrieved successfully',
    data: result,
  });
});

const getTeacherCourses = catchAsync(async (req, res) => {
  const { teacherId } = req.params;

  // Validate the teacherId parameter
  if (!teacherId || teacherId === 'undefined' || teacherId === 'null') {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Valid teacher ID is required',
      data: null,
    });
  }

  const result = await CourseServices.getCreatorCourse(teacherId);

  // Set Cache-Control headers to prevent caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Teacher courses retrieved successfully',
    data: result,
  });
});

export const CourseController = {
  createCourse,
  searchCourse,
  getPublishedCourse,
  getCreatorCourse,
  getCourseById,
  updateCourse,
  getCourseByEnrolledStudentId,
  getPopularCourses,
  editCourse,
  deleteCourse,
  getAllCourses,
  getTeacherCourses,
};
