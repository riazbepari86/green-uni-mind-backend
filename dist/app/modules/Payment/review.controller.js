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
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const teacher_model_1 = require("../Teacher/teacher.model");
const review_service_1 = require("./review.service");
/**
 * Helper function to validate and resolve teacher ID
 * Handles cases where frontend passes user._id instead of teacher._id
 */
const validateAndResolveTeacherId = (teacherId, authenticatedUser) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🔍 validateAndResolveTeacherId called with:', {
        teacherId,
        userRole: authenticatedUser.role,
        userId: authenticatedUser._id,
    });
    if (authenticatedUser.role !== 'teacher') {
        console.log('✅ Non-teacher user, returning original teacherId');
        return teacherId; // For non-teacher users, return as-is
    }
    // Try to find teacher by the provided ID first
    console.log('🔍 Looking for teacher by ID:', teacherId);
    let teacher = yield teacher_model_1.Teacher.findById(teacherId);
    console.log('📊 Teacher.findById result:', teacher ? 'Found' : 'Not found');
    // If not found, try to find by user ID (common case when frontend passes user._id)
    if (!teacher) {
        console.log('🔍 Looking for teacher by user ID:', teacherId);
        teacher = yield teacher_model_1.Teacher.findOne({ user: teacherId });
        console.log('📊 Teacher.findOne({user}) result:', teacher ? 'Found' : 'Not found');
    }
    // Validate that the teacher belongs to the authenticated user
    if (!teacher) {
        console.log('❌ No teacher found for ID:', teacherId);
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Teacher not found');
    }
    console.log('🔍 Teacher found:', {
        teacherId: teacher._id,
        userId: teacher.user,
    });
    if (teacher.user.toString() !== authenticatedUser._id) {
        console.log('❌ Teacher user mismatch:', {
            teacherUserId: teacher.user.toString(),
            authenticatedUserId: authenticatedUser._id,
        });
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You can only access your own data');
    }
    console.log('✅ Teacher validation successful, returning teacher ID:', teacher._id.toString());
    return teacher._id.toString();
});
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
const getTeacherReviewStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    const actualTeacherId = yield validateAndResolveTeacherId(teacherId, user);
    const result = yield review_service_1.ReviewServices.getTeacherReviewStats(actualTeacherId);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Teacher review statistics retrieved successfully',
        data: result,
    });
}));
const getTeacherReviewDashboard = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    const actualTeacherId = yield validateAndResolveTeacherId(teacherId, user);
    const result = yield review_service_1.ReviewServices.getTeacherReviewDashboard(actualTeacherId);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Teacher review dashboard data retrieved successfully',
        data: result,
    });
}));
exports.ReviewControllers = {
    createReview,
    getCourseReviews,
    getTeacherReviews,
    getTeacherReviewStats,
    getTeacherReviewDashboard,
};
