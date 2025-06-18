import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { SubCategoryValidation } from './subCategory.validation';
import { SubCategoryController } from './subCategory.controller';

const router = Router();

// Public routes
router.get('/category/:categoryId', SubCategoryController.getSubCategoriesByCategory);
router.get('/:id', SubCategoryController.getSubCategoryById);
router.get('/:subcategoryId/courses', SubCategoryController.getCoursesBySubCategory);

// Protected routes (Teacher only)
router.post(
  '/create-subCategory',
  auth(USER_ROLE.teacher),
  validateRequest(SubCategoryValidation.subCategoryValidationSchema),
  SubCategoryController.createSubCategory,
);

router.patch(
  '/:id',
  auth(USER_ROLE.teacher),
  validateRequest(SubCategoryValidation.updateSubCategoryValidationSchema),
  SubCategoryController.updateSubCategory,
);

router.delete(
  '/:id',
  auth(USER_ROLE.teacher),
  SubCategoryController.deleteSubCategory,
);

export const SubCategoryRoutes = router;
