import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { CourseServices } from './course.service';
import httpStatus from 'http-status';

const createCourse = catchAsync(async (req, res) => {
  const { id } = req.params;
  const file = req.file;

  const result = await CourseServices.createCourse(req.body, id, file);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course is created successfully',
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

  const result = await CourseServices.getCreatorCourse(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course are retrieved successfully',
    data: result,
  });
});

const getCourseById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await CourseServices.getCourseById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course are retrieved successfully',
    data: result,
  });
});

const updateCourse = catchAsync(async (req, res) => {
  const { id } = req.params;
  const file = req.file;

  const result = await CourseServices.updateCourse(id, req.body, file);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course are updated successfully',
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

  const result = await CourseServices.editCourse(id, req.body, file);

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
};
