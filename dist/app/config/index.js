"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), '.env') });
exports.default = {
    NODE_ENV: process.env.NODE_ENV,
    port: process.env.PORT,
    database_url: process.env.DATABASE_URL,
    bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
    cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
    cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
    jwt_access_secret: process.env.JWT_ACCESS_SECRET,
    jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
    jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
    jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
    reset_pass_ui_link: process.env.RESET_PASS_UI_LINK,
    super_admin_password: process.env.SUPER_ADMIN_PASSWORD,
    invite_teacher_link: process.env.INVITE_TEACHER_LINK,
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
    stripe_connect_webhook_secret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    stripe_webhook_endpoint_url: process.env.STRIPE_WEBHOOK_ENDPOINT_URL,
    stripe_mother_account_id: process.env.MOTHER_STRIPE_ACCOUNT_ID,
    frontend_url: process.env.FRONTEND_URL || 'http://localhost:8080',
    gemini_api_key: process.env.GEMINI_API_KEY,
    redis: {
        host: process.env.REDIS_HOST || ((_b = (_a = process.env.REDIS_URL) === null || _a === void 0 ? void 0 : _a.split('@')[1]) === null || _b === void 0 ? void 0 : _b.split(':')[0]) || 'localhost',
        port: parseInt(process.env.REDIS_PORT || ((_d = (_c = process.env.REDIS_URL) === null || _c === void 0 ? void 0 : _c.split(':').pop()) === null || _d === void 0 ? void 0 : _d.split('/')[0]) || '6379'),
        password: process.env.REDIS_PASSWORD || ((_g = (_f = (_e = process.env.REDIS_URL) === null || _e === void 0 ? void 0 : _e.split('://')[1]) === null || _f === void 0 ? void 0 : _f.split('@')[0]) === null || _g === void 0 ? void 0 : _g.split(':')[1]) || '',
        url: process.env.REDIS_URL, // Support for full Redis URL (common in cloud deployments)
    },
    email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
    },
    // OAuth configuration
    oauth: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Use frontend callback URL instead of backend
            redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL || 'http://localhost:8080'}/oauth/callback/google`,
            // Keep the backend callback for backward compatibility
            backendRedirectUri: '/api/v1/oauth/google/callback',
        },
        facebook: {
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
            // Use frontend callback URL instead of backend
            redirectUri: process.env.FACEBOOK_REDIRECT_URI || `${process.env.FRONTEND_URL || 'http://localhost:8080'}/oauth/callback/facebook`,
            // Keep the backend callback for backward compatibility
            backendRedirectUri: '/api/v1/oauth/facebook/callback',
        },
        apple: {
            clientId: process.env.APPLE_CLIENT_ID,
            teamId: process.env.APPLE_TEAM_ID,
            keyId: process.env.APPLE_KEY_ID,
            privateKeyLocation: process.env.APPLE_PRIVATE_KEY_LOCATION,
            privateKeyContent: process.env.APPLE_PRIVATE_KEY_CONTENT,
            // Use frontend callback URL instead of backend
            redirectUri: process.env.APPLE_REDIRECT_URI || `${process.env.FRONTEND_URL || 'http://localhost:8080'}/oauth/callback/apple`,
            // Keep the backend callback for backward compatibility
            backendRedirectUri: '/api/v1/oauth/apple/callback',
        },
    },
};
