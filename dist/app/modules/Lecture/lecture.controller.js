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
exports.LectureController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const lecture_service_1 = require("./lecture.service");
const http_status_1 = __importDefault(require("http-status"));
const EnterpriseCache_1 = __importDefault(require("../../services/cache/EnterpriseCache"));
const LectureUpdateCacheInvalidator_1 = __importDefault(require("../../services/cache/LectureUpdateCacheInvalidator"));
const createLecture = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { courseId } = req.params;
    // Process the request body to handle adaptive streaming data
    const lectureData = req.body;
    // Ensure videoResolutions is properly formatted if present
    if (lectureData.videoResolutions && Array.isArray(lectureData.videoResolutions)) {
        // Make sure each resolution has the required fields
        lectureData.videoResolutions = lectureData.videoResolutions.map((resolution) => ({
            url: resolution.url,
            quality: resolution.quality,
            format: resolution.format || undefined
        }));
    }
    const newLecture = yield lecture_service_1.LectureService.createLecture(lectureData, courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Lecture created successfully',
        data: newLecture,
    });
}));
const getLecturesByCourseId = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { courseId } = req.params;
    const lectures = yield lecture_service_1.LectureService.getLecturesByCourseId(courseId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'All lectures fetched for the course',
        data: lectures,
    });
}));
const getLectureById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const user = req.user;
    const lecture = yield lecture_service_1.LectureService.getLectureById(id, user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Lecture fetched successfully',
        data: lecture,
    });
}));
const updateLectureOrder = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { courseId } = req.params;
    const { lectures } = req.body;
    const updatedLectures = yield lecture_service_1.LectureService.updateLectureOrder(courseId, lectures);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Lecture order updated successfully',
        data: updatedLectures,
    });
}));
const updateLecture = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { courseId, lectureId } = req.params;
    const payload = req.body;
    // Validate required parameters
    if (!courseId || courseId === 'undefined' || courseId === 'null') {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Valid course ID is required',
            data: null,
        });
    }
    if (!lectureId || lectureId === 'undefined' || lectureId === 'null') {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Valid lecture ID is required',
            data: null,
        });
    }
    // Process the payload to handle adaptive streaming data
    if (payload.videoResolutions && Array.isArray(payload.videoResolutions)) {
        // Make sure each resolution has the required fields
        payload.videoResolutions = payload.videoResolutions.map((resolution) => ({
            url: resolution.url,
            quality: resolution.quality,
            format: resolution.format || undefined
        }));
    }
    const updated = yield lecture_service_1.LectureService.updateLecture(courseId, lectureId, payload);
    // COMPREHENSIVE CACHE INVALIDATION - SOLUTION TO YOUR ISSUE
    // This ensures immediate updates in creator courses endpoint
    try {
        console.log('🎯 Starting comprehensive cache invalidation for lecture update:', {
            lectureId,
            courseId,
            updatedFields: Object.keys(payload)
        });
        // Use both enterprise cache service and specialized invalidator
        const [enterpriseCache, cacheInvalidator] = [
            new EnterpriseCache_1.default(),
            LectureUpdateCacheInvalidator_1.default.getInstance()
        ];
        // Run both invalidation strategies in parallel for maximum effectiveness
        yield Promise.all([
            enterpriseCache.invalidateLectureUpdate(lectureId, courseId, Object.keys(payload)),
            cacheInvalidator.invalidateAfterLectureUpdate(lectureId, courseId)
        ]);
        // Validate that cache invalidation worked
        const isInvalidated = yield cacheInvalidator.validateCacheInvalidation(lectureId, courseId);
        console.log('🔍 Cache invalidation validation:', isInvalidated ? 'SUCCESS' : 'PARTIAL');
        console.log('✅ Comprehensive cache invalidation completed successfully');
    }
    catch (cacheError) {
        console.error('❌ Cache invalidation failed:', cacheError);
        // Emergency fallback - clear all course caches
        try {
            console.log('🚨 Attempting emergency cache clear...');
            yield LectureUpdateCacheInvalidator_1.default.getInstance().emergencyClearAllCourseCaches();
            console.log('🚨 Emergency cache clear completed');
        }
        catch (emergencyError) {
            console.error('❌ Emergency cache clear also failed:', emergencyError);
        }
        // Don't fail the request if cache invalidation fails
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Lecture updated successfully',
        data: updated,
    });
}));
const deleteLecture = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { courseId, lectureId } = req.params;
    // Validate required parameters
    if (!courseId || courseId === 'undefined' || courseId === 'null') {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Valid course ID is required',
            data: null,
        });
    }
    if (!lectureId || lectureId === 'undefined' || lectureId === 'null') {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: 'Valid lecture ID is required',
            data: null,
        });
    }
    const result = yield lecture_service_1.LectureService.deleteLecture(courseId, lectureId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Lecture deleted successfully',
        data: result,
    });
}));
exports.LectureController = {
    createLecture,
    getLectureById,
    getLecturesByCourseId,
    updateLectureOrder,
    updateLecture,
    deleteLecture,
};
