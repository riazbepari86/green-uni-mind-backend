import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { IBookmark } from './bookmark.interface';
import { Bookmark } from './bookmark.model';
import { Student } from '../Student/student.model';
import { Lecture } from '../Lecture/lecture.model';
import { Types } from 'mongoose';

const createBookmark = async (payload: IBookmark): Promise<IBookmark> => {
  // Check if student exists
  const student = await Student.findById(payload.studentId);
  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, 'Student not found');
  }

  // Check if lecture exists
  const lecture = await Lecture.findById(payload.lectureId);
  if (!lecture) {
    throw new AppError(httpStatus.NOT_FOUND, 'Lecture not found');
  }

  // Create bookmark
  const result = await Bookmark.create(payload);
  return result;
};

const getBookmarksByLectureAndStudent = async (
  lectureId: string,
  studentId: string,
): Promise<IBookmark[]> => {
  const bookmarks = await Bookmark.find({
    lectureId: new Types.ObjectId(lectureId),
    studentId: new Types.ObjectId(studentId),
  }).sort({ timestamp: 1 });

  return bookmarks;
};

const updateBookmark = async (
  id: string,
  payload: Partial<IBookmark>,
): Promise<IBookmark | null> => {
  const bookmark = await Bookmark.findByIdAndUpdate(id, payload, {
    new: true,
  });

  if (!bookmark) {
    throw new AppError(httpStatus.NOT_FOUND, 'Bookmark not found');
  }

  return bookmark;
};

const deleteBookmark = async (id: string): Promise<IBookmark | null> => {
  const bookmark = await Bookmark.findByIdAndDelete(id);

  if (!bookmark) {
    throw new AppError(httpStatus.NOT_FOUND, 'Bookmark not found');
  }

  return bookmark;
};

const getSharedBookmarks = async (lectureId: string): Promise<IBookmark[]> => {
  const bookmarks = await Bookmark.find({
    lectureId: new Types.ObjectId(lectureId),
    isShared: true,
  }).populate('studentId', 'name email');

  return bookmarks;
};

const shareBookmark = async (
  bookmarkId: string,
  studentIds: string[]
): Promise<IBookmark | null> => {
  const bookmark = await Bookmark.findById(bookmarkId);

  if (!bookmark) {
    throw new AppError(httpStatus.NOT_FOUND, 'Bookmark not found');
  }

  // Convert string IDs to ObjectIds
  const studentObjectIds = studentIds.map(id => new Types.ObjectId(id));

  // Set bookmark as shared and add students to sharedWith array
  bookmark.isShared = true;
  bookmark.sharedWith = studentObjectIds;

  await bookmark.save();
  return bookmark;
};

const getBookmarksByCategory = async (
  studentId: string,
  category: string
): Promise<IBookmark[]> => {
  const bookmarks = await Bookmark.find({
    studentId: new Types.ObjectId(studentId),
    category,
  }).sort({ timestamp: 1 });

  return bookmarks;
};

const getBookmarksByTags = async (
  studentId: string,
  tags: string[]
): Promise<IBookmark[]> => {
  const bookmarks = await Bookmark.find({
    studentId: new Types.ObjectId(studentId),
    tags: { $in: tags },
  }).sort({ timestamp: 1 });

  return bookmarks;
};

export const BookmarkService = {
  createBookmark,
  getBookmarksByLectureAndStudent,
  updateBookmark,
  deleteBookmark,
  getSharedBookmarks,
  shareBookmark,
  getBookmarksByCategory,
  getBookmarksByTags,
};
