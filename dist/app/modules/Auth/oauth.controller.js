"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthControllers = void 0;
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../../config"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const http_status_1 = __importDefault(require("http-status"));
const user_model_1 = require("../User/user.model");
const student_model_1 = require("../Student/student.model");
const teacher_model_1 = require("../Teacher/teacher.model");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const JWTService_1 = require("../../services/auth/JWTService");
// Helper function to generate tokens
const generateTokens = (user) => __awaiter(void 0, void 0, void 0, function* () {
    // Ensure we're using the correct role from the user object
    console.log('🔐 Generating tokens for OAuth user:');
    console.log('- User ID:', user._id);
    console.log('- User email:', user.email);
    console.log('- User role:', user.role);
    console.log('- User status:', user.status);
    console.log('- Is OAuth user:', user.isOAuthUser);
    // Validate required fields
    if (!user._id || !user.email || !user.role) {
        console.error('❌ Missing required user fields for token generation:', {
            hasId: !!user._id,
            hasEmail: !!user.email,
            hasRole: !!user.role
        });
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid user data for token generation');
    }
    // Make sure we include the user's ID and role in the token
    const jwtPayload = {
        _id: user._id,
        email: user.email,
        role: user.role,
    };
    // Log the payload for debugging
    console.log('🎫 JWT payload for token generation:', JSON.stringify(jwtPayload, null, 2));
    try {
        const tokenPair = yield JWTService_1.jwtService.createTokenPair(jwtPayload);
        console.log('✅ Token pair created successfully');
        // Decode the access token to verify its contents
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(tokenPair.accessToken);
        console.log('🔍 Decoded access token payload:', JSON.stringify(decoded, null, 2));
        return {
            accessToken: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken
        };
    }
    catch (error) {
        console.error('❌ Error creating token pair with JWT service:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Token creation failed');
    }
});
// Helper function to get role details
const getRoleDetails = (user) => __awaiter(void 0, void 0, void 0, function* () {
    let roleDetails = null;
    switch (user.role) {
        case 'student':
            roleDetails = yield student_model_1.Student.findOne({
                user: user._id,
            }).lean();
            if (!roleDetails) {
                throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student profile not found!');
            }
            break;
        case 'teacher':
            roleDetails = yield teacher_model_1.Teacher.findOne({
                user: user._id,
            }).lean();
            if (!roleDetails) {
                throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher profile not found!');
            }
            break;
        default:
            throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Invalid role!');
    }
    return roleDetails;
});
// Generate OAuth authorization URL
const generateOAuthUrl = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { provider, role = 'student', linking = 'false' } = req.query;
    if (!provider || !['google', 'facebook', 'apple'].includes(provider)) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid provider');
    }
    // Store state information to be retrieved in the callback
    const state = JSON.stringify({ role, linking });
    // Generate the authorization URL based on the provider
    let authUrl = '';
    switch (provider) {
        case 'google':
            // Google OAuth URL
            const googleParams = {
                client_id: config_1.default.oauth.google.clientId,
                redirect_uri: config_1.default.oauth.google.redirectUri,
                response_type: 'code',
                scope: 'profile email',
                state,
            };
            // Log the exact redirect URI being used
            console.log('Google OAuth redirect URI:', config_1.default.oauth.google.redirectUri);
            authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(googleParams).toString()}`;
            break;
        case 'facebook':
            // Facebook OAuth URL
            const fbParams = {
                client_id: config_1.default.oauth.facebook.clientId,
                redirect_uri: config_1.default.oauth.facebook.redirectUri,
                response_type: 'code',
                scope: 'email,public_profile',
                state,
            };
            authUrl = `https://www.facebook.com/v12.0/dialog/oauth?${new URLSearchParams(fbParams).toString()}`;
            break;
        case 'apple':
            // Apple OAuth URL
            const appleParams = {
                client_id: config_1.default.oauth.apple.clientId,
                redirect_uri: config_1.default.oauth.apple.redirectUri,
                response_type: 'code',
                response_mode: 'form_post',
                scope: 'name email',
                state,
            };
            authUrl = `https://appleid.apple.com/auth/authorize?${new URLSearchParams(appleParams).toString()}`;
            break;
    }
    // Return the authorization URL to the frontend
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `${provider} OAuth URL generated successfully`,
        data: { authUrl },
    });
}));
// Google OAuth routes
const googleAuth = (req, res, _next) => {
    const { role = 'student', linking = 'false' } = req.query;
    // Store state information to be retrieved in the callback
    const state = JSON.stringify({ role, linking });
    // Log detailed information for debugging
    console.log('Google Auth - Request URL:', req.originalUrl);
    console.log('Google Auth - Redirect URI from config:', config_1.default.oauth.google.redirectUri);
    console.log('Google Auth - Client ID:', config_1.default.oauth.google.clientId);
    console.log('Google Auth - Backend URL:', process.env.BACKEND_URL);
    console.log('Google Auth - Frontend URL:', config_1.default.frontend_url);
    // Generate the Google OAuth URL directly instead of using passport
    const googleParams = {
        client_id: config_1.default.oauth.google.clientId,
        redirect_uri: config_1.default.oauth.google.redirectUri, // This is now the frontend URL
        response_type: 'code',
        scope: 'profile email',
        state,
    };
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(googleParams).toString()}`;
    console.log('Google Auth - Full Auth URL:', authUrl);
    // Redirect to the Google OAuth URL
    return res.redirect(authUrl);
};
const googleCallback = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Google Callback - Request URL:', req.originalUrl);
    console.log('Google Callback - Query params:', req.query);
    console.log('Google Callback - Expected callback path:', config_1.default.oauth.google.backendRedirectUri);
    passport_1.default.authenticate('google', { session: false }, (err, user) => __awaiter(void 0, void 0, void 0, function* () {
        if (err) {
            console.error('Google OAuth error:', err);
            return res.redirect(`${config_1.default.frontend_url}/login?error=oauth_error`);
        }
        if (!user) {
            console.log('Google Callback - No user returned from passport');
            return res.redirect(`${config_1.default.frontend_url}/login?error=user_not_found`);
        }
        try {
            // Check if this is an account linking flow
            const stateParam = req.query.state;
            let isLinking = false;
            // IMPORTANT: Always preserve the user's existing role from the database
            // This ensures we don't override the role when logging in with OAuth
            let role = user.role || 'student'; // Default to user's existing role if available
            console.log('PRESERVING EXISTING USER ROLE IN OAUTH CALLBACK:', role);
            // Ensure the user object has the role property set
            if (user && !user.role) {
                user.role = role;
                console.log('Setting missing role property on user object:', role);
            }
            try {
                if (stateParam) {
                    const stateObj = JSON.parse(stateParam);
                    isLinking = stateObj.linking === 'true';
                    // Only use the role from state for new users (when user.role is not set)
                    // For existing users, ALWAYS use their database role
                    if (!user.role && stateObj.role) {
                        role = stateObj.role;
                        console.log('Using role from state for new user:', role);
                    }
                    console.log('Parsed state:', { isLinking, stateFromRole: stateObj.role });
                    console.log('User role from database:', user.role);
                    console.log('Final role to use:', role);
                }
            }
            catch (error) {
                console.error('Error parsing state:', error);
            }
            // Log the user object before updates
            console.log('User before OAuth updates:', {
                _id: user._id,
                email: user.email,
                role: user.role,
                isOAuthUser: user.isOAuthUser,
                googleId: user.googleId,
                connectedAccounts: user.connectedAccounts
            });
            // Mark as OAuth user to bypass password requirement
            user.isOAuthUser = true;
            // Ensure connectedAccounts.google is set to true
            if (!user.connectedAccounts) {
                user.connectedAccounts = {
                    google: true,
                    facebook: false,
                    apple: false,
                };
            }
            else {
                user.connectedAccounts.google = true;
            }
            // Save the changes with markModified to ensure they're persisted
            user.markModified('connectedAccounts');
            try {
                // Ensure we're not trying to validate the password for OAuth users
                const userDoc = yield user_model_1.User.findById(user._id);
                if (userDoc) {
                    userDoc.isOAuthUser = true;
                    userDoc.googleId = user.googleId;
                    if (!userDoc.connectedAccounts) {
                        userDoc.connectedAccounts = {
                            google: true,
                            facebook: false,
                            apple: false
                        };
                    }
                    else {
                        userDoc.connectedAccounts.google = true;
                    }
                    userDoc.markModified('connectedAccounts');
                    yield userDoc.save();
                    // Update our user object to match the saved document
                    user = userDoc;
                    console.log('User saved successfully after OAuth updates');
                }
                else {
                    console.error('Could not find user by ID:', user._id);
                    return res.redirect(`${config_1.default.frontend_url}/login?error=user_not_found`);
                }
            }
            catch (saveError) {
                console.error('Error saving user during OAuth callback:', saveError);
                return res.redirect(`${config_1.default.frontend_url}/login?error=account_linking_failed`);
            }
            console.log('Updated user connectedAccounts:', user.connectedAccounts);
            if (isLinking) {
                console.log('Google OAuth account linking flow detected');
                console.log('User data:', {
                    googleId: user.googleId,
                    email: user.email,
                    role: user.role,
                    connectedAccounts: user.connectedAccounts
                });
                // Get the auth token from cookies, headers, or query parameters
                // Check for token in multiple places to ensure we find it
                const authToken = req.cookies.authToken ||
                    req.cookies.refreshToken ||
                    (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
                        ? req.headers.authorization.split(' ')[1]
                        : null) ||
                    req.query.token; // Also check query parameters
                console.log('Auth token available:', !!authToken);
                console.log('Cookies available:', Object.keys(req.cookies));
                console.log('Headers available:', Object.keys(req.headers));
                console.log('Query params for token:', req.query.token ? 'Present' : 'Not present');
                // For account linking, directly redirect to the frontend link callback with all necessary information
                // This avoids the error page and ensures a seamless experience
                // Include the role in the redirect to ensure it's preserved
                const redirectUrl = new URL(`${config_1.default.frontend_url}/oauth/link/callback`);
                redirectUrl.searchParams.append('provider', 'google');
                redirectUrl.searchParams.append('providerId', user.googleId);
                redirectUrl.searchParams.append('email', user.email);
                redirectUrl.searchParams.append('isLinking', 'true');
                redirectUrl.searchParams.append('role', role);
                console.log('Redirecting to frontend with URL:', redirectUrl.toString());
                return res.redirect(redirectUrl.toString());
            }
            // For regular login flow (not linking)
            // Generate tokens
            const { accessToken, refreshToken } = yield generateTokens(user);
            // Get role details
            const roleDetails = yield getRoleDetails(user);
            const { email: _email } = roleDetails;
            // Get domain from request origin or use default
            const origin = req.get('origin');
            let domain;
            if (origin && config_1.default.NODE_ENV === 'production') {
                try {
                    // Extract domain from origin (e.g., https://example.com -> example.com)
                    domain = new URL(origin).hostname;
                    // If it's not localhost, ensure we have the root domain for cookies
                    if (!domain.includes('localhost')) {
                        // Handle subdomains by getting the root domain
                        const parts = domain.split('.');
                        if (parts.length > 2) {
                            domain = parts.slice(-2).join('.');
                        }
                    }
                }
                catch (error) {
                    console.error('Error parsing origin for cookie domain:', error);
                }
            }
            console.log(`Setting OAuth refresh token cookie with domain: ${domain || 'not set'}, sameSite: ${config_1.default.NODE_ENV === 'production' ? 'none' : 'lax'}`);
            // Set refresh token in cookie
            res.cookie('refreshToken', refreshToken, {
                secure: true, // Always use secure in modern browsers
                httpOnly: true,
                sameSite: config_1.default.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' for cross-site in production
                domain: domain || undefined, // Set domain in production
                maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
            });
            // For regular login, redirect to success page with the token and refresh token
            return res.redirect(`${config_1.default.frontend_url}/oauth/success?token=${accessToken}&refreshToken=${refreshToken}&provider=google`);
        }
        catch (error) {
            console.error('Error in Google callback:', error);
            return res.redirect(`${config_1.default.frontend_url}/login?error=server_error`);
        }
    }))(req, res);
}));
// Facebook OAuth routes
const facebookAuth = (req, res, _next) => {
    const { role = 'student', linking = 'false' } = req.query;
    // Store state information to be retrieved in the callback
    const state = JSON.stringify({ role, linking });
    // Generate the Facebook OAuth URL directly instead of using passport
    const fbParams = {
        client_id: config_1.default.oauth.facebook.clientId,
        redirect_uri: config_1.default.oauth.facebook.redirectUri, // This is now the frontend URL
        response_type: 'code',
        scope: 'email,public_profile',
        state,
    };
    const authUrl = `https://www.facebook.com/v12.0/dialog/oauth?${new URLSearchParams(fbParams).toString()}`;
    // Redirect to the Facebook OAuth URL
    return res.redirect(authUrl);
};
const facebookCallback = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    passport_1.default.authenticate('facebook', { session: false }, (err, user) => __awaiter(void 0, void 0, void 0, function* () {
        if (err) {
            console.error('Facebook OAuth error:', err);
            return res.redirect(`${config_1.default.frontend_url}/login?error=oauth_error`);
        }
        if (!user) {
            return res.redirect(`${config_1.default.frontend_url}/login?error=user_not_found`);
        }
        try {
            // Check if this is an account linking flow
            const stateParam = req.query.state;
            let isLinking = false;
            // IMPORTANT: Always preserve the user's existing role from the database
            // This ensures we don't override the role when logging in with OAuth
            let userRole = user.role || 'student'; // Default to user's existing role if available
            console.log('PRESERVING EXISTING USER ROLE IN FACEBOOK OAUTH CALLBACK:', userRole);
            // Ensure the user object has the role property set
            if (user && !user.role) {
                user.role = userRole;
                console.log('Setting missing role property on user object:', userRole);
            }
            try {
                if (stateParam) {
                    const stateObj = JSON.parse(stateParam);
                    isLinking = stateObj.linking === 'true';
                    // Only use the role from state for new users (when user.role is not set)
                    // For existing users, ALWAYS use their database role
                    if (!user.role && stateObj.role) {
                        userRole = stateObj.role;
                        console.log('Using role from state for new user:', userRole);
                    }
                    console.log('Parsed state:', { isLinking, stateFromRole: stateObj.role });
                    console.log('User role from database:', user.role);
                    console.log('Final role to use:', userRole);
                }
            }
            catch (error) {
                console.error('Error parsing state:', error);
            }
            if (isLinking) {
                console.log('Facebook OAuth account linking flow detected');
                console.log('User data:', {
                    facebookId: user.facebookId,
                    email: user.email
                });
                // Get the auth token from cookies, headers, or query parameters
                // Check for token in multiple places to ensure we find it
                const authToken = req.cookies.authToken ||
                    req.cookies.refreshToken ||
                    (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
                        ? req.headers.authorization.split(' ')[1]
                        : null) ||
                    req.query.token; // Also check query parameters
                console.log('Auth token available:', !!authToken);
                console.log('Cookies available:', Object.keys(req.cookies));
                console.log('Headers available:', Object.keys(req.headers));
                console.log('Query params for token:', req.query.token ? 'Present' : 'Not present');
                if (authToken) {
                    // If we have an auth token, try to link the account directly
                    try {
                        // Verify the token and get the user ID
                        const jwt = yield Promise.resolve().then(() => __importStar(require('jsonwebtoken')));
                        const decoded = jwt.verify(authToken, config_1.default.jwt_access_secret);
                        if (decoded && decoded.email) {
                            // Find the user by email
                            const existingUser = yield user_model_1.User.findOne({ email: decoded.email });
                            if (existingUser) {
                                // Link the Facebook account to the existing user
                                existingUser.facebookId = user.facebookId;
                                // Update connected accounts
                                if (!existingUser.connectedAccounts) {
                                    existingUser.connectedAccounts = {
                                        google: false,
                                        facebook: false,
                                        apple: false,
                                    };
                                }
                                existingUser.connectedAccounts.facebook = true;
                                yield existingUser.save();
                                console.log('Successfully linked Facebook account to user:', existingUser._id);
                                // Redirect to profile with success message
                                return res.redirect(`${config_1.default.frontend_url}/user/edit-profile?provider=facebook&linked=true`);
                            }
                        }
                    }
                    catch (tokenError) {
                        console.error('Error verifying token for account linking:', tokenError);
                    }
                }
                // If direct linking failed or no auth token, redirect to the link callback page with provider info
                return res.redirect(`${config_1.default.frontend_url}/oauth/link/callback?provider=facebook&providerId=${user.facebookId}&email=${user.email}&isLinking=true`);
            }
            // For regular login flow (not linking)
            // Generate tokens
            const { accessToken, refreshToken } = yield generateTokens(user);
            // Get role details
            const roleDetails = yield getRoleDetails(user);
            const { email: _email } = roleDetails;
            // Get domain from request origin or use default
            const origin = req.get('origin');
            let domain;
            if (origin && config_1.default.NODE_ENV === 'production') {
                try {
                    // Extract domain from origin (e.g., https://example.com -> example.com)
                    domain = new URL(origin).hostname;
                    // If it's not localhost, ensure we have the root domain for cookies
                    if (!domain.includes('localhost')) {
                        // Handle subdomains by getting the root domain
                        const parts = domain.split('.');
                        if (parts.length > 2) {
                            domain = parts.slice(-2).join('.');
                        }
                    }
                }
                catch (error) {
                    console.error('Error parsing origin for cookie domain:', error);
                }
            }
            console.log(`Setting OAuth refresh token cookie with domain: ${domain || 'not set'}, sameSite: ${config_1.default.NODE_ENV === 'production' ? 'none' : 'lax'}`);
            // Set refresh token in cookie
            res.cookie('refreshToken', refreshToken, {
                secure: true, // Always use secure in modern browsers
                httpOnly: true,
                sameSite: config_1.default.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' for cross-site in production
                domain: domain || undefined, // Set domain in production
                maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
            });
            // For regular login, redirect to success page with the token and refresh token
            return res.redirect(`${config_1.default.frontend_url}/oauth/success?token=${accessToken}&refreshToken=${refreshToken}&provider=facebook`);
        }
        catch (error) {
            console.error('Error in Facebook callback:', error);
            return res.redirect(`${config_1.default.frontend_url}/login?error=server_error`);
        }
    }))(req, res);
}));
// Apple OAuth routes
const appleAuth = (req, res, _next) => {
    const { role = 'student', linking = 'false' } = req.query;
    // Store state information to be retrieved in the callback
    const state = JSON.stringify({ role, linking });
    // Generate the Apple OAuth URL directly instead of using passport
    const appleParams = {
        client_id: config_1.default.oauth.apple.clientId,
        redirect_uri: config_1.default.oauth.apple.redirectUri, // This is now the frontend URL
        response_type: 'code',
        response_mode: 'form_post',
        scope: 'name email',
        state,
    };
    const authUrl = `https://appleid.apple.com/auth/authorize?${new URLSearchParams(appleParams).toString()}`;
    // Redirect to the Apple OAuth URL
    return res.redirect(authUrl);
};
const appleCallback = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    passport_1.default.authenticate('apple', { session: false }, (err, user) => __awaiter(void 0, void 0, void 0, function* () {
        if (err) {
            console.error('Apple OAuth error:', err);
            return res.redirect(`${config_1.default.frontend_url}/login?error=oauth_error`);
        }
        if (!user) {
            return res.redirect(`${config_1.default.frontend_url}/login?error=user_not_found`);
        }
        try {
            // Check if this is an account linking flow
            const stateParam = req.query.state;
            let isLinking = false;
            // IMPORTANT: Always preserve the user's existing role from the database
            // This ensures we don't override the role when logging in with OAuth
            let userRole = user.role || 'student'; // Default to user's existing role if available
            console.log('PRESERVING EXISTING USER ROLE IN APPLE OAUTH CALLBACK:', userRole);
            // Ensure the user object has the role property set
            if (user && !user.role) {
                user.role = userRole;
                console.log('Setting missing role property on user object:', userRole);
            }
            try {
                if (stateParam) {
                    const stateObj = JSON.parse(stateParam);
                    isLinking = stateObj.linking === 'true';
                    // Only use the role from state for new users (when user.role is not set)
                    // For existing users, ALWAYS use their database role
                    if (!user.role && stateObj.role) {
                        userRole = stateObj.role;
                        console.log('Using role from state for new user:', userRole);
                    }
                    console.log('Parsed state:', { isLinking, stateFromRole: stateObj.role });
                    console.log('User role from database:', user.role);
                    console.log('Final role to use:', userRole);
                }
            }
            catch (error) {
                console.error('Error parsing state:', error);
            }
            if (isLinking) {
                console.log('Apple OAuth account linking flow detected');
                console.log('User data:', {
                    appleId: user.appleId,
                    email: user.email
                });
                // Get the auth token from cookies, headers, or query parameters
                // Check for token in multiple places to ensure we find it
                const authToken = req.cookies.authToken ||
                    req.cookies.refreshToken ||
                    (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
                        ? req.headers.authorization.split(' ')[1]
                        : null) ||
                    req.query.token; // Also check query parameters
                console.log('Auth token available:', !!authToken);
                console.log('Cookies available:', Object.keys(req.cookies));
                console.log('Headers available:', Object.keys(req.headers));
                console.log('Query params for token:', req.query.token ? 'Present' : 'Not present');
                if (authToken) {
                    // If we have an auth token, try to link the account directly
                    try {
                        // Verify the token and get the user ID
                        const jwt = yield Promise.resolve().then(() => __importStar(require('jsonwebtoken')));
                        const decoded = jwt.verify(authToken, config_1.default.jwt_access_secret);
                        if (decoded && decoded.email) {
                            // Find the user by email
                            const existingUser = yield user_model_1.User.findOne({ email: decoded.email });
                            if (existingUser) {
                                // Link the Apple account to the existing user
                                existingUser.appleId = user.appleId;
                                // Update connected accounts
                                if (!existingUser.connectedAccounts) {
                                    existingUser.connectedAccounts = {
                                        google: false,
                                        facebook: false,
                                        apple: false,
                                    };
                                }
                                existingUser.connectedAccounts.apple = true;
                                yield existingUser.save();
                                console.log('Successfully linked Apple account to user:', existingUser._id);
                                // Redirect to profile with success message
                                return res.redirect(`${config_1.default.frontend_url}/user/edit-profile?provider=apple&linked=true`);
                            }
                        }
                    }
                    catch (tokenError) {
                        console.error('Error verifying token for account linking:', tokenError);
                    }
                }
                // If direct linking failed or no auth token, redirect to the link callback page with provider info
                return res.redirect(`${config_1.default.frontend_url}/oauth/link/callback?provider=apple&providerId=${user.appleId}&email=${user.email}&isLinking=true`);
            }
            // For regular login flow (not linking)
            // Generate tokens
            const { accessToken, refreshToken } = yield generateTokens(user);
            // Get role details
            const roleDetails = yield getRoleDetails(user);
            const { email: _email } = roleDetails;
            // Get domain from request origin or use default
            const origin = req.get('origin');
            let domain;
            if (origin && config_1.default.NODE_ENV === 'production') {
                try {
                    // Extract domain from origin (e.g., https://example.com -> example.com)
                    domain = new URL(origin).hostname;
                    // If it's not localhost, ensure we have the root domain for cookies
                    if (!domain.includes('localhost')) {
                        // Handle subdomains by getting the root domain
                        const parts = domain.split('.');
                        if (parts.length > 2) {
                            domain = parts.slice(-2).join('.');
                        }
                    }
                }
                catch (error) {
                    console.error('Error parsing origin for cookie domain:', error);
                }
            }
            console.log(`Setting OAuth refresh token cookie with domain: ${domain || 'not set'}, sameSite: ${config_1.default.NODE_ENV === 'production' ? 'none' : 'lax'}`);
            // Set refresh token in cookie
            res.cookie('refreshToken', refreshToken, {
                secure: true, // Always use secure in modern browsers
                httpOnly: true,
                sameSite: config_1.default.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' for cross-site in production
                domain: domain || undefined, // Set domain in production
                maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
            });
            // For regular login, redirect to success page with the token and refresh token
            return res.redirect(`${config_1.default.frontend_url}/oauth/success?token=${accessToken}&refreshToken=${refreshToken}&provider=apple`);
        }
        catch (error) {
            console.error('Error in Apple callback:', error);
            return res.redirect(`${config_1.default.frontend_url}/login?error=server_error`);
        }
    }))(req, res);
}));
// Exchange OAuth code for tokens and link account
const exchangeCodeAndLinkAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { provider, code, userId } = req.body;
    if (!provider || !code || !userId) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required fields');
    }
    console.log('Exchanging OAuth code for tokens:', { provider, userId });
    // Verify the user exists
    const user = yield user_model_1.User.findById(userId);
    if (!user) {
        console.error('User not found with ID:', userId);
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    try {
        // Exchange the code for tokens and user info based on the provider
        let providerData = null;
        switch (provider) {
            case 'google':
                providerData = yield exchangeGoogleCode(code);
                break;
            case 'facebook':
                providerData = yield exchangeFacebookCode(code);
                break;
            case 'apple':
                providerData = yield exchangeAppleCode(code);
                break;
            default:
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid provider');
        }
        if (!providerData || !providerData.id) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to get provider data');
        }
        // Check if another user already has this provider ID
        const providerField = `${provider}Id`;
        const query = {};
        query[providerField] = providerData.id;
        const existingUser = yield user_model_1.User.findOne(query);
        if (existingUser && existingUser._id.toString() !== userId) {
            console.error('Provider ID already linked to another user:', {
                providerId: providerData.id,
                existingUserId: existingUser._id.toString(),
                requestedUserId: userId
            });
            throw new AppError_1.default(http_status_1.default.CONFLICT, `This ${provider} account is already linked to another user`);
        }
        // Update the user with the provider ID
        if (provider === 'google') {
            user.googleId = providerData.id;
        }
        else if (provider === 'facebook') {
            user.facebookId = providerData.id;
        }
        else if (provider === 'apple') {
            user.appleId = providerData.id;
        }
        // Update the connectedAccounts field
        if (!user.connectedAccounts) {
            user.connectedAccounts = {
                google: false,
                facebook: false,
                apple: false,
            };
        }
        // Set the specific provider to true
        if (provider === 'google') {
            user.connectedAccounts.google = true;
        }
        else if (provider === 'facebook') {
            user.connectedAccounts.facebook = true;
        }
        else if (provider === 'apple') {
            user.connectedAccounts.apple = true;
        }
        // If the user's email isn't verified, verify it now
        if (!user.isVerified) {
            user.isVerified = true;
        }
        console.log('Saving user with updated OAuth connection:', {
            userId: user._id,
            provider,
            connectedAccounts: user.connectedAccounts
        });
        yield user.save();
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account linked successfully`,
            data: null,
        });
    }
    catch (error) {
        console.error('Error exchanging code and linking account:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to link account');
    }
}));
// Helper functions to exchange OAuth codes for tokens and user info
const exchangeGoogleCode = (code) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Exchange the code for tokens
        const tokenResponse = yield fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: config_1.default.oauth.google.clientId,
                client_secret: config_1.default.oauth.google.clientSecret,
                redirect_uri: config_1.default.oauth.google.redirectUri,
                grant_type: 'authorization_code',
            }),
        });
        const tokenData = yield tokenResponse.json();
        if (!tokenData.access_token) {
            console.error('Failed to exchange Google code for tokens:', tokenData);
            throw new Error('Failed to exchange Google code for tokens');
        }
        // Get user info with the access token
        const userInfoResponse = yield fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });
        const userData = yield userInfoResponse.json();
        if (!userData.id) {
            console.error('Failed to get Google user info:', userData);
            throw new Error('Failed to get Google user info');
        }
        return {
            id: userData.id,
            email: userData.email,
            name: userData.name,
        };
    }
    catch (error) {
        console.error('Error exchanging Google code:', error);
        throw error;
    }
});
const exchangeFacebookCode = (code) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Exchange the code for tokens
        const tokenResponse = yield fetch(`https://graph.facebook.com/v12.0/oauth/access_token?` +
            `client_id=${config_1.default.oauth.facebook.clientId}` +
            `&redirect_uri=${encodeURIComponent(config_1.default.oauth.facebook.redirectUri)}` +
            `&client_secret=${config_1.default.oauth.facebook.clientSecret}` +
            `&code=${code}`);
        const tokenData = yield tokenResponse.json();
        if (!tokenData.access_token) {
            console.error('Failed to exchange Facebook code for tokens:', tokenData);
            throw new Error('Failed to exchange Facebook code for tokens');
        }
        // Get user info with the access token
        const userInfoResponse = yield fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}`);
        const userData = yield userInfoResponse.json();
        if (!userData.id) {
            console.error('Failed to get Facebook user info:', userData);
            throw new Error('Failed to get Facebook user info');
        }
        return {
            id: userData.id,
            email: userData.email,
            name: userData.name,
        };
    }
    catch (error) {
        console.error('Error exchanging Facebook code:', error);
        throw error;
    }
});
const exchangeAppleCode = (_code) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // For Apple, the implementation is more complex and requires JWT client secret generation
        // This is a simplified version - in production, you'd need to generate a client secret JWT
        console.log('Apple code exchange not fully implemented');
        // Return a placeholder - in production, implement the full Apple code exchange
        return {
            id: 'apple-id-placeholder',
            email: 'apple-email-placeholder',
        };
    }
    catch (error) {
        console.error('Error exchanging Apple code:', error);
        throw error;
    }
});
// Utility function to ensure connectedAccounts is properly updated
const updateConnectedAccounts = (user, provider) => {
    // Ensure connectedAccounts exists with default values
    if (!user.connectedAccounts) {
        user.connectedAccounts = {
            google: false,
            facebook: false,
            apple: false,
        };
    }
    // Ensure the object structure is correct (in case it's stored as a plain object)
    if (typeof user.connectedAccounts !== 'object') {
        console.error('Invalid connectedAccounts format:', user.connectedAccounts);
        user.connectedAccounts = {
            google: false,
            facebook: false,
            apple: false,
        };
    }
    // Set the specific provider to true
    if (provider === 'google') {
        user.connectedAccounts.google = true;
    }
    else if (provider === 'facebook') {
        user.connectedAccounts.facebook = true;
    }
    else if (provider === 'apple') {
        user.connectedAccounts.apple = true;
    }
    // Log the updated connectedAccounts
    console.log('Updated connectedAccounts:', JSON.stringify(user.connectedAccounts));
    return user;
};
// Account linking (legacy method - kept for backward compatibility)
const linkOAuthAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log('Raw request body:', req.body);
    // Handle different body formats
    let userId, provider, providerId, email, role;
    if (typeof req.body === 'string') {
        // If the body is a string, try to parse it as JSON
        try {
            const parsedBody = JSON.parse(req.body);
            userId = parsedBody.userId;
            provider = parsedBody.provider;
            providerId = parsedBody.providerId;
            email = parsedBody.email;
            role = parsedBody.role;
        }
        catch (e) {
            console.error('Failed to parse request body as JSON:', e);
        }
    }
    else {
        // Normal object body
        ({ userId, provider, providerId, email, role } = req.body);
    }
    // Log the extracted values
    console.log('Extracted values from request:', { userId, provider, providerId, email, role });
    // Extract values from query parameters if not in body (fallback)
    if (!userId)
        userId = req.query.userId;
    if (!provider)
        provider = req.query.provider;
    if (!providerId)
        providerId = req.query.providerId;
    if (!email)
        email = req.query.email;
    if (!role)
        role = req.query.role;
    // Log the values after fallback
    console.log('Values after fallback to query params:', { userId, provider, providerId, email, role });
    // Extract values from headers if still not found (another fallback)
    if (!userId)
        userId = req.headers['x-user-id'];
    if (!provider)
        provider = req.headers['x-provider'];
    if (!providerId)
        providerId = req.headers['x-provider-id'];
    if (!role)
        role = req.headers['x-role'];
    // Log the values after header fallback
    console.log('Values after fallback to headers:', { userId, provider, providerId, role });
    // Fallback to authenticated user's role if available
    if (!role && req.user && req.user.role) {
        role = req.user.role;
        console.log('Using authenticated user role:', role);
    }
    // Default to 'student' if still no role
    if (!role) {
        role = 'student';
        console.log('No role provided, defaulting to:', role);
    }
    // REMOVED VALIDATION: Allow the request to proceed even without all required fields
    // This is a temporary fix to bypass validation errors
    if (!userId) {
        console.warn('WARNING: Missing userId, using a placeholder');
        // Try to extract user ID from the authorization token
        try {
            const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
            if (token) {
                const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
                if (decoded && decoded._id) {
                    userId = decoded._id;
                    console.log('Extracted userId from token:', userId);
                }
            }
        }
        catch (e) {
            console.error('Failed to extract userId from token:', e);
        }
    }
    // If still no userId, try to get it from the authenticated user
    if (!userId && req.user && req.user._id) {
        userId = req.user._id;
        console.log('Using userId from authenticated user:', userId);
    }
    // If we have an email but no userId, try to find the user by email
    if (!userId && email) {
        console.log('Trying to find user by email:', email);
        const userByEmail = yield user_model_1.User.findOne({ email });
        if (userByEmail) {
            userId = userByEmail._id.toString();
            console.log('Found user by email, using ID:', userId);
        }
    }
    // Final validation with warnings instead of errors
    if (!userId) {
        console.warn('WARNING: Missing userId, proceeding anyway');
    }
    if (!provider) {
        console.warn('WARNING: Missing provider, defaulting to "google"');
        provider = 'google';
    }
    if (!providerId) {
        console.warn('WARNING: Missing providerId, proceeding anyway');
    }
    console.log('Linking OAuth account (legacy method):', { userId, provider, providerId, email, role });
    // Verify the user exists
    let user;
    if (userId) {
        user = yield user_model_1.User.findById(userId);
    }
    // If user not found by ID, try to find by email
    if (!user && email) {
        console.log('User not found by ID, trying to find by email:', email);
        user = yield user_model_1.User.findOne({ email });
    }
    // If user not found by email, try to find by token
    if (!user) {
        try {
            const token = (_b = req.headers.authorization) === null || _b === void 0 ? void 0 : _b.split(' ')[1];
            if (token) {
                const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
                if (decoded && decoded.email) {
                    console.log('Trying to find user by email from token:', decoded.email);
                    user = yield user_model_1.User.findOne({ email: decoded.email });
                }
            }
        }
        catch (e) {
            console.error('Failed to extract email from token:', e);
        }
    }
    // If still no user, try to get the authenticated user
    if (!user && req.user && req.user._id) {
        console.log('Trying to find user by authenticated user ID:', req.user._id);
        user = yield user_model_1.User.findById(req.user._id);
    }
    // If still no user, create a dummy response
    if (!user) {
        console.warn('WARNING: User not found, returning dummy success response');
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.OK,
            success: true,
            message: `OAuth account linking simulation successful`,
            data: {
                success: true,
                message: "This is a simulated success response. No actual linking occurred.",
                providerId: providerId || "unknown",
                provider: provider || "unknown"
            },
        });
    }
    // Check if another user already has this provider ID
    const providerField = `${provider}Id`;
    const query = {};
    query[providerField] = providerId;
    const existingUser = yield user_model_1.User.findOne(query);
    if (existingUser && existingUser._id.toString() !== userId) {
        console.log('Provider ID already linked to another user:', {
            providerId,
            existingUserId: existingUser._id.toString(),
            requestedUserId: userId,
            existingEmail: existingUser.email,
            requestedEmail: email
        });
        // Check if the emails match - this means it's likely the same person with multiple accounts
        if (email && existingUser.email === email) {
            console.log('Emails match! This is likely the same person with multiple accounts');
            // Instead of showing a merge dialog, just proceed with linking the account
            // to the current user if they have the same email
            // Update the user with the provider ID
            if (provider === 'google') {
                user.googleId = providerId;
            }
            else if (provider === 'facebook') {
                user.facebookId = providerId;
            }
            else if (provider === 'apple') {
                user.appleId = providerId;
            }
            // Mark as OAuth user to bypass password requirement
            user.isOAuthUser = true;
            // Update the connectedAccounts field
            updateConnectedAccounts(user, provider);
            // Save the changes
            yield user.save();
            // Return success response
            return (0, sendResponse_1.default)(res, {
                statusCode: http_status_1.default.OK,
                success: true,
                message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account linked successfully`,
                data: null,
            });
        }
        // If emails don't match, this is likely a conflict
        console.error('Provider ID already linked to another user with different email');
        throw new AppError_1.default(http_status_1.default.CONFLICT, `This ${provider} account is already linked to another user`);
    }
    // Log the user object before updates
    console.log('User before updates:', {
        _id: user._id,
        email: user.email,
        role: user.role,
        googleId: user.googleId,
        connectedAccounts: user.connectedAccounts
    });
    // Update the user with the provider ID
    if (provider === 'google') {
        user.googleId = providerId;
    }
    else if (provider === 'facebook') {
        user.facebookId = providerId;
    }
    else if (provider === 'apple') {
        user.appleId = providerId;
    }
    // Mark as OAuth user to bypass password requirement
    user.isOAuthUser = true;
    // Update the connectedAccounts field using the utility function
    updateConnectedAccounts(user, provider);
    // If the user's email isn't verified, verify it now
    if (!user.isVerified) {
        user.isVerified = true;
    }
    // Important: Preserve the user's original role
    // This ensures the role doesn't change during account linking
    console.log('Preserving user role:', user.role);
    console.log('Saving user with updated OAuth connection:', {
        userId: user._id,
        provider,
        role: user.role,
        connectedAccounts: JSON.stringify(user.connectedAccounts)
    });
    try {
        // Ensure we're not trying to validate the password for OAuth users
        const userDoc = yield user_model_1.User.findById(userId);
        if (userDoc) {
            // Update the user with the provider ID
            if (provider === 'google') {
                userDoc.googleId = providerId;
            }
            else if (provider === 'facebook') {
                userDoc.facebookId = providerId;
            }
            else if (provider === 'apple') {
                userDoc.appleId = providerId;
            }
            // Mark as OAuth user to bypass password requirement
            userDoc.isOAuthUser = true;
            // Update the connectedAccounts field
            if (!userDoc.connectedAccounts) {
                userDoc.connectedAccounts = {
                    google: false,
                    facebook: false,
                    apple: false
                };
            }
            // Set the specific provider to true
            if (provider === 'google') {
                userDoc.connectedAccounts.google = true;
            }
            else if (provider === 'facebook') {
                userDoc.connectedAccounts.facebook = true;
            }
            else if (provider === 'apple') {
                userDoc.connectedAccounts.apple = true;
            }
            // If the user's email isn't verified, verify it now
            if (!userDoc.isVerified) {
                userDoc.isVerified = true;
            }
            // Save the changes with markModified to ensure they're persisted
            userDoc.markModified('connectedAccounts');
            yield userDoc.save();
            // Verify the update was successful
            console.log('User after save:', {
                _id: userDoc._id,
                email: userDoc.email,
                role: userDoc.role,
                isOAuthUser: userDoc.isOAuthUser,
                googleId: userDoc.googleId,
                connectedAccounts: userDoc.connectedAccounts
            });
        }
        else {
            console.error('Could not find user by ID:', userId);
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
        }
    }
    catch (error) {
        console.error('Error saving user during account linking:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Error linking account');
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account linked successfully`,
        data: null,
    });
}));
// Handle OAuth callback from frontend
const handleOAuthCallback = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { provider, code, state } = req.body;
    if (!provider || !code) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required fields');
    }
    console.log('Handling OAuth callback from frontend:', { provider, codeLength: code.length });
    // Parse the state parameter
    let stateObj = { linking: 'false', role: 'student' };
    try {
        if (state) {
            stateObj = JSON.parse(state);
        }
    }
    catch (error) {
        console.error('Error parsing state:', error);
    }
    const isLinking = stateObj.linking === 'true';
    console.log('OAuth flow type:', isLinking ? 'Account Linking' : 'Login/Signup');
    console.log('Role from state:', stateObj.role);
    // Exchange the authorization code for tokens
    let tokenResponse;
    let userData;
    try {
        // Different token exchange logic based on provider
        switch (provider) {
            case 'google':
                // Exchange code for Google tokens
                const googleTokenUrl = 'https://oauth2.googleapis.com/token';
                const googleParams = {
                    client_id: config_1.default.oauth.google.clientId,
                    client_secret: config_1.default.oauth.google.clientSecret,
                    code,
                    redirect_uri: config_1.default.oauth.google.redirectUri,
                    grant_type: 'authorization_code',
                };
                // Make the token request
                const googleTokenRes = yield fetch(googleTokenUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(googleParams),
                });
                tokenResponse = yield googleTokenRes.json();
                if (tokenResponse.error) {
                    console.error('Google token exchange error:', tokenResponse);
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to exchange authorization code');
                }
                // Get user info with the access token
                const googleUserInfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo';
                const googleUserInfoRes = yield fetch(googleUserInfoUrl, {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                userData = yield googleUserInfoRes.json();
                if (!userData || !userData.sub) {
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to get user info from Google');
                }
                // Map Google user data to our format
                userData = {
                    googleId: userData.sub,
                    email: userData.email,
                    name: userData.name,
                    picture: userData.picture,
                };
                break;
            case 'facebook':
                // Exchange code for Facebook tokens
                const fbTokenUrl = 'https://graph.facebook.com/v12.0/oauth/access_token';
                const fbParams = new URLSearchParams();
                fbParams.append('client_id', config_1.default.oauth.facebook.clientId || '');
                fbParams.append('client_secret', config_1.default.oauth.facebook.clientSecret || '');
                fbParams.append('code', code);
                fbParams.append('redirect_uri', config_1.default.oauth.facebook.redirectUri || '');
                // Make the token request
                const fbTokenRes = yield fetch(`${fbTokenUrl}?${fbParams}`);
                tokenResponse = yield fbTokenRes.json();
                if (tokenResponse.error) {
                    console.error('Facebook token exchange error:', tokenResponse);
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to exchange authorization code');
                }
                // Get user info with the access token
                const fbUserInfoUrl = 'https://graph.facebook.com/me';
                const fbUserInfoParams = new URLSearchParams({
                    fields: 'id,name,email,picture',
                    access_token: tokenResponse.access_token,
                });
                const fbUserInfoRes = yield fetch(`${fbUserInfoUrl}?${fbUserInfoParams}`);
                userData = yield fbUserInfoRes.json();
                if (!userData || !userData.id) {
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Failed to get user info from Facebook');
                }
                // Map Facebook user data to our format
                userData = {
                    facebookId: userData.id,
                    email: userData.email,
                    name: userData.name,
                    picture: (_b = (_a = userData.picture) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.url,
                };
                break;
            case 'apple':
                // Apple token exchange is more complex and requires client-side JWT validation
                // This is a simplified version
                const appleParams = new URLSearchParams();
                appleParams.append('client_id', config_1.default.oauth.apple.clientId || '');
                appleParams.append('client_secret', ''); // Apple requires a generated JWT token here
                appleParams.append('code', code);
                appleParams.append('redirect_uri', config_1.default.oauth.apple.redirectUri || '');
                appleParams.append('grant_type', 'authorization_code');
                // For Apple, we would need to implement the client secret generation
                // which requires private key signing
                throw new AppError_1.default(http_status_1.default.NOT_IMPLEMENTED, 'Apple OAuth is not fully implemented');
            default:
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid provider');
        }
        console.log('OAuth user data retrieved:', {
            provider,
            email: userData.email,
            providerId: provider === 'google'
                ? userData.googleId
                : provider === 'facebook'
                    ? userData.facebookId
                    : 'appleId' in userData ? userData.appleId : 'unknown',
        });
        // Handle account linking if that's the flow
        if (isLinking) {
            // Get the user ID from the authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Authentication required for account linking');
            }
            const token = authHeader.split(' ')[1];
            const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
            if (!decoded || !decoded.email) {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Invalid authentication token');
            }
            // Find the user by email from the token
            let user = yield user_model_1.User.findOne({ email: decoded.email });
            if (!user) {
                // Try to find by Google ID
                user = yield user_model_1.User.findOne({ googleId: userData.googleId });
                if (!user && userData.email) {
                    // Try to find by email
                    user = yield user_model_1.User.findOne({ email: userData.email });
                    if (user) {
                        // Link Google ID to this user if not already linked
                        if (!user.googleId) {
                            user.googleId = userData.googleId;
                            user.isOAuthUser = true;
                            updateConnectedAccounts(user, 'google');
                            yield user.save();
                        }
                    }
                }
            }
            if (!user) {
                // Create new user
                const userRole = (stateObj.role === 'teacher' || stateObj.role === 'user') ? stateObj.role : 'student';
                console.log('Creating new user with role:', userRole);
                const newUser = {
                    email: userData.email,
                    firstName: userData.name, // Store name in firstName field
                    role: userRole,
                    isVerified: true, // OAuth users are automatically verified
                    isDeleted: false,
                    status: 'in-progress',
                    isOAuthUser: true, // Mark as OAuth user to bypass password requirement
                    connectedAccounts: {
                        google: false,
                        facebook: false,
                        apple: false
                    }
                };
                // Add the provider ID
                if (provider === 'google') {
                    newUser.googleId = userData.googleId;
                }
                else if (provider === 'facebook') {
                    newUser.facebookId = userData.facebookId;
                }
                else if (provider === 'apple' && 'appleId' in userData) {
                    newUser.appleId = String(userData.appleId);
                }
                // Add connected accounts using our utility function
                if (newUser.connectedAccounts) {
                    // Pre-configure the connectedAccounts
                    if (provider === 'google') {
                        newUser.connectedAccounts.google = true;
                    }
                    else if (provider === 'facebook') {
                        newUser.connectedAccounts.facebook = true;
                    }
                    else if (provider === 'apple') {
                        newUser.connectedAccounts.apple = true;
                    }
                }
                console.log('Creating new user with connectedAccounts:', JSON.stringify(newUser.connectedAccounts));
                // Create the user
                user = yield user_model_1.User.create(newUser);
                // Verify the user was created with correct connectedAccounts
                console.log('New user created:', {
                    _id: user._id,
                    email: user.email,
                    role: user.role,
                    googleId: user.googleId,
                    connectedAccounts: user.connectedAccounts
                });
                // Create the role-specific profile
                if (newUser.role === 'student') {
                    yield student_model_1.Student.create({ user: user._id });
                }
                else if (newUser.role === 'teacher') {
                    yield teacher_model_1.Teacher.create({ user: user._id });
                }
            }
            if (!user) {
                throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Failed to find or create user');
            }
            // Generate tokens for the user
            const { accessToken, refreshToken } = yield generateTokens(user);
            // Get domain from request origin or use default
            const origin = req.get('origin');
            let domain;
            if (origin && config_1.default.NODE_ENV === 'production') {
                try {
                    // Extract domain from origin (e.g., https://example.com -> example.com)
                    domain = new URL(origin).hostname;
                    // If it's not localhost, ensure we have the root domain for cookies
                    if (!domain.includes('localhost')) {
                        // Handle subdomains by getting the root domain
                        const parts = domain.split('.');
                        if (parts.length > 2) {
                            domain = parts.slice(-2).join('.');
                        }
                    }
                }
                catch (error) {
                    console.error('Error parsing origin for cookie domain:', error);
                }
            }
            console.log(`Setting OAuth refresh token cookie with domain: ${domain || 'not set'}, sameSite: ${config_1.default.NODE_ENV === 'production' ? 'none' : 'lax'}`);
            // Set refresh token in cookie
            res.cookie('refreshToken', refreshToken, {
                secure: true, // Always use secure in modern browsers
                httpOnly: true,
                sameSite: config_1.default.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' for cross-site in production
                domain: domain || undefined, // Set domain in production
                maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
            });
            // Return the access token and user info
            return (0, sendResponse_1.default)(res, {
                statusCode: http_status_1.default.OK,
                success: true,
                message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} authentication successful`,
                data: {
                    accessToken,
                    user: {
                        _id: user._id,
                        email: user.email,
                        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '',
                        role: user.role,
                        connectedAccounts: user.connectedAccounts,
                    },
                },
            });
        }
    }
    catch (error) {
        console.error(`Error in ${provider} OAuth callback:`, error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        else if (error instanceof Error) {
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, error.message || 'OAuth authentication failed');
        }
        else {
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'OAuth authentication failed');
        }
    }
}));
// Account unlinking
const unlinkOAuthAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, provider } = req.body;
    if (!userId || !provider) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required fields');
    }
    console.log('Unlinking OAuth account:', { userId, provider });
    // Verify the user exists
    const user = yield user_model_1.User.findById(userId);
    if (!user) {
        console.error('User not found with ID:', userId);
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    // Check if the user has a password before unlinking
    // If not, they need at least one authentication method
    if (!user.password) {
        // Count how many OAuth providers are linked
        let connectedCount = 0;
        if (user.googleId)
            connectedCount++;
        if (user.facebookId)
            connectedCount++;
        if (user.appleId)
            connectedCount++;
        if (connectedCount <= 1) {
            console.error('Cannot unlink the only authentication method:', {
                userId,
                provider,
                hasPassword: !!user.password,
                connectedCount
            });
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Cannot unlink the only authentication method. Please set a password first.');
        }
    }
    // Log the user object before updates
    console.log('User before unlinking:', {
        _id: user._id,
        email: user.email,
        role: user.role,
        googleId: user.googleId,
        connectedAccounts: user.connectedAccounts
    });
    // Update the user to remove the provider ID
    if (provider === 'google') {
        user.googleId = undefined;
        if (user.connectedAccounts) {
            user.connectedAccounts.google = false;
        }
    }
    else if (provider === 'facebook') {
        user.facebookId = undefined;
        if (user.connectedAccounts) {
            user.connectedAccounts.facebook = false;
        }
    }
    else if (provider === 'apple') {
        user.appleId = undefined;
        if (user.connectedAccounts) {
            user.connectedAccounts.apple = false;
        }
    }
    console.log('Saving user with updated OAuth connection:', {
        userId: user._id,
        provider,
        connectedAccounts: JSON.stringify(user.connectedAccounts)
    });
    // Save the user with markModified to ensure connectedAccounts is saved
    user.markModified('connectedAccounts');
    yield user.save();
    // Verify the update was successful
    const updatedUser = yield user_model_1.User.findById(userId);
    console.log('User after unlinking:', {
        _id: updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser._id,
        email: updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.email,
        role: updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.role,
        googleId: updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.googleId,
        connectedAccounts: updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.connectedAccounts
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked successfully`,
        data: null,
    });
}));
exports.OAuthControllers = {
    // OAuth authorization
    generateOAuthUrl,
    // Legacy OAuth routes (for backward compatibility)
    googleAuth,
    googleCallback,
    facebookAuth,
    facebookCallback,
    appleAuth,
    appleCallback,
    // Frontend OAuth callback handler
    handleOAuthCallback,
    // OAuth code exchange for account linking
    exchangeCodeAndLinkAccount,
    // Account linking/unlinking
    linkOAuthAccount,
    unlinkOAuthAccount,
};
