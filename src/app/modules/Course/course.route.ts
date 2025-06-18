import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { CourseValidation } from './course.validation';
import { CourseController } from './course.controller';
import { upload } from '../../utils/sendImageToCloudinary';
import { parseDataMiddleware } from '../../middlewares/parseMiddleware';

const router = Router({ mergeParams: true });

router.get(
  '/search',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  CourseController.searchCourse,
);

router.get('/published-courses', CourseController.getPublishedCourse);

router.get('/popular-courses', CourseController.getPopularCourses);

router.get(
  '/creator/:id',
  auth(USER_ROLE.teacher),
  CourseController.getCreatorCourse,
);

router.patch(
  '/update-course/:id',
  upload.single('file'),
  parseDataMiddleware,
  auth(USER_ROLE.teacher),
  validateRequest(CourseValidation.updateCourseZodSchema),
  CourseController.updateCourse,
);

router.post(
  '/create-course/:id',
  upload.single('file'),
  parseDataMiddleware,
  auth(USER_ROLE.teacher),
  validateRequest(CourseValidation.createCourseZodSchema),
  CourseController.createCourse,
);

router.get(
  '/:id',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  CourseController.getCourseById,
);

router.get(
  '/:studentId/enrolled-courses',
  CourseController.getCourseByEnrolledStudentId,
);

// Add edit course route
router.patch(
  '/edit-course/:id',
  upload.single('file'),
  parseDataMiddleware,
  auth(USER_ROLE.teacher),
  validateRequest(CourseValidation.editCourseZodSchema),
  CourseController.editCourse,
);

// Add delete course route
router.delete(
  '/delete-course/:id',
  auth(USER_ROLE.teacher),
  validateRequest(CourseValidation.deleteCourseZodSchema),
  CourseController.deleteCourse,
);

export const CourseRoutes = router;
