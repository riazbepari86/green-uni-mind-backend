import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { Course } from '../Course/course.model';
import { Lecture } from '../Lecture/lecture.model';
import { Student } from '../Student/student.model';
import { Teacher } from '../Teacher/teacher.model';
import { Review } from './review.model';

const createReview = async (
  studentId: string,
  courseId: string,
  rating: number,
  comment: string,
) => {
  const student = await Student.findById(studentId);
  const course = await Course.findById(courseId);
  const teacher = await Teacher.findById(course?.creator);

  if (!student || !course || !teacher) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Student, course, or teacher not found',
    );
  }

  // Check if student has completed the course
  const courseProgress = student.enrolledCourses?.find((course) =>
    course.courseId.equals(courseId),
  );

  if (!courseProgress) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Student is not enrolled in this course',
    );
  }

  const totalLectures = await Lecture.countDocuments({ course: courseId });
  if (courseProgress.completedLectures.length < totalLectures) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Student must complete all lectures before reviewing',
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
    courseReviews.reduce(
      (sum: number, review: { rating: number }) => sum + review.rating,
      0,
    ) / courseReviews.length;

  await Course.findByIdAndUpdate(courseId, {
    averageRating,
  });

  // Update teacher average rating
  const teacherReviews = await Review.find({ teacher: teacher._id });
  const teacherAverageRating =
    teacherReviews.reduce(
      (sum: number, review: { rating: number }) => sum + review.rating,
      0,
    ) / teacherReviews.length;

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

const getTeacherReviewStats = async (teacherId: string) => {
  const reviews = await Review.find({ teacher: teacherId });

  if (reviews.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      },
      recentReviews: [],
      monthlyTrend: [],
    };
  }

  // Calculate average rating
  const averageRating =
    reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

  // Calculate rating distribution
  const ratingDistribution = {
    5: reviews.filter((r) => r.rating === 5).length,
    4: reviews.filter((r) => r.rating === 4).length,
    3: reviews.filter((r) => r.rating === 3).length,
    2: reviews.filter((r) => r.rating === 2).length,
    1: reviews.filter((r) => r.rating === 1).length,
  };

  // Get recent reviews (last 5)
  const recentReviews = await Review.find({ teacher: teacherId })
    .populate('student', 'name email profileImg')
    .populate('course', 'title')
    .sort({ createdAt: -1 })
    .limit(5);

  // Calculate monthly trend (last 6 months)
  const monthlyTrend = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const monthReviews = reviews.filter(
      (review) =>
        review.createdAt >= monthStart && review.createdAt <= monthEnd,
    );

    const monthAverage =
      monthReviews.length > 0
        ? monthReviews.reduce((sum, review) => sum + review.rating, 0) /
          monthReviews.length
        : 0;

    monthlyTrend.push({
      month: monthStart.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
      averageRating: Math.round(monthAverage * 10) / 10,
      reviewCount: monthReviews.length,
    });
  }

  return {
    totalReviews: reviews.length,
    averageRating: Math.round(averageRating * 10) / 10,
    ratingDistribution,
    recentReviews,
    monthlyTrend,
  };
};

const getTeacherReviewDashboard = async (teacherId: string) => {
  const stats = await getTeacherReviewStats(teacherId);

  // Get course-wise review breakdown
  const courseReviews = await Review.aggregate([
    { $match: { teacher: new Types.ObjectId(teacherId) } },
    {
      $group: {
        _id: '$course',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
        latestReview: { $max: '$createdAt' },
      },
    },
    {
      $lookup: {
        from: 'courses',
        localField: '_id',
        foreignField: '_id',
        as: 'courseInfo',
      },
    },
    {
      $unwind: '$courseInfo',
    },
    {
      $project: {
        courseId: '$_id',
        courseName: '$courseInfo.title',
        averageRating: { $round: ['$averageRating', 1] },
        reviewCount: 1,
        latestReview: 1,
      },
    },
    { $sort: { reviewCount: -1 } },
  ]);

  return {
    ...stats,
    courseBreakdown: courseReviews,
    insights: {
      topRatedCourse:
        courseReviews.length > 0
          ? courseReviews.reduce((prev, current) =>
              prev.averageRating > current.averageRating ? prev : current,
            )
          : null,
      mostReviewedCourse: courseReviews.length > 0 ? courseReviews[0] : null,
      improvementAreas:
        stats.averageRating < 4
          ? [
              'Consider improving course content quality',
              'Focus on student engagement strategies',
              'Gather more detailed feedback from students',
            ]
          : [],
    },
  };
};

export const ReviewServices = {
  createReview,
  getCourseReviews,
  getTeacherReviews,
  getTeacherReviewStats,
  getTeacherReviewDashboard,
};
