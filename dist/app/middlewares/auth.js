"use strict";
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
const http_status_1 = __importDefault(require("http-status"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const user_model_1 = require("../modules/User/user.model");
// Express Request type extension is now handled in types/express.d.ts
const auth = (...requiredRoles) => {
    return (0, catchAsync_1.default)((req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        // Extract token from Authorization header (Bearer token)
        const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
        // checking if the token is missing
        if (!token) {
            throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'You are not authorized!');
        }
        // checking if the given token is valid
        let decoded;
        try {
            if (!config_1.default.jwt_access_secret) {
                console.error('JWT access secret is not configured');
                throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'JWT configuration error');
            }
            decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
            console.log('Token verified successfully for user:', decoded.email);
        }
        catch (err) {
            console.error('JWT verification error:', err);
            // Check if it's a token expiration error
            if (err instanceof Error && err.name === 'TokenExpiredError') {
                console.log('Token expired at:', err.expiredAt);
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, `Token expired: Please refresh your authentication`);
            }
            if (err instanceof Error) {
                throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, `Unauthorized: ${err.message}`);
            }
            throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'Unauthorized');
        }
        const { role, email, iat } = decoded;
        // Enhanced logging for debugging
        console.log('🔍 Auth Middleware Debug Info:');
        console.log('- Decoded JWT payload:', JSON.stringify(decoded, null, 2));
        console.log('- Looking up user by email:', email);
        console.log('- User role from token:', role);
        console.log('- Token issued at:', iat ? new Date(iat * 1000).toISOString() : 'N/A');
        // checking if the user is exist
        const user = yield user_model_1.User.isUserExists(email);
        console.log('- User lookup result:', user ? 'Found' : 'Not found');
        if (user) {
            console.log('- Found user details:', {
                id: user._id,
                email: user.email,
                role: user.role,
                isOAuthUser: user.isOAuthUser,
                isVerified: user.isVerified,
                status: user.status
            });
        }
        if (!user) {
            console.error('❌ User not found in database for email:', email);
            console.error('❌ This might indicate:');
            console.error('   1. Email mismatch between token and database');
            console.error('   2. User was deleted after token generation');
            console.error('   3. Database connection issue');
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'This user is not found !');
        }
        if (user.passwordChangedAt &&
            user_model_1.User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat)) {
            throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'You are not authorized !');
        }
        if (requiredRoles && requiredRoles.length > 0) {
            console.log(`Required roles: ${requiredRoles.join(', ')}, User role: ${role}`);
            if (!requiredRoles.includes(role)) {
                console.error(`Role mismatch: User has role "${role}" but needs one of [${requiredRoles.join(', ')}]`);
                throw new AppError_1.default(http_status_1.default.FORBIDDEN, `Access denied. Required role: ${requiredRoles.join(' or ')}`);
            }
        }
        // Add user ID to the decoded token
        req.user = Object.assign(Object.assign({}, decoded), { _id: ((_b = user._id) === null || _b === void 0 ? void 0 : _b.toString()) || '' });
        next();
    }));
};
exports.default = auth;
