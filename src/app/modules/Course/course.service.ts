/* eslint-disable no-undef */
/* eslint-disable no-console */
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import {
  deleteFileFromCloudinary,
  extractPublicIdFromUrl,
  sendFileToCloudinary,
} from '../../utils/sendImageToCloudinary';
import { Teacher } from '../Teacher/teacher.model';
import { Category } from '../Category/category.model';
import { SubCategory } from '../SubCategory/subCategory.model';
import { courseSearchableFields } from './course.constant';
import { ICourse } from './course.interface';
import { Course } from './course.model';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { Lecture } from '../Lecture/lecture.model';
import { Bookmark } from '../Bookmark/bookmark.model';
import { Note } from '../Note/note.model';
import { Question } from '../Question/question.model';
import Express from 'express';
// WebSocket removed - replaced with SSE/Polling system
// RealTimeAnalyticsService removed - using standard API patterns

const createCourse = async (
  payload: ICourse,
  id: string,
  file?: Express.Request['file'],
) => {
  try {
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      throw new Error('Teacher not found');
    }

    if (payload.categoryId) {
      const category = await Category.findById(payload.categoryId);
      if (!category) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid category ID');
      }
    }

    if (payload.subcategoryId) {
      const subcategory = await SubCategory.findById(payload.subcategoryId);
      if (!subcategory) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid subcategory ID');
      }

      if (payload.categoryId && subcategory.categoryId.toString() !== payload.categoryId.toString()) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Subcategory does not belong to the selected category');
      }
    }

    const promises: Promise<any>[] = [];

    if (file?.path) {
      const imageName = `${payload.title.replace(/\s+/g, '_')}_${Date.now()}`;

      // Schedule image upload to Cloudinary
      const uploadPromise = sendFileToCloudinary(imageName, file.path).then(
        ({ secure_url, public_id }) => {
          payload.courseThumbnail = secure_url;
          payload.courseThumbnailPublicId = public_id;
          console.log('Thumbnail uploaded:', secure_url, public_id);
        },
      );

      promises.push(uploadPromise);
    }

    // Wait for all promises to resolve
    await Promise.all(promises);

    // Convert coursePrice to number if it exists
    if (payload.coursePrice) {
      payload.coursePrice = Number(payload.coursePrice);
    }

    // Create the course with the updated payload
    const result = await Course.create({
      ...payload,
      creator: teacher._id,
    });

    return result;
  } catch (error: any) {
    // eslint-disable-next-line no-undef
    console.log(error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create course',
    );
  }
};

const searchCourse = async (query: Record<string, unknown>) => {
  const searchableQuery = new QueryBuilder(
    Course.find({ isPublished: true })
      .populate({
        path: 'creator',
        select: 'name profileImg',
      })
      .populate({
        path: 'categoryId',
        select: 'name slug icon',
      })
      .populate({
        path: 'subcategoryId',
        select: 'name slug',
      }),
    query,
  )
    .search(courseSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await searchableQuery.modelQuery;
  const meta = await searchableQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getPublishedCourse = async (query: Record<string, unknown>) => {
  const publishableQuery = new QueryBuilder(
    Course.find({ isPublished: true })
      .populate({
        path: 'creator',
        select: 'name profileImg',
      })
      .populate({
        path: 'categoryId',
        select: 'name slug icon',
      })
      .populate({
        path: 'subcategoryId',
        select: 'name slug',
      }),
    query,
  )
    .search(courseSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await publishableQuery.modelQuery;
  const meta = await publishableQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getCreatorCourse = async (id: string) => {
  const result = await Course.find({ creator: id }).sort({ createdAt: -1 });

  return result;
};

const updateCourse = async (
  courseId: string,
  payload: Partial<ICourse>,
  file?: Express.Request['file'],
) => {
  try {
    const promises: Promise<any>[] = [];

    if (file?.path) {
      // If old thumbnail exists, schedule deletion
      if (payload.courseThumbnail) {
        const publicId = extractPublicIdFromUrl(payload.courseThumbnail);
        if (publicId) {
          promises.push(deleteFileFromCloudinary(publicId));
        }
      }

      // Schedule new upload
      const uploadPromise = sendFileToCloudinary(
        file.originalname,
        file.path,
      ).then(({ secure_url }) => {
        payload.courseThumbnail = secure_url as string;
      });

      promises.push(uploadPromise);

      // Wait for both delete and upload to finish together
      await Promise.all(promises);
    }

    if (payload.creator) {
      const teacherExists = await Teacher.exists({ _id: payload.creator });
      if (!teacherExists) {
        throw new AppError(httpStatus.NOT_FOUND, 'Teacher Not Found!');
      }
    }

    const updatedCourse = await Course.findByIdAndUpdate(courseId, payload, {
      new: true,
      runValidators: true,
    });

    if (!updatedCourse) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course Not Found!');
    }

    // TODO: Broadcast real-time course update via SSE/Polling
    // realTimeAnalyticsService.broadcastCourseUpdate(courseId, {
    //   action: 'updated',
    //   course: updatedCourse,
    //   courseId: courseId
    // }, updatedCourse.teacher.toString());

    return updatedCourse;
  } catch (error) {
    console.error('Error updating course:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update course',
    );
  }
};

const getCourseById = async (id: string) => {
  const result = await Course.findById(id)
    .populate({
      path: 'creator',
      select: 'name profileImg',
    })
    .populate({
      path: 'categoryId',
      select: 'name slug icon',
    })
    .populate({
      path: 'subcategoryId',
      select: 'name slug',
    })
    .populate({
      path: 'lectures',
    });

  return result;
};

const getCourseByEnrolledStudentId = async (studentId: string) => {
  const result = await Course.find({ enrolledStudents: studentId })
    .populate({
      path: 'creator',
      select: 'name profileImg',
    })
    .populate({
      path: 'lectures',
    });

  return result;
};

const getPopularCourses = async (limit: number = 8) => {
  try {
    // Get popular courses based on enrollment count and published status
    // Sort by totalEnrollment in descending order to get most popular first
    const result = await Course.find({
      isPublished: true
      // Remove status filter for now as it might not be set consistently
    })
      .populate({
        path: 'creator',
        select: 'name profileImg',
      })
      .populate({
        path: 'lectures',
        select: '_id lectureTitle duration', // Only select necessary fields for performance
      })
      .sort({
        totalEnrollment: -1, // Primary sort by enrollment count
        createdAt: -1 // Secondary sort by newest first
      })
      .limit(limit);

    return result;
  } catch (error) {
    console.error('Error fetching popular courses:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch popular courses',
    );
  }
};

const editCourse = async (
  id: string,
  payload: Partial<ICourse>,
  file?: Express.Request['file'],
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if course exists
    const course = await Course.findById(id).session(session);
    if (!course) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course not found!');
    }

    // Handle file upload and delete old image if necessary
    if (file?.path) {
      // If old thumbnail exists, delete it from Cloudinary
      if (course.courseThumbnailPublicId) {
        await deleteFileFromCloudinary(course.courseThumbnailPublicId);
      }

      // Upload new thumbnail
      const imageName =
        `${payload.title || course.title}_${Date.now()}`.replace(/\s+/g, '_');
      const { secure_url, public_id } = await sendFileToCloudinary(
        imageName,
        file.path,
      );

      // Update payload with new thumbnail info
      payload.courseThumbnail = secure_url;
      payload.courseThumbnailPublicId = public_id;
    }

    // Convert coursePrice to number if it exists
    if (payload.coursePrice) {
      payload.coursePrice = Number(payload.coursePrice);
    }

    // Update the course
    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true, runValidators: true, session },
    );

    await session.commitTransaction();
    session.endSession();

    // TODO: Broadcast real-time course update via SSE/Polling
    // realTimeAnalyticsService.broadcastCourseUpdate(id, {
    //   action: 'updated',
    //   course: updatedCourse,
    //   courseId: id
    // }, updatedCourse?.teacher.toString());

    return updatedCourse;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const deleteCourse = async (id: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the course
    const course = await Course.findById(id).session(session);
    if (!course) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course not found!');
    }

    // Delete course thumbnail from Cloudinary if exists
    if (course.courseThumbnailPublicId) {
      await deleteFileFromCloudinary(course.courseThumbnailPublicId);
    }

    // Find all lectures associated with this course
    const lectures = await Lecture.find({ courseId: id }).session(session);

    // Delete all associated resources for each lecture
    for (const lecture of lectures) {
      // Delete lecture videos from Cloudinary if they exist
      if (lecture.videoUrl) {
        const publicId = extractPublicIdFromUrl(lecture.videoUrl);
        if (publicId) {
          await deleteFileFromCloudinary(publicId);
        }
      }

      // Delete video resolutions if they exist
      if (lecture.videoResolutions && lecture.videoResolutions.length > 0) {
        for (const resolution of lecture.videoResolutions) {
          const publicId = extractPublicIdFromUrl(resolution.url);
          if (publicId) {
            await deleteFileFromCloudinary(publicId);
          }
        }
      }

      // Delete HLS stream if it exists
      if (lecture.hlsUrl) {
        const publicId = extractPublicIdFromUrl(lecture.hlsUrl);
        if (publicId) {
          await deleteFileFromCloudinary(publicId);
        }
      }

      // Delete PDF if it exists
      if (lecture.pdfUrl) {
        const publicId = extractPublicIdFromUrl(lecture.pdfUrl);
        if (publicId) {
          await deleteFileFromCloudinary(publicId);
        }
      }

      // Delete all bookmarks associated with this lecture
      await Bookmark.deleteMany({ lectureId: lecture._id }).session(session);

      // Delete all notes associated with this lecture
      await Note.deleteMany({ lectureId: lecture._id }).session(session);

      // Delete all questions associated with this lecture
      await Question.deleteMany({ lectureId: lecture._id }).session(session);
    }

    // Delete all lectures associated with this course
    await Lecture.deleteMany({ courseId: id }).session(session);

    // Finally, delete the course
    await Course.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    return {
      message: 'Course and all associated resources deleted successfully',
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const CourseServices = {
  createCourse,
  searchCourse,
  getPublishedCourse,
  getCreatorCourse,
  updateCourse,
  getCourseById,
  getCourseByEnrolledStudentId,
  getPopularCourses,
  editCourse,
  deleteCourse,
};
