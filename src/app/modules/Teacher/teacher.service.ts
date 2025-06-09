import AppError from '../../errors/AppError';
import { Teacher } from './teacher.model';
import httpStatus from 'http-status';
import { Course } from '../Course/course.model';
import { Student } from '../Student/student.model';
import { Lecture } from '../Lecture/lecture.model';

const connectStripe = async (
  teacherId: string,
  stripeData: { stripeAccountId: string; stripeEmail: string },
) => {
  const teacher = await Teacher.findById(teacherId);

  if (!teacher) {
    throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
  }

  teacher.stripeAccountId = stripeData.stripeAccountId;
  teacher.stripeEmail = stripeData.stripeEmail;

  await teacher.save();

  return teacher;
};

/**
 * Get all enrolled students for a teacher's courses with their progress
 * @param teacherId - The ID of the teacher
 * @returns Array of students with their enrollment and progress data
 */
const getEnrolledStudentsWithProgress = async (teacherId: string) => {
  // Find the teacher
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
  }

  // Get all courses created by this teacher
  const courses = await Course.find({ creator: teacherId });
  if (!courses.length) {
    return []; // No courses, so no students
  }

  // Get all course IDs
  const courseIds = courses.map(course => course._id);

  // Find all students enrolled in any of these courses
  const students = await Student.find({
    'enrolledCourses.courseId': { $in: courseIds }
  });

  if (!students.length) {
    return []; // No enrolled students
  }

  // Create a map of course ID to course details for quick lookup
  const courseMap = new Map();
  for (const course of courses) {
    // Get lectures for this course
    const lectures = await Lecture.find({ courseId: course._id });
    courseMap.set(course._id.toString(), {
      _id: course._id,
      title: course.title,
      totalLectures: lectures.length,
      lectures: lectures
    });
  }

  // Process each student to include their course progress
  const studentsWithProgress = await Promise.all(
    students.map(async (student) => {
      // Filter enrollments to only include courses by this teacher
      const relevantEnrollments = student.enrolledCourses.filter(enrollment =>
        courseMap.has(enrollment.courseId.toString())
      );

      // Process each enrollment to include progress details
      const enrollmentDetails = relevantEnrollments.map(enrollment => {
        const courseId = enrollment.courseId.toString();
        const course = courseMap.get(courseId);

        if (!course) return null; // Skip if course not found (shouldn't happen)

        // Get completed lecture IDs as strings for comparison
        const completedLectureIds = enrollment.completedLectures.map(id => id.toString());
        const completedLectures = completedLectureIds.length;

        // Calculate progress percentage
        const totalLectures = course.totalLectures;
        const validCompletedLectures = Math.min(completedLectures, totalLectures);

        // Check if ALL lectures are completed
        const allLecturesCompleted = totalLectures > 0 &&
          course.lectures.every((lecture: any) => completedLectureIds.includes(lecture._id.toString()));

        // Only show 100% if ALL lectures are completed
        const progress = totalLectures > 0
          ? (allLecturesCompleted
              ? 100
              : Math.min(99, Math.round((validCompletedLectures / totalLectures) * 100)))
          : 0;

        return {
          courseId,
          title: course.title,
          totalLectures,
          completedLectures: validCompletedLectures,
          progress,
          certificateGenerated: enrollment.certificateGenerated || false,
          enrolledAt: enrollment.enrolledAt
        };
      }).filter(Boolean); // Remove any null entries

      return {
        _id: student._id,
        name: student.name,
        email: student.email,
        profileImg: student.profileImg,
        enrolledCourses: enrollmentDetails
      };
    })
  );

  return studentsWithProgress;
};

export const TeacherService = {
  connectStripe,
  getEnrolledStudentsWithProgress,
};
