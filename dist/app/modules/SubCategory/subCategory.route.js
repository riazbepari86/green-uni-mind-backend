"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubCategoryRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const subCategory_validation_1 = require("./subCategory.validation");
const subCategory_controller_1 = require("./subCategory.controller");
const router = (0, express_1.Router)();
router.post('/create-subCategory', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(subCategory_validation_1.SubCategoryValidation.subCategoryValidationSchema), subCategory_controller_1.SubCategoryController.createSubCategory);
exports.SubCategoryRoutes = router;
