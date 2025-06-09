"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoutes = void 0;
const express_1 = require("express");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_validation_1 = require("./user.validation");
const user_controller_1 = require("./user.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("./user.constant");
const sendImageToCloudinary_1 = require("../../utils/sendImageToCloudinary");
const student_validation_1 = require("../Student/student.validation");
const teacher_validation_1 = require("../Teacher/teacher.validation");
const parseMiddleware_1 = require("../../middlewares/parseMiddleware");
const router = (0, express_1.Router)();
// router.post(
//   '/register',
//   upload.single('file'),
//   (req: Request, res: Response, next: NextFunction) => {
//     req.body = JSON.parse(req.body.data);
//     next();
//   },
//   validateRequest(UserValidation.registerUserValidationSchema),
//   UserControllers.registerUser,
// );
router.post('/create-student', sendImageToCloudinary_1.upload.single('file'), (req, res, next) => {
    req.body = JSON.parse(req.body.data);
    next();
}, (0, validateRequest_1.default)(student_validation_1.createStudentValidationSchema), user_controller_1.UserControllers.createStudent);
router.post('/create-teacher', sendImageToCloudinary_1.upload.single('file'), (req, res, next) => {
    req.body = JSON.parse(req.body.data);
    next();
}, (0, validateRequest_1.default)(teacher_validation_1.createTeacherValidationSchema), user_controller_1.UserControllers.createTeacher);
router.get('/', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), user_controller_1.UserControllers.getAllUsers);
router.get('/me', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.user), user_controller_1.UserControllers.getMe);
router.patch('/edit-profile/:id', sendImageToCloudinary_1.upload.single('file'), parseMiddleware_1.parseDataMiddleware, (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(user_validation_1.UserValidation.editProfileValidationSchema), user_controller_1.UserControllers.updateUserProfile);
router.post('/change-status/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher));
router.get('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.user), user_controller_1.UserControllers.getSingleUser);
exports.UserRoutes = router;
