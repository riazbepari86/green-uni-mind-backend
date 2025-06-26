"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestUser = createTestUser;
exports.generateTestToken = generateTestToken;
exports.createTestTeacher = createTestTeacher;
exports.createTestAdmin = createTestAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function createTestUser(overrides = {}) {
    return Object.assign({ id: 'test-user-123', email: 'test@example.com', role: 'student', name: 'Test User' }, overrides);
}
function generateTestToken(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name
    };
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_ACCESS_SECRET || 'test-secret', {
        expiresIn: '1h'
    });
}
function createTestTeacher() {
    return createTestUser({
        id: 'test-teacher-456',
        email: 'teacher@example.com',
        role: 'teacher',
        name: 'Test Teacher'
    });
}
function createTestAdmin() {
    return createTestUser({
        id: 'test-admin-789',
        email: 'admin@example.com',
        role: 'admin',
        name: 'Test Admin'
    });
}
