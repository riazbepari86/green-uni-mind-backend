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
const app_1 = __importDefault(require("../app"));
const database_1 = require("./setup/database");
const testHelpers_1 = require("./helpers/testHelpers");
const auth_utils_1 = require("../app/modules/Auth/auth.utils");
// Mock generateToken function for tests
const generateToken = (payload) => {
    return (0, auth_utils_1.createToken)(payload, 'test-secret', '1h');
};
describe('Enhanced Analytics API', () => {
    let teacherToken;
    let teacherId;
    let courseId;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.connectDB)();
        // Create test teacher
        const teacher = yield (0, testHelpers_1.createTestTeacher)();
        teacherId = teacher._id.toString();
        teacherToken = generateToken({
            userId: teacher.user.toString(),
            role: 'teacher',
            teacherId: teacher._id.toString(),
        });
        // Create test course
        const course = yield (0, testHelpers_1.createTestCourse)(teacher._id);
        courseId = course._id.toString();
        // Create test student
        yield (0, testHelpers_1.createTestStudent)();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.disconnectDB)();
    }));
    describe('GET /api/v1/analytics/teachers/:teacherId/enrollment-statistics', () => {
        it('should get comprehensive enrollment statistics', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalEnrollments');
            expect(response.body.data).toHaveProperty('newEnrollments');
            expect(response.body.data).toHaveProperty('enrollmentTrend');
            expect(response.body.data).toHaveProperty('topCourses');
            expect(response.body.data).toHaveProperty('growthRate');
            expect(response.body.data.enrollmentTrend).toBeInstanceOf(Array);
            expect(response.body.data.topCourses).toBeInstanceOf(Array);
        }));
        it('should support period filtering', () => __awaiter(void 0, void 0, void 0, function* () {
            const periods = ['daily', 'weekly', 'monthly', 'yearly'];
            for (const period of periods) {
                const response = yield (0, supertest_1.default)(app_1.default)
                    .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics?period=${period}`)
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .expect(200);
                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('totalEnrollments');
            }
        }));
        it('should support course filtering', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics?courseId=${courseId}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
        }));
        it('should return 403 for unauthorized teacher', () => __awaiter(void 0, void 0, void 0, function* () {
            const otherTeacher = yield (0, testHelpers_1.createTestTeacher)();
            const otherToken = generateToken({
                userId: otherTeacher.user.toString(),
                role: 'teacher',
                teacherId: otherTeacher._id.toString(),
            });
            yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(403);
        }));
    });
    describe('GET /api/v1/analytics/teachers/:teacherId/engagement-metrics', () => {
        it('should get student engagement metrics', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/engagement-metrics`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalActiveStudents');
            expect(response.body.data).toHaveProperty('averageEngagementScore');
            expect(response.body.data).toHaveProperty('completionRates');
            expect(response.body.data).toHaveProperty('timeSpentTrends');
            expect(response.body.data).toHaveProperty('activityPatterns');
            expect(response.body.data).toHaveProperty('retentionRate');
            expect(response.body.data.completionRates).toBeInstanceOf(Array);
            expect(response.body.data.timeSpentTrends).toBeInstanceOf(Array);
            expect(response.body.data.activityPatterns).toBeInstanceOf(Array);
        }));
        it('should validate activity patterns structure', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/engagement-metrics`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            const activityPatterns = response.body.data.activityPatterns;
            expect(activityPatterns).toHaveLength(24); // 24 hours
            activityPatterns.forEach((pattern) => {
                expect(pattern).toHaveProperty('hour');
                expect(pattern).toHaveProperty('activity');
                expect(pattern.hour).toBeGreaterThanOrEqual(0);
                expect(pattern.hour).toBeLessThan(24);
                expect(pattern.activity).toBeGreaterThanOrEqual(0);
            });
        }));
    });
    describe('GET /api/v1/analytics/teachers/:teacherId/revenue-detailed', () => {
        it('should get detailed revenue analytics', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/revenue-detailed`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalRevenue');
            expect(response.body.data).toHaveProperty('revenueGrowth');
            expect(response.body.data).toHaveProperty('averageOrderValue');
            expect(response.body.data).toHaveProperty('paymentTrends');
            expect(response.body.data).toHaveProperty('topEarningCourses');
            expect(response.body.data).toHaveProperty('revenueByPeriod');
            expect(response.body.data).toHaveProperty('conversionRate');
            expect(response.body.data).toHaveProperty('refundRate');
            expect(response.body.data.paymentTrends).toBeInstanceOf(Array);
            expect(response.body.data.topEarningCourses).toBeInstanceOf(Array);
        }));
        it('should validate revenue by period structure', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/revenue-detailed`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            const revenueByPeriod = response.body.data.revenueByPeriod;
            expect(revenueByPeriod).toHaveProperty('daily');
            expect(revenueByPeriod).toHaveProperty('weekly');
            expect(revenueByPeriod).toHaveProperty('monthly');
            expect(revenueByPeriod).toHaveProperty('yearly');
            expect(typeof revenueByPeriod.daily).toBe('number');
            expect(typeof revenueByPeriod.weekly).toBe('number');
            expect(typeof revenueByPeriod.monthly).toBe('number');
            expect(typeof revenueByPeriod.yearly).toBe('number');
        }));
    });
    describe('GET /api/v1/analytics/teachers/:teacherId/performance-detailed', () => {
        it('should get detailed performance metrics', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/performance-detailed`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('averageRating');
            expect(response.body.data).toHaveProperty('totalReviews');
            expect(response.body.data).toHaveProperty('ratingDistribution');
            expect(response.body.data).toHaveProperty('ratingTrends');
            expect(response.body.data).toHaveProperty('studentSatisfactionScore');
            expect(response.body.data).toHaveProperty('courseCompletionRate');
            expect(response.body.data).toHaveProperty('studentRetentionRate');
            expect(response.body.data).toHaveProperty('qualityMetrics');
            expect(response.body.data).toHaveProperty('competitiveMetrics');
            expect(response.body.data).toHaveProperty('improvementSuggestions');
        }));
        it('should validate quality metrics structure', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/performance-detailed`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            const qualityMetrics = response.body.data.qualityMetrics;
            expect(qualityMetrics).toHaveProperty('contentQuality');
            expect(qualityMetrics).toHaveProperty('instructorRating');
            expect(qualityMetrics).toHaveProperty('courseStructure');
            expect(qualityMetrics).toHaveProperty('valueForMoney');
            Object.values(qualityMetrics).forEach((value) => {
                expect(typeof value).toBe('number');
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(100);
            });
        }));
        it('should validate improvement suggestions', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/performance-detailed`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            const suggestions = response.body.data.improvementSuggestions;
            expect(suggestions).toBeInstanceOf(Array);
            suggestions.forEach((suggestion) => {
                expect(typeof suggestion).toBe('string');
                expect(suggestion.length).toBeGreaterThan(0);
            });
        }));
    });
    describe('PATCH /api/v1/analytics/teachers/:teacherId/activities/bulk-read', () => {
        it('should bulk mark activities as read', () => __awaiter(void 0, void 0, void 0, function* () {
            const activityIds = [
                '507f1f77bcf86cd799439011',
                '507f1f77bcf86cd799439012',
                '507f1f77bcf86cd799439013'
            ];
            const response = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/analytics/teachers/${teacherId}/activities/bulk-read`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({ activityIds })
                .expect(200);
            expect(response.body.success).toBe(true);
        }));
        it('should validate activity IDs array', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/analytics/teachers/${teacherId}/activities/bulk-read`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({ activityIds: [] })
                .expect(400);
        }));
        it('should validate activity ID format', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/analytics/teachers/${teacherId}/activities/bulk-read`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({ activityIds: ['invalid-id'] })
                .expect(400);
        }));
    });
    describe('Caching and Performance', () => {
        it('should cache enrollment statistics', () => __awaiter(void 0, void 0, void 0, function* () {
            const start = Date.now();
            // First request
            yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            const firstRequestTime = Date.now() - start;
            // Second request (should be cached)
            const secondStart = Date.now();
            yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            const secondRequestTime = Date.now() - secondStart;
            // Cached request should be significantly faster
            expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5);
        }));
    });
    describe('Error Handling', () => {
        it('should handle invalid period parameter', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/enrollment-statistics?period=invalid`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400);
        }));
        it('should handle invalid course ID', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/analytics/teachers/${teacherId}/engagement-metrics?courseId=invalid`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400);
        }));
    });
});
