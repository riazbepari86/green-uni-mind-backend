"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const notification_controller_1 = require("./notification.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const router = express_1.default.Router();
// User notification routes
router.get('/', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.admin), notification_controller_1.NotificationController.getUserNotifications);
router.get('/preferences', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.admin), notification_controller_1.NotificationController.getUserPreferences);
router.put('/preferences', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.admin), notification_controller_1.NotificationController.updateUserPreferences);
router.patch('/:notificationId/read', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.admin), notification_controller_1.NotificationController.markAsRead);
router.patch('/mark-all-read', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.admin), notification_controller_1.NotificationController.markAllAsRead);
router.get('/stats', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.admin), notification_controller_1.NotificationController.getNotificationStats);
router.get('/connection-status', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.admin), notification_controller_1.NotificationController.getConnectionStatus);
// Development/testing routes
router.post('/test', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), notification_controller_1.NotificationController.testNotification);
// Admin routes
router.get('/system/stats', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), notification_controller_1.NotificationController.getSystemStats);
router.post('/system/broadcast', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), notification_controller_1.NotificationController.sendBroadcast);
router.post('/system/process-pending', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), notification_controller_1.NotificationController.processPendingNotifications);
exports.NotificationRoutes = router;
