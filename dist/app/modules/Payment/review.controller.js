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
exports.ReviewControllers = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const review_service_1 = require("./review.service");
const createReview = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId, courseId, rating, comment } = req.body;
    const result = yield review_service_1.ReviewServices.createReview(studentId, courseId, rating, comment);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Review created successfully',
        data: result,
    });
}));
const getCourseReviews = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { courseId } = req.params;
    const result = yield review_service_1.ReviewServices.getCourseReviews(courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Course reviews retrieved successfully',
        data: result,
    });
}));
const getTeacherReviews = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const result = yield review_service_1.ReviewServices.getTeacherReviews(teacherId);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Teacher reviews retrieved successfully',
        data: result,
    });
}));
exports.ReviewControllers = {
    createReview,
    getCourseReviews,
    getTeacherReviews,
};
