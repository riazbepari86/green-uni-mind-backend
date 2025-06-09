import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import { StudentControllers } from './student.controller';

const router = Router();

router.get(
  '/enroll/:studentId',
  auth(USER_ROLE.student),
  StudentControllers.enrollInCourse,
);

// Add course progress route
router.get(
  '/:studentId/course-progress/:courseId',
  auth(USER_ROLE.student),
  StudentControllers.getCourseProgress,
);

// Add route to get all enrolled courses with progress
router.get(
  '/:studentId/enrolled-courses-progress',
  auth(USER_ROLE.student),
  StudentControllers.getEnrolledCoursesWithProgress,
);

// Add route to mark lecture as complete
router.post(
  '/:studentId/mark-lecture-complete',
  auth(USER_ROLE.student),
  StudentControllers.markLectureComplete,
);

export const StudentRoutes = router;
