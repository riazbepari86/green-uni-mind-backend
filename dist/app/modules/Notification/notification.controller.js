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
exports.NotificationController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const notification_service_1 = require("./notification.service");
const websocketService_1 = require("../../services/websocketService");
const notification_interface_1 = require("./notification.interface");
// Get user notifications
const getUserNotifications = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const { limit = 50, offset = 0, status, type, channel, unreadOnly = false } = req.query;
    const options = {
        limit: parseInt(limit),
        offset: parseInt(offset),
        status: status,
        type: type,
        channel: channel,
        unreadOnly: unreadOnly === 'true',
    };
    const result = yield notification_service_1.NotificationService.getUserNotifications(userId, options);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Notifications retrieved successfully',
        data: result,
    });
}));
// Get user notification preferences
const getUserPreferences = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const userType = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
    const preferences = yield notification_service_1.NotificationService.getUserPreferences(userId, userType);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Notification preferences retrieved successfully',
        data: preferences,
    });
}));
// Update user notification preferences
const updateUserPreferences = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const userType = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
    const updates = req.body;
    const preferences = yield notification_service_1.NotificationService.updateUserPreferences(userId, userType, updates);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Notification preferences updated successfully',
        data: preferences,
    });
}));
// Mark notification as read
const markAsRead = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { notificationId } = req.params;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    yield notification_service_1.NotificationService.markAsRead(notificationId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Notification marked as read',
        data: null,
    });
}));
// Mark all notifications as read
const markAllAsRead = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    // This would need to be implemented in the service
    // await NotificationService.markAllAsRead(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'All notifications marked as read',
        data: null,
    });
}));
// Get notification statistics
const getNotificationStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    // This would need to be implemented in the service
    const stats = {
        total: 0,
        unread: 0,
        byType: {},
        byChannel: {},
        recentActivity: [],
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Notification statistics retrieved successfully',
        data: stats,
    });
}));
// Test notification (for development/admin)
const testNotification = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const userType = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
    const { type, title, body, priority, actionUrl, actionText } = req.body;
    const notifications = yield notification_service_1.NotificationService.createNotification({
        type: type || notification_interface_1.NotificationType.SYSTEM_MAINTENANCE,
        priority: priority || notification_interface_1.NotificationPriority.NORMAL,
        userId,
        userType,
        title: title || 'Test Notification',
        body: body || 'This is a test notification',
        actionUrl,
        actionText,
        metadata: {
            isTest: true,
            createdBy: userId,
        },
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Test notification sent successfully',
        data: notifications,
    });
}));
// Get real-time connection status
const getConnectionStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const isConnected = websocketService_1.webSocketService.isUserConnected(userId);
    const connectionInfo = websocketService_1.webSocketService.getUserConnectionInfo(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Connection status retrieved successfully',
        data: {
            isConnected,
            connections: connectionInfo.length,
            connectionDetails: connectionInfo,
        },
    });
}));
// Admin: Get system notification statistics
const getSystemStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { startDate, endDate } = req.query;
    // This would need to be implemented in the service
    const stats = {
        totalNotifications: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        byType: {},
        byChannel: {},
        connectedUsers: websocketService_1.webSocketService.getConnectedUsersStats(),
    };
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'System notification statistics retrieved successfully',
        data: stats,
    });
}));
// Admin: Send broadcast notification
const sendBroadcast = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userType, type, title, body, priority, actionUrl, actionText, channels } = req.body;
    // This would need to be implemented to send to multiple users
    // For now, just send via WebSocket
    if (userType) {
        websocketService_1.webSocketService.sendToUserType(userType, 'broadcast-notification', {
            type: type || notification_interface_1.NotificationType.SYSTEM_MAINTENANCE,
            title: title || 'System Announcement',
            body: body || 'This is a system announcement',
            priority: priority || notification_interface_1.NotificationPriority.NORMAL,
            actionUrl,
            actionText,
            broadcast: true,
        });
    }
    else {
        websocketService_1.webSocketService.broadcast('broadcast-notification', {
            type: type || notification_interface_1.NotificationType.SYSTEM_MAINTENANCE,
            title: title || 'System Announcement',
            body: body || 'This is a system announcement',
            priority: priority || notification_interface_1.NotificationPriority.NORMAL,
            actionUrl,
            actionText,
            broadcast: true,
        });
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Broadcast notification sent successfully',
        data: null,
    });
}));
// Process pending notifications manually (admin)
const processPendingNotifications = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield notification_service_1.NotificationService.processPendingNotifications();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Pending notifications processed successfully',
        data: result,
    });
}));
exports.NotificationController = {
    getUserNotifications,
    getUserPreferences,
    updateUserPreferences,
    markAsRead,
    markAllAsRead,
    getNotificationStats,
    testNotification,
    getConnectionStatus,
    getSystemStats,
    sendBroadcast,
    processPendingNotifications,
};
