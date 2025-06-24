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
describe('Analytics API', () => {
    let teacherToken;
    let teacherId;
    let courseId;
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
        // Create test course
        const course = yield (0, testHelpers_1.createTestCourse)(teacher._id);
        courseId = course._id.toString();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.disconnectDB)();
    }));
    describe('GET /api/v1/analytics/teachers/:teacherId/overview', () => {
        it('should get teacher analytics overview', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/overview`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('teacherId');
            expect(response.body.data).toHaveProperty('period');
            expect(response.body.data).toHaveProperty('courseAnalytics');
            expect(response.body.data).toHaveProperty('revenueAnalytics');
            expect(response.body.data).toHaveProperty('performanceMetrics');
            expect(response.body.data).toHaveProperty('studentEngagement');
        }));
        it('should return 403 for unauthorized teacher', () => __awaiter(void 0, void 0, void 0, function* () {
            const otherTeacher = yield (0, testHelpers_1.createTestTeacher)();
            const otherToken = (0, jwtHelpers_1.generateToken)({
                userId: otherTeacher.user.toString(),
                role: 'teacher',
                teacherId: otherTeacher._id.toString(),
            });
            yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/overview`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(403);
        }));
        it('should validate period parameter', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/overview?period=invalid`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400);
        }));
        it('should validate date range parameters', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/overview?startDate=2023-01-01`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400);
        }));
    });
    describe('GET /api/v1/analytics/teachers/:teacherId/dashboard', () => {
        it('should get dashboard summary', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/dashboard`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('overview');
            expect(response.body.data).toHaveProperty('recentActivities');
            expect(response.body.data).toHaveProperty('topPerformingCourses');
            expect(response.body.data).toHaveProperty('insights');
        }));
        it('should respect rate limiting', () => __awaiter(void 0, void 0, void 0, function* () {
            // Make multiple rapid requests to test rate limiting
            const promises = Array(35).fill(null).map(() => (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/dashboard`)
                .set('Authorization', `Bearer ${teacherToken}`));
            const responses = yield Promise.all(promises);
            const rateLimitedResponses = responses.filter(res => res.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        }));
    });
    describe('GET /api/v1/analytics/teachers/:teacherId/courses/:courseId', () => {
        it('should get course-specific analytics', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/courses/${courseId}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
        }));
        it('should validate ObjectId format', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/courses/invalid-id`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400);
        }));
    });
    describe('GET /api/v1/analytics/teachers/:teacherId/revenue', () => {
        it('should get revenue analytics', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/revenue`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalRevenue');
            expect(response.body.data).toHaveProperty('revenueByPeriod');
        }));
        it('should filter by course when courseId provided', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/revenue?courseId=${courseId}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
        }));
    });
    describe('GET /api/v1/analytics/teachers/:teacherId/performance', () => {
        it('should get performance metrics', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/performance`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('averageRating');
            expect(response.body.data).toHaveProperty('totalReviews');
            expect(response.body.data).toHaveProperty('courseCompletionRate');
        }));
    });
    describe('GET /api/v1/analytics/teachers/:teacherId/engagement', () => {
        it('should get student engagement data', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/engagement`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalActiveStudents');
            expect(response.body.data).toHaveProperty('averageEngagementScore');
            expect(response.body.data).toHaveProperty('retentionRate');
        }));
    });
    describe('GET /api/v1/analytics/teachers/:teacherId/activities', () => {
        it('should get activity feed', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/activities`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('activities');
            expect(response.body.data).toHaveProperty('pagination');
            expect(response.body.data.activities).toBeInstanceOf(Array);
        }));
        it('should support pagination', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/activities?limit=5&offset=0`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.data.pagination.limit).toBe(5);
            expect(response.body.data.pagination.offset).toBe(0);
        }));
        it('should validate pagination parameters', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/activities?limit=101`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400);
        }));
    });
    describe('PATCH /api/v1/analytics/teachers/:teacherId/activities/:activityId/read', () => {
        it('should mark activity as read', () => __awaiter(void 0, void 0, void 0, function* () {
            // First create an activity (this would normally be done by the system)
            // For testing, we'll use a mock activity ID
            const mockActivityId = '507f1f77bcf86cd799439011';
            const response = yield (0, supertest_1.default)(app_1.app)
                .patch(`/api/v1/analytics/teachers/${teacherId}/activities/${mockActivityId}/read`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
        }));
        it('should validate activity ID format', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .patch(`/api/v1/analytics/teachers/${teacherId}/activities/invalid-id/read`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400);
        }));
    });
    describe('GET /api/v1/analytics/teachers/:teacherId/export', () => {
        it('should export analytics data as JSON', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/export?format=json`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('teacherId');
        }));
        it('should return 501 for CSV export (not implemented)', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/export?format=csv`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(501);
        }));
    });
    describe('Authentication and Authorization', () => {
        it('should require authentication', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/overview`)
                .expect(401);
        }));
        it('should require teacher role', () => __awaiter(void 0, void 0, void 0, function* () {
            const student = yield (0, testHelpers_1.createTestUser)('student');
            const studentToken = (0, jwtHelpers_1.generateToken)({
                userId: student._id.toString(),
                role: 'student',
                studentId: student._id.toString(),
            });
            yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${teacherId}/overview`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(403);
        }));
    });
    describe('Error Handling', () => {
        it('should handle invalid teacher ID', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.app)
                .get('/api/v1/analytics/teachers/invalid-id/overview')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400);
        }));
        it('should handle non-existent teacher ID', () => __awaiter(void 0, void 0, void 0, function* () {
            const nonExistentId = '507f1f77bcf86cd799439011';
            yield (0, supertest_1.default)(app_1.app)
                .get(`/api/v1/analytics/teachers/${nonExistentId}/overview`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(403);
        }));
    });
});
