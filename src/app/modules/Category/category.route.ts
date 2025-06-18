import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { CategoryValidation } from './category.validation';
import { CategoryController } from './category.controller';

const router = Router();

// Public routes
router.get('/', CategoryController.getAllCategories);
router.get('/with-subcategories', CategoryController.getAllCategoriesWithSubcategories);
router.get('/:id', CategoryController.getCategoryById);
router.get('/:categoryId/courses', CategoryController.getCoursesByCategory);

// Protected routes (Teacher only)
router.post(
  '/create-category',
  auth(USER_ROLE.teacher),
  validateRequest(CategoryValidation.createCategoryValidationSchema),
  CategoryController.createCategory,
);

router.patch(
  '/:id',
  auth(USER_ROLE.teacher),
  validateRequest(CategoryValidation.updateCategoryValidationSchema),
  CategoryController.updateCategory,
);

router.delete(
  '/:id',
  auth(USER_ROLE.teacher),
  CategoryController.deleteCategory,
);

export const CategoryRoutes = router;
