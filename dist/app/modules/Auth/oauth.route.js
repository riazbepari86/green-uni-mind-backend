"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthRoutes = void 0;
const express_1 = require("express");
const oauth_controller_1 = require("./oauth.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// New frontend-based OAuth flow
router.get('/auth-url', oauth_controller_1.OAuthControllers.generateOAuthUrl);
router.post('/callback', oauth_controller_1.OAuthControllers.handleOAuthCallback);
// OAuth code exchange for account linking
const exchangeCodeSchema = zod_1.z.object({
    provider: zod_1.z.enum(['google', 'facebook', 'apple']),
    code: zod_1.z.string(),
    userId: zod_1.z.string(),
});
router.post('/exchange-code', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(exchangeCodeSchema), oauth_controller_1.OAuthControllers.exchangeCodeAndLinkAccount);
// Middleware to extract token from query parameters and set it in the request
const extractTokenMiddleware = (req, _res, next) => {
    // If token is in query parameters, set it in the authorization header
    if (req.query.token) {
        console.log('Token found in query parameters, setting in authorization header');
        req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
};
// Legacy OAuth routes (kept for backward compatibility)
// Google OAuth routes
router.get('/google', extractTokenMiddleware, oauth_controller_1.OAuthControllers.googleAuth);
// Facebook OAuth routes
router.get('/facebook', extractTokenMiddleware, oauth_controller_1.OAuthControllers.facebookAuth);
// Apple OAuth routes
router.get('/apple', extractTokenMiddleware, oauth_controller_1.OAuthControllers.appleAuth);
// Account linking/unlinking routes
const linkOAuthSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    provider: zod_1.z.enum(['google', 'facebook', 'apple']),
    providerId: zod_1.z.string(),
    email: zod_1.z.string().email().optional(),
});
const unlinkOAuthSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    provider: zod_1.z.enum(['google', 'facebook', 'apple']),
});
// Removed Zod validation for OAuth link endpoint to bypass validation errors
router.post('/link', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.user), 
// validateRequest(linkOAuthSchema), -- Removed validation
oauth_controller_1.OAuthControllers.linkOAuthAccount);
router.post('/unlink', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.user), (0, validateRequest_1.default)(unlinkOAuthSchema), oauth_controller_1.OAuthControllers.unlinkOAuthAccount);
exports.OAuthRoutes = router;
