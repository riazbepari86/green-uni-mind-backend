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
exports.BookmarkService = void 0;
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const bookmark_model_1 = require("./bookmark.model");
const student_model_1 = require("../Student/student.model");
const lecture_model_1 = require("../Lecture/lecture.model");
const mongoose_1 = require("mongoose");
const createBookmark = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if student exists
    const student = yield student_model_1.Student.findById(payload.studentId);
    if (!student) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student not found');
    }
    // Check if lecture exists
    const lecture = yield lecture_model_1.Lecture.findById(payload.lectureId);
    if (!lecture) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Lecture not found');
    }
    // Create bookmark
    const result = yield bookmark_model_1.Bookmark.create(payload);
    return result;
});
const getBookmarksByLectureAndStudent = (lectureId, studentId) => __awaiter(void 0, void 0, void 0, function* () {
    const bookmarks = yield bookmark_model_1.Bookmark.find({
        lectureId: new mongoose_1.Types.ObjectId(lectureId),
        studentId: new mongoose_1.Types.ObjectId(studentId),
    }).sort({ timestamp: 1 });
    return bookmarks;
});
const updateBookmark = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const bookmark = yield bookmark_model_1.Bookmark.findByIdAndUpdate(id, payload, {
        new: true,
    });
    if (!bookmark) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Bookmark not found');
    }
    return bookmark;
});
const deleteBookmark = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const bookmark = yield bookmark_model_1.Bookmark.findByIdAndDelete(id);
    if (!bookmark) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Bookmark not found');
    }
    return bookmark;
});
const getSharedBookmarks = (lectureId) => __awaiter(void 0, void 0, void 0, function* () {
    const bookmarks = yield bookmark_model_1.Bookmark.find({
        lectureId: new mongoose_1.Types.ObjectId(lectureId),
        isShared: true,
    }).populate('studentId', 'name email');
    return bookmarks;
});
const shareBookmark = (bookmarkId, studentIds) => __awaiter(void 0, void 0, void 0, function* () {
    const bookmark = yield bookmark_model_1.Bookmark.findById(bookmarkId);
    if (!bookmark) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Bookmark not found');
    }
    // Convert string IDs to ObjectIds
    const studentObjectIds = studentIds.map(id => new mongoose_1.Types.ObjectId(id));
    // Set bookmark as shared and add students to sharedWith array
    bookmark.isShared = true;
    bookmark.sharedWith = studentObjectIds;
    yield bookmark.save();
    return bookmark;
});
const getBookmarksByCategory = (studentId, category) => __awaiter(void 0, void 0, void 0, function* () {
    const bookmarks = yield bookmark_model_1.Bookmark.find({
        studentId: new mongoose_1.Types.ObjectId(studentId),
        category,
    }).sort({ timestamp: 1 });
    return bookmarks;
});
const getBookmarksByTags = (studentId, tags) => __awaiter(void 0, void 0, void 0, function* () {
    const bookmarks = yield bookmark_model_1.Bookmark.find({
        studentId: new mongoose_1.Types.ObjectId(studentId),
        tags: { $in: tags },
    }).sort({ timestamp: 1 });
    return bookmarks;
});
exports.BookmarkService = {
    createBookmark,
    getBookmarksByLectureAndStudent,
    updateBookmark,
    deleteBookmark,
    getSharedBookmarks,
    shareBookmark,
    getBookmarksByCategory,
    getBookmarksByTags,
};
