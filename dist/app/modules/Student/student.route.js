"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const student_controller_1 = require("./student.controller");
const router = (0, express_1.Router)();
router.get('/enroll/:studentId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), student_controller_1.StudentControllers.enrollInCourse);
// Add course progress route
router.get('/:studentId/course-progress/:courseId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), student_controller_1.StudentControllers.getCourseProgress);
// Add route to get all enrolled courses with progress
router.get('/:studentId/enrolled-courses-progress', (0, auth_1.default)(user_constant_1.USER_ROLE.student), student_controller_1.StudentControllers.getEnrolledCoursesWithProgress);
// Add route to mark lecture as complete
router.post('/:studentId/mark-lecture-complete', (0, auth_1.default)(user_constant_1.USER_ROLE.student), student_controller_1.StudentControllers.markLectureComplete);
exports.StudentRoutes = router;
