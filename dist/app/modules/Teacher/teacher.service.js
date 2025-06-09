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
exports.TeacherService = void 0;
const AppError_1 = __importDefault(require("../../errors/AppError"));
const teacher_model_1 = require("./teacher.model");
const http_status_1 = __importDefault(require("http-status"));
const course_model_1 = require("../Course/course.model");
const student_model_1 = require("../Student/student.model");
const lecture_model_1 = require("../Lecture/lecture.model");
const connectStripe = (teacherId, stripeData) => __awaiter(void 0, void 0, void 0, function* () {
    const teacher = yield teacher_model_1.Teacher.findById(teacherId);
    if (!teacher) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
    }
    teacher.stripeAccountId = stripeData.stripeAccountId;
    teacher.stripeEmail = stripeData.stripeEmail;
    yield teacher.save();
    return teacher;
});
/**
 * Get all enrolled students for a teacher's courses with their progress
 * @param teacherId - The ID of the teacher
 * @returns Array of students with their enrollment and progress data
 */
const getEnrolledStudentsWithProgress = (teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    // Find the teacher
    const teacher = yield teacher_model_1.Teacher.findById(teacherId);
    if (!teacher) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
    }
    // Get all courses created by this teacher
    const courses = yield course_model_1.Course.find({ creator: teacherId });
    if (!courses.length) {
        return []; // No courses, so no students
    }
    // Get all course IDs
    const courseIds = courses.map(course => course._id);
    // Find all students enrolled in any of these courses
    const students = yield student_model_1.Student.find({
        'enrolledCourses.courseId': { $in: courseIds }
    });
    if (!students.length) {
        return []; // No enrolled students
    }
    // Create a map of course ID to course details for quick lookup
    const courseMap = new Map();
    for (const course of courses) {
        // Get lectures for this course
        const lectures = yield lecture_model_1.Lecture.find({ courseId: course._id });
        courseMap.set(course._id.toString(), {
            _id: course._id,
            title: course.title,
            totalLectures: lectures.length,
            lectures: lectures
        });
    }
    // Process each student to include their course progress
    const studentsWithProgress = yield Promise.all(students.map((student) => __awaiter(void 0, void 0, void 0, function* () {
        // Filter enrollments to only include courses by this teacher
        const relevantEnrollments = student.enrolledCourses.filter(enrollment => courseMap.has(enrollment.courseId.toString()));
        // Process each enrollment to include progress details
        const enrollmentDetails = relevantEnrollments.map(enrollment => {
            const courseId = enrollment.courseId.toString();
            const course = courseMap.get(courseId);
            if (!course)
                return null; // Skip if course not found (shouldn't happen)
            // Get completed lecture IDs as strings for comparison
            const completedLectureIds = enrollment.completedLectures.map(id => id.toString());
            const completedLectures = completedLectureIds.length;
            // Calculate progress percentage
            const totalLectures = course.totalLectures;
            const validCompletedLectures = Math.min(completedLectures, totalLectures);
            // Check if ALL lectures are completed
            const allLecturesCompleted = totalLectures > 0 &&
                course.lectures.every((lecture) => completedLectureIds.includes(lecture._id.toString()));
            // Only show 100% if ALL lectures are completed
            const progress = totalLectures > 0
                ? (allLecturesCompleted
                    ? 100
                    : Math.min(99, Math.round((validCompletedLectures / totalLectures) * 100)))
                : 0;
            return {
                courseId,
                title: course.title,
                totalLectures,
                completedLectures: validCompletedLectures,
                progress,
                certificateGenerated: enrollment.certificateGenerated || false,
                enrolledAt: enrollment.enrolledAt
            };
        }).filter(Boolean); // Remove any null entries
        return {
            _id: student._id,
            name: student.name,
            email: student.email,
            profileImg: student.profileImg,
            enrolledCourses: enrollmentDetails
        };
    })));
    return studentsWithProgress;
});
exports.TeacherService = {
    connectStripe,
    getEnrolledStudentsWithProgress,
};
