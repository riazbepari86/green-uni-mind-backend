"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookmarkRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const bookmark_validation_1 = require("./bookmark.validation");
const bookmark_controller_1 = require("./bookmark.controller");
const router = (0, express_1.Router)();
// Create a bookmark
router.post('/:studentId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(bookmark_validation_1.BookmarkValidation.createBookmarkZodSchema), bookmark_controller_1.BookmarkController.createBookmark);
// Get bookmarks by lecture and student
router.get('/:lectureId/:studentId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), bookmark_controller_1.BookmarkController.getBookmarksByLectureAndStudent);
// Update a bookmark
router.patch('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(bookmark_validation_1.BookmarkValidation.updateBookmarkZodSchema), bookmark_controller_1.BookmarkController.updateBookmark);
// Delete a bookmark
router.delete('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.student), bookmark_controller_1.BookmarkController.deleteBookmark);
// Get shared bookmarks for a lecture
router.get('/shared/:lectureId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), bookmark_controller_1.BookmarkController.getSharedBookmarks);
// Share a bookmark with other students
router.post('/share/:bookmarkId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(bookmark_validation_1.BookmarkValidation.shareBookmarkZodSchema), bookmark_controller_1.BookmarkController.shareBookmark);
// Get bookmarks by category
router.get('/category/:studentId/:category', (0, auth_1.default)(user_constant_1.USER_ROLE.student), bookmark_controller_1.BookmarkController.getBookmarksByCategory);
// Get bookmarks by tags
router.post('/tags/:studentId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(bookmark_validation_1.BookmarkValidation.getBookmarksByTagsZodSchema), bookmark_controller_1.BookmarkController.getBookmarksByTags);
exports.BookmarkRoutes = router;
