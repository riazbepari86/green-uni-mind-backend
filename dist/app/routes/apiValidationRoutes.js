"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const auth_1 = __importDefault(require("../middlewares/auth"));
const user_constant_1 = require("../modules/User/user.constant");
const router = (0, express_1.Router)();
/**
 * API Validation Routes for Enterprise API Reliability
 *
 * These routes provide validation endpoints for authentication,
 * token verification, and API health checks.
 */
// Token Validation Route
router.get('/validate', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.user), (req, res) => {
    try {
        // If we reach here, the auth middleware has already validated the token
        const user = req.user;
        res.status(200).json({
            success: true,
            message: 'Token is valid',
            data: {
                valid: true,
                user: {
                    id: user.userId,
                    email: user.email,
                    role: user.role,
                    iat: user.iat,
                    exp: user.exp,
                },
                expiresAt: new Date(user.exp * 1000).toISOString(),
                issuedAt: new Date(user.iat * 1000).toISOString(),
            },
        });
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: 'Token validation failed',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Token Refresh Route
router.post('/refresh', (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required',
            });
        }
        // Verify refresh token
        const decoded = jsonwebtoken_1.default.verify(refreshToken, config_1.default.jwt_refresh_secret);
        // Generate new access token
        const newAccessToken = jsonwebtoken_1.default.sign({
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
        }, config_1.default.jwt_access_secret, { expiresIn: config_1.default.jwt_access_expires_in });
        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken: newAccessToken,
                expiresIn: config_1.default.jwt_access_expires_in,
            },
        });
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// User Session Info Route
router.get('/session', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.user), (req, res) => {
    try {
        const user = req.user;
        res.status(200).json({
            success: true,
            message: 'Session information retrieved successfully',
            data: {
                sessionId: `session_${user.userId}_${Date.now()}`,
                user: {
                    id: user.userId,
                    email: user.email,
                    role: user.role,
                },
                loginTime: new Date(user.iat * 1000).toISOString(),
                expiryTime: new Date(user.exp * 1000).toISOString(),
                remainingTime: Math.max(0, user.exp - Math.floor(Date.now() / 1000)),
                isActive: user.exp > Math.floor(Date.now() / 1000),
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve session information',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// API Status Route
router.get('/status', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is operational',
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            endpoints: {
                authentication: 'operational',
                validation: 'operational',
                dashboard: 'operational',
                analytics: 'operational',
                payments: 'operational',
            },
        },
    });
});
// User Permissions Route
router.get('/permissions', (0, auth_1.default)(user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.user), (req, res) => {
    try {
        const user = req.user;
        // Define role-based permissions
        const permissions = {
            [user_constant_1.USER_ROLE.teacher]: [
                'read:own_profile',
                'update:own_profile',
                'read:own_courses',
                'create:courses',
                'update:own_courses',
                'delete:own_courses',
                'read:own_analytics',
                'read:own_earnings',
                'create:stripe_connect',
                'read:own_students',
            ],
            [user_constant_1.USER_ROLE.student]: [
                'read:own_profile',
                'update:own_profile',
                'read:courses',
                'enroll:courses',
                'read:own_enrollments',
                'create:payments',
                'read:own_transactions',
            ],
            [user_constant_1.USER_ROLE.user]: ['read:own_profile', 'update:own_profile'],
        };
        res.status(200).json({
            success: true,
            message: 'User permissions retrieved successfully',
            data: {
                userId: user.userId,
                role: user.role,
                permissions: permissions[user.role] || [],
                canAccess: {
                    dashboard: [user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student].includes(user.role),
                    analytics: user.role === user_constant_1.USER_ROLE.teacher,
                    payments: [user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student].includes(user.role),
                    courses: [user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student].includes(user.role),
                    admin: false, // No admin role in current system
                },
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user permissions',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
