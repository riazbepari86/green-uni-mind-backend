"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const teacher_controller_1 = require("./teacher.controller");
const router = (0, express_1.Router)();
// Connect Stripe account
router.post('/:teacherId/connect-stripe', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), teacher_controller_1.TeacherController.connectStripe);
// Get enrolled students with progress
router.get('/:teacherId/enrolled-students', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), teacher_controller_1.TeacherController.getEnrolledStudentsWithProgress);
exports.TeacherRoutes = router;
