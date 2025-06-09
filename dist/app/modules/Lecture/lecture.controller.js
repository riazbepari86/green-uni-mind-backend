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
exports.LectureController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const lecture_service_1 = require("./lecture.service");
const http_status_1 = __importDefault(require("http-status"));
const createLecture = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { courseId } = req.params;
    // Process the request body to handle adaptive streaming data
    const lectureData = req.body;
    // Ensure videoResolutions is properly formatted if present
    if (lectureData.videoResolutions && Array.isArray(lectureData.videoResolutions)) {
        // Make sure each resolution has the required fields
        lectureData.videoResolutions = lectureData.videoResolutions.map((resolution) => ({
            url: resolution.url,
            quality: resolution.quality,
            format: resolution.format || undefined
        }));
    }
    const newLecture = yield lecture_service_1.LectureService.createLecture(lectureData, courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Lecture created successfully',
        data: newLecture,
    });
}));
const getLecturesByCourseId = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { courseId } = req.params;
    const lectures = yield lecture_service_1.LectureService.getLecturesByCourseId(courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'All lectures fetched for the course',
        data: lectures,
    });
}));
const getLectureById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const user = req.user;
    const lecture = yield lecture_service_1.LectureService.getLectureById(id, user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Lecture fetched successfully',
        data: lecture,
    });
}));
const updateLectureOrder = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { courseId } = req.params;
    const { lectures } = req.body;
    const updatedLectures = yield lecture_service_1.LectureService.updateLectureOrder(courseId, lectures);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Lecture order updated successfully',
        data: updatedLectures,
    });
}));
const updateLecture = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { courseId, lectureId } = req.params;
    const payload = req.body;
    // Process the payload to handle adaptive streaming data
    if (payload.videoResolutions && Array.isArray(payload.videoResolutions)) {
        // Make sure each resolution has the required fields
        payload.videoResolutions = payload.videoResolutions.map((resolution) => ({
            url: resolution.url,
            quality: resolution.quality,
            format: resolution.format || undefined
        }));
    }
    const updated = yield lecture_service_1.LectureService.updateLecture(courseId, lectureId, payload);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Lecture updated successfully',
        data: updated,
    });
}));
exports.LectureController = {
    createLecture,
    getLectureById,
    getLecturesByCourseId,
    updateLectureOrder,
    updateLecture,
};
