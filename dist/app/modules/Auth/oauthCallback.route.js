"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthCallbackRoutes = void 0;
const express_1 = require("express");
const oauth_controller_1 = require("./oauth.controller");
const router = (0, express_1.Router)();
// Google OAuth callback route
router.get('/google/callback', oauth_controller_1.OAuthControllers.googleCallback);
// Facebook OAuth callback route
router.get('/facebook/callback', oauth_controller_1.OAuthControllers.facebookCallback);
// Apple OAuth callback route
router.get('/apple/callback', oauth_controller_1.OAuthControllers.appleCallback);
exports.OAuthCallbackRoutes = router;
