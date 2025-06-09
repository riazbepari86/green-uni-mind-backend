import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { QuestionValidation } from './question.validation';
import { QuestionController } from './question.controller';

const router = Router();

// Create a question
router.post(
  '/:studentId',
  auth(USER_ROLE.student),
  validateRequest(QuestionValidation.createQuestionZodSchema),
  QuestionController.createQuestion,
);

// Get questions by lecture and student
router.get(
  '/:lectureId/:studentId',
  auth(USER_ROLE.student),
  QuestionController.getQuestionsByLectureAndStudent,
);

// Get all questions for a lecture (for teachers)
router.get(
  '/lecture/:lectureId',
  auth(USER_ROLE.teacher),
  QuestionController.getQuestionsByLecture,
);

// Answer a question (for teachers)
router.patch(
  '/answer/:id',
  auth(USER_ROLE.teacher),
  validateRequest(QuestionValidation.answerQuestionZodSchema),
  QuestionController.answerQuestion,
);

// Update a question
router.patch(
  '/:id',
  auth(USER_ROLE.student),
  validateRequest(QuestionValidation.updateQuestionZodSchema),
  QuestionController.updateQuestion,
);

// Delete a question
router.delete(
  '/:id',
  auth(USER_ROLE.student),
  QuestionController.deleteQuestion,
);

export const QuestionRoutes = router;
