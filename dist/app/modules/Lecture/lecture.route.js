"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LectureRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const lecture_validation_1 = require("./lecture.validation");
const lecture_controller_1 = require("./lecture.controller");
const router = (0, express_1.Router)({ mergeParams: true });
router.get('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), lecture_controller_1.LectureController.getLectureById);
router.post('/:courseId/create-lecture', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(lecture_validation_1.LectureValidation.createLectureZodSchema), lecture_controller_1.LectureController.createLecture);
router.get('/:courseId/get-lectures', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), lecture_controller_1.LectureController.getLecturesByCourseId);
router.patch('/:courseId/update-order', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(lecture_validation_1.LectureValidation.updateLectureOrderZodSchema), lecture_controller_1.LectureController.updateLectureOrder);
router.patch('/:courseId/update-lecture/:lectureId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(lecture_validation_1.LectureValidation.updateLectureZodSchema), lecture_controller_1.LectureController.updateLecture);
exports.LectureRoutes = router;
