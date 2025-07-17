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
exports.CourseController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const course_service_1 = require("./course.service");
const createCourse = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const file = req.file;
    // Validate required parameters
    if (!id || id === 'undefined' || id === 'null') {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Valid teacher ID is required',
            data: null,
        });
    }
    const result = yield course_service_1.CourseServices.createCourse(req.body, id, file);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Course created successfully',
        data: result,
    });
}));
const searchCourse = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield course_service_1.CourseServices.searchCourse(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Course are retrieved successfully',
        meta: result.meta,
        data: result.result,
    });
}));
const getPublishedCourse = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield course_service_1.CourseServices.getPublishedCourse(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Course are retrieved successfully',
        meta: result.meta,
        data: result.result,
    });
}));
const getCreatorCourse = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    // Validate the ID parameter
    if (!id || id === 'undefined' || id === 'null') {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Valid creator ID is required',
            data: null,
        });
    }
    const result = yield course_service_1.CourseServices.getCreatorCourse(id);
    // Set Cache-Control headers to prevent caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Course are retrieved successfully',
        data: result,
    });
}));
const getCourseById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    // Validate required parameters
    if (!id || id === 'undefined' || id === 'null') {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Valid course ID is required',
            data: null,
        });
    }
    const result = yield course_service_1.CourseServices.getCourseById(id);
    // Set Cache-Control headers to prevent caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Course retrieved successfully',
        data: result,
    });
}));
const updateCourse = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const file = req.file;
    // Validate required parameters
    if (!id || id === 'undefined' || id === 'null') {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Valid course ID is required',
            data: null,
        });
    }
    const result = yield course_service_1.CourseServices.editCourse(id, req.body, file);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Course updated successfully',
        data: result,
    });
}));
const getCourseByEnrolledStudentId = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const studentId = req.params.studentId;
    const result = yield course_service_1.CourseServices.getCourseByEnrolledStudentId(studentId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Course are retrieved successfully',
        data: result,
    });
}));
const getPopularCourses = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const limit = req.query.limit ? parseInt(req.query.limit) : 8;
    const result = yield course_service_1.CourseServices.getPopularCourses(limit);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Popular courses retrieved successfully',
        data: result,
    });
}));
const editCourse = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const file = req.file;
    console.log('🎯 EditCourse Controller - Course ID:', id);
    console.log('📥 EditCourse Controller - Request body:', JSON.stringify(req.body, null, 2));
    console.log('📁 EditCourse Controller - File:', file ? `${file.originalname} (${file.size} bytes)` : 'No file');
    const result = yield course_service_1.CourseServices.editCourse(id, req.body, file);
    // Set Cache-Control headers to prevent caching of updated course data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('ETag', `"${Date.now()}"`);
    console.log('✅ EditCourse Controller - Sending response with course title:', result === null || result === void 0 ? void 0 : result.title);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Course edited successfully',
        data: result,
    });
}));
const deleteCourse = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield course_service_1.CourseServices.deleteCourse(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Course and all associated resources deleted successfully',
        data: result,
    });
}));
const getAllCourses = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield course_service_1.CourseServices.getAllCourses(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'All courses retrieved successfully',
        data: result,
    });
}));
const getTeacherCourses = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    // Validate the teacherId parameter
    if (!teacherId || teacherId === 'undefined' || teacherId === 'null') {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Valid teacher ID is required',
            data: null,
        });
    }
    const result = yield course_service_1.CourseServices.getCreatorCourse(teacherId);
    // Set Cache-Control headers to prevent caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Teacher courses retrieved successfully',
        data: result,
    });
}));
exports.CourseController = {
    createCourse,
    searchCourse,
    getPublishedCourse,
    getCreatorCourse,
    getCourseById,
    updateCourse,
    getCourseByEnrolledStudentId,
    getPopularCourses,
    editCourse,
    deleteCourse,
    getAllCourses,
    getTeacherCourses,
};
