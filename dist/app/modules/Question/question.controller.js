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
exports.QuestionController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const question_service_1 = require("./question.service");
const http_status_1 = __importDefault(require("http-status"));
const createQuestion = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId } = req.params;
    const questionData = Object.assign(Object.assign({}, req.body), { studentId });
    const result = yield question_service_1.QuestionService.createQuestion(questionData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Question created successfully',
        data: result,
    });
}));
const getQuestionsByLectureAndStudent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { lectureId, studentId } = req.params;
    const result = yield question_service_1.QuestionService.getQuestionsByLectureAndStudent(lectureId, studentId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Questions retrieved successfully',
        data: result,
    });
}));
const getQuestionsByLecture = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { lectureId } = req.params;
    const result = yield question_service_1.QuestionService.getQuestionsByLecture(lectureId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Questions retrieved successfully',
        data: result,
    });
}));
const answerQuestion = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { answer } = req.body;
    const teacherId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!teacherId) {
        throw new Error('Teacher ID not found');
    }
    const result = yield question_service_1.QuestionService.answerQuestion(id, answer, teacherId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Question answered successfully',
        data: result,
    });
}));
const updateQuestion = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield question_service_1.QuestionService.updateQuestion(id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Question updated successfully',
        data: result,
    });
}));
const deleteQuestion = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield question_service_1.QuestionService.deleteQuestion(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Question deleted successfully',
        data: result,
    });
}));
exports.QuestionController = {
    createQuestion,
    getQuestionsByLectureAndStudent,
    getQuestionsByLecture,
    answerQuestion,
    updateQuestion,
    deleteQuestion,
};
