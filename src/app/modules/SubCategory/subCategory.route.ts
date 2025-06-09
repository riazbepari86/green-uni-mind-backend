import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { SubCategoryValidation } from './subCategory.validation';
import { SubCategoryController } from './subCategory.controller';

const router = Router();

router.post(
  '/create-subCategory',
  auth(USER_ROLE.teacher),
  validateRequest(SubCategoryValidation.subCategoryValidationSchema),
  SubCategoryController.createSubCategory,
);

export const SubCategoryRoutes = router;
