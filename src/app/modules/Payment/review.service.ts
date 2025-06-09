import { Types } from 'mongoose';
import { Review } from './review.model';
import { Student } from '../Student/student.model';
import { Teacher } from '../Teacher/teacher.model';
import { Course } from '../Course/course.model';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { Lecture } from '../Lecture/lecture.model';

const createReview = async (
  studentId: string,
  courseId: string,
  rating: number,
  comment: string
) => {
  const student = await Student.findById(studentId);
  const course = await Course.findById(courseId);
  const teacher = await Teacher.findById(course?.creator);

  if (!student || !course || !teacher) {
    throw new AppError(httpStatus.NOT_FOUND, 'Student, course, or teacher not found');
  }

  // Check if student has completed the course
  const courseProgress = student.enrolledCourses?.find((course) =>
    course.courseId.equals(courseId)
  );

  if (!courseProgress) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Student is not enrolled in this course');
  }

  const totalLectures = await Lecture.countDocuments({ course: courseId });
  if (courseProgress.completedLectures.length < totalLectures) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Student must complete all lectures before reviewing'
    );
  }

  // Check if already reviewed
  const existingReview = await Review.findOne({
    student: studentId,
    course: courseId,
  });

  if (existingReview) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Already reviewed this course');
  }

  // Create review
  const review = await Review.create({
    student: new Types.ObjectId(studentId),
    course: new Types.ObjectId(courseId),
    teacher: new Types.ObjectId(teacher._id),
    rating,
    comment,
  });

  // Update course average rating
  const courseReviews = await Review.find({ course: courseId });
  const averageRating =
    courseReviews.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0) /
    courseReviews.length;

  await Course.findByIdAndUpdate(courseId, {
    averageRating,
  });

  // Update teacher average rating
  const teacherReviews = await Review.find({ teacher: teacher._id });
  const teacherAverageRating =
    teacherReviews.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0) /
    teacherReviews.length;

  await Teacher.findByIdAndUpdate(teacher._id, {
    averageRating: teacherAverageRating,
  });

  return review;
};

const getCourseReviews = async (courseId: string) => {
  const reviews = await Review.find({ course: courseId })
    .populate('student', 'name email profileImg')
    .sort({ createdAt: -1 });

  return reviews;
};

const getTeacherReviews = async (teacherId: string) => {
  const reviews = await Review.find({ teacher: teacherId })
    .populate('student', 'name email profileImg')
    .populate('course', 'title')
    .sort({ createdAt: -1 });

  return reviews;
};

export const ReviewServices = {
  createReview,
  getCourseReviews,
  getTeacherReviews,
}; 