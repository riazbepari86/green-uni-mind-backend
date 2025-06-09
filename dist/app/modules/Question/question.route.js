"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const question_validation_1 = require("./question.validation");
const question_controller_1 = require("./question.controller");
const router = (0, express_1.Router)();
// Create a question
router.post('/:studentId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(question_validation_1.QuestionValidation.createQuestionZodSchema), question_controller_1.QuestionController.createQuestion);
// Get questions by lecture and student
router.get('/:lectureId/:studentId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), question_controller_1.QuestionController.getQuestionsByLectureAndStudent);
// Get all questions for a lecture (for teachers)
router.get('/lecture/:lectureId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), question_controller_1.QuestionController.getQuestionsByLecture);
// Answer a question (for teachers)
router.patch('/answer/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(question_validation_1.QuestionValidation.answerQuestionZodSchema), question_controller_1.QuestionController.answerQuestion);
// Update a question
router.patch('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(question_validation_1.QuestionValidation.updateQuestionZodSchema), question_controller_1.QuestionController.updateQuestion);
// Delete a question
router.delete('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.student), question_controller_1.QuestionController.deleteQuestion);
exports.QuestionRoutes = router;
