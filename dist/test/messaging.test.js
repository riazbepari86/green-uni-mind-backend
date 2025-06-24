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
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../app");
const database_1 = require("./setup/database");
const testHelpers_1 = require("./helpers/testHelpers");
const jwtHelpers_1 = require("../app/utils/jwtHelpers");
const student_model_1 = require("../app/modules/Student/student.model");
describe('Messaging API', () => {
    let teacherToken;
    let studentToken;
    let teacherId;
    let studentId;
    let courseId;
    let conversationId;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.connectDB)();
        // Create test teacher
        const teacher = yield (0, testHelpers_1.createTestTeacher)();
        teacherId = teacher._id.toString();
        teacherToken = (0, jwtHelpers_1.generateToken)({
            userId: teacher.user.toString(),
            role: 'teacher',
            teacherId: teacher._id.toString(),
        });
        // Create test student
        const student = yield (0, testHelpers_1.createTestStudent)();
        studentId = student._id.toString();
        studentToken = (0, jwtHelpers_1.generateToken)({
            userId: student.user.toString(),
            role: 'student',
            studentId: student._id.toString(),
        });
        // Create test course
        const course = yield (0, testHelpers_1.createTestCourse)(teacher._id);
        courseId = course._id.toString();
        // Enroll student in course
        yield student_model_1.Student.findByIdAndUpdate(studentId, {
            $push: {
                enrolledCourses: {
                    courseId: course._id,
                    enrolledAt: new Date(),
                    progress: 0,
                },
            },
        });
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.disconnectDB)();
    }));
    describe('POST /api/v1/messaging/conversations', () => {
        it('should create a new conversation', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/messaging/conversations')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                courseId,
                teacherId,
                studentId,
                title: 'Test Conversation',
                initialMessage: 'Hello, I have a question about the course.',
            })
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data.title).toBe('Test Conversation');
            conversationId = response.body.data.id;
        }));
        it('should prevent duplicate conversations', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/messaging/conversations')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                courseId,
                teacherId,
                studentId,
                title: 'Duplicate Conversation',
            })
                .expect(201); // Should return existing conversation
        }));
        it('should validate enrollment before creating conversation', () => __awaiter(void 0, void 0, void 0, function* () {
            const otherStudent = yield (0, testHelpers_1.createTestStudent)();
            const otherStudentToken = (0, jwtHelpers_1.generateToken)({
                userId: otherStudent.user.toString(),
                role: 'student',
                studentId: otherStudent._id.toString(),
            });
            yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/messaging/conversations')
                .set('Authorization', `Bearer ${otherStudentToken}`)
                .send({
                courseId,
                teacherId,
                studentId: otherStudent._id.toString(),
                title: 'Unauthorized Conversation',
            })
                .expect(403);
        }));
        it('should validate required fields', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/messaging/conversations')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                courseId,
                teacherId,
                // Missing studentId
            })
                .expect(400);
        }));
    });
    describe('GET /api/v1/messaging/conversations', () => {
        it('should get conversations for student', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/conversations')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('conversations');
            expect(response.body.data).toHaveProperty('total');
            expect(response.body.data.conversations).toBeInstanceOf(Array);
        }));
        it('should get conversations for teacher', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/conversations')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.conversations).toBeInstanceOf(Array);
        }));
        it('should support pagination', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/conversations?limit=5&offset=0')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);
            expect(response.body.data.conversations.length).toBeLessThanOrEqual(5);
        }));
        it('should support filtering by course', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/messaging/conversations?courseId=${courseId}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
        }));
    });
    describe('POST /api/v1/messaging/conversations/:conversationId/messages', () => {
        it('should send a text message', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                conversationId,
                content: 'This is a test message.',
                messageType: 'text',
            })
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data.content).toBe('This is a test message.');
        }));
        it('should send a message with file attachment', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .field('conversationId', conversationId)
                .field('content', 'Here is a document for you.')
                .field('messageType', 'file')
                .attach('attachments', Buffer.from('test file content'), 'test.txt')
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.attachments).toBeInstanceOf(Array);
        }));
        it('should validate message content length', () => __awaiter(void 0, void 0, void 0, function* () {
            const longContent = 'a'.repeat(5001);
            yield (0, supertest_1.default)(app_1.app)
                .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                conversationId,
                content: longContent,
            })
                .expect(400);
        }));
        it('should sanitize message content', () => __awaiter(void 0, void 0, void 0, function* () {
            const maliciousContent = '<script>alert("xss")</script>Hello';
            const response = yield (0, supertest_1.default)(app_1.app)
                .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                conversationId,
                content: maliciousContent,
            })
                .expect(201);
            expect(response.body.data.content).not.toContain('<script>');
            expect(response.body.data.content).toContain('Hello');
        }));
        it('should respect rate limiting', () => __awaiter(void 0, void 0, void 0, function* () {
            const promises = Array(25).fill(null).map((_, index) => (0, supertest_1.default)(app_1.app)
                .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                conversationId,
                content: `Rate limit test message ${index}`,
            }));
            const responses = yield Promise.all(promises);
            const rateLimitedResponses = responses.filter(res => res.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        }));
    });
    describe('GET /api/v1/messaging/conversations/:conversationId/messages', () => {
        it('should get messages in conversation', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/messaging/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('messages');
            expect(response.body.data).toHaveProperty('total');
            expect(response.body.data.messages).toBeInstanceOf(Array);
        }));
        it('should support message pagination', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/messaging/conversations/${conversationId}/messages?limit=10&offset=0`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);
            expect(response.body.data.messages.length).toBeLessThanOrEqual(10);
        }));
        it('should filter messages by type', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/messaging/conversations/${conversationId}/messages?messageType=text`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
        }));
        it('should prevent access to unauthorized conversations', () => __awaiter(void 0, void 0, void 0, function* () {
            const otherStudent = yield (0, testHelpers_1.createTestStudent)();
            const otherStudentToken = (0, jwtHelpers_1.generateToken)({
                userId: otherStudent.user.toString(),
                role: 'student',
                studentId: otherStudent._id.toString(),
            });
            yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/messaging/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${otherStudentToken}`)
                .expect(403);
        }));
    });
    describe('PATCH /api/v1/messaging/conversations/:conversationId/messages/read', () => {
        it('should mark messages as read', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .patch(`/api/v1/messaging/conversations/${conversationId}/messages/read`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
        }));
    });
    describe('GET /api/v1/messaging/messages/search', () => {
        it('should search messages', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/messages/search?searchTerm=test')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
        }));
        it('should require search term', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/messages/search')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(400);
        }));
        it('should validate search term length', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/messages/search?searchTerm=')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(400);
        }));
    });
    describe('GET /api/v1/messaging/eligible-courses', () => {
        it('should get messaging eligible courses for student', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/eligible-courses')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
        }));
        it('should not allow teachers to access this endpoint', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/eligible-courses')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(403);
        }));
    });
    describe('POST /api/v1/messaging/validate-permissions', () => {
        it('should validate conversation permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/messaging/validate-permissions')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                teacherId,
                studentId,
                courseId,
            })
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('canMessage');
        }));
        it('should return false for non-enrolled student', () => __awaiter(void 0, void 0, void 0, function* () {
            const otherStudent = yield (0, testHelpers_1.createTestStudent)();
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/v1/messaging/validate-permissions')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                teacherId,
                studentId: otherStudent._id.toString(),
                courseId,
            })
                .expect(200);
            expect(response.body.data.canMessage).toBe(false);
        }));
    });
    describe('File Upload Validation', () => {
        it('should reject files that are too large', () => __awaiter(void 0, void 0, void 0, function* () {
            const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
            yield (0, supertest_1.default)(app_1.app)
                .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${studentToken}`)
                .field('conversationId', conversationId)
                .field('content', 'Large file test')
                .attach('attachments', largeBuffer, 'large-file.txt')
                .expect(400);
        }));
        it('should reject unauthorized file types', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${studentToken}`)
                .field('conversationId', conversationId)
                .field('content', 'Executable file test')
                .attach('attachments', Buffer.from('fake exe'), 'malware.exe')
                .expect(400);
        }));
        it('should limit number of attachments', () => __awaiter(void 0, void 0, void 0, function* () {
            const formData = (0, supertest_1.default)(app_1.app)
                .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
                .set('Authorization', `Bearer ${studentToken}`)
                .field('conversationId', conversationId)
                .field('content', 'Multiple files test');
            // Attach 6 files (limit is 5)
            for (let i = 0; i < 6; i++) {
                formData.attach('attachments', Buffer.from(`file ${i}`), `file${i}.txt`);
            }
            yield formData.expect(400);
        }));
    });
    describe('Authentication and Authorization', () => {
        it('should require authentication', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/conversations')
                .expect(401);
        }));
        it('should allow both students and teachers', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/conversations')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);
            yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/conversations')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
        }));
    });
    describe('Error Handling', () => {
        it('should handle invalid conversation ID', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/messaging/conversations/invalid-id/messages')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(400);
        }));
        it('should handle non-existent conversation', () => __awaiter(void 0, void 0, void 0, function* () {
            const nonExistentId = '507f1f77bcf86cd799439011';
            yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/messaging/conversations/${nonExistentId}/messages`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(404);
        }));
    });
});
