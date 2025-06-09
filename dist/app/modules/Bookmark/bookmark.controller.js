"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookmarkController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const bookmark_service_1 = require("./bookmark.service");
const http_status_1 = __importDefault(require("http-status"));
const createBookmark = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId } = req.params;
    const bookmarkData = Object.assign(Object.assign({}, req.body), { studentId });
    const result = yield bookmark_service_1.BookmarkService.createBookmark(bookmarkData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Bookmark created successfully',
        data: result,
    });
}));
const getBookmarksByLectureAndStudent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { lectureId, studentId } = req.params;
    const result = yield bookmark_service_1.BookmarkService.getBookmarksByLectureAndStudent(lectureId, studentId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Bookmarks retrieved successfully',
        data: result,
    });
}));
const updateBookmark = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield bookmark_service_1.BookmarkService.updateBookmark(id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Bookmark updated successfully',
        data: result,
    });
}));
const deleteBookmark = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield bookmark_service_1.BookmarkService.deleteBookmark(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Bookmark deleted successfully',
        data: result,
    });
}));
const getSharedBookmarks = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { lectureId } = req.params;
    const result = yield bookmark_service_1.BookmarkService.getSharedBookmarks(lectureId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Shared bookmarks retrieved successfully',
        data: result,
    });
}));
const shareBookmark = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { bookmarkId } = req.params;
    const { studentIds } = req.body;
    const result = yield bookmark_service_1.BookmarkService.shareBookmark(bookmarkId, studentIds);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Bookmark shared successfully',
        data: result,
    });
}));
const getBookmarksByCategory = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId, category } = req.params;
    const result = yield bookmark_service_1.BookmarkService.getBookmarksByCategory(studentId, category);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Bookmarks retrieved successfully',
        data: result,
    });
}));
const getBookmarksByTags = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId } = req.params;
    const { tags } = req.body;
    const result = yield bookmark_service_1.BookmarkService.getBookmarksByTags(studentId, tags);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Bookmarks retrieved successfully',
        data: result,
    });
}));
exports.BookmarkController = {
    createBookmark,
    getBookmarksByLectureAndStudent,
    updateBookmark,
    deleteBookmark,
    getSharedBookmarks,
    shareBookmark,
    getBookmarksByCategory,
    getBookmarksByTags,
};
