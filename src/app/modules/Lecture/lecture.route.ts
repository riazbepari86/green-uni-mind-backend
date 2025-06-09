import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { LectureValidation } from './lecture.validation';
import { LectureController } from './lecture.controller';

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
  LectureController.updateLecture,
);

export const LectureRoutes = router;
