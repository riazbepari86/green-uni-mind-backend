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
exports.StripeConnectController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const stripeConnect_service_1 = require("./stripeConnect.service");
const AppError_1 = __importDefault(require("../../errors/AppError"));
// Create Stripe Connect account with enhanced tracking
const createAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const { type, country, email, business_type } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    if (!userId) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User ID not found');
    }
    if (!type || !country) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required fields: type, country');
    }
    const result = yield stripeConnect_service_1.StripeConnectService.createStripeAccount(userId, {
        type,
        country,
        email, // Optional - will use teacher's email if not provided
        business_type,
        ipAddress,
        userAgent,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Stripe account created successfully',
        data: result,
    });
}));
// Create account link for onboarding with enhanced URLs
const createAccountLink = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const { type, refreshUrl, returnUrl } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    if (!userId) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User ID not found');
    }
    // Set default URLs with success/failure handling if not provided
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const defaultRefreshUrl = refreshUrl || `${baseUrl}/teacher/stripe-connect?success=false&reason=refresh`;
    const defaultReturnUrl = returnUrl || `${baseUrl}/teacher/stripe-connect?success=true`;
    if (!type) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required field: type');
    }
    const result = yield stripeConnect_service_1.StripeConnectService.createAccountLink(userId, {
        type,
        refreshUrl: defaultRefreshUrl,
        returnUrl: defaultReturnUrl,
        ipAddress,
        userAgent,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Account link created successfully',
        data: result,
    });
}));
// Get account status
const getAccountStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    if (!userId) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User ID not found');
    }
    const result = yield stripeConnect_service_1.StripeConnectService.getAccountStatus(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Account status retrieved successfully',
        data: result,
    });
}));
// Update account information
const updateAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const updateData = req.body;
    if (!userId) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User ID not found');
    }
    const result = yield stripeConnect_service_1.StripeConnectService.updateAccount(userId, updateData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Account updated successfully',
        data: result,
    });
}));
// Disconnect account
const disconnectAccount = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    if (!userId) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User ID not found');
    }
    const result = yield stripeConnect_service_1.StripeConnectService.disconnectAccount(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Account disconnected successfully',
        data: result,
    });
}));
// Retry failed connection
const retryConnection = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    if (!userId) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User ID not found');
    }
    const result = yield stripeConnect_service_1.StripeConnectService.retryConnection(userId, {
        ipAddress,
        userAgent,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.message,
        data: result,
    });
}));
// Get audit log for compliance
const getAuditLog = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const { limit, offset, action } = req.query;
    if (!userId) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User ID not found');
    }
    const result = yield stripeConnect_service_1.StripeConnectService.getAuditLog(userId, {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
        action: action,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Audit log retrieved successfully',
        data: result,
    });
}));
// Enhanced disconnect with options
const disconnectAccountEnhanced = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const { reason } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    if (!userId) {
        throw new AppError_1.default(http_status_1.default.UNAUTHORIZED, 'User ID not found');
    }
    const result = yield stripeConnect_service_1.StripeConnectService.disconnectAccount(userId, {
        reason,
        ipAddress,
        userAgent,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.message,
        data: result,
    });
}));
exports.StripeConnectController = {
    createAccount,
    createAccountLink,
    getAccountStatus,
    updateAccount,
    disconnectAccount,
    retryConnection,
    getAuditLog,
    disconnectAccountEnhanced,
};
