import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import { TeacherController } from './teacher.controller';

const router = Router();

// Connect Stripe account
router.post(
  '/:teacherId/connect-stripe',
  auth(USER_ROLE.teacher),
  TeacherController.connectStripe,
);

// Get enrolled students with progress
router.get(
  '/:teacherId/enrolled-students',
  auth(USER_ROLE.teacher),
  TeacherController.getEnrolledStudentsWithProgress,
);

export const TeacherRoutes = router;