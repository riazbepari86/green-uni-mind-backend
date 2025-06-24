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
exports.AIController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const http_status_1 = __importDefault(require("http-status"));
const ai_service_1 = require("../../services/ai.service");
const enhanceTitle = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title } = req.body;
    const result = yield ai_service_1.aiService.enhanceTitle(title);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Title enhanced successfully',
        data: { enhancedTitle: result },
    });
}));
const enhanceSubtitle = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, subtitle } = req.body;
    const result = yield ai_service_1.aiService.enhanceSubtitle(title, subtitle);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Subtitle enhanced successfully',
        data: { enhancedSubtitle: result },
    });
}));
const enhanceDescription = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, subtitle, description } = req.body;
    const result = yield ai_service_1.aiService.enhanceDescription(title, subtitle, description);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Description enhanced successfully',
        data: { enhancedDescription: result },
    });
}));
const suggestCategory = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, description } = req.body;
    const result = yield ai_service_1.aiService.suggestCategory(title, description);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Category suggested successfully',
        data: result,
    });
}));
const generateCourseOutline = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, description, level } = req.body;
    const result = yield ai_service_1.aiService.generateCourseOutline(title, description, level);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Course outline generated successfully',
        data: { outline: result },
    });
}));
exports.AIController = {
    enhanceTitle,
    enhanceSubtitle,
    enhanceDescription,
    suggestCategory,
    generateCourseOutline,
};
