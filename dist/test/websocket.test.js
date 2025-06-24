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
const http_1 = require("http");
const socket_io_client_1 = require("socket.io-client");
const app_1 = require("../app");
const database_1 = require("./setup/database");
const testHelpers_1 = require("./helpers/testHelpers");
const jwtHelpers_1 = require("../app/utils/jwtHelpers");
const WebSocketService_1 = __importDefault(require("../app/services/websocket/WebSocketService"));
describe('WebSocket Service', () => {
    let httpServer;
    let webSocketService;
    let teacherToken;
    let studentToken;
    let teacherId;
    let studentId;
    let courseId;
    let conversationId;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.connectDB)();
        // Create HTTP server
        httpServer = new http_1.Server(app_1.app);
        // Initialize WebSocket service
        webSocketService = new WebSocketService_1.default(httpServer);
        // Create test users
        const teacher = yield (0, testHelpers_1.createTestTeacher)();
        teacherId = teacher._id.toString();
        teacherToken = (0, jwtHelpers_1.generateToken)({
            userId: teacher.user.toString(),
            role: 'teacher',
            teacherId: teacher._id.toString(),
        });
        const student = yield (0, testHelpers_1.createTestStudent)();
        studentId = student._id.toString();
        studentToken = (0, jwtHelpers_1.generateToken)({
            userId: student.user.toString(),
            role: 'student',
            studentId: student._id.toString(),
        });
        // Create test course and enroll student
        const course = yield (0, testHelpers_1.createTestCourse)(teacher._id);
        courseId = course._id.toString();
        yield (0, testHelpers_1.enrollStudentInCourse)(student._id, course._id);
        // Start server
        yield new Promise((resolve) => {
            httpServer.listen(0, resolve);
        });
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        if (httpServer) {
            yield new Promise((resolve) => {
                httpServer.close(() => resolve());
            });
        }
        yield (0, database_1.disconnectDB)();
    }));
    describe('Connection Authentication', () => {
        it('should authenticate teacher connection', (done) => {
            var _a;
            const port = (_a = httpServer.address()) === null || _a === void 0 ? void 0 : _a.port;
            const teacherClient = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                auth: { token: teacherToken },
                transports: ['websocket'],
            });
            teacherClient.on('connect', () => {
                expect(teacherClient.connected).toBe(true);
                teacherClient.disconnect();
                done();
            });
            teacherClient.on('connect_error', (error) => {
                done(error);
            });
        });
        it('should authenticate student connection', (done) => {
            var _a;
            const port = (_a = httpServer.address()) === null || _a === void 0 ? void 0 : _a.port;
            const studentClient = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                auth: { token: studentToken },
                transports: ['websocket'],
            });
            studentClient.on('connect', () => {
                expect(studentClient.connected).toBe(true);
                studentClient.disconnect();
                done();
            });
            studentClient.on('connect_error', (error) => {
                done(error);
            });
        });
        it('should reject connection without token', (done) => {
            var _a;
            const port = (_a = httpServer.address()) === null || _a === void 0 ? void 0 : _a.port;
            const unauthenticatedClient = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                transports: ['websocket'],
            });
            unauthenticatedClient.on('connect', () => {
                done(new Error('Should not connect without token'));
            });
            unauthenticatedClient.on('connect_error', (error) => {
                expect(error.message).toContain('Authentication');
                done();
            });
        });
        it('should reject connection with invalid token', (done) => {
            var _a;
            const port = (_a = httpServer.address()) === null || _a === void 0 ? void 0 : _a.port;
            const invalidClient = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                auth: { token: 'invalid-token' },
                transports: ['websocket'],
            });
            invalidClient.on('connect', () => {
                done(new Error('Should not connect with invalid token'));
            });
            invalidClient.on('connect_error', (error) => {
                expect(error.message).toContain('Authentication');
                done();
            });
        });
    });
    describe('Room Management', () => {
        let teacherClient;
        let studentClient;
        beforeEach((done) => {
            var _a;
            const port = (_a = httpServer.address()) === null || _a === void 0 ? void 0 : _a.port;
            let connectionsCount = 0;
            const checkConnections = () => {
                connectionsCount++;
                if (connectionsCount === 2) {
                    done();
                }
            };
            teacherClient = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                auth: { token: teacherToken },
                transports: ['websocket'],
            });
            studentClient = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                auth: { token: studentToken },
                transports: ['websocket'],
            });
            teacherClient.on('connect', checkConnections);
            studentClient.on('connect', checkConnections);
        });
        afterEach(() => {
            if (teacherClient)
                teacherClient.disconnect();
            if (studentClient)
                studentClient.disconnect();
        });
        it('should join conversation room', (done) => {
            const testConversationId = 'test-conversation-123';
            teacherClient.emit('join_conversation', testConversationId);
            // Wait a bit for the room join to process
            setTimeout(() => {
                // Test that the client is in the room by sending a message to the room
                webSocketService.broadcastToConversation(testConversationId, 'test_event', { message: 'test' });
                done();
            }, 100);
        });
        it('should join course room', (done) => {
            studentClient.emit('join_course', courseId);
            setTimeout(() => {
                webSocketService.broadcastCourseUpdate(courseId, { update: 'test' });
                done();
            }, 100);
        });
        it('should leave conversation room', (done) => {
            const testConversationId = 'test-conversation-456';
            teacherClient.emit('join_conversation', testConversationId);
            setTimeout(() => {
                teacherClient.emit('leave_conversation', testConversationId);
                done();
            }, 100);
        });
    });
    describe('Real-time Messaging', () => {
        let teacherClient;
        let studentClient;
        beforeEach((done) => {
            var _a;
            const port = (_a = httpServer.address()) === null || _a === void 0 ? void 0 : _a.port;
            let connectionsCount = 0;
            const checkConnections = () => {
                connectionsCount++;
                if (connectionsCount === 2) {
                    done();
                }
            };
            teacherClient = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                auth: { token: teacherToken },
                transports: ['websocket'],
            });
            studentClient = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                auth: { token: studentToken },
                transports: ['websocket'],
            });
            teacherClient.on('connect', checkConnections);
            studentClient.on('connect', checkConnections);
        });
        afterEach(() => {
            if (teacherClient)
                teacherClient.disconnect();
            if (studentClient)
                studentClient.disconnect();
        });
        it('should broadcast new message to conversation participants', (done) => {
            const testConversationId = 'test-conversation-789';
            const messageData = {
                id: 'msg-123',
                content: 'Hello from test',
                senderId: studentId,
                senderType: 'student',
                createdAt: new Date(),
            };
            // Both clients join the conversation
            teacherClient.emit('join_conversation', testConversationId);
            studentClient.emit('join_conversation', testConversationId);
            // Teacher listens for new messages
            teacherClient.on('new_message', (data) => {
                expect(data.content).toBe('Hello from test');
                expect(data.senderId).toBe(studentId);
                done();
            });
            // Simulate message broadcast
            setTimeout(() => {
                webSocketService.broadcastNewMessage(testConversationId, messageData);
            }, 100);
        });
        it('should handle typing indicators', (done) => {
            const testConversationId = 'test-conversation-typing';
            teacherClient.emit('join_conversation', testConversationId);
            studentClient.emit('join_conversation', testConversationId);
            teacherClient.on('user_typing', (data) => {
                expect(data.userId).toBe(studentId);
                expect(data.isTyping).toBe(true);
                done();
            });
            setTimeout(() => {
                studentClient.emit('typing_start', testConversationId);
            }, 100);
        });
        it('should handle message read status', (done) => {
            const testConversationId = 'test-conversation-read';
            const messageId = 'msg-456';
            teacherClient.emit('join_conversation', testConversationId);
            studentClient.emit('join_conversation', testConversationId);
            teacherClient.on('message_read', (data) => {
                expect(data.messageId).toBe(messageId);
                expect(data.readBy).toBe(studentId);
                done();
            });
            setTimeout(() => {
                studentClient.emit('message_read', { messageId, conversationId: testConversationId });
            }, 100);
        });
    });
    describe('Activity Broadcasting', () => {
        let teacherClient;
        beforeEach((done) => {
            var _a;
            const port = (_a = httpServer.address()) === null || _a === void 0 ? void 0 : _a.port;
            teacherClient = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                auth: { token: teacherToken },
                transports: ['websocket'],
            });
            teacherClient.on('connect', () => done());
        });
        afterEach(() => {
            if (teacherClient)
                teacherClient.disconnect();
        });
        it('should broadcast activity updates to teacher', (done) => {
            const activityData = {
                id: 'activity-123',
                type: 'enrollment',
                title: 'New Student Enrollment',
                description: 'A new student enrolled in your course',
                createdAt: new Date(),
            };
            teacherClient.on('new_activity', (data) => {
                expect(data.type).toBe('enrollment');
                expect(data.title).toBe('New Student Enrollment');
                done();
            });
            setTimeout(() => {
                webSocketService.broadcastActivityUpdate(teacherId, activityData);
            }, 100);
        });
        it('should handle activity read confirmation', (done) => {
            const activityId = 'activity-456';
            teacherClient.on('activity_read_confirmed', (data) => {
                expect(data.activityId).toBe(activityId);
                expect(data.readAt).toBeDefined();
                done();
            });
            setTimeout(() => {
                teacherClient.emit('activity_read', activityId);
            }, 100);
        });
    });
    describe('User Status Management', () => {
        let teacherClient;
        let studentClient;
        beforeEach((done) => {
            var _a;
            const port = (_a = httpServer.address()) === null || _a === void 0 ? void 0 : _a.port;
            let connectionsCount = 0;
            const checkConnections = () => {
                connectionsCount++;
                if (connectionsCount === 2) {
                    done();
                }
            };
            teacherClient = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                auth: { token: teacherToken },
                transports: ['websocket'],
            });
            studentClient = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                auth: { token: studentToken },
                transports: ['websocket'],
            });
            teacherClient.on('connect', checkConnections);
            studentClient.on('connect', checkConnections);
        });
        afterEach(() => {
            if (teacherClient)
                teacherClient.disconnect();
            if (studentClient)
                studentClient.disconnect();
        });
        it('should broadcast user online status', (done) => {
            teacherClient.on('user_status_change', (data) => {
                if (data.userId === studentId && data.status === 'online') {
                    expect(data.userType).toBe('student');
                    done();
                }
            });
            // Student connection should trigger online status
            // This is already handled in beforeEach, so we just wait
            setTimeout(() => {
                // If we reach here without the event, the test will timeout and fail
            }, 500);
        });
        it('should track connected users', () => {
            const connectedUsers = webSocketService.getConnectedUsers();
            expect(connectedUsers.length).toBeGreaterThanOrEqual(2);
            const teacherConnected = connectedUsers.some(user => user.userId === teacherId);
            const studentConnected = connectedUsers.some(user => user.userId === studentId);
            expect(teacherConnected).toBe(true);
            expect(studentConnected).toBe(true);
        });
        it('should check if user is online', () => {
            expect(webSocketService.isUserOnline(teacherId)).toBe(true);
            expect(webSocketService.isUserOnline(studentId)).toBe(true);
            expect(webSocketService.isUserOnline('non-existent-user')).toBe(false);
        });
    });
    describe('Error Handling', () => {
        it('should handle connection errors gracefully', (done) => {
            var _a;
            const port = (_a = httpServer.address()) === null || _a === void 0 ? void 0 : _a.port;
            // Try to connect to wrong port
            const errorClient = (0, socket_io_client_1.io)(`http://localhost:${port + 1}`, {
                auth: { token: teacherToken },
                transports: ['websocket'],
                timeout: 1000,
            });
            errorClient.on('connect_error', (error) => {
                expect(error).toBeDefined();
                done();
            });
            errorClient.on('connect', () => {
                done(new Error('Should not connect to wrong port'));
            });
        });
        it('should handle malformed events', (done) => {
            var _a;
            const port = (_a = httpServer.address()) === null || _a === void 0 ? void 0 : _a.port;
            const client = (0, socket_io_client_1.io)(`http://localhost:${port}`, {
                auth: { token: teacherToken },
                transports: ['websocket'],
            });
            client.on('connect', () => {
                // Send malformed data
                client.emit('join_conversation', null);
                client.emit('typing_start', undefined);
                client.emit('message_read', 'invalid-data');
                // If no errors occur, test passes
                setTimeout(() => {
                    client.disconnect();
                    done();
                }, 100);
            });
        });
    });
});
