"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourseRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const course_validation_1 = require("./course.validation");
const course_controller_1 = require("./course.controller");
const sendImageToCloudinary_1 = require("../../utils/sendImageToCloudinary");
const parseMiddleware_1 = require("../../middlewares/parseMiddleware");
const router = (0, express_1.Router)({ mergeParams: true });
router.get('/search', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), course_controller_1.CourseController.searchCourse);
router.get('/published-courses', course_controller_1.CourseController.getPublishedCourse);
router.get('/popular-courses', course_controller_1.CourseController.getPopularCourses);
router.get('/creator/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), course_controller_1.CourseController.getCreatorCourse);
router.patch('/update-course/:id', sendImageToCloudinary_1.upload.single('file'), parseMiddleware_1.parseDataMiddleware, (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(course_validation_1.CourseValidation.updateCourseZodSchema), course_controller_1.CourseController.updateCourse);
router.post('/create-course/:id', sendImageToCloudinary_1.upload.single('file'), parseMiddleware_1.parseDataMiddleware, (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(course_validation_1.CourseValidation.createCourseZodSchema), course_controller_1.CourseController.createCourse);
router.get('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), course_controller_1.CourseController.getCourseById);
router.get('/:studentId/enrolled-courses', course_controller_1.CourseController.getCourseByEnrolledStudentId);
// Add edit course route
router.patch('/edit-course/:id', sendImageToCloudinary_1.upload.single('file'), parseMiddleware_1.parseDataMiddleware, (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(course_validation_1.CourseValidation.editCourseZodSchema), course_controller_1.CourseController.editCourse);
// Add delete course route
router.delete('/delete-course/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(course_validation_1.CourseValidation.deleteCourseZodSchema), course_controller_1.CourseController.deleteCourse);
exports.CourseRoutes = router;
