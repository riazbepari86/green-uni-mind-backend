import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { BookmarkValidation } from './bookmark.validation';
import { BookmarkController } from './bookmark.controller';

const router = Router();

// Create a bookmark
router.post(
  '/:studentId',
  auth(USER_ROLE.student),
  validateRequest(BookmarkValidation.createBookmarkZodSchema),
  BookmarkController.createBookmark,
);

// Get bookmarks by lecture and student
router.get(
  '/:lectureId/:studentId',
  auth(USER_ROLE.student),
  BookmarkController.getBookmarksByLectureAndStudent,
);

// Update a bookmark
router.patch(
  '/:id',
  auth(USER_ROLE.student),
  validateRequest(BookmarkValidation.updateBookmarkZodSchema),
  BookmarkController.updateBookmark,
);

// Delete a bookmark
router.delete(
  '/:id',
  auth(USER_ROLE.student),
  BookmarkController.deleteBookmark,
);

// Get shared bookmarks for a lecture
router.get(
  '/shared/:lectureId',
  auth(USER_ROLE.student),
  BookmarkController.getSharedBookmarks,
);

// Share a bookmark with other students
router.post(
  '/share/:bookmarkId',
  auth(USER_ROLE.student),
  validateRequest(BookmarkValidation.shareBookmarkZodSchema),
  BookmarkController.shareBookmark,
);

// Get bookmarks by category
router.get(
  '/category/:studentId/:category',
  auth(USER_ROLE.student),
  BookmarkController.getBookmarksByCategory,
);

// Get bookmarks by tags
router.post(
  '/tags/:studentId',
  auth(USER_ROLE.student),
  validateRequest(BookmarkValidation.getBookmarksByTagsZodSchema),
  BookmarkController.getBookmarksByTags,
);

export const BookmarkRoutes = router;
