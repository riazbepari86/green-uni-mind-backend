import express from 'express';
import { ReviewControllers } from './review.controller';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';

const router = express.Router();

router.post(
  '/create',
  auth(USER_ROLE.student),
  ReviewControllers.createReview
);

router.get(
  '/course/:courseId',
  ReviewControllers.getCourseReviews
);

router.get(
  '/teacher/:teacherId',
  ReviewControllers.getTeacherReviews
);

export const ReviewRoutes = router; 