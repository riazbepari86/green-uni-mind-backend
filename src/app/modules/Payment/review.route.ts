import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import { ReviewControllers } from './review.controller';

const router = express.Router();

router.post('/create', auth(USER_ROLE.student), ReviewControllers.createReview);

router.get('/course/:courseId', ReviewControllers.getCourseReviews);

router.get('/teacher/:teacherId', ReviewControllers.getTeacherReviews);

router.get(
  '/teacher/:teacherId/stats',
  auth(USER_ROLE.teacher),
  ReviewControllers.getTeacherReviewStats,
);

router.get(
  '/teacher/:teacherId/dashboard',
  auth(USER_ROLE.teacher),
  ReviewControllers.getTeacherReviewDashboard,
);

export const ReviewRoutes = router;
