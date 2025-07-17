import { Router } from 'express';
import auth from '../../middlewares/auth';
import { parseDataMiddleware } from '../../middlewares/parseMiddleware';
import validateRequest from '../../middlewares/validateRequest';
import { upload } from '../../utils/sendImageToCloudinary';
import { USER_ROLE } from '../User/user.constant';
import { CourseController } from './course.controller';
import { CourseValidation } from './course.validation';
// Removed Redis caching imports to eliminate backend caching conflicts
// Only Redux will handle frontend caching for real-time UI updates

const router = Router({ mergeParams: true });

router.get(
  '/search',
  auth(USER_ROLE.student, USER_ROLE.teacher),
  CourseController.searchCourse,
);

router.get('/published-courses', CourseController.getPublishedCourse);

router.get('/popular-courses', CourseController.getPopularCourses);

// General course list route
router.get('/', CourseController.getAllCourses);

router.get(
  '/creator/:id',
  auth(USER_ROLE.teacher),
  // Removed Redis caching - only Redux will handle frontend caching
  CourseController.getCreatorCourse,
);

// Alias route for teacher courses (backward compatibility)
router.get(
  '/teacher/:teacherId',
  auth(USER_ROLE.teacher, USER_ROLE.student),
  CourseController.getTeacherCourses,
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
