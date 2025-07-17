"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.LectureService = void 0;
const http_status_1 = __importDefault(require("http-status"));
const lecture_model_1 = require("./lecture.model");
const course_model_1 = require("../Course/course.model");
const student_model_1 = require("../Student/student.model");
const mongoose_1 = __importStar(require("mongoose"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const createLecture = (payload, courseId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        // Check if course exists
        const course = yield course_model_1.Course.findById(courseId).session(session);
        if (!course) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Course not found!');
        }
        // Get the current highest order number for this course (optimized query)
        const lastLecture = yield lecture_model_1.Lecture.findOne({ courseId })
            .select('order')
            .sort({ order: -1 })
            .lean()
            .session(session);
        // Set the new order (last order + 1 or 1 if no lectures exist)
        const newOrder = lastLecture ? lastLecture.order + 1 : 1;
        // Create lecture with the calculated order
        const lecture = yield lecture_model_1.Lecture.create([Object.assign(Object.assign({}, payload), { courseId, order: newOrder })], { session });
        // Add lecture to course
        (_a = course === null || course === void 0 ? void 0 : course.lectures) === null || _a === void 0 ? void 0 : _a.push(lecture[0]._id);
        yield course.save({ session });
        yield session.commitTransaction();
        session.endSession();
        // Invalidate cache AFTER successful database transaction
        try {
            const { apiCache, queryCache } = yield Promise.resolve().then(() => __importStar(require('../../middlewares/cachingMiddleware')));
            yield Promise.all([
                apiCache.invalidateByTags(['course_content', 'course_list', 'user_data', 'course_creator']),
                queryCache.invalidateByTags(['course_content', 'course_list', 'user_data', 'course_creator']),
            ]);
            console.log('✅ Cache invalidated successfully after lecture creation');
        }
        catch (cacheError) {
            console.error('⚠️ Cache invalidation failed after lecture creation:', cacheError);
        }
        return lecture[0];
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const getLecturesByCourseId = (courseId) => __awaiter(void 0, void 0, void 0, function* () {
    // Use lean() for better performance and select only necessary fields
    const lectures = yield lecture_model_1.Lecture.find({ courseId })
        .select('lectureTitle instruction videoUrl videoResolutions hlsUrl pdfUrl duration isPreviewFree order courseId createdAt updatedAt')
        .sort({ order: 1 })
        .lean(); // Returns plain JavaScript objects instead of Mongoose documents
    return lectures;
});
const getLectureById = (id, user) => __awaiter(void 0, void 0, void 0, function* () {
    // First, find the lecture to get its courseId
    const lecture = yield lecture_model_1.Lecture.findById(id);
    if (!lecture) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Lecture not found');
    }
    // If user is a teacher, they can access any lecture
    if ((user === null || user === void 0 ? void 0 : user.role) === 'teacher') {
        return lecture;
    }
    // If user is a student, check if they're enrolled in the course
    if ((user === null || user === void 0 ? void 0 : user.role) === 'student') {
        // Get the student by email
        const student = yield student_model_1.Student.findOne({ email: user.email });
        if (!student) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student not found');
        }
        // Check if the student is enrolled in the course
        const isEnrolled = student.enrolledCourses.some(course => course.courseId.toString() === lecture.courseId.toString());
        // If the lecture is marked as preview, allow access regardless of enrollment
        if (lecture.isPreviewFree) {
            return lecture;
        }
        // If student is enrolled, allow access
        if (isEnrolled) {
            return lecture;
        }
        // If student is not enrolled, deny access
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'You must be enrolled in this course to access this lecture');
    }
    // If no user or unknown role, deny access
    throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Unauthorized access');
});
const updateLectureOrder = (courseId, lectures) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        // Verify all lectures belong to the course
        const lectureIds = lectures.map((l) => l.lectureId);
        const existingLectures = yield lecture_model_1.Lecture.find({
            _id: { $in: lectureIds },
            courseId,
        }).session(session);
        if (existingLectures.length !== lectures.length) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Some lectures do not belong to this course');
        }
        // Sort lectures by new order to maintain sequence
        lectures.sort((a, b) => a.order - b.order);
        // Update each lecture's order
        const bulkOps = lectures.map((lecture) => ({
            updateOne: {
                filter: { _id: lecture.lectureId },
                update: { $set: { order: lecture.order } },
            },
        }));
        yield lecture_model_1.Lecture.bulkWrite(bulkOps, { session });
        // Update the course's lectures array to match the new order
        const course = yield course_model_1.Course.findById(courseId).session(session);
        if (course) {
            course.lectures = lectures.map((l) => new mongoose_1.default.Types.ObjectId(l.lectureId));
            yield course.save({ session });
        }
        yield session.commitTransaction();
        // Return the updated lectures with their full data, properly populated
        const updatedLectures = yield lecture_model_1.Lecture.find({
            _id: { $in: lectureIds },
        }).sort({ order: 1 });
        return updatedLectures;
    }
    catch (error) {
        if (session.inTransaction()) {
            yield session.abortTransaction();
        }
        throw error;
    }
    finally {
        session.endSession();
    }
});
const updateLecture = (courseId, lectureId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    // Validate ObjectId format
    if (!mongoose_1.default.Types.ObjectId.isValid(courseId)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid course ID format');
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(lectureId)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid lecture ID format');
    }
    // Start a session for transaction to ensure data consistency
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        // ensure course exists
        const course = yield course_model_1.Course.findById(courseId).session(session);
        if (!course) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Course not found!');
        }
        // find & update lecture
        const lecture = yield lecture_model_1.Lecture.findOneAndUpdate({ _id: lectureId, courseId }, { $set: payload }, { new: true, session });
        if (!lecture) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Lecture not found for this course');
        }
        // CRITICAL FIX: Update the course's updatedAt timestamp to reflect lecture changes
        // This ensures course creator endpoints return fresh data with correct timestamps
        yield course_model_1.Course.findByIdAndUpdate(courseId, { $set: { updatedAt: new Date() } }, { session });
        yield session.commitTransaction();
        session.endSession();
        // CRITICAL FIX: Invalidate cache AFTER successful database transaction
        // This prevents race conditions where cache is invalidated before DB update completes
        try {
            const { apiCache, queryCache } = yield Promise.resolve().then(() => __importStar(require('../../middlewares/cachingMiddleware')));
            // Comprehensive cache invalidation for all related data
            const tagsToInvalidate = [
                'course_content',
                'course_list',
                'user_data',
                'course_creator',
                'lecture_content',
                'lecture_list',
                `course_${courseId}`,
                `lecture_${lectureId}`,
                `creator_courses`,
                `creator_lectures`
            ];
            yield Promise.all([
                apiCache.invalidateByTags(tagsToInvalidate),
                queryCache.invalidateByTags(tagsToInvalidate),
            ]);
            console.log(`✅ Cache invalidated successfully after lecture update (${tagsToInvalidate.length} tag types)`);
        }
        catch (cacheError) {
            console.error('⚠️ Cache invalidation failed after lecture update:', cacheError);
            // Don't throw error - the database update was successful
        }
        return lecture;
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const deleteLecture = (courseId, lectureId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        // Validate ObjectId format
        if (!mongoose_1.default.Types.ObjectId.isValid(courseId)) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid course ID format');
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(lectureId)) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid lecture ID format');
        }
        // Check if course exists
        const course = yield course_model_1.Course.findById(courseId).session(session);
        if (!course) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Course not found!');
        }
        // Find the lecture to be deleted
        const lectureToDelete = yield lecture_model_1.Lecture.findOne({ _id: lectureId, courseId }).session(session);
        if (!lectureToDelete) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Lecture not found for this course');
        }
        // Get the order of the lecture being deleted
        const deletedOrder = lectureToDelete.order;
        // Delete the lecture
        yield lecture_model_1.Lecture.findOneAndDelete({ _id: lectureId, courseId }).session(session);
        // Remove lecture from course's lectures array
        course.lectures = (_a = course.lectures) === null || _a === void 0 ? void 0 : _a.filter((lecture) => lecture.toString() !== lectureId);
        yield course.save({ session });
        // Update the order of remaining lectures (shift down lectures with higher order)
        yield lecture_model_1.Lecture.updateMany({ courseId, order: { $gt: deletedOrder } }, { $inc: { order: -1 } }).session(session);
        yield session.commitTransaction();
        session.endSession();
        return {
            message: 'Lecture deleted successfully',
            deletedLectureId: lectureId,
        };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
exports.LectureService = {
    createLecture,
    getLecturesByCourseId,
    getLectureById,
    updateLectureOrder,
    updateLecture,
    deleteLecture,
};
