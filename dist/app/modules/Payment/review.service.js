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
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const course_model_1 = require("../Course/course.model");
const lecture_model_1 = require("../Lecture/lecture.model");
const student_model_1 = require("../Student/student.model");
const teacher_model_1 = require("../Teacher/teacher.model");
const review_model_1 = require("./review.model");
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
    const averageRating = courseReviews.reduce((sum, review) => sum + review.rating, 0) / courseReviews.length;
    yield course_model_1.Course.findByIdAndUpdate(courseId, {
        averageRating,
    });
    // Update teacher average rating
    const teacherReviews = yield review_model_1.Review.find({ teacher: teacher._id });
    const teacherAverageRating = teacherReviews.reduce((sum, review) => sum + review.rating, 0) / teacherReviews.length;
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
const getTeacherReviewStats = (teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    const reviews = yield review_model_1.Review.find({ teacher: teacherId });
    if (reviews.length === 0) {
        return {
            totalReviews: 0,
            averageRating: 0,
            ratingDistribution: {
                5: 0,
                4: 0,
                3: 0,
                2: 0,
                1: 0,
            },
            recentReviews: [],
            monthlyTrend: [],
        };
    }
    // Calculate average rating
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    // Calculate rating distribution
    const ratingDistribution = {
        5: reviews.filter((r) => r.rating === 5).length,
        4: reviews.filter((r) => r.rating === 4).length,
        3: reviews.filter((r) => r.rating === 3).length,
        2: reviews.filter((r) => r.rating === 2).length,
        1: reviews.filter((r) => r.rating === 1).length,
    };
    // Get recent reviews (last 5)
    const recentReviews = yield review_model_1.Review.find({ teacher: teacherId })
        .populate('student', 'name email profileImg')
        .populate('course', 'title')
        .sort({ createdAt: -1 })
        .limit(5);
    // Calculate monthly trend (last 6 months)
    const monthlyTrend = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthReviews = reviews.filter((review) => review.createdAt >= monthStart && review.createdAt <= monthEnd);
        const monthAverage = monthReviews.length > 0
            ? monthReviews.reduce((sum, review) => sum + review.rating, 0) /
                monthReviews.length
            : 0;
        monthlyTrend.push({
            month: monthStart.toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
            }),
            averageRating: Math.round(monthAverage * 10) / 10,
            reviewCount: monthReviews.length,
        });
    }
    return {
        totalReviews: reviews.length,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution,
        recentReviews,
        monthlyTrend,
    };
});
const getTeacherReviewDashboard = (teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    const stats = yield getTeacherReviewStats(teacherId);
    // Get course-wise review breakdown
    const courseReviews = yield review_model_1.Review.aggregate([
        { $match: { teacher: new mongoose_1.Types.ObjectId(teacherId) } },
        {
            $group: {
                _id: '$course',
                averageRating: { $avg: '$rating' },
                reviewCount: { $sum: 1 },
                latestReview: { $max: '$createdAt' },
            },
        },
        {
            $lookup: {
                from: 'courses',
                localField: '_id',
                foreignField: '_id',
                as: 'courseInfo',
            },
        },
        {
            $unwind: '$courseInfo',
        },
        {
            $project: {
                courseId: '$_id',
                courseName: '$courseInfo.title',
                averageRating: { $round: ['$averageRating', 1] },
                reviewCount: 1,
                latestReview: 1,
            },
        },
        { $sort: { reviewCount: -1 } },
    ]);
    return Object.assign(Object.assign({}, stats), { courseBreakdown: courseReviews, insights: {
            topRatedCourse: courseReviews.length > 0
                ? courseReviews.reduce((prev, current) => prev.averageRating > current.averageRating ? prev : current)
                : null,
            mostReviewedCourse: courseReviews.length > 0 ? courseReviews[0] : null,
            improvementAreas: stats.averageRating < 4
                ? [
                    'Consider improving course content quality',
                    'Focus on student engagement strategies',
                    'Gather more detailed feedback from students',
                ]
                : [],
        } });
});
exports.ReviewServices = {
    createReview,
    getCourseReviews,
    getTeacherReviews,
    getTeacherReviewStats,
    getTeacherReviewDashboard,
};
