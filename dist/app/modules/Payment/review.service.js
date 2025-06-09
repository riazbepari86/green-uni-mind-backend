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
exports.ReviewServices = void 0;
const mongoose_1 = require("mongoose");
const review_model_1 = require("./review.model");
const student_model_1 = require("../Student/student.model");
const teacher_model_1 = require("../Teacher/teacher.model");
const course_model_1 = require("../Course/course.model");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const lecture_model_1 = require("../Lecture/lecture.model");
const createReview = (studentId, courseId, rating, comment) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const student = yield student_model_1.Student.findById(studentId);
    const course = yield course_model_1.Course.findById(courseId);
    const teacher = yield teacher_model_1.Teacher.findById(course === null || course === void 0 ? void 0 : course.creator);
    if (!student || !course || !teacher) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student, course, or teacher not found');
    }
    // Check if student has completed the course
    const courseProgress = (_a = student.enrolledCourses) === null || _a === void 0 ? void 0 : _a.find((course) => course.courseId.equals(courseId));
    if (!courseProgress) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Student is not enrolled in this course');
    }
    const totalLectures = yield lecture_model_1.Lecture.countDocuments({ course: courseId });
    if (courseProgress.completedLectures.length < totalLectures) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Student must complete all lectures before reviewing');
    }
    // Check if already reviewed
    const existingReview = yield review_model_1.Review.findOne({
        student: studentId,
        course: courseId,
    });
    if (existingReview) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Already reviewed this course');
    }
    // Create review
    const review = yield review_model_1.Review.create({
        student: new mongoose_1.Types.ObjectId(studentId),
        course: new mongoose_1.Types.ObjectId(courseId),
        teacher: new mongoose_1.Types.ObjectId(teacher._id),
        rating,
        comment,
    });
    // Update course average rating
    const courseReviews = yield review_model_1.Review.find({ course: courseId });
    const averageRating = courseReviews.reduce((sum, review) => sum + review.rating, 0) /
        courseReviews.length;
    yield course_model_1.Course.findByIdAndUpdate(courseId, {
        averageRating,
    });
    // Update teacher average rating
    const teacherReviews = yield review_model_1.Review.find({ teacher: teacher._id });
    const teacherAverageRating = teacherReviews.reduce((sum, review) => sum + review.rating, 0) /
        teacherReviews.length;
    yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
        averageRating: teacherAverageRating,
    });
    return review;
});
const getCourseReviews = (courseId) => __awaiter(void 0, void 0, void 0, function* () {
    const reviews = yield review_model_1.Review.find({ course: courseId })
        .populate('student', 'name email profileImg')
        .sort({ createdAt: -1 });
    return reviews;
});
const getTeacherReviews = (teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    const reviews = yield review_model_1.Review.find({ teacher: teacherId })
        .populate('student', 'name email profileImg')
        .populate('course', 'title')
        .sort({ createdAt: -1 });
    return reviews;
});
exports.ReviewServices = {
    createReview,
    getCourseReviews,
    getTeacherReviews,
};
