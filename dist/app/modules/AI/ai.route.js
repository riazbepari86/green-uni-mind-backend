"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const ai_validation_1 = require("./ai.validation");
const ai_controller_1 = require("./ai.controller");
const router = (0, express_1.Router)();
router.post('/enhance-title', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(ai_validation_1.AIValidation.enhanceTitleValidationSchema), ai_controller_1.AIController.enhanceTitle);
router.post('/enhance-subtitle', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(ai_validation_1.AIValidation.enhanceSubtitleValidationSchema), ai_controller_1.AIController.enhanceSubtitle);
router.post('/enhance-description', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(ai_validation_1.AIValidation.enhanceDescriptionValidationSchema), ai_controller_1.AIController.enhanceDescription);
router.post('/suggest-category', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(ai_validation_1.AIValidation.suggestCategoryValidationSchema), ai_controller_1.AIController.suggestCategory);
router.post('/generate-outline', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(ai_validation_1.AIValidation.generateCourseOutlineValidationSchema), ai_controller_1.AIController.generateCourseOutline);
exports.AIRoutes = router;
