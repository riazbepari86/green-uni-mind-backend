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
exports.CourseServices = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importDefault(require("mongoose"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const sendImageToCloudinary_1 = require("../../utils/sendImageToCloudinary");
const bookmark_model_1 = require("../Bookmark/bookmark.model");
const category_model_1 = require("../Category/category.model");
const lecture_model_1 = require("../Lecture/lecture.model");
const note_model_1 = require("../Note/note.model");
const question_model_1 = require("../Question/question.model");
const subCategory_model_1 = require("../SubCategory/subCategory.model");
const teacher_model_1 = require("../Teacher/teacher.model");
const course_constant_1 = require("./course.constant");
const course_model_1 = require("./course.model");
// WebSocket removed - replaced with SSE/Polling system
// RealTimeAnalyticsService removed - using standard API patterns
const createCourse = (payload, id, file) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findById(id);
        if (!teacher) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
        }
        if (payload.categoryId) {
            const category = yield category_model_1.Category.findById(payload.categoryId);
            if (!category) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Category not found. Please select a valid category.');
            }
        }
        if (payload.subcategoryId) {
            const subcategory = yield subCategory_model_1.SubCategory.findById(payload.subcategoryId);
            if (!subcategory) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subcategory not found. Please select a valid subcategory.');
            }
            if (payload.categoryId &&
                subcategory.categoryId.toString() !== payload.categoryId.toString()) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Subcategory does not belong to the selected category. Please select a matching subcategory.');
            }
        }
        const promises = [];
        if (file === null || file === void 0 ? void 0 : file.path) {
            const imageName = `${payload.title.replace(/\s+/g, '_')}_${Date.now()}`;
            // Schedule image upload to Cloudinary
            const uploadPromise = (0, sendImageToCloudinary_1.sendFileToCloudinary)(imageName, file.path).then(({ secure_url, public_id }) => {
                payload.courseThumbnail = secure_url;
                payload.courseThumbnailPublicId = public_id;
            });
            promises.push(uploadPromise);
        }
        // Wait for all promises to resolve
        yield Promise.all(promises);
        // Convert coursePrice to number if it exists
        if (payload.coursePrice) {
            payload.coursePrice = Number(payload.coursePrice);
        }
        // Create the course with the updated payload
        const result = yield course_model_1.Course.create(Object.assign(Object.assign({}, payload), { creator: teacher._id }));
        return result;
    }
    catch (error) {
        // If it's already an AppError, re-throw it
        if (error instanceof AppError_1.default) {
            throw error;
        }
        // Handle specific MongoDB errors
        if (error.code === 11000) {
            throw new AppError_1.default(http_status_1.default.CONFLICT, 'A course with this title already exists');
        }
        // Generic error
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, error.message || 'Failed to create course');
    }
});
const searchCourse = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const searchableQuery = new QueryBuilder_1.default(course_model_1.Course.find({ isPublished: true })
        .populate({
        path: 'creator',
        select: 'name profileImg',
    })
        .populate({
        path: 'categoryId',
        select: 'name slug icon',
    })
        .populate({
        path: 'subcategoryId',
        select: 'name slug',
    }), query)
        .search(course_constant_1.courseSearchableFields)
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield searchableQuery.modelQuery;
    const meta = yield searchableQuery.countTotal();
    return {
        meta,
        result,
    };
});
const getPublishedCourse = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const publishableQuery = new QueryBuilder_1.default(course_model_1.Course.find({ isPublished: true })
        .populate({
        path: 'creator',
        select: 'name profileImg',
    })
        .populate({
        path: 'categoryId',
        select: 'name slug icon',
    })
        .populate({
        path: 'subcategoryId',
        select: 'name slug',
    }), query)
        .search(course_constant_1.courseSearchableFields)
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield publishableQuery.modelQuery;
    const meta = yield publishableQuery.countTotal();
    return {
        meta,
        result,
    };
});
const getCreatorCourse = (id) => __awaiter(void 0, void 0, void 0, function* () {
    // Validate ObjectId format
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid creator ID format');
    }
    const result = yield course_model_1.Course.find({ creator: id })
        .populate({
        path: 'lectures',
    })
        .sort({ createdAt: -1 });
    return result;
});
const updateCourse = (courseId, payload, file) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const promises = [];
        if (file === null || file === void 0 ? void 0 : file.path) {
            // If old thumbnail exists, schedule deletion
            if (payload.courseThumbnail) {
                const publicId = (0, sendImageToCloudinary_1.extractPublicIdFromUrl)(payload.courseThumbnail);
                if (publicId) {
                    promises.push((0, sendImageToCloudinary_1.deleteFileFromCloudinary)(publicId));
                }
            }
            // Schedule new upload
            const uploadPromise = (0, sendImageToCloudinary_1.sendFileToCloudinary)(file.originalname, file.path).then(({ secure_url }) => {
                payload.courseThumbnail = secure_url;
            });
            promises.push(uploadPromise);
            // Wait for both delete and upload to finish together
            yield Promise.all(promises);
        }
        if (payload.creator) {
            const teacherExists = yield teacher_model_1.Teacher.exists({ _id: payload.creator });
            if (!teacherExists) {
                throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher Not Found!');
            }
        }
        const updatedCourse = yield course_model_1.Course.findByIdAndUpdate(courseId, payload, {
            new: true,
            runValidators: true,
        });
        if (!updatedCourse) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Course Not Found!');
        }
        // TODO: Broadcast real-time course update via SSE/Polling
        // realTimeAnalyticsService.broadcastCourseUpdate(courseId, {
        //   action: 'updated',
        //   course: updatedCourse,
        //   courseId: courseId
        // }, updatedCourse.teacher.toString());
        return updatedCourse;
    }
    catch (error) {
        console.error('Error updating course:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to update course');
    }
});
const getCourseById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield course_model_1.Course.findById(id)
        .populate({
        path: 'creator',
        select: 'name profileImg',
    })
        .populate({
        path: 'categoryId',
        select: 'name slug icon',
    })
        .populate({
        path: 'subcategoryId',
        select: 'name slug',
    })
        .populate({
        path: 'lectures',
    });
    return result;
});
const getCourseByEnrolledStudentId = (studentId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield course_model_1.Course.find({ enrolledStudents: studentId })
        .populate({
        path: 'creator',
        select: 'name profileImg',
    })
        .populate({
        path: 'lectures',
    });
    return result;
});
const getPopularCourses = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (limit = 8) {
    try {
        // Get popular courses based on enrollment count and published status
        // Sort by totalEnrollment in descending order to get most popular first
        const result = yield course_model_1.Course.find({
            isPublished: true,
            // Remove status filter for now as it might not be set consistently
        })
            .populate({
            path: 'creator',
            select: 'name profileImg',
        })
            .populate({
            path: 'lectures',
            select: '_id lectureTitle duration', // Only select necessary fields for performance
        })
            .sort({
            totalEnrollment: -1, // Primary sort by enrollment count
            createdAt: -1, // Secondary sort by newest first
        })
            .limit(limit);
        return result;
    }
    catch (error) {
        console.error('Error fetching popular courses:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to fetch popular courses');
    }
});
const editCourse = (id, payload, file) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        console.log('🔄 EditCourse Service - Received payload:', JSON.stringify(payload, null, 2));
        // Check if course exists
        const course = yield course_model_1.Course.findById(id).session(session);
        if (!course) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Course not found!');
        }
        console.log('📋 EditCourse Service - Current course title:', course.title);
        // Handle file upload and delete old image if necessary
        if (file === null || file === void 0 ? void 0 : file.path) {
            // If old thumbnail exists, delete it from Cloudinary
            if (course.courseThumbnailPublicId) {
                yield (0, sendImageToCloudinary_1.deleteFileFromCloudinary)(course.courseThumbnailPublicId);
            }
            // Upload new thumbnail
            const imageName = `${payload.title || course.title}_${Date.now()}`.replace(/\s+/g, '_');
            const { secure_url, public_id } = yield (0, sendImageToCloudinary_1.sendFileToCloudinary)(imageName, file.path);
            // Update payload with new thumbnail info
            payload.courseThumbnail = secure_url;
            payload.courseThumbnailPublicId = public_id;
        }
        // Convert coursePrice to number if it exists
        if (payload.coursePrice) {
            payload.coursePrice = Number(payload.coursePrice);
        }
        // Create a new object with only the fields to be updated
        // Fixed: Check for undefined/null instead of falsy values to allow empty strings
        const updateData = {};
        if (payload.title !== undefined)
            updateData.title = payload.title;
        if (payload.subtitle !== undefined)
            updateData.subtitle = payload.subtitle;
        if (payload.description !== undefined)
            updateData.description = payload.description;
        if (payload.categoryId !== undefined)
            updateData.categoryId = payload.categoryId;
        if (payload.subcategoryId !== undefined)
            updateData.subcategoryId = payload.subcategoryId;
        if (payload.courseLevel !== undefined)
            updateData.courseLevel = payload.courseLevel;
        if (payload.coursePrice !== undefined)
            updateData.coursePrice = payload.coursePrice;
        if (payload.courseThumbnail !== undefined)
            updateData.courseThumbnail = payload.courseThumbnail;
        if (payload.courseThumbnailPublicId !== undefined)
            updateData.courseThumbnailPublicId = payload.courseThumbnailPublicId;
        if (payload.isPublished !== undefined)
            updateData.isPublished = payload.isPublished;
        if (payload.status !== undefined)
            updateData.status = payload.status;
        if (payload.isFree !== undefined)
            updateData.isFree = payload.isFree;
        if (payload.learningObjectives !== undefined)
            updateData.learningObjectives = payload.learningObjectives;
        if (payload.prerequisites !== undefined)
            updateData.prerequisites = payload.prerequisites;
        if (payload.targetAudience !== undefined)
            updateData.targetAudience = payload.targetAudience;
        if (payload.estimatedDuration !== undefined)
            updateData.estimatedDuration = payload.estimatedDuration;
        if (payload.language !== undefined)
            updateData.language = payload.language;
        if (payload.hasSubtitles !== undefined)
            updateData.hasSubtitles = payload.hasSubtitles;
        if (payload.hasCertificate !== undefined)
            updateData.hasCertificate = payload.hasCertificate;
        console.log('📝 EditCourse Service - Update data to be applied:', JSON.stringify(updateData, null, 2));
        // Update the course
        const updatedCourse = yield course_model_1.Course.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true, session })
            .populate({
            path: 'creator',
            select: 'name profileImg',
        })
            .populate({
            path: 'categoryId',
            select: 'name slug icon',
        })
            .populate({
            path: 'subcategoryId',
            select: 'name slug',
        })
            .populate({
            path: 'lectures',
        });
        yield session.commitTransaction();
        session.endSession();
        console.log('✅ EditCourse Service - Updated course title:', updatedCourse === null || updatedCourse === void 0 ? void 0 : updatedCourse.title);
        console.log('📤 EditCourse Service - Returning updated course with ID:', updatedCourse === null || updatedCourse === void 0 ? void 0 : updatedCourse._id);
        return updatedCourse;
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const deleteCourse = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Find the course
        const course = yield course_model_1.Course.findById(id).session(session);
        if (!course) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Course not found!');
        }
        // Delete course thumbnail from Cloudinary if exists
        if (course.courseThumbnailPublicId) {
            yield (0, sendImageToCloudinary_1.deleteFileFromCloudinary)(course.courseThumbnailPublicId);
        }
        // Find all lectures associated with this course
        const lectures = yield lecture_model_1.Lecture.find({ courseId: id }).session(session);
        // Delete all associated resources for each lecture
        for (const lecture of lectures) {
            // Delete lecture videos from Cloudinary if they exist
            if (lecture.videoUrl) {
                const publicId = (0, sendImageToCloudinary_1.extractPublicIdFromUrl)(lecture.videoUrl);
                if (publicId) {
                    yield (0, sendImageToCloudinary_1.deleteFileFromCloudinary)(publicId);
                }
            }
            // Delete video resolutions if they exist
            if (lecture.videoResolutions && lecture.videoResolutions.length > 0) {
                for (const resolution of lecture.videoResolutions) {
                    const publicId = (0, sendImageToCloudinary_1.extractPublicIdFromUrl)(resolution.url);
                    if (publicId) {
                        yield (0, sendImageToCloudinary_1.deleteFileFromCloudinary)(publicId);
                    }
                }
            }
            // Delete HLS stream if it exists
            if (lecture.hlsUrl) {
                const publicId = (0, sendImageToCloudinary_1.extractPublicIdFromUrl)(lecture.hlsUrl);
                if (publicId) {
                    yield (0, sendImageToCloudinary_1.deleteFileFromCloudinary)(publicId);
                }
            }
            // Delete PDF if it exists
            if (lecture.pdfUrl) {
                const publicId = (0, sendImageToCloudinary_1.extractPublicIdFromUrl)(lecture.pdfUrl);
                if (publicId) {
                    yield (0, sendImageToCloudinary_1.deleteFileFromCloudinary)(publicId);
                }
            }
            // Delete all bookmarks associated with this lecture
            yield bookmark_model_1.Bookmark.deleteMany({ lectureId: lecture._id }).session(session);
            // Delete all notes associated with this lecture
            yield note_model_1.Note.deleteMany({ lectureId: lecture._id }).session(session);
            // Delete all questions associated with this lecture
            yield question_model_1.Question.deleteMany({ lectureId: lecture._id }).session(session);
        }
        // Delete all lectures associated with this course
        yield lecture_model_1.Lecture.deleteMany({ courseId: id }).session(session);
        // Finally, delete the course
        yield course_model_1.Course.findByIdAndDelete(id).session(session);
        yield session.commitTransaction();
        session.endSession();
        return {
            message: 'Course and all associated resources deleted successfully',
        };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const getAllCourses = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const courseQuery = new QueryBuilder_1.default(course_model_1.Course.find()
        .populate('creator', 'name email')
        .populate('categoryId', 'name'), query)
        .search(['title', 'description'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield courseQuery.modelQuery;
    const meta = yield courseQuery.countTotal();
    return {
        meta,
        result,
    };
});
exports.CourseServices = {
    createCourse,
    searchCourse,
    getPublishedCourse,
    getCreatorCourse,
    updateCourse,
    getCourseById,
    getCourseByEnrolledStudentId,
    getPopularCourses,
    editCourse,
    deleteCourse,
    getAllCourses,
};
