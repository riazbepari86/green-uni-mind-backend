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
exports.StudentControllers = exports.markLectureComplete = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const student_service_1 = require("./student.service");
const enrollInCourse = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId } = req.params;
    const { courseId } = req.body;
    const result = yield student_service_1.StudentServices.enrolledInCourse(studentId, courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Enrolled in course successfully',
        data: result,
    });
}));
exports.markLectureComplete = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId } = req.params;
    const { courseId, lectureId } = req.body;
    console.log(`Marking lecture complete for student ${studentId}, course ${courseId}, lecture ${lectureId}`);
    const result = yield student_service_1.StudentServices.markLectureComplete(studentId, courseId, lectureId);
    console.log('Lecture marked as complete, returning result:', result);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Lecture marked as complete',
        data: result,
    });
}));
const getCourseProgress = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId, courseId } = req.params;
    const result = yield student_service_1.StudentServices.getCourseProgress(studentId, courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Course progress retrieved',
        data: result,
    });
}));
const getEnrolledCoursesWithProgress = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId } = req.params;
    const result = yield student_service_1.StudentServices.getEnrolledCoursesWithProgress(studentId);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Enrolled courses with progress retrieved',
        data: result,
    });
}));
exports.StudentControllers = {
    enrollInCourse,
    markLectureComplete: exports.markLectureComplete,
    getEnrolledCoursesWithProgress,
    getCourseProgress,
};
