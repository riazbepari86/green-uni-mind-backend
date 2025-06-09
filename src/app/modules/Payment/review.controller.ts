import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ReviewServices } from './review.service';

const createReview = catchAsync(async (req: Request, res: Response) => {
  const { studentId, courseId, rating, comment } = req.body;

  const result = await ReviewServices.createReview(studentId, courseId, rating, comment);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Review created successfully',
    data: result,
  });
});

const getCourseReviews = catchAsync(async (req: Request, res: Response) => {
  const { courseId } = req.params;

  const result = await ReviewServices.getCourseReviews(courseId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Course reviews retrieved successfully',
    data: result,
  });
});

const getTeacherReviews = catchAsync(async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  const result = await ReviewServices.getTeacherReviews(teacherId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Teacher reviews retrieved successfully',
    data: result,
  });
});

export const ReviewControllers = {
  createReview,
  getCourseReviews,
  getTeacherReviews,
}; 