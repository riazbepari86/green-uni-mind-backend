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
exports.PayoutController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const teacher_model_1 = require("../Teacher/teacher.model");
const payout_interface_1 = require("./payout.interface");
const payout_model_1 = require("./payout.model");
const payout_service_1 = require("./payout.service");
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
/**
 * Create a payout request
 */
const createPayoutRequest = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { amount } = req.body;
    const result = yield payout_service_1.PayoutService.createPayoutRequest(teacherId, amount);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Payout request created successfully',
        data: result,
    });
}));
/**
 * Get payout history for a teacher
 */
const getPayoutHistory = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    // Validate teacher ID matches authenticated user
    const user = req.user;
    const actualTeacherId = yield validateAndResolveTeacherId(teacherId, user);
    const result = yield payout_service_1.PayoutService.getPayoutHistory(actualTeacherId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Payout history retrieved successfully',
        data: result,
    });
}));
/**
 * Get payout details by ID
 */
const getPayoutById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { payoutId } = req.params;
    const result = yield payout_service_1.PayoutService.getPayoutById(payoutId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Payout details retrieved successfully',
        data: result,
    });
}));
/**
 * Update payout preferences for a teacher
 */
const updatePayoutPreferences = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const { schedule, minimumAmount, isAutoPayoutEnabled } = req.body;
    // Validate schedule
    if (schedule &&
        !Object.values(payout_interface_1.PayoutSchedule).includes(schedule)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid payout schedule');
    }
    // Validate minimum amount
    if (minimumAmount !== undefined &&
        (isNaN(minimumAmount) || minimumAmount < 0)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Minimum amount must be a non-negative number');
    }
    // Update or create payout preferences
    const preferences = yield payout_model_1.PayoutPreference.findOneAndUpdate({ teacherId: new mongoose_1.Types.ObjectId(teacherId) }, Object.assign(Object.assign(Object.assign({}, (schedule && { schedule })), (minimumAmount !== undefined && { minimumAmount })), (isAutoPayoutEnabled !== undefined && { isAutoPayoutEnabled })), { upsert: true, new: true });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Payout preferences updated successfully',
        data: preferences,
    });
}));
/**
 * Get payout preferences for a teacher
 */
const getPayoutPreferences = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    // Set no-cache headers for real-time payout preferences
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('ETag', `"${Date.now()}"`);
    const preferences = yield payout_model_1.PayoutPreference.findOne({
        teacherId: new mongoose_1.Types.ObjectId(teacherId),
    });
    // If no preferences exist, return default values
    const result = preferences || {
        teacherId,
        schedule: payout_interface_1.PayoutSchedule.MONTHLY,
        minimumAmount: 50,
        isAutoPayoutEnabled: true,
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Payout preferences retrieved successfully',
        data: result,
    });
}));
exports.PayoutController = {
    createPayoutRequest,
    getPayoutHistory,
    getPayoutById,
    updatePayoutPreferences,
    getPayoutPreferences,
};
