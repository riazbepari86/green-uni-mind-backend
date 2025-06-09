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
exports.TeacherController = void 0;
const AppError_1 = __importDefault(require("../../errors/AppError"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const http_status_1 = __importDefault(require("http-status"));
const teacher_service_1 = require("./teacher.service");
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const connectStripe = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { stripeAccountId, stripeEmail } = req.body;
    const { teacherId } = req.params;
    if (!teacherId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Teacher ID is required');
    }
    const result = yield teacher_service_1.TeacherService.connectStripe(teacherId, {
        stripeAccountId,
        stripeEmail,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Stripe account connected successfully',
        data: result,
    });
}));
/**
 * Get all enrolled students with their progress for a teacher's courses
 */
const getEnrolledStudentsWithProgress = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { teacherId } = req.params;
    const result = yield teacher_service_1.TeacherService.getEnrolledStudentsWithProgress(teacherId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Enrolled students with progress retrieved successfully',
        data: result,
    });
}));
exports.TeacherController = {
    connectStripe,
    getEnrolledStudentsWithProgress,
};
