import { ILecture } from './lecture.interface';
import httpStatus from 'http-status';
import { Lecture } from './lecture.model';
import { Course } from '../Course/course.model';
import { Student } from '../Student/student.model';
import mongoose, { startSession } from 'mongoose';
import AppError from '../../errors/AppError';

const createLecture = async (payload: ILecture, courseId: string) => {
  const session = await startSession();
  session.startTransaction();

  try {
    // Check if course exists
    const course = await Course.findById(courseId).session(session);
    if (!course) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course not found!');
    }

    // Get the current highest order number for this course
    const lastLecture = await Lecture.findOne({ courseId })
      .sort({ order: -1 })
      .session(session);

    // Set the new order (last order + 1 or 1 if no lectures exist)
    const newOrder = lastLecture ? lastLecture.order + 1 : 1;

    // Create lecture with the calculated order
    const lecture = await Lecture.create(
      [{ ...payload, courseId, order: newOrder }],
      { session },
    );

    // Add lecture to course
    course?.lectures?.push(lecture[0]._id);
    await course.save({ session });

    await session.commitTransaction();
    session.endSession();

    return lecture[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getLecturesByCourseId = async (courseId: string) => {
  const lectures = await Lecture.find({ courseId }).sort({ order: 1 });
  return lectures;
};

const getLectureById = async (id: string, user?: { role: string; email: string }) => {
  // First, find the lecture to get its courseId
  const lecture = await Lecture.findById(id);

  if (!lecture) {
    throw new AppError(httpStatus.NOT_FOUND, 'Lecture not found');
  }

  // If user is a teacher, they can access any lecture
  if (user?.role === 'teacher') {
    return lecture;
  }

  // If user is a student, check if they're enrolled in the course
  if (user?.role === 'student') {
    // Get the student by email
    const student = await Student.findOne({ email: user.email });

    if (!student) {
      throw new AppError(httpStatus.NOT_FOUND, 'Student not found');
    }

    // Check if the student is enrolled in the course
    const isEnrolled = student.enrolledCourses.some(course =>
      course.courseId.toString() === lecture.courseId.toString()
    );

    // If the lecture is marked as preview, allow access regardless of enrollment
    if (lecture.isPreviewFree) {
      return lecture;
    }

    // If student is enrolled, allow access
    if (isEnrolled) {
      return lecture;
    }

    // If student is not enrolled, deny access
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You must be enrolled in this course to access this lecture'
    );
  }

  // If no user or unknown role, deny access
  throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized access');
};

const updateLectureOrder = async (
  courseId: string,
  lectures: Array<{ lectureId: string; order: number }>,
) => {
  const session = await startSession();
  session.startTransaction();

  try {
    // Verify all lectures belong to the course
    const lectureIds = lectures.map((l) => l.lectureId);
    const existingLectures = await Lecture.find({
      _id: { $in: lectureIds },
      courseId,
    }).session(session);

    if (existingLectures.length !== lectures.length) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Some lectures do not belong to this course',
      );
    }

    // Sort lectures by new order to maintain sequence
    lectures.sort((a, b) => a.order - b.order);

    // Update each lecture's order
    const bulkOps = lectures.map((lecture) => ({
      updateOne: {
        filter: { _id: lecture.lectureId },
        update: { $set: { order: lecture.order } },
      },
    }));

    await Lecture.bulkWrite(bulkOps, { session });

    // Update the course's lectures array to match the new order
    const course = await Course.findById(courseId).session(session);
    if (course) {
      course.lectures = lectures.map(
        (l) => new mongoose.Types.ObjectId(l.lectureId),
      );
      await course.save({ session });
    }

    await session.commitTransaction();

    // Return the updated lectures with their full data, properly populated
    const updatedLectures = await Lecture.find({
      _id: { $in: lectureIds },
    }).sort({ order: 1 });

    return updatedLectures;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }
};

const updateLecture = async (
  courseId: string,
  lectureId: string,
  payload: Partial<ILecture>,
) => {
  // ensure course exists
  const course = await Course.findById(courseId);
  if (!course) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found!');
  }

  // find & update lecture
  const lecture = await Lecture.findOneAndUpdate(
    { _id: lectureId, courseId },
    { $set: payload },
    { new: true },
  );

  if (!lecture) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Lecture not found for this course',
    );
  }

  return lecture;
};

export const LectureService = {
  createLecture,
  getLecturesByCourseId,
  getLectureById,
  updateLectureOrder,
  updateLecture,
};
