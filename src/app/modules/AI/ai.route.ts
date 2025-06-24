import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { AIValidation } from './ai.validation';
import { AIController } from './ai.controller';

const router = Router();

router.post(
  '/enhance-title',
  auth(USER_ROLE.teacher),
  validateRequest(AIValidation.enhanceTitleValidationSchema),
  AIController.enhanceTitle
);

router.post(
  '/enhance-subtitle',
  auth(USER_ROLE.teacher),
  validateRequest(AIValidation.enhanceSubtitleValidationSchema),
  AIController.enhanceSubtitle
);

router.post(
  '/enhance-description',
  auth(USER_ROLE.teacher),
  validateRequest(AIValidation.enhanceDescriptionValidationSchema),
  AIController.enhanceDescription
);

router.post(
  '/suggest-category',
  auth(USER_ROLE.teacher),
  validateRequest(AIValidation.suggestCategoryValidationSchema),
  AIController.suggestCategory
);

router.post(
  '/generate-outline',
  auth(USER_ROLE.teacher),
  validateRequest(AIValidation.generateCourseOutlineValidationSchema),
  AIController.generateCourseOutline
);

export const AIRoutes = router;
