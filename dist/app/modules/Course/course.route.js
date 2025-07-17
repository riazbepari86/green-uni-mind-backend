"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourseRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const parseMiddleware_1 = require("../../middlewares/parseMiddleware");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const sendImageToCloudinary_1 = require("../../utils/sendImageToCloudinary");
const user_constant_1 = require("../User/user.constant");
const course_controller_1 = require("./course.controller");
const course_validation_1 = require("./course.validation");
// Removed Redis caching imports to eliminate backend caching conflicts
// Only Redux will handle frontend caching for real-time UI updates
const router = (0, express_1.Router)({ mergeParams: true });
router.get('/search', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), course_controller_1.CourseController.searchCourse);
router.get('/published-courses', course_controller_1.CourseController.getPublishedCourse);
router.get('/popular-courses', course_controller_1.CourseController.getPopularCourses);
// General course list route
router.get('/', course_controller_1.CourseController.getAllCourses);
router.get('/creator/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), 
// Removed Redis caching - only Redux will handle frontend caching
course_controller_1.CourseController.getCreatorCourse);
// Alias route for teacher courses (backward compatibility)
router.get('/teacher/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), course_controller_1.CourseController.getTeacherCourses);
router.patch('/update-course/:id', sendImageToCloudinary_1.upload.single('file'), parseMiddleware_1.parseDataMiddleware, (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(course_validation_1.CourseValidation.updateCourseZodSchema), course_controller_1.CourseController.updateCourse);
router.post('/create-course/:id', sendImageToCloudinary_1.upload.single('file'), parseMiddleware_1.parseDataMiddleware, (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(course_validation_1.CourseValidation.createCourseZodSchema), course_controller_1.CourseController.createCourse);
router.get('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher), course_controller_1.CourseController.getCourseById);
router.get('/:studentId/enrolled-courses', course_controller_1.CourseController.getCourseByEnrolledStudentId);
// Add edit course route
router.patch('/edit-course/:id', sendImageToCloudinary_1.upload.single('file'), parseMiddleware_1.parseDataMiddleware, (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(course_validation_1.CourseValidation.editCourseZodSchema), course_controller_1.CourseController.editCourse);
// Add delete course route
router.delete('/delete-course/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(course_validation_1.CourseValidation.deleteCourseZodSchema), course_controller_1.CourseController.deleteCourse);
exports.CourseRoutes = router;
