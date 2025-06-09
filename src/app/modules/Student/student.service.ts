import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { Student } from './student.model';
import httpStatus from 'http-status';
import { Lecture } from '../Lecture/lecture.model';
import { Course } from '../Course/course.model';

const enrolledInCourse = async (studentId: string, courseId: string) => {
  const student = await Student.findById(studentId);

  if (!student) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User is not Found!');
  }

  const alreadyEnrolled = student?.enrolledCourses?.some((course) =>
    course.courseId.equals(courseId),
  );

  if (alreadyEnrolled) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Already enrolled in this course',
    );
  }

  student.enrolledCourses.push({
    courseId: new Types.ObjectId(courseId),
    completedLectures: [],
    enrolledAt: new Date(),
  });
  return await student?.save();
};

const markLectureComplete = async (
  studentId: string,
  courseId: string,
  lectureId: string,
) => {
  // Update the student document to mark the lecture as complete
  const student = await Student.findOneAndUpdate(
    {
      _id: studentId,
      'enrolledCourses.courseId': courseId,
    },
    {
      $addToSet: { 'enrolledCourses.$.completedLectures': lectureId },
    },
    { new: true },
  );

  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, 'Student or course not found');
  }

  // Get the updated course progress to return
  const progress = await getCourseProgress(studentId, courseId);
  return progress;
};

const getCourseProgress = async (studentId: string, courseId: string) => {
  // Find student and verify enrollment
  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, 'Student not found');
  }

  const courseProgress = student?.enrolledCourses.find((c) =>
    c.courseId.equals(courseId),
  );

  if (!courseProgress) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Student not enrolled in this course',
    );
  }

  // Get all lectures for this course
  const lectures = await Lecture.find({ courseId });
  const totalLectures = lectures.length;

  // Get completed lecture IDs as strings for comparison
  const completedLectureIds = courseProgress.completedLectures.map((id) =>
    id.toString(),
  );
  const completed = completedLectureIds.length;

  // Calculate percentage (capped at 100%)
  // First ensure completed doesn't exceed totalLectures
  const validCompleted = Math.min(completed, totalLectures);

  // Check if ALL lectures are actually completed by verifying each lecture ID
  // This ensures we don't just count the number but verify the exact lectures
  const allLecturesCompleted = totalLectures > 0 &&
    lectures.every(lecture => completedLectureIds.includes(lecture._id.toString()));

  // Only show 100% if ALL lectures are completed
  const percentage =
    totalLectures > 0
      ? (allLecturesCompleted
          ? 100
          : Math.min(99, Math.round((validCompleted / totalLectures) * 100)))
      : 0;

  // Get detailed lecture progress
  const lectureProgress = lectures
    .map((lecture) => ({
      lectureId: lecture._id.toString(),
      title: lecture.lectureTitle,
      isCompleted: completedLectureIds.includes(lecture._id.toString()),
      duration: lecture.duration || 0,
      order: lecture.order || 0,
    }))
    .sort((a, b) => a.order - b.order);

  // Check if all required lectures are completed
  // Only allow certificate if ALL lectures are completed (not just percentage)
  const canGenerateCertificate =
    allLecturesCompleted && !courseProgress.certificateGenerated;

  return {
    courseId,
    totalLectures,
    completedLectures: validCompleted, // Use the valid completed count
    percentage,
    certificateGenerated: courseProgress?.certificateGenerated || false,
    enrolledAt: courseProgress?.enrolledAt || new Date(),
    lastUpdated: new Date(),
    lectureProgress,
    canGenerateCertificate,
    remainingLectures: Math.max(0, totalLectures - validCompleted), // Ensure this is never negative
  };
};

const generateCertificate = async (studentId: string, courseId: string) => {
  // Get all lectures for this course
  const lectures = await Lecture.find({ courseId });
  const totalLectures = lectures.length;

  const student = await Student.findOne({
    _id: studentId,
    'enrolledCourses.courseId': courseId,
  });

  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, 'Student or course not found');
  }

  const progress = student.enrolledCourses.find((c) =>
    c.courseId.equals(courseId),
  );

  if (!progress) {
    throw new AppError(httpStatus.NOT_FOUND, 'Student not enrolled in this course');
  }

  // Get completed lecture IDs
  const completedLectureIds = progress.completedLectures.map(id => id.toString());

  // Check if all lectures are actually completed by verifying each lecture ID
  const allLecturesCompleted = totalLectures > 0 &&
    lectures.every(lecture => completedLectureIds.includes(lecture._id.toString()));

  if (!allLecturesCompleted) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Course not yet completed. All lectures must be completed to generate a certificate.'
    );
  }

  // Check if certificate is already generated
  if (progress.certificateGenerated) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Certificate has already been generated for this course.'
    );
  }

  progress.certificateGenerated = true;
  await student.save();
  return { certificate: 'certificate-url-or-id' };
};

const getEnrolledCoursesWithProgress = async (studentId: string) => {
  // Find student
  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, 'Student not found');
  }

  // Get all enrolled courses with progress
  const enrolledCoursesWithProgress = await Promise.all(
    student.enrolledCourses.map(async (enrollment) => {
      const courseId = enrollment.courseId;

      // Get course details
      const course = await Course.findById(courseId).populate({
        path: 'creator',
        select: 'name profileImg',
      });
      if (!course) return null;

      // Get lectures for this course
      const lectures = await Lecture.find({ courseId });
      const totalLectures = lectures.length;

      // Get completed lecture IDs as strings for comparison
      const completedLectureIds = enrollment.completedLectures.map(id => id.toString());
      const completedLectures = completedLectureIds.length;

      // Calculate progress percentage (capped at 100%)
      // First ensure completedLectures doesn't exceed totalLectures
      const validCompletedLectures = Math.min(completedLectures, totalLectures);

      // Check if ALL lectures are actually completed by verifying each lecture ID
      // This ensures we don't just count the number but verify the exact lectures
      const allLecturesCompleted = totalLectures > 0 &&
        lectures.every(lecture => completedLectureIds.includes(lecture._id.toString()));

      // Only show 100% if ALL lectures are completed
      const progress =
        totalLectures > 0
          ? (allLecturesCompleted
              ? 100
              : Math.min(99, Math.round((validCompletedLectures / totalLectures) * 100)))
          : 0;

      return {
        _id: course._id,
        title: course.title,
        description: course.description,
        courseThumbnail: course.courseThumbnail,
        creator: course.creator,
        lectures: lectures.map((l) => ({ _id: l._id, title: l.lectureTitle })),
        totalLectures,
        completedLectures: validCompletedLectures, // Use the valid completed count
        progress,
        certificateGenerated: enrollment.certificateGenerated || false,
        enrolledAt: enrollment.enrolledAt,
      };
    }),
  );

  return enrolledCoursesWithProgress.filter(Boolean);
};

export const StudentServices = {
  enrolledInCourse,
  markLectureComplete,
  getCourseProgress,
  generateCertificate,
  getEnrolledCoursesWithProgress,
};
