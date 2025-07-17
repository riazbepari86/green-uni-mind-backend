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

    // Get the current highest order number for this course (optimized query)
    const lastLecture = await Lecture.findOne({ courseId })
      .select('order')
      .sort({ order: -1 })
      .lean()
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

    // Invalidate cache AFTER successful database transaction
    try {
      const { apiCache, queryCache } = await import('../../middlewares/cachingMiddleware');
      await Promise.all([
        apiCache.invalidateByTags(['course_content', 'course_list', 'user_data', 'course_creator']),
        queryCache.invalidateByTags(['course_content', 'course_list', 'user_data', 'course_creator']),
      ]);
      console.log('✅ Cache invalidated successfully after lecture creation');
    } catch (cacheError) {
      console.error('⚠️ Cache invalidation failed after lecture creation:', cacheError);
    }

    return lecture[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getLecturesByCourseId = async (courseId: string) => {
  // Use lean() for better performance and select only necessary fields
  const lectures = await Lecture.find({ courseId })
    .select('lectureTitle instruction videoUrl videoResolutions hlsUrl pdfUrl duration isPreviewFree order courseId createdAt updatedAt')
    .sort({ order: 1 })
    .lean(); // Returns plain JavaScript objects instead of Mongoose documents
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
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid course ID format');
  }

  if (!mongoose.Types.ObjectId.isValid(lectureId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid lecture ID format');
  }

  // Start a session for transaction to ensure data consistency
  const session = await startSession();
  session.startTransaction();

  try {
    // ensure course exists
    const course = await Course.findById(courseId).session(session);
    if (!course) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course not found!');
    }

    // find & update lecture
    const lecture = await Lecture.findOneAndUpdate(
      { _id: lectureId, courseId },
      { $set: payload },
      { new: true, session },
    );

    if (!lecture) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Lecture not found for this course',
      );
    }

    // CRITICAL FIX: Update the course's updatedAt timestamp to reflect lecture changes
    // This ensures course creator endpoints return fresh data with correct timestamps
    await Course.findByIdAndUpdate(
      courseId,
      { $set: { updatedAt: new Date() } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // CRITICAL FIX: Invalidate cache AFTER successful database transaction
    // This prevents race conditions where cache is invalidated before DB update completes
    try {
      const { apiCache, queryCache } = await import('../../middlewares/cachingMiddleware');

      // Comprehensive cache invalidation for all related data
      const tagsToInvalidate = [
        'course_content',
        'course_list',
        'user_data',
        'course_creator',
        'lecture_content',
        'lecture_list',
        `course_${courseId}`,
        `lecture_${lectureId}`,
        `creator_courses`,
        `creator_lectures`
      ];

      await Promise.all([
        apiCache.invalidateByTags(tagsToInvalidate),
        queryCache.invalidateByTags(tagsToInvalidate),
      ]);

      console.log(`✅ Cache invalidated successfully after lecture update (${tagsToInvalidate.length} tag types)`);
    } catch (cacheError) {
      console.error('⚠️ Cache invalidation failed after lecture update:', cacheError);
      // Don't throw error - the database update was successful
    }

    return lecture;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const deleteLecture = async (courseId: string, lectureId: string) => {
  const session = await startSession();
  session.startTransaction();

  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid course ID format');
    }

    if (!mongoose.Types.ObjectId.isValid(lectureId)) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid lecture ID format');
    }

    // Check if course exists
    const course = await Course.findById(courseId).session(session);
    if (!course) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course not found!');
    }

    // Find the lecture to be deleted
    const lectureToDelete = await Lecture.findOne({ _id: lectureId, courseId }).session(session);
    if (!lectureToDelete) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Lecture not found for this course',
      );
    }

    // Get the order of the lecture being deleted
    const deletedOrder = lectureToDelete.order;

    // Delete the lecture
    await Lecture.findOneAndDelete({ _id: lectureId, courseId }).session(session);

    // Remove lecture from course's lectures array
    course.lectures = course.lectures?.filter(
      (lecture) => lecture.toString() !== lectureId
    );
    await course.save({ session });

    // Update the order of remaining lectures (shift down lectures with higher order)
    await Lecture.updateMany(
      { courseId, order: { $gt: deletedOrder } },
      { $inc: { order: -1 } }
    ).session(session);

    await session.commitTransaction();
    session.endSession();

    return {
      message: 'Lecture deleted successfully',
      deletedLectureId: lectureId,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const LectureService = {
  createLecture,
  getLecturesByCourseId,
  getLectureById,
  updateLectureOrder,
  updateLecture,
  deleteLecture,
};
