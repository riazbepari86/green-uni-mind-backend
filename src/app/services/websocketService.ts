import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import config from '../config';
import { AuditLogService } from '../modules/AuditLog/auditLog.service';
import { 
  AuditLogAction, 
  AuditLogCategory, 
  AuditLogLevel 
} from '../modules/AuditLog/auditLog.interface';

interface AuthenticatedSocket {
  id: string;
  userId: string;
  userType: 'student' | 'teacher' | 'admin';
  email: string;
  join: (room: string) => void;
  leave: (room: string) => void;
  emit: (event: string, data: any) => void;
  disconnect: () => void;
}

interface SocketUser {
  userId: string;
  userType: 'student' | 'teacher' | 'admin';
  email: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.frontend_url,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));

    console.log('WebSocket service initialized');
  }

  private async authenticateSocket(socket: any, next: any): Promise<void> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwt_access_secret) as any;
      
      if (!decoded.userId || !decoded.userType) {
        return next(new Error('Invalid token payload'));
      }

      // Attach user info to socket
      socket.userId = decoded.userId;
      socket.userType = decoded.userType;
      socket.email = decoded.email;

      next();
    } catch (error: any) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  }

  private async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const { userId, userType, email } = socket;
    
    console.log(`User connected: ${userId} (${userType}) - Socket: ${socket.id}`);

    // Store user connection
    const userInfo: SocketUser = {
      userId,
      userType,
      email,
      socketId: socket.id,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    this.connectedUsers.set(socket.id, userInfo);

    // Track multiple sockets per user
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // Join user-specific room
    socket.join(`user:${userId}`);
    socket.join(`userType:${userType}`);

    // Log connection
    await AuditLogService.createAuditLog({
      action: AuditLogAction.USER_LOGIN,
      category: AuditLogCategory.USER,
      level: AuditLogLevel.INFO,
      message: 'WebSocket connection established',
      userId,
      userType,
      resourceType: 'websocket_connection',
      resourceId: socket.id,
      metadata: {
        socketId: socket.id,
        userAgent: socket.handshake.headers['user-agent'],
        ipAddress: socket.handshake.address,
        connectedAt: new Date(),
      },
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to real-time notifications',
      userId,
      userType,
      connectedAt: new Date(),
    });

    // Handle disconnection
    socket.on('disconnect', () => this.handleDisconnection(socket));

    // Handle activity updates
    socket.on('activity', () => this.updateUserActivity(socket.id));

    // Handle joining specific rooms (e.g., for course-specific notifications)
    socket.on('join-room', (roomName: string) => {
      if (this.isValidRoom(roomName, userType)) {
        socket.join(roomName);
        socket.emit('room-joined', { room: roomName });
      }
    });

    // Handle leaving rooms
    socket.on('leave-room', (roomName: string) => {
      socket.leave(roomName);
      socket.emit('room-left', { room: roomName });
    });
  }

  private async handleDisconnection(socket: AuthenticatedSocket): Promise<void> {
    const userInfo = this.connectedUsers.get(socket.id);
    
    if (userInfo) {
      console.log(`User disconnected: ${userInfo.userId} - Socket: ${socket.id}`);

      // Remove from tracking
      this.connectedUsers.delete(socket.id);
      
      const userSockets = this.userSockets.get(userInfo.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.userSockets.delete(userInfo.userId);
        }
      }

      // Log disconnection
      await AuditLogService.createAuditLog({
        action: AuditLogAction.USER_LOGOUT,
        category: AuditLogCategory.USER,
        level: AuditLogLevel.INFO,
        message: 'WebSocket connection closed',
        userId: userInfo.userId,
        userType: userInfo.userType,
        resourceType: 'websocket_connection',
        resourceId: socket.id,
        metadata: {
          socketId: socket.id,
          connectedDuration: Date.now() - userInfo.connectedAt.getTime(),
          disconnectedAt: new Date(),
        },
      });
    }
  }

  private updateUserActivity(socketId: string): void {
    const userInfo = this.connectedUsers.get(socketId);
    if (userInfo) {
      userInfo.lastActivity = new Date();
    }
  }

  private isValidRoom(roomName: string, userType: string): boolean {
    // Define room access rules
    const allowedRooms = {
      student: ['course:', 'student:', 'general'],
      teacher: ['course:', 'teacher:', 'general', 'earnings:', 'payout:'],
      admin: ['admin:', 'general', 'system:'],
    };

    const userAllowedRooms = allowedRooms[userType as keyof typeof allowedRooms] || [];
    
    return userAllowedRooms.some(prefix => 
      roomName === prefix.slice(0, -1) || roomName.startsWith(prefix)
    );
  }

  // Send notification to specific user
  sendToUser(userId: string, event: string, data: any): boolean {
    if (!this.io) return false;

    const userSockets = this.userSockets.get(userId);
    if (!userSockets || userSockets.size === 0) {
      return false; // User not connected
    }

    this.io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date(),
      delivered: true,
    });

    return true;
  }

  // Send notification to all users of a specific type
  sendToUserType(userType: 'student' | 'teacher' | 'admin', event: string, data: any): void {
    if (!this.io) return;

    this.io.to(`userType:${userType}`).emit(event, {
      ...data,
      timestamp: new Date(),
      broadcast: true,
    });
  }

  // Send notification to specific room
  sendToRoom(roomName: string, event: string, data: any): void {
    if (!this.io) return;

    this.io.to(roomName).emit(event, {
      ...data,
      timestamp: new Date(),
      room: roomName,
    });
  }

  // Broadcast to all connected users
  broadcast(event: string, data: any): void {
    if (!this.io) return;

    this.io.emit(event, {
      ...data,
      timestamp: new Date(),
      broadcast: true,
    });
  }

  // Get connected users statistics
  getConnectedUsersStats(): {
    totalConnected: number;
    byUserType: Record<string, number>;
    activeUsers: string[];
  } {
    const stats = {
      totalConnected: this.connectedUsers.size,
      byUserType: { student: 0, teacher: 0, admin: 0 },
      activeUsers: [] as string[],
    };

    for (const userInfo of this.connectedUsers.values()) {
      stats.byUserType[userInfo.userType]++;
      
      // Consider user active if last activity was within 5 minutes
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      if (userInfo.lastActivity.getTime() > fiveMinutesAgo) {
        stats.activeUsers.push(userInfo.userId);
      }
    }

    return stats;
  }

  // Check if user is connected
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  // Get user's connection info
  getUserConnectionInfo(userId: string): SocketUser[] {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds) return [];

    return Array.from(socketIds)
      .map(socketId => this.connectedUsers.get(socketId))
      .filter(Boolean) as SocketUser[];
  }

  // Send real-time notification (integrates with notification service)
  sendRealTimeNotification(notification: {
    userId: string;
    type: string;
    title: string;
    body: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    actionUrl?: string;
    actionText?: string;
    metadata?: any;
  }): boolean {
    return this.sendToUser(notification.userId, 'notification', {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      priority: notification.priority,
      actionUrl: notification.actionUrl,
      actionText: notification.actionText,
      metadata: notification.metadata,
      createdAt: new Date(),
    });
  }

  // Send real-time status update
  sendStatusUpdate(userId: string, resourceType: string, resourceId: string, status: any): boolean {
    return this.sendToUser(userId, 'status-update', {
      resourceType,
      resourceId,
      status,
      updatedAt: new Date(),
    });
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;
