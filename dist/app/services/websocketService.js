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
exports.webSocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const auditLog_service_1 = require("../modules/AuditLog/auditLog.service");
const auditLog_interface_1 = require("../modules/AuditLog/auditLog.interface");
class WebSocketService {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map();
        this.userSockets = new Map(); // userId -> Set of socketIds
    }
    initialize(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: config_1.default.frontend_url,
                methods: ['GET', 'POST'],
                credentials: true,
            },
            transports: ['websocket', 'polling'],
        });
        this.io.use(this.authenticateSocket.bind(this));
        this.io.on('connection', this.handleConnection.bind(this));
        console.log('WebSocket service initialized');
    }
    authenticateSocket(socket, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const token = socket.handshake.auth.token || ((_a = socket.handshake.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', ''));
                if (!token) {
                    return next(new Error('Authentication token required'));
                }
                const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
                if (!decoded.userId || !decoded.userType) {
                    return next(new Error('Invalid token payload'));
                }
                // Attach user info to socket
                socket.userId = decoded.userId;
                socket.userType = decoded.userType;
                socket.email = decoded.email;
                next();
            }
            catch (error) {
                console.error('Socket authentication error:', error);
                next(new Error('Authentication failed'));
            }
        });
    }
    handleConnection(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userId, userType, email } = socket;
            console.log(`User connected: ${userId} (${userType}) - Socket: ${socket.id}`);
            // Store user connection
            const userInfo = {
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
            this.userSockets.get(userId).add(socket.id);
            // Join user-specific room
            socket.join(`user:${userId}`);
            socket.join(`userType:${userType}`);
            // Log connection
            yield auditLog_service_1.AuditLogService.createAuditLog({
                action: auditLog_interface_1.AuditLogAction.USER_LOGIN,
                category: auditLog_interface_1.AuditLogCategory.USER,
                level: auditLog_interface_1.AuditLogLevel.INFO,
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
            socket.on('join-room', (roomName) => {
                if (this.isValidRoom(roomName, userType)) {
                    socket.join(roomName);
                    socket.emit('room-joined', { room: roomName });
                }
            });
            // Handle leaving rooms
            socket.on('leave-room', (roomName) => {
                socket.leave(roomName);
                socket.emit('room-left', { room: roomName });
            });
        });
    }
    handleDisconnection(socket) {
        return __awaiter(this, void 0, void 0, function* () {
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
                yield auditLog_service_1.AuditLogService.createAuditLog({
                    action: auditLog_interface_1.AuditLogAction.USER_LOGOUT,
                    category: auditLog_interface_1.AuditLogCategory.USER,
                    level: auditLog_interface_1.AuditLogLevel.INFO,
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
        });
    }
    updateUserActivity(socketId) {
        const userInfo = this.connectedUsers.get(socketId);
        if (userInfo) {
            userInfo.lastActivity = new Date();
        }
    }
    isValidRoom(roomName, userType) {
        // Define room access rules
        const allowedRooms = {
            student: ['course:', 'student:', 'general'],
            teacher: ['course:', 'teacher:', 'general', 'earnings:', 'payout:'],
            admin: ['admin:', 'general', 'system:'],
        };
        const userAllowedRooms = allowedRooms[userType] || [];
        return userAllowedRooms.some(prefix => roomName === prefix.slice(0, -1) || roomName.startsWith(prefix));
    }
    // Send notification to specific user
    sendToUser(userId, event, data) {
        if (!this.io)
            return false;
        const userSockets = this.userSockets.get(userId);
        if (!userSockets || userSockets.size === 0) {
            return false; // User not connected
        }
        this.io.to(`user:${userId}`).emit(event, Object.assign(Object.assign({}, data), { timestamp: new Date(), delivered: true }));
        return true;
    }
    // Send notification to all users of a specific type
    sendToUserType(userType, event, data) {
        if (!this.io)
            return;
        this.io.to(`userType:${userType}`).emit(event, Object.assign(Object.assign({}, data), { timestamp: new Date(), broadcast: true }));
    }
    // Send notification to specific room
    sendToRoom(roomName, event, data) {
        if (!this.io)
            return;
        this.io.to(roomName).emit(event, Object.assign(Object.assign({}, data), { timestamp: new Date(), room: roomName }));
    }
    // Broadcast to all connected users
    broadcast(event, data) {
        if (!this.io)
            return;
        this.io.emit(event, Object.assign(Object.assign({}, data), { timestamp: new Date(), broadcast: true }));
    }
    // Get connected users statistics
    getConnectedUsersStats() {
        const stats = {
            totalConnected: this.connectedUsers.size,
            byUserType: { student: 0, teacher: 0, admin: 0 },
            activeUsers: [],
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
    isUserConnected(userId) {
        return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
    }
    // Get user's connection info
    getUserConnectionInfo(userId) {
        const socketIds = this.userSockets.get(userId);
        if (!socketIds)
            return [];
        return Array.from(socketIds)
            .map(socketId => this.connectedUsers.get(socketId))
            .filter(Boolean);
    }
    // Send real-time notification (integrates with notification service)
    sendRealTimeNotification(notification) {
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
    sendStatusUpdate(userId, resourceType, resourceId, status) {
        return this.sendToUser(userId, 'status-update', {
            resourceType,
            resourceId,
            status,
            updatedAt: new Date(),
        });
    }
}
// Export singleton instance
exports.webSocketService = new WebSocketService();
exports.default = exports.webSocketService;
