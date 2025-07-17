import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { LectureValidation } from './lecture.validation';
import { LectureController } from './lecture.controller';
import { enterpriseCacheMiddleware } from '../../middlewares/enterpriseCacheMiddleware';
// Removed Redis caching imports to eliminate backend caching conflicts
// Only Redux will handle frontend caching for real-time UI updates
// Added enterprise cache middleware for advanced invalidation patterns

const router = Router({ mergeParams: true });

router.get('/:id', auth(USER_ROLE.teacher, USER_ROLE.student), LectureController.getLectureById);

router.post(
  '/:courseId/create-lecture',
  auth(USER_ROLE.teacher),
  validateRequest(LectureValidation.createLectureZodSchema),
  LectureController.createLecture,
);

router.get(
  '/:courseId/get-lectures',
  auth(USER_ROLE.teacher, USER_ROLE.student),
  // Removed Redis caching - only Redux will handle frontend caching
  LectureController.getLecturesByCourseId,
);

router.patch(
  '/:courseId/update-order',
  auth(USER_ROLE.teacher),
  validateRequest(LectureValidation.updateLectureOrderZodSchema),
  LectureController.updateLectureOrder,
);

router.patch(
  '/:courseId/update-lecture/:lectureId',
  auth(USER_ROLE.teacher),
  validateRequest(LectureValidation.updateLectureZodSchema),
  enterpriseCacheMiddleware.enterpriseLectureInvalidation(),
  LectureController.updateLecture,
);

router.delete(
  '/:courseId/delete-lecture/:lectureId',
  auth(USER_ROLE.teacher),
  validateRequest(LectureValidation.deleteLectureZodSchema),
  LectureController.deleteLecture,
);

export const LectureRoutes = router;
