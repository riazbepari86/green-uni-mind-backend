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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthControllers = void 0;
var passport_1 = __importDefault(require("passport"));
var config_1 = __importDefault(require("../../config"));
var catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
var sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
var http_status_1 = __importDefault(require("http-status"));
var user_model_1 = require("../User/user.model");
var student_model_1 = require("../Student/student.model");
var teacher_model_1 = require("../Teacher/teacher.model");
var AppError_1 = __importDefault(require("../../errors/AppError"));
var auth_utils_1 = require("./auth.utils");
// Helper function to generate tokens
var generateTokens = function (user) {
    var jwtPayload = {
        email: user.email,
        role: user.role,
    };
    var accessToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
    var refreshToken = (0, auth_utils_1.createToken)(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
    return { accessToken: accessToken, refreshToken: refreshToken };
};
// Helper function to get role details
var getRoleDetails = function (user) { return __awaiter(void 0, void 0, void 0, function () {
    var roleDetails, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                roleDetails = null;
                _a = user.role;
                switch (_a) {
                    case 'student': return [3 /*break*/, 1];
                    case 'teacher': return [3 /*break*/, 3];
                }
                return [3 /*break*/, 5];
            case 1: return [4 /*yield*/, student_model_1.Student.findOne({
                    user: user._id,
                }).lean()];
            case 2:
                roleDetails = _b.sent();
                if (!roleDetails) {
                    throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student profile not found!');
                }
                return [3 /*break*/, 6];
            case 3: return [4 /*yield*/, teacher_model_1.Teacher.findOne({
                    user: user._id,
                }).lean()];
            case 4:
                roleDetails = _b.sent();
                if (!roleDetails) {
                    throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher profile not found!');
                }
                return [3 /*break*/, 6];
            case 5: throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Invalid role!');
            case 6: return [2 /*return*/, roleDetails];
        }
    });
}); };
// Google OAuth routes
var googleAuth = function (req, res, next) {
    var _a = req.query, _b = _a.role, role = _b === void 0 ? 'student' : _b, _c = _a.linking, linking = _c === void 0 ? 'false' : _c;
    // Store state information to be retrieved in the callback
    var state = JSON.stringify({ role: role, linking: linking });
    passport_1.default.authenticate('google', {
        scope: ['profile', 'email'],
        state: state,
    })(req, res, next);
};
var googleCallback = (0, catchAsync_1.default)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        passport_1.default.authenticate('google', { session: false }, function (err, user) { return __awaiter(void 0, void 0, void 0, function () {
            var stateParam, isLinking, role, stateObj, authToken, jwt_1, decoded, existingUser, tokenError_1, _a, accessToken, refreshToken, roleDetails, _email, safeRoleDetails, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (err) {
                            console.error('Google OAuth error:', err);
                            return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/login?error=oauth_error"))];
                        }
                        if (!user) {
                            return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/login?error=user_not_found"))];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 11, , 12]);
                        stateParam = req.query.state;
                        isLinking = false;
                        role = 'student';
                        try {
                            if (stateParam) {
                                stateObj = JSON.parse(stateParam);
                                isLinking = stateObj.linking === 'true';
                                role = stateObj.role || 'student';
                                console.log('Parsed state:', { isLinking: isLinking, role: role });
                            }
                        }
                        catch (error) {
                            console.error('Error parsing state:', error);
                        }
                        if (!isLinking) return [3 /*break*/, 9];
                        console.log('Google OAuth account linking flow detected');
                        console.log('User data:', {
                            googleId: user.googleId,
                            email: user.email
                        });
                        authToken = req.cookies.authToken ||
                            (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
                                ? req.headers.authorization.split(' ')[1]
                                : null);
                        console.log('Auth token available:', !!authToken);
                        if (!authToken) return [3 /*break*/, 8];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 7, , 8]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('jsonwebtoken')); })];
                    case 3:
                        jwt_1 = _b.sent();
                        decoded = jwt_1.verify(authToken, config_1.default.jwt_access_secret);
                        if (!(decoded && decoded.email)) return [3 /*break*/, 6];
                        return [4 /*yield*/, user_model_1.User.findOne({ email: decoded.email })];
                    case 4:
                        existingUser = _b.sent();
                        if (!existingUser) return [3 /*break*/, 6];
                        // Link the Google account to the existing user
                        existingUser.googleId = user.googleId;
                        // Update connected accounts
                        if (!existingUser.connectedAccounts) {
                            existingUser.connectedAccounts = {
                                google: false,
                                facebook: false,
                                apple: false,
                            };
                        }
                        existingUser.connectedAccounts.google = true;
                        return [4 /*yield*/, existingUser.save()];
                    case 5:
                        _b.sent();
                        console.log('Successfully linked Google account to user:', existingUser._id);
                        // Redirect to profile with success message
                        return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/user/edit-profile?provider=google&linked=true"))];
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        tokenError_1 = _b.sent();
                        console.error('Error verifying token for account linking:', tokenError_1);
                        return [3 /*break*/, 8];
                    case 8: 
                    // If direct linking failed or no auth token, redirect to the callback page with provider info
                    return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/oauth/callback?provider=google&providerId=").concat(user.googleId, "&email=").concat(user.email, "&isLinking=true"))];
                    case 9:
                        _a = generateTokens(user), accessToken = _a.accessToken, refreshToken = _a.refreshToken;
                        return [4 /*yield*/, getRoleDetails(user)];
                    case 10:
                        roleDetails = _b.sent();
                        _email = roleDetails.email, safeRoleDetails = __rest(roleDetails, ["email"]);
                        // Set refresh token in cookie
                        res.cookie('refreshToken', refreshToken, {
                            secure: config_1.default.NODE_ENV === 'production',
                            httpOnly: true,
                            sameSite: 'lax',
                            maxAge: 1000 * 60 * 60 * 24 * 365,
                        });
                        // For regular login, redirect with the token
                        return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/oauth/callback?token=").concat(accessToken, "&provider=google"))];
                    case 11:
                        error_1 = _b.sent();
                        console.error('Error in Google callback:', error_1);
                        return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/login?error=server_error"))];
                    case 12: return [2 /*return*/];
                }
            });
        }); })(req, res);
        return [2 /*return*/];
    });
}); });
// Facebook OAuth routes
var facebookAuth = function (req, res, next) {
    var _a = req.query, _b = _a.role, role = _b === void 0 ? 'student' : _b, _c = _a.linking, linking = _c === void 0 ? 'false' : _c;
    // Store state information to be retrieved in the callback
    var state = JSON.stringify({ role: role, linking: linking });
    passport_1.default.authenticate('facebook', {
        scope: ['email', 'public_profile'],
        state: state,
    })(req, res, next);
};
var facebookCallback = (0, catchAsync_1.default)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        passport_1.default.authenticate('facebook', { session: false }, function (err, user) { return __awaiter(void 0, void 0, void 0, function () {
            var stateParam, isLinking, userRole, stateObj, authToken, jwt_2, decoded, existingUser, tokenError_2, _a, accessToken, refreshToken, roleDetails, _email, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (err) {
                            console.error('Facebook OAuth error:', err);
                            return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/login?error=oauth_error"))];
                        }
                        if (!user) {
                            return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/login?error=user_not_found"))];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 11, , 12]);
                        stateParam = req.query.state;
                        isLinking = false;
                        userRole = 'student';
                        try {
                            if (stateParam) {
                                stateObj = JSON.parse(stateParam);
                                isLinking = stateObj.linking === 'true';
                                userRole = stateObj.role || 'student';
                                console.log('Parsed state:', { isLinking: isLinking, userRole: userRole });
                            }
                        }
                        catch (error) {
                            console.error('Error parsing state:', error);
                        }
                        if (!isLinking) return [3 /*break*/, 9];
                        console.log('Facebook OAuth account linking flow detected');
                        console.log('User data:', {
                            facebookId: user.facebookId,
                            email: user.email
                        });
                        authToken = req.cookies.authToken ||
                            (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
                                ? req.headers.authorization.split(' ')[1]
                                : null);
                        console.log('Auth token available:', !!authToken);
                        if (!authToken) return [3 /*break*/, 8];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 7, , 8]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('jsonwebtoken')); })];
                    case 3:
                        jwt_2 = _b.sent();
                        decoded = jwt_2.verify(authToken, config_1.default.jwt_access_secret);
                        if (!(decoded && decoded.email)) return [3 /*break*/, 6];
                        return [4 /*yield*/, user_model_1.User.findOne({ email: decoded.email })];
                    case 4:
                        existingUser = _b.sent();
                        if (!existingUser) return [3 /*break*/, 6];
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
                        return [4 /*yield*/, existingUser.save()];
                    case 5:
                        _b.sent();
                        console.log('Successfully linked Facebook account to user:', existingUser._id);
                        // Redirect to profile with success message
                        return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/user/edit-profile?provider=facebook&linked=true"))];
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        tokenError_2 = _b.sent();
                        console.error('Error verifying token for account linking:', tokenError_2);
                        return [3 /*break*/, 8];
                    case 8: 
                    // If direct linking failed or no auth token, redirect to the callback page with provider info
                    return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/oauth/callback?provider=facebook&providerId=").concat(user.facebookId, "&email=").concat(user.email, "&isLinking=true"))];
                    case 9:
                        _a = generateTokens(user), accessToken = _a.accessToken, refreshToken = _a.refreshToken;
                        return [4 /*yield*/, getRoleDetails(user)];
                    case 10:
                        roleDetails = _b.sent();
                        _email = roleDetails.email;
                        // Set refresh token in cookie
                        res.cookie('refreshToken', refreshToken, {
                            secure: config_1.default.NODE_ENV === 'production',
                            httpOnly: true,
                            sameSite: 'lax',
                            maxAge: 1000 * 60 * 60 * 24 * 365,
                        });
                        // For regular login, redirect with the token
                        return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/oauth/callback?token=").concat(accessToken, "&provider=facebook"))];
                    case 11:
                        error_2 = _b.sent();
                        console.error('Error in Facebook callback:', error_2);
                        return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/login?error=server_error"))];
                    case 12: return [2 /*return*/];
                }
            });
        }); })(req, res);
        return [2 /*return*/];
    });
}); });
// Apple OAuth routes
var appleAuth = function (req, res, next) {
    var _a = req.query, _b = _a.role, role = _b === void 0 ? 'student' : _b, _c = _a.linking, linking = _c === void 0 ? 'false' : _c;
    // Store state information to be retrieved in the callback
    var state = JSON.stringify({ role: role, linking: linking });
    passport_1.default.authenticate('apple', {
        scope: ['name', 'email'],
        state: state,
    })(req, res, next);
};
var appleCallback = (0, catchAsync_1.default)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        passport_1.default.authenticate('apple', { session: false }, function (err, user) { return __awaiter(void 0, void 0, void 0, function () {
            var stateParam, isLinking, userRole, stateObj, authToken, jwt_3, decoded, existingUser, tokenError_3, _a, accessToken, refreshToken, roleDetails, _email, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (err) {
                            console.error('Apple OAuth error:', err);
                            return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/login?error=oauth_error"))];
                        }
                        if (!user) {
                            return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/login?error=user_not_found"))];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 11, , 12]);
                        stateParam = req.query.state;
                        isLinking = false;
                        userRole = 'student';
                        try {
                            if (stateParam) {
                                stateObj = JSON.parse(stateParam);
                                isLinking = stateObj.linking === 'true';
                                userRole = stateObj.role || 'student';
                                console.log('Parsed state:', { isLinking: isLinking, userRole: userRole });
                            }
                        }
                        catch (error) {
                            console.error('Error parsing state:', error);
                        }
                        if (!isLinking) return [3 /*break*/, 9];
                        console.log('Apple OAuth account linking flow detected');
                        console.log('User data:', {
                            appleId: user.appleId,
                            email: user.email
                        });
                        authToken = req.cookies.authToken ||
                            (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
                                ? req.headers.authorization.split(' ')[1]
                                : null);
                        console.log('Auth token available:', !!authToken);
                        if (!authToken) return [3 /*break*/, 8];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 7, , 8]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('jsonwebtoken')); })];
                    case 3:
                        jwt_3 = _b.sent();
                        decoded = jwt_3.verify(authToken, config_1.default.jwt_access_secret);
                        if (!(decoded && decoded.email)) return [3 /*break*/, 6];
                        return [4 /*yield*/, user_model_1.User.findOne({ email: decoded.email })];
                    case 4:
                        existingUser = _b.sent();
                        if (!existingUser) return [3 /*break*/, 6];
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
                        return [4 /*yield*/, existingUser.save()];
                    case 5:
                        _b.sent();
                        console.log('Successfully linked Apple account to user:', existingUser._id);
                        // Redirect to profile with success message
                        return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/user/edit-profile?provider=apple&linked=true"))];
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        tokenError_3 = _b.sent();
                        console.error('Error verifying token for account linking:', tokenError_3);
                        return [3 /*break*/, 8];
                    case 8: 
                    // If direct linking failed or no auth token, redirect to the callback page with provider info
                    return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/oauth/callback?provider=apple&providerId=").concat(user.appleId, "&email=").concat(user.email, "&isLinking=true"))];
                    case 9:
                        _a = generateTokens(user), accessToken = _a.accessToken, refreshToken = _a.refreshToken;
                        return [4 /*yield*/, getRoleDetails(user)];
                    case 10:
                        roleDetails = _b.sent();
                        _email = roleDetails.email;
                        // Set refresh token in cookie
                        res.cookie('refreshToken', refreshToken, {
                            secure: config_1.default.NODE_ENV === 'production',
                            httpOnly: true,
                            sameSite: 'lax',
                            maxAge: 1000 * 60 * 60 * 24 * 365,
                        });
                        // For regular login, redirect with the token
                        return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/oauth/callback?token=").concat(accessToken, "&provider=apple"))];
                    case 11:
                        error_3 = _b.sent();
                        console.error('Error in Apple callback:', error_3);
                        return [2 /*return*/, res.redirect("".concat(config_1.default.frontend_url, "/login?error=server_error"))];
                    case 12: return [2 /*return*/];
                }
            });
        }); })(req, res);
        return [2 /*return*/];
    });
}); });
// Account linking
var linkOAuthAccount = (0, catchAsync_1.default)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, userId, provider, providerId, email, user, providerField, query, existingUser;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.body, userId = _a.userId, provider = _a.provider, providerId = _a.providerId, email = _a.email;
                if (!userId || !provider || !providerId) {
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required fields');
                }
                console.log('Linking OAuth account:', { userId: userId, provider: provider, providerId: providerId, email: email });
                return [4 /*yield*/, user_model_1.User.findById(userId)];
            case 1:
                user = _b.sent();
                if (!user) {
                    console.error('User not found with ID:', userId);
                    throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
                }
                providerField = "".concat(provider, "Id");
                query = {};
                query[providerField] = providerId;
                return [4 /*yield*/, user_model_1.User.findOne(query)];
            case 2:
                existingUser = _b.sent();
                if (existingUser && existingUser._id.toString() !== userId) {
                    console.error('Provider ID already linked to another user:', {
                        providerId: providerId,
                        existingUserId: existingUser._id.toString(),
                        requestedUserId: userId
                    });
                    throw new AppError_1.default(http_status_1.default.CONFLICT, "This ".concat(provider, " account is already linked to another user"));
                }
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
                    provider: provider,
                    connectedAccounts: user.connectedAccounts
                });
                return [4 /*yield*/, user.save()];
            case 3:
                _b.sent();
                (0, sendResponse_1.default)(res, {
                    statusCode: http_status_1.default.OK,
                    success: true,
                    message: "".concat(provider.charAt(0).toUpperCase() + provider.slice(1), " account linked successfully"),
                    data: null,
                });
                return [2 /*return*/];
        }
    });
}); });
// Account unlinking
var unlinkOAuthAccount = (0, catchAsync_1.default)(function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, userId, provider, user, connectedCount;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.body, userId = _a.userId, provider = _a.provider;
                if (!userId || !provider) {
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required fields');
                }
                console.log('Unlinking OAuth account:', { userId: userId, provider: provider });
                return [4 /*yield*/, user_model_1.User.findById(userId)];
            case 1:
                user = _b.sent();
                if (!user) {
                    console.error('User not found with ID:', userId);
                    throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
                }
                // Check if the user has a password before unlinking
                // If not, they need at least one authentication method
                if (!user.password) {
                    connectedCount = 0;
                    if (user.googleId)
                        connectedCount++;
                    if (user.facebookId)
                        connectedCount++;
                    if (user.appleId)
                        connectedCount++;
                    if (connectedCount <= 1) {
                        console.error('Cannot unlink the only authentication method:', {
                            userId: userId,
                            provider: provider,
                            hasPassword: !!user.password,
                            connectedCount: connectedCount
                        });
                        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Cannot unlink the only authentication method. Please set a password first.');
                    }
                }
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
                    provider: provider,
                    connectedAccounts: user.connectedAccounts
                });
                return [4 /*yield*/, user.save()];
            case 2:
                _b.sent();
                (0, sendResponse_1.default)(res, {
                    statusCode: http_status_1.default.OK,
                    success: true,
                    message: "".concat(provider.charAt(0).toUpperCase() + provider.slice(1), " account unlinked successfully"),
                    data: null,
                });
                return [2 /*return*/];
        }
    });
}); });
exports.OAuthControllers = {
    googleAuth: googleAuth,
    googleCallback: googleCallback,
    facebookAuth: facebookAuth,
    facebookCallback: facebookCallback,
    appleAuth: appleAuth,
    appleCallback: appleCallback,
    linkOAuthAccount: linkOAuthAccount,
    unlinkOAuthAccount: unlinkOAuthAccount,
};
