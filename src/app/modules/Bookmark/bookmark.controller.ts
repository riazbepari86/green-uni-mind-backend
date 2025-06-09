import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { BookmarkService } from './bookmark.service';
import httpStatus from 'http-status';

const createBookmark = catchAsync(async (req: Request, res: Response) => {
  const { studentId } = req.params;
  const bookmarkData = { ...req.body, studentId };

  const result = await BookmarkService.createBookmark(bookmarkData);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Bookmark created successfully',
    data: result,
  });
});

const getBookmarksByLectureAndStudent = catchAsync(
  async (req: Request, res: Response) => {
    const { lectureId, studentId } = req.params;

    const result = await BookmarkService.getBookmarksByLectureAndStudent(
      lectureId,
      studentId,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Bookmarks retrieved successfully',
      data: result,
    });
  },
);

const updateBookmark = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await BookmarkService.updateBookmark(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Bookmark updated successfully',
    data: result,
  });
});

const deleteBookmark = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await BookmarkService.deleteBookmark(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Bookmark deleted successfully',
    data: result,
  });
});

const getSharedBookmarks = catchAsync(async (req: Request, res: Response) => {
  const { lectureId } = req.params;

  const result = await BookmarkService.getSharedBookmarks(lectureId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Shared bookmarks retrieved successfully',
    data: result,
  });
});

const shareBookmark = catchAsync(async (req: Request, res: Response) => {
  const { bookmarkId } = req.params;
  const { studentIds } = req.body;

  const result = await BookmarkService.shareBookmark(bookmarkId, studentIds);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Bookmark shared successfully',
    data: result,
  });
});

const getBookmarksByCategory = catchAsync(async (req: Request, res: Response) => {
  const { studentId, category } = req.params;

  const result = await BookmarkService.getBookmarksByCategory(studentId, category);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Bookmarks retrieved successfully',
    data: result,
  });
});

const getBookmarksByTags = catchAsync(async (req: Request, res: Response) => {
  const { studentId } = req.params;
  const { tags } = req.body;

  const result = await BookmarkService.getBookmarksByTags(studentId, tags);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Bookmarks retrieved successfully',
    data: result,
  });
});

export const BookmarkController = {
  createBookmark,
  getBookmarksByLectureAndStudent,
  updateBookmark,
  deleteBookmark,
  getSharedBookmarks,
  shareBookmark,
  getBookmarksByCategory,
  getBookmarksByTags,
};
