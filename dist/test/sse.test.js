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
const globals_1 = require("@jest/globals");
const supertest_1 = __importDefault(require("supertest"));
const SSEService_1 = __importDefault(require("../app/services/sse/SSEService"));
const testApp_1 = require("./helpers/testApp");
const testAuth_1 = require("./helpers/testAuth");
(0, globals_1.describe)('SSE Service', () => {
    let app;
    let sseService;
    let testUser;
    let testToken;
    (0, globals_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
        app = (0, testApp_1.createTestApp)();
        sseService = new SSEService_1.default();
        testUser = yield (0, testAuth_1.createTestUser)();
        testToken = (0, testAuth_1.generateTestToken)(testUser);
    }));
    (0, globals_1.afterEach)(() => __awaiter(void 0, void 0, void 0, function* () {
        sseService.shutdown();
    }));
    (0, globals_1.describe)('Connection Management', () => {
        (0, globals_1.it)('should create SSE connection with valid token', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .get('/api/sse/connect')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);
            // Check that response is SSE format
            (0, globals_1.expect)(response.headers['content-type']).toBe('text/event-stream');
            (0, globals_1.expect)(response.headers['cache-control']).toBe('no-cache');
            (0, globals_1.expect)(response.headers['connection']).toBe('keep-alive');
        }));
        (0, globals_1.it)('should reject SSE connection without token', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app)
                .get('/api/sse/connect')
                .expect(401);
        }));
        (0, globals_1.it)('should reject SSE connection with invalid token', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app)
                .get('/api/sse/connect')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);
        }));
        (0, globals_1.it)('should track connection statistics', () => {
            const stats = sseService.getConnectionStats();
            (0, globals_1.expect)(stats).toHaveProperty('totalConnections');
            (0, globals_1.expect)(stats).toHaveProperty('activeConnections');
            (0, globals_1.expect)(stats).toHaveProperty('connectionsByUserType');
            (0, globals_1.expect)(stats).toHaveProperty('averageConnectionTime');
        });
        (0, globals_1.it)('should handle multiple connections from same user', () => __awaiter(void 0, void 0, void 0, function* () {
            const clientId1 = sseService.createConnection({}, { writeHead: globals_1.jest.fn(), write: globals_1.jest.fn() }, testUser.id, 'student');
            const clientId2 = sseService.createConnection({}, { writeHead: globals_1.jest.fn(), write: globals_1.jest.fn() }, testUser.id, 'student');
            (0, globals_1.expect)(clientId1).not.toBe(clientId2);
            const connectedUsers = sseService.getConnectedUsers();
            const userConnections = connectedUsers.find(u => u.userId === testUser.id);
            (0, globals_1.expect)(userConnections === null || userConnections === void 0 ? void 0 : userConnections.connectionCount).toBe(2);
        }));
    });
    (0, globals_1.describe)('Message Broadcasting', () => {
        let clientId;
        let mockResponse;
        (0, globals_1.beforeEach)(() => {
            mockResponse = {
                writeHead: globals_1.jest.fn(),
                write: globals_1.jest.fn(),
                end: globals_1.jest.fn()
            };
            clientId = sseService.createConnection({}, mockResponse, testUser.id, 'student');
        });
        (0, globals_1.it)('should send message to specific client', () => {
            const message = {
                id: 'test-message-1',
                type: 'test',
                data: { content: 'Hello World' },
                timestamp: new Date(),
                priority: 'medium'
            };
            const success = sseService.sendToClient(clientId, message);
            (0, globals_1.expect)(success).toBe(true);
            (0, globals_1.expect)(mockResponse.write).toHaveBeenCalled();
        });
        (0, globals_1.it)('should send message to user (all connections)', () => {
            const message = {
                id: 'test-message-2',
                type: 'notification',
                data: { title: 'Test Notification' },
                timestamp: new Date(),
                priority: 'high'
            };
            const sentCount = sseService.sendToUser(testUser.id, message);
            (0, globals_1.expect)(sentCount).toBe(1);
            (0, globals_1.expect)(mockResponse.write).toHaveBeenCalled();
        });
        (0, globals_1.it)('should broadcast to all users of specific type', () => {
            const message = {
                id: 'test-message-3',
                type: 'system_alert',
                data: { message: 'System maintenance' },
                timestamp: new Date(),
                priority: 'urgent'
            };
            const sentCount = sseService.sendToUserType('student', message);
            (0, globals_1.expect)(sentCount).toBe(1);
        });
        (0, globals_1.it)('should handle message sending to disconnected client', () => {
            // Simulate disconnected client
            mockResponse.write = globals_1.jest.fn().mockImplementation(() => {
                throw new Error('Connection closed');
            });
            const message = {
                id: 'test-message-4',
                type: 'test',
                data: { content: 'Should fail' },
                timestamp: new Date(),
                priority: 'low'
            };
            const success = sseService.sendToClient(clientId, message);
            (0, globals_1.expect)(success).toBe(false);
        });
    });
    (0, globals_1.describe)('Room Management', () => {
        let clientId;
        (0, globals_1.beforeEach)(() => {
            const mockResponse = {
                writeHead: globals_1.jest.fn(),
                write: globals_1.jest.fn(),
                end: globals_1.jest.fn()
            };
            clientId = sseService.createConnection({}, mockResponse, testUser.id, 'student');
        });
        (0, globals_1.it)('should join client to room', () => {
            const success = sseService.joinRoom(clientId, 'course:123');
            (0, globals_1.expect)(success).toBe(true);
        });
        (0, globals_1.it)('should leave client from room', () => {
            sseService.joinRoom(clientId, 'course:123');
            const success = sseService.leaveRoom(clientId, 'course:123');
            (0, globals_1.expect)(success).toBe(true);
        });
        (0, globals_1.it)('should send message to room', () => {
            sseService.joinRoom(clientId, 'course:123');
            const message = {
                id: 'room-message-1',
                type: 'course_update',
                data: { courseId: '123', action: 'updated' },
                timestamp: new Date(),
                priority: 'medium'
            };
            const sentCount = sseService.sendToRoom('course:123', message);
            (0, globals_1.expect)(sentCount).toBe(1);
        });
        (0, globals_1.it)('should not send message to room if client not joined', () => {
            const message = {
                id: 'room-message-2',
                type: 'course_update',
                data: { courseId: '456', action: 'updated' },
                timestamp: new Date(),
                priority: 'medium'
            };
            const sentCount = sseService.sendToRoom('course:456', message);
            (0, globals_1.expect)(sentCount).toBe(0);
        });
    });
    (0, globals_1.describe)('Heartbeat and Cleanup', () => {
        (0, globals_1.it)('should perform heartbeat', (done) => {
            const mockResponse = {
                writeHead: globals_1.jest.fn(),
                write: globals_1.jest.fn(),
                end: globals_1.jest.fn()
            };
            const clientId = sseService.createConnection({}, mockResponse, testUser.id, 'student');
            // Wait for heartbeat
            setTimeout(() => {
                (0, globals_1.expect)(mockResponse.write).toHaveBeenCalledWith(globals_1.expect.stringContaining('event: heartbeat'));
                done();
            }, 100);
        });
        (0, globals_1.it)('should cleanup inactive connections', (done) => {
            const mockResponse = {
                writeHead: globals_1.jest.fn(),
                write: globals_1.jest.fn(),
                end: globals_1.jest.fn()
            };
            const clientId = sseService.createConnection({}, mockResponse, testUser.id, 'student');
            // Simulate old connection
            const client = sseService.clients.get(clientId);
            if (client) {
                client.lastHeartbeat = new Date(Date.now() - 120000); // 2 minutes ago
            }
            // Wait for cleanup
            setTimeout(() => {
                const stats = sseService.getConnectionStats();
                (0, globals_1.expect)(stats.activeConnections).toBe(0);
                done();
            }, 100);
        });
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.it)('should handle malformed message data', () => {
            const mockResponse = {
                writeHead: globals_1.jest.fn(),
                write: globals_1.jest.fn(),
                end: globals_1.jest.fn()
            };
            const clientId = sseService.createConnection({}, mockResponse, testUser.id, 'student');
            const malformedMessage = {
                id: 'malformed-1',
                type: 'test',
                data: { circular: {} },
                timestamp: new Date(),
                priority: 'low'
            };
            // Create circular reference
            malformedMessage.data.circular.self = malformedMessage.data.circular;
            // Should not throw error
            (0, globals_1.expect)(() => {
                sseService.sendToClient(clientId, malformedMessage);
            }).not.toThrow();
        });
        (0, globals_1.it)('should handle connection errors gracefully', () => {
            const mockResponse = {
                writeHead: globals_1.jest.fn(),
                write: globals_1.jest.fn().mockImplementation(() => {
                    throw new Error('Network error');
                }),
                end: globals_1.jest.fn()
            };
            const clientId = sseService.createConnection({}, mockResponse, testUser.id, 'student');
            const message = {
                id: 'error-test-1',
                type: 'test',
                data: { content: 'Test' },
                timestamp: new Date(),
                priority: 'low'
            };
            // Should handle error gracefully
            const success = sseService.sendToClient(clientId, message);
            (0, globals_1.expect)(success).toBe(false);
            // Connection should be removed
            const stats = sseService.getConnectionStats();
            (0, globals_1.expect)(stats.activeConnections).toBe(0);
        });
    });
    (0, globals_1.describe)('Performance', () => {
        (0, globals_1.it)('should handle multiple concurrent connections', () => {
            const connections = [];
            const numConnections = 100;
            for (let i = 0; i < numConnections; i++) {
                const mockResponse = {
                    writeHead: globals_1.jest.fn(),
                    write: globals_1.jest.fn(),
                    end: globals_1.jest.fn()
                };
                const clientId = sseService.createConnection({}, mockResponse, `user-${i}`, 'student');
                connections.push(clientId);
            }
            const stats = sseService.getConnectionStats();
            (0, globals_1.expect)(stats.activeConnections).toBe(numConnections);
            // Test broadcasting to all connections
            const message = {
                id: 'perf-test-1',
                type: 'broadcast',
                data: { message: 'Performance test' },
                timestamp: new Date(),
                priority: 'low'
            };
            const sentCount = sseService.broadcast(message);
            (0, globals_1.expect)(sentCount).toBe(numConnections);
        });
        (0, globals_1.it)('should handle rapid message sending', () => {
            const mockResponse = {
                writeHead: globals_1.jest.fn(),
                write: globals_1.jest.fn(),
                end: globals_1.jest.fn()
            };
            const clientId = sseService.createConnection({}, mockResponse, testUser.id, 'student');
            const numMessages = 1000;
            let successCount = 0;
            for (let i = 0; i < numMessages; i++) {
                const message = {
                    id: `rapid-${i}`,
                    type: 'rapid_test',
                    data: { index: i },
                    timestamp: new Date(),
                    priority: 'low'
                };
                if (sseService.sendToClient(clientId, message)) {
                    successCount++;
                }
            }
            (0, globals_1.expect)(successCount).toBe(numMessages);
            (0, globals_1.expect)(mockResponse.write).toHaveBeenCalledTimes(numMessages + 1); // +1 for welcome message
        });
    });
});
// Helper functions for test setup
function createMockRequest() {
    return {
        headers: {},
        ip: '127.0.0.1',
        on: globals_1.jest.fn()
    };
}
function createMockResponse() {
    return {
        writeHead: globals_1.jest.fn(),
        write: globals_1.jest.fn(),
        end: globals_1.jest.fn(),
        on: globals_1.jest.fn()
    };
}
