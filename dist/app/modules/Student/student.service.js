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
exports.StudentServices = void 0;
const mongoose_1 = require("mongoose");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const student_model_1 = require("./student.model");
const http_status_1 = __importDefault(require("http-status"));
const lecture_model_1 = require("../Lecture/lecture.model");
const course_model_1 = require("../Course/course.model");
const enrolledInCourse = (studentId, courseId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const student = yield student_model_1.Student.findById(studentId);
    if (!student) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'User is not Found!');
    }
    const alreadyEnrolled = (_a = student === null || student === void 0 ? void 0 : student.enrolledCourses) === null || _a === void 0 ? void 0 : _a.some((course) => course.courseId.equals(courseId));
    if (alreadyEnrolled) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Already enrolled in this course');
    }
    student.enrolledCourses.push({
        courseId: new mongoose_1.Types.ObjectId(courseId),
        completedLectures: [],
        enrolledAt: new Date(),
    });
    return yield (student === null || student === void 0 ? void 0 : student.save());
});
const markLectureComplete = (studentId, courseId, lectureId) => __awaiter(void 0, void 0, void 0, function* () {
    // Update the student document to mark the lecture as complete
    const student = yield student_model_1.Student.findOneAndUpdate({
        _id: studentId,
        'enrolledCourses.courseId': courseId,
    }, {
        $addToSet: { 'enrolledCourses.$.completedLectures': lectureId },
    }, { new: true });
    if (!student) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student or course not found');
    }
    // Get the updated course progress to return
    const progress = yield getCourseProgress(studentId, courseId);
    return progress;
});
const getCourseProgress = (studentId, courseId) => __awaiter(void 0, void 0, void 0, function* () {
    // Find student and verify enrollment
    const student = yield student_model_1.Student.findById(studentId);
    if (!student) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student not found');
    }
    const courseProgress = student === null || student === void 0 ? void 0 : student.enrolledCourses.find((c) => c.courseId.equals(courseId));
    if (!courseProgress) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student not enrolled in this course');
    }
    // Get all lectures for this course
    const lectures = yield lecture_model_1.Lecture.find({ courseId });
    const totalLectures = lectures.length;
    // Get completed lecture IDs as strings for comparison
    const completedLectureIds = courseProgress.completedLectures.map((id) => id.toString());
    const completed = completedLectureIds.length;
    // Calculate percentage (capped at 100%)
    // First ensure completed doesn't exceed totalLectures
    const validCompleted = Math.min(completed, totalLectures);
    // Check if ALL lectures are actually completed by verifying each lecture ID
    // This ensures we don't just count the number but verify the exact lectures
    const allLecturesCompleted = totalLectures > 0 &&
        lectures.every(lecture => completedLectureIds.includes(lecture._id.toString()));
    // Only show 100% if ALL lectures are completed
    const percentage = totalLectures > 0
        ? (allLecturesCompleted
            ? 100
            : Math.min(99, Math.round((validCompleted / totalLectures) * 100)))
        : 0;
    // Get detailed lecture progress
    const lectureProgress = lectures
        .map((lecture) => ({
        lectureId: lecture._id.toString(),
        title: lecture.lectureTitle,
        isCompleted: completedLectureIds.includes(lecture._id.toString()),
        duration: lecture.duration || 0,
        order: lecture.order || 0,
    }))
        .sort((a, b) => a.order - b.order);
    // Check if all required lectures are completed
    // Only allow certificate if ALL lectures are completed (not just percentage)
    const canGenerateCertificate = allLecturesCompleted && !courseProgress.certificateGenerated;
    return {
        courseId,
        totalLectures,
        completedLectures: validCompleted, // Use the valid completed count
        percentage,
        certificateGenerated: (courseProgress === null || courseProgress === void 0 ? void 0 : courseProgress.certificateGenerated) || false,
        enrolledAt: (courseProgress === null || courseProgress === void 0 ? void 0 : courseProgress.enrolledAt) || new Date(),
        lastUpdated: new Date(),
        lectureProgress,
        canGenerateCertificate,
        remainingLectures: Math.max(0, totalLectures - validCompleted), // Ensure this is never negative
    };
});
const generateCertificate = (studentId, courseId) => __awaiter(void 0, void 0, void 0, function* () {
    // Get all lectures for this course
    const lectures = yield lecture_model_1.Lecture.find({ courseId });
    const totalLectures = lectures.length;
    const student = yield student_model_1.Student.findOne({
        _id: studentId,
        'enrolledCourses.courseId': courseId,
    });
    if (!student) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student or course not found');
    }
    const progress = student.enrolledCourses.find((c) => c.courseId.equals(courseId));
    if (!progress) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student not enrolled in this course');
    }
    // Get completed lecture IDs
    const completedLectureIds = progress.completedLectures.map(id => id.toString());
    // Check if all lectures are actually completed by verifying each lecture ID
    const allLecturesCompleted = totalLectures > 0 &&
        lectures.every(lecture => completedLectureIds.includes(lecture._id.toString()));
    if (!allLecturesCompleted) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Course not yet completed. All lectures must be completed to generate a certificate.');
    }
    // Check if certificate is already generated
    if (progress.certificateGenerated) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Certificate has already been generated for this course.');
    }
    progress.certificateGenerated = true;
    yield student.save();
    return { certificate: 'certificate-url-or-id' };
});
const getEnrolledCoursesWithProgress = (studentId) => __awaiter(void 0, void 0, void 0, function* () {
    // Find student
    const student = yield student_model_1.Student.findById(studentId);
    if (!student) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student not found');
    }
    // Get all enrolled courses with progress
    const enrolledCoursesWithProgress = yield Promise.all(student.enrolledCourses.map((enrollment) => __awaiter(void 0, void 0, void 0, function* () {
        const courseId = enrollment.courseId;
        // Get course details
        const course = yield course_model_1.Course.findById(courseId).populate({
            path: 'creator',
            select: 'name profileImg',
        });
        if (!course)
            return null;
        // Get lectures for this course
        const lectures = yield lecture_model_1.Lecture.find({ courseId });
        const totalLectures = lectures.length;
        // Get completed lecture IDs as strings for comparison
        const completedLectureIds = enrollment.completedLectures.map(id => id.toString());
        const completedLectures = completedLectureIds.length;
        // Calculate progress percentage (capped at 100%)
        // First ensure completedLectures doesn't exceed totalLectures
        const validCompletedLectures = Math.min(completedLectures, totalLectures);
        // Check if ALL lectures are actually completed by verifying each lecture ID
        // This ensures we don't just count the number but verify the exact lectures
        const allLecturesCompleted = totalLectures > 0 &&
            lectures.every(lecture => completedLectureIds.includes(lecture._id.toString()));
        // Only show 100% if ALL lectures are completed
        const progress = totalLectures > 0
            ? (allLecturesCompleted
                ? 100
                : Math.min(99, Math.round((validCompletedLectures / totalLectures) * 100)))
            : 0;
        return {
            _id: course._id,
            title: course.title,
            description: course.description,
            courseThumbnail: course.courseThumbnail,
            creator: course.creator,
            lectures: lectures.map((l) => ({ _id: l._id, title: l.lectureTitle })),
            totalLectures,
            completedLectures: validCompletedLectures, // Use the valid completed count
            progress,
            certificateGenerated: enrollment.certificateGenerated || false,
            enrolledAt: enrollment.enrolledAt,
        };
    })));
    return enrolledCoursesWithProgress.filter(Boolean);
});
exports.StudentServices = {
    enrolledInCourse,
    markLectureComplete,
    getCourseProgress,
    generateCertificate,
    getEnrolledCoursesWithProgress,
};
