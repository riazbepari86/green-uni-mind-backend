import { NextFunction, Request, Response, Router } from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { UserValidation } from './user.validation';
import { UserControllers } from './user.controller';
import auth from '../../middlewares/auth';
import { USER_ROLE } from './user.constant';
import { upload } from '../../utils/sendImageToCloudinary';
import { createStudentValidationSchema } from '../Student/student.validation';
import { createTeacherValidationSchema } from '../Teacher/teacher.validation';
import { parseDataMiddleware } from '../../middlewares/parseMiddleware';

const router = Router();

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

router.post(
  '/create-student',
  upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = JSON.parse(req.body.data);

    next();
  },
  validateRequest(createStudentValidationSchema),
  UserControllers.createStudent,
);

router.post(
  '/create-teacher',
  upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = JSON.parse(req.body.data);

    next();
  },
  validateRequest(createTeacherValidationSchema),
  UserControllers.createTeacher,
);

router.get('/', auth(USER_ROLE.teacher), UserControllers.getAllUsers);

router.get(
  '/me',
  auth(USER_ROLE.teacher, USER_ROLE.student, USER_ROLE.user),
  UserControllers.getMe,
);

router.patch(
  '/edit-profile/:id',
  upload.single('file'),
  parseDataMiddleware,
  auth(USER_ROLE.teacher, USER_ROLE.student),
  validateRequest(UserValidation.editProfileValidationSchema),
  UserControllers.updateUserProfile,
);

router.post('/change-status/:id', auth(USER_ROLE.teacher));

router.get('/:id', auth(USER_ROLE.teacher, USER_ROLE.student, USER_ROLE.user), UserControllers.getSingleUser);

export const UserRoutes = router;
