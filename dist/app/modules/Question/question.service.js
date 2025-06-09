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
exports.QuestionService = void 0;
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const question_model_1 = require("./question.model");
const student_model_1 = require("../Student/student.model");
const lecture_model_1 = require("../Lecture/lecture.model");
const mongoose_1 = require("mongoose");
const createQuestion = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if student exists
    const student = yield student_model_1.Student.findById(payload.studentId);
    if (!student) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student not found');
    }
    // Check if lecture exists
    const lecture = yield lecture_model_1.Lecture.findById(payload.lectureId);
    if (!lecture) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Lecture not found');
    }
    // Create question
    const result = yield question_model_1.Question.create(payload);
    return result;
});
const getQuestionsByLectureAndStudent = (lectureId, studentId) => __awaiter(void 0, void 0, void 0, function* () {
    const questions = yield question_model_1.Question.find({
        lectureId: new mongoose_1.Types.ObjectId(lectureId),
        studentId: new mongoose_1.Types.ObjectId(studentId),
    }).sort({ timestamp: 1 });
    return questions;
});
const getQuestionsByLecture = (lectureId) => __awaiter(void 0, void 0, void 0, function* () {
    const questions = yield question_model_1.Question.find({
        lectureId: new mongoose_1.Types.ObjectId(lectureId),
    })
        .populate('studentId', 'name')
        .sort({ timestamp: 1 });
    return questions;
});
const answerQuestion = (id, answer, teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    const question = yield question_model_1.Question.findByIdAndUpdate(id, {
        answer,
        answeredBy: new mongoose_1.Types.ObjectId(teacherId),
        answered: true,
        answeredAt: new Date(),
    }, { new: true });
    if (!question) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Question not found');
    }
    return question;
});
const updateQuestion = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const question = yield question_model_1.Question.findByIdAndUpdate(id, payload, {
        new: true,
    });
    if (!question) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Question not found');
    }
    return question;
});
const deleteQuestion = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const question = yield question_model_1.Question.findByIdAndDelete(id);
    if (!question) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Question not found');
    }
    return question;
});
exports.QuestionService = {
    createQuestion,
    getQuestionsByLectureAndStudent,
    getQuestionsByLecture,
    answerQuestion,
    updateQuestion,
    deleteQuestion,
};
