import { Router } from 'express';
import { OAuthControllers } from './oauth.controller';

const router = Router();

// Google OAuth callback route
router.get('/google/callback', OAuthControllers.googleCallback);

// Facebook OAuth callback route
router.get('/facebook/callback', OAuthControllers.facebookCallback);

// Apple OAuth callback route
router.get('/apple/callback', OAuthControllers.appleCallback);

export const OAuthCallbackRoutes = router;
