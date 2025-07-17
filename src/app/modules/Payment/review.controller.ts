import { Request, Response } from 'express';
import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { Teacher } from '../Teacher/teacher.model';
import { ReviewServices } from './review.service';

/**
 * Helper function to validate and resolve teacher ID
 * Handles cases where frontend passes user._id instead of teacher._id
 */
const validateAndResolveTeacherId = async (
  teacherId: string,
  authenticatedUser: any,
): Promise<string> => {
  console.log('🔍 validateAndResolveTeacherId called with:', {
    teacherId,
    userRole: authenticatedUser.role,
    userId: authenticatedUser._id,
  });

  if (authenticatedUser.role !== 'teacher') {
    console.log('✅ Non-teacher user, returning original teacherId');
    return teacherId; // For non-teacher users, return as-is
  }

  // Try to find teacher by the provided ID first
  console.log('🔍 Looking for teacher by ID:', teacherId);
  let teacher = await Teacher.findById(teacherId);
  console.log('📊 Teacher.findById result:', teacher ? 'Found' : 'Not found');

  // If not found, try to find by user ID (common case when frontend passes user._id)
  if (!teacher) {
    console.log('🔍 Looking for teacher by user ID:', teacherId);
    teacher = await Teacher.findOne({ user: teacherId });
    console.log(
      '📊 Teacher.findOne({user}) result:',
      teacher ? 'Found' : 'Not found',
    );
  }

  // Validate that the teacher belongs to the authenticated user
  if (!teacher) {
    console.log('❌ No teacher found for ID:', teacherId);
    throw new AppError(httpStatus.FORBIDDEN, 'Teacher not found');
  }

  console.log('🔍 Teacher found:', {
    teacherId: teacher._id,
    userId: teacher.user,
  });

  if (teacher.user.toString() !== authenticatedUser._id) {
    console.log('❌ Teacher user mismatch:', {
      teacherUserId: teacher.user.toString(),
      authenticatedUserId: authenticatedUser._id,
    });
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only access your own data',
    );
  }

  console.log(
    '✅ Teacher validation successful, returning teacher ID:',
    teacher._id.toString(),
  );
  return teacher._id.toString();
};

const createReview = catchAsync(async (req: Request, res: Response) => {
  const { studentId, courseId, rating, comment } = req.body;

  const result = await ReviewServices.createReview(
    studentId,
    courseId,
    rating,
    comment,
  );

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

const getTeacherReviewStats = catchAsync(
  async (req: Request, res: Response) => {
    const { teacherId } = req.params;

    // Validate teacher ID matches authenticated user
    const user = (req as any).user;
    const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

    const result = await ReviewServices.getTeacherReviewStats(actualTeacherId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Teacher review statistics retrieved successfully',
      data: result,
    });
  },
);

const getTeacherReviewDashboard = catchAsync(
  async (req: Request, res: Response) => {
    const { teacherId } = req.params;

    // Validate teacher ID matches authenticated user
    const user = (req as any).user;
    const actualTeacherId = await validateAndResolveTeacherId(teacherId, user);

    const result =
      await ReviewServices.getTeacherReviewDashboard(actualTeacherId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Teacher review dashboard data retrieved successfully',
      data: result,
    });
  },
);

export const ReviewControllers = {
  createReview,
  getCourseReviews,
  getTeacherReviews,
  getTeacherReviewStats,
  getTeacherReviewDashboard,
};
