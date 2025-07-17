"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const review_controller_1 = require("./review.controller");
const router = express_1.default.Router();
router.post('/create', (0, auth_1.default)(user_constant_1.USER_ROLE.student), review_controller_1.ReviewControllers.createReview);
router.get('/course/:courseId', review_controller_1.ReviewControllers.getCourseReviews);
router.get('/teacher/:teacherId', review_controller_1.ReviewControllers.getTeacherReviews);
router.get('/teacher/:teacherId/stats', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), review_controller_1.ReviewControllers.getTeacherReviewStats);
router.get('/teacher/:teacherId/dashboard', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), review_controller_1.ReviewControllers.getTeacherReviewDashboard);
exports.ReviewRoutes = router;
