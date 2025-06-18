"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const category_validation_1 = require("./category.validation");
const category_controller_1 = require("./category.controller");
const router = (0, express_1.Router)();
// Public routes
router.get('/', category_controller_1.CategoryController.getAllCategories);
router.get('/with-subcategories', category_controller_1.CategoryController.getAllCategoriesWithSubcategories);
router.get('/:id', category_controller_1.CategoryController.getCategoryById);
router.get('/:categoryId/courses', category_controller_1.CategoryController.getCoursesByCategory);
// Protected routes (Teacher only)
router.post('/create-category', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(category_validation_1.CategoryValidation.createCategoryValidationSchema), category_controller_1.CategoryController.createCategory);
router.patch('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(category_validation_1.CategoryValidation.updateCategoryValidationSchema), category_controller_1.CategoryController.updateCategory);
router.delete('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), category_controller_1.CategoryController.deleteCategory);
exports.CategoryRoutes = router;
