import AppError from "../../errors/AppError";
import catchAsync from "../../utils/catchAsync";
import  httpStatus  from 'http-status';
import { TeacherService } from "./teacher.service";
import sendResponse from "../../utils/sendResponse";

const connectStripe = catchAsync(async (req, res) => {
  const { stripeAccountId, stripeEmail } = req.body;
  const { teacherId } = req.params;

  if (!teacherId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Teacher ID is required');
  }

  const result = await TeacherService.connectStripe(teacherId, {
    stripeAccountId,
    stripeEmail,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Stripe account connected successfully',
    data: result,
  });
});

/**
 * Get all enrolled students with their progress for a teacher's courses
 */
const getEnrolledStudentsWithProgress = catchAsync(async (req, res) => {
  const { teacherId } = req.params;

  const result = await TeacherService.getEnrolledStudentsWithProgress(teacherId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Enrolled students with progress retrieved successfully',
    data: result,
  });
});

export const TeacherController = {
  connectStripe,
  getEnrolledStudentsWithProgress,
};
