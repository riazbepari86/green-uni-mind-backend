"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRoutes = void 0;
const express_1 = require("express");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const auth_validation_1 = require("./auth.validation");
const auth_controller_1 = require("./auth.controller");
const twoFactor_controller_1 = require("./twoFactor.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
router.post('/login', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.loginValidationSchema), auth_controller_1.AuthControllers.loginUser);
router.post('/change-password', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(auth_validation_1.AuthValidation.changePasswordValidationSchema), auth_controller_1.AuthControllers.changePassword);
router.post('/refresh-token', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.refreshTokenValidationSchema), auth_controller_1.AuthControllers.refreshToken);
router.post('/forget-password', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.forgetPasswordValidationSchema), auth_controller_1.AuthControllers.forgetPassword);
router.post('/reset-password', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.resetpasswordValidationSchema), auth_controller_1.AuthControllers.resetPassword);
router.post('/logout', auth_controller_1.AuthControllers.logoutUser);
// Email verification routes
router.post('/verify-email', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.verifyEmailValidationSchema), auth_controller_1.AuthControllers.verifyEmail);
// OTP verification route (alias for verify-email for better naming)
router.post('/verify-otp', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.verifyEmailValidationSchema), auth_controller_1.AuthControllers.verifyEmail);
router.post('/resend-verification', (0, validateRequest_1.default)(auth_validation_1.AuthValidation.resendVerificationEmailValidationSchema), auth_controller_1.AuthControllers.resendVerificationEmail);
// Rate limiting status route
router.get('/rate-limit-status', auth_controller_1.AuthControllers.getRateLimitStatus);
// Two-factor authentication routes
const setupTwoFactorSchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: zod_1.z.string(),
    }),
});
const verifyTwoFactorSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string(),
        userId: zod_1.z.string(),
        secret: zod_1.z.string(),
    }),
});
const verifyLoginTwoFactorSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string(),
        userId: zod_1.z.string(),
    }),
});
const disableTwoFactorSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string(),
        password: zod_1.z.string(),
    }),
});
router.get('/2fa/setup/:userId', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(setupTwoFactorSchema), twoFactor_controller_1.TwoFactorController.setupTwoFactor);
router.post('/2fa/verify', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(verifyTwoFactorSchema), twoFactor_controller_1.TwoFactorController.verifyAndEnableTwoFactor);
router.post('/2fa/login-verify', (0, validateRequest_1.default)(verifyLoginTwoFactorSchema), twoFactor_controller_1.TwoFactorController.verifyTwoFactorToken);
router.post('/2fa/disable', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(disableTwoFactorSchema), twoFactor_controller_1.TwoFactorController.disableTwoFactor);
exports.AuthRoutes = router;
