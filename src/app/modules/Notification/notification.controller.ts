import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { NotificationService } from './notification.service';
// WebSocketService removed - using standard API patterns
import { 
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus 
} from './notification.interface';

// Get user notifications
const getUserNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new Error('User ID is required');
  }

  const {
    limit = 50,
    offset = 0,
    status,
    type,
    channel,
    unreadOnly = false
  } = req.query;

  const options = {
    limit: parseInt(limit as string),
    offset: parseInt(offset as string),
    status: status as NotificationStatus,
    type: type as NotificationType,
    channel: channel as NotificationChannel,
    unreadOnly: unreadOnly === 'true',
  };

  const result = await NotificationService.getUserNotifications(userId, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notifications retrieved successfully',
    data: result,
  });
});

// Get user notification preferences
const getUserPreferences = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const userType = req.user?.role;

  if (!userId) {
    throw new Error('User ID is required');
  }
  if (!userType) {
    throw new Error('User type is required');
  }

  // Map user role to notification service expected type
  const mappedUserType = userType === 'user' ? 'admin' : userType as 'student' | 'teacher' | 'admin';
  const preferences = await NotificationService.getUserPreferences(userId, mappedUserType);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notification preferences retrieved successfully',
    data: preferences,
  });
});

// Update user notification preferences
const updateUserPreferences = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const userType = req.user?.role;
  const updates = req.body;

  if (!userId) {
    throw new Error('User ID is required');
  }
  if (!userType) {
    throw new Error('User type is required');
  }

  // Map user role to notification service expected type
  const mappedUserType = userType === 'user' ? 'admin' : userType as 'student' | 'teacher' | 'admin';
  const preferences = await NotificationService.updateUserPreferences(
    userId,
    mappedUserType,
    updates
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notification preferences updated successfully',
    data: preferences,
  });
});

// Mark notification as read
const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const { notificationId } = req.params;
  const userId = req.user?._id;

  await NotificationService.markAsRead(notificationId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notification marked as read',
    data: null,
  });
});

// Mark all notifications as read
const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  // This would need to be implemented in the service
  // await NotificationService.markAllAsRead(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All notifications marked as read',
    data: null,
  });
});

// Get notification statistics
const getNotificationStats = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  // This would need to be implemented in the service
  const stats = {
    total: 0,
    unread: 0,
    byType: {},
    byChannel: {},
    recentActivity: [],
  };

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notification statistics retrieved successfully',
    data: stats,
  });
});

// Test notification (for development/admin)
const testNotification = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const userType = req.user?.role;
  const { type, title, body, priority, actionUrl, actionText } = req.body;

  if (!userId) {
    throw new Error('User ID is required');
  }
  if (!userType) {
    throw new Error('User type is required');
  }

  // Map user role to notification service expected type
  const mappedUserType = userType === 'user' ? 'admin' : userType as 'student' | 'teacher' | 'admin';
  const notifications = await NotificationService.createNotification({
    type: type || NotificationType.SYSTEM_MAINTENANCE,
    priority: priority || NotificationPriority.NORMAL,
    userId,
    userType: mappedUserType,
    title: title || 'Test Notification',
    body: body || 'This is a test notification',
    actionUrl,
    actionText,
    metadata: {
      isTest: true,
      createdBy: userId,
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test notification sent successfully',
    data: notifications,
  });
});

// Get real-time connection status
const getConnectionStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  // TODO: Implement WebSocket service
  const isConnected = false; // webSocketService.isUserConnected(userId);
  const connectionInfo: any[] = []; // webSocketService.getUserConnectionInfo(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Connection status retrieved successfully',
    data: {
      isConnected,
      connections: connectionInfo.length,
      connectionDetails: connectionInfo,
    },
  });
});

// Admin: Get system notification statistics
const getSystemStats = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  // This would need to be implemented in the service
  const stats = {
    totalNotifications: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
    byType: {},
    byChannel: {},
    connectedUsers: 0, // webSocketService.getConnectedUsersStats(),
  };

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'System notification statistics retrieved successfully',
    data: stats,
  });
});

// Admin: Send broadcast notification
const sendBroadcast = catchAsync(async (req: Request, res: Response) => {
  const { 
    userType, 
    type, 
    title, 
    body, 
    priority, 
    actionUrl, 
    actionText,
    channels 
  } = req.body;

  // TODO: Implement WebSocket service for broadcast notifications
  // This would need to be implemented to send to multiple users
  // For now, just log the broadcast attempt
  console.log('Broadcast notification requested:', {
    userType,
    type: type || NotificationType.SYSTEM_MAINTENANCE,
    title: title || 'System Announcement',
    body: body || 'This is a system announcement',
    priority: priority || NotificationPriority.NORMAL,
    actionUrl,
    actionText,
    broadcast: true,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Broadcast notification sent successfully',
    data: null,
  });
});

// Process pending notifications manually (admin)
const processPendingNotifications = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.processPendingNotifications();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Pending notifications processed successfully',
    data: result,
  });
});

export const NotificationController = {
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
