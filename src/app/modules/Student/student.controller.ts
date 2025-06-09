import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { StudentServices } from './student.service';

const enrollInCourse = catchAsync(async (req, res) => {
  const { studentId } = req.params;
  const { courseId } = req.body;

  const result = await StudentServices.enrolledInCourse(studentId, courseId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Enrolled in course successfully',
    data: result,
  });
});

export const markLectureComplete = catchAsync(async (req, res) => {
  const { studentId } = req.params;
  const { courseId, lectureId } = req.body;

  console.log(`Marking lecture complete for student ${studentId}, course ${courseId}, lecture ${lectureId}`);

  const result = await StudentServices.markLectureComplete(
    studentId,
    courseId,
    lectureId,
  );

  console.log('Lecture marked as complete, returning result:', result);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Lecture marked as complete',
    data: result,
  });
});

const getCourseProgress = catchAsync(async (req, res) => {
  const { studentId, courseId } = req.params;

  const result = await StudentServices.getCourseProgress(studentId, courseId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Course progress retrieved',
    data: result,
  });
});

const getEnrolledCoursesWithProgress = catchAsync(async (req, res) => {
  const { studentId } = req.params;

  const result = await StudentServices.getEnrolledCoursesWithProgress(studentId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Enrolled courses with progress retrieved',
    data: result,
  });
});

export const StudentControllers = {
  enrollInCourse,
  markLectureComplete,
  getEnrolledCoursesWithProgress,
  getCourseProgress,
};
