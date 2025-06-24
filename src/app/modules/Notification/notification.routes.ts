import express from 'express';
import { NotificationController } from './notification.controller';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';

const router = express.Router();

// User notification routes
router.get(
  '/',
  auth(USER_ROLE.student, USER_ROLE.teacher, USER_ROLE.admin),
  NotificationController.getUserNotifications
);

router.get(
  '/preferences',
  auth(USER_ROLE.student, USER_ROLE.teacher, USER_ROLE.admin),
  NotificationController.getUserPreferences
);

router.put(
  '/preferences',
  auth(USER_ROLE.student, USER_ROLE.teacher, USER_ROLE.admin),
  NotificationController.updateUserPreferences
);

router.patch(
  '/:notificationId/read',
  auth(USER_ROLE.student, USER_ROLE.teacher, USER_ROLE.admin),
  NotificationController.markAsRead
);

router.patch(
  '/mark-all-read',
  auth(USER_ROLE.student, USER_ROLE.teacher, USER_ROLE.admin),
  NotificationController.markAllAsRead
);

router.get(
  '/stats',
  auth(USER_ROLE.student, USER_ROLE.teacher, USER_ROLE.admin),
  NotificationController.getNotificationStats
);

router.get(
  '/connection-status',
  auth(USER_ROLE.student, USER_ROLE.teacher, USER_ROLE.admin),
  NotificationController.getConnectionStatus
);

// Development/testing routes
router.post(
  '/test',
  auth(USER_ROLE.admin),
  NotificationController.testNotification
);

// Admin routes
router.get(
  '/system/stats',
  auth(USER_ROLE.admin),
  NotificationController.getSystemStats
);

router.post(
  '/system/broadcast',
  auth(USER_ROLE.admin),
  NotificationController.sendBroadcast
);

router.post(
  '/system/process-pending',
  auth(USER_ROLE.admin),
  NotificationController.processPendingNotifications
);

export const NotificationRoutes = router;
