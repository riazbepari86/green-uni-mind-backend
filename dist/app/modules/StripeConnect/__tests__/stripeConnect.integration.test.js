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
const app_1 = require("../../../app");
const teacher_model_1 = require("../../Teacher/teacher.model");
const database_1 = require("../../../config/database");
const stripe_1 = __importDefault(require("stripe"));
// Mock Stripe
globals_1.jest.mock('stripe');
const MockedStripe = stripe_1.default;
(0, globals_1.describe)('Stripe Connect Integration Tests', () => {
    let mockStripe;
    let authToken;
    let teacherId;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.connectDB)();
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, database_1.disconnectDB)();
    }));
    (0, globals_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
        globals_1.jest.clearAllMocks();
        // Mock Stripe instance
        mockStripe = {
            accounts: {
                create: globals_1.jest.fn(),
                retrieve: globals_1.jest.fn(),
                update: globals_1.jest.fn(),
            },
            accountLinks: {
                create: globals_1.jest.fn(),
            },
            oauth: {
                token: globals_1.jest.fn(),
            },
        };
        MockedStripe.mockImplementation(() => mockStripe);
        // Create a test teacher and get auth token
        const teacherData = {
            name: { firstName: 'John', lastName: 'Doe' },
            email: 'teacher@test.com',
            password: 'password123',
            role: 'teacher',
        };
        const signupResponse = yield (0, supertest_1.default)(app_1.app)
            .post('/api/auth/signup')
            .send(teacherData);
        authToken = signupResponse.body.data.accessToken;
        teacherId = signupResponse.body.data.user._id;
    }));
    (0, globals_1.afterEach)(() => __awaiter(void 0, void 0, void 0, function* () {
        // Clean up test data
        yield teacher_model_1.Teacher.deleteMany({});
    }));
    (0, globals_1.describe)('POST /api/stripe-connect/create-account', () => {
        (0, globals_1.it)('should create Stripe Connect account successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockAccount = {
                id: 'acct_test123',
                type: 'express',
                country: 'US',
                email: 'teacher@test.com',
                capabilities: {
                    transfers: 'inactive',
                    card_payments: 'inactive',
                },
                requirements: {
                    currently_due: ['individual.first_name', 'individual.last_name'],
                    eventually_due: ['individual.ssn_last_4'],
                    past_due: [],
                    pending_verification: [],
                },
                charges_enabled: false,
                payouts_enabled: false,
            };
            mockStripe.accounts.create.mockResolvedValue(mockAccount);
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/stripe-connect/create-account')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                type: 'express',
                country: 'US',
                email: 'teacher@test.com',
            });
            (0, globals_1.expect)(response.status).toBe(201);
            (0, globals_1.expect)(response.body.success).toBe(true);
            (0, globals_1.expect)(response.body.data.accountId).toBe('acct_test123');
            (0, globals_1.expect)(response.body.data.isConnected).toBe(true);
            (0, globals_1.expect)(response.body.data.isVerified).toBe(false);
            // Verify teacher was updated in database
            const updatedTeacher = yield teacher_model_1.Teacher.findById(teacherId);
            (0, globals_1.expect)(updatedTeacher === null || updatedTeacher === void 0 ? void 0 : updatedTeacher.stripeAccountId).toBe('acct_test123');
        }));
        (0, globals_1.it)('should return error for invalid account type', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/stripe-connect/create-account')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                type: 'invalid',
                country: 'US',
                email: 'teacher@test.com',
            });
            (0, globals_1.expect)(response.status).toBe(400);
            (0, globals_1.expect)(response.body.success).toBe(false);
        }));
        (0, globals_1.it)('should handle Stripe account creation error', () => __awaiter(void 0, void 0, void 0, function* () {
            mockStripe.accounts.create.mockRejectedValue(new Error('Stripe error'));
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/stripe-connect/create-account')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                type: 'express',
                country: 'US',
                email: 'teacher@test.com',
            });
            (0, globals_1.expect)(response.status).toBe(500);
            (0, globals_1.expect)(response.body.success).toBe(false);
            (0, globals_1.expect)(response.body.message).toContain('Failed to create Stripe account');
        }));
    });
    (0, globals_1.describe)('POST /api/stripe-connect/create-account-link', () => {
        (0, globals_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
            // Set up teacher with Stripe account
            yield teacher_model_1.Teacher.findByIdAndUpdate(teacherId, {
                stripeAccountId: 'acct_test123',
            });
        }));
        (0, globals_1.it)('should create account link successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockAccountLink = {
                object: 'account_link',
                url: 'https://connect.stripe.com/setup/s/acct_test123',
                created: 1640995200,
                expires_at: 1640998800,
            };
            mockStripe.accountLinks.create.mockResolvedValue(mockAccountLink);
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/stripe-connect/create-account-link')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                type: 'account_onboarding',
                refreshUrl: 'http://localhost:3000/teacher/stripe-connect?refresh=true',
                returnUrl: 'http://localhost:3000/teacher/stripe-connect?success=true',
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(response.body.success).toBe(true);
            (0, globals_1.expect)(response.body.data.url).toBe('https://connect.stripe.com/setup/s/acct_test123');
            (0, globals_1.expect)(mockStripe.accountLinks.create).toHaveBeenCalledWith({
                account: 'acct_test123',
                type: 'account_onboarding',
                refresh_url: 'http://localhost:3000/teacher/stripe-connect?refresh=true',
                return_url: 'http://localhost:3000/teacher/stripe-connect?success=true',
            });
        }));
        (0, globals_1.it)('should return error if teacher has no Stripe account', () => __awaiter(void 0, void 0, void 0, function* () {
            yield teacher_model_1.Teacher.findByIdAndUpdate(teacherId, {
                $unset: { stripeAccountId: 1 },
            });
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/stripe-connect/create-account-link')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                type: 'account_onboarding',
                refreshUrl: 'http://localhost:3000/teacher/stripe-connect?refresh=true',
                returnUrl: 'http://localhost:3000/teacher/stripe-connect?success=true',
            });
            (0, globals_1.expect)(response.status).toBe(400);
            (0, globals_1.expect)(response.body.success).toBe(false);
            (0, globals_1.expect)(response.body.message).toContain('No Stripe account found');
        }));
    });
    (0, globals_1.describe)('GET /api/stripe-connect/account-status', () => {
        (0, globals_1.it)('should return account status for connected account', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockAccount = {
                id: 'acct_test123',
                type: 'express',
                country: 'US',
                email: 'teacher@test.com',
                capabilities: {
                    transfers: 'active',
                    card_payments: 'active',
                },
                requirements: {
                    currently_due: [],
                    eventually_due: [],
                    past_due: [],
                    pending_verification: [],
                },
                charges_enabled: true,
                payouts_enabled: true,
                details_submitted: true,
            };
            yield teacher_model_1.Teacher.findByIdAndUpdate(teacherId, {
                stripeAccountId: 'acct_test123',
            });
            mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);
            const response = yield (0, supertest_1.default)(app_1.app)
                .get('/api/stripe-connect/account-status')
                .set('Authorization', `Bearer ${authToken}`);
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(response.body.success).toBe(true);
            (0, globals_1.expect)(response.body.data.isConnected).toBe(true);
            (0, globals_1.expect)(response.body.data.isVerified).toBe(true);
            (0, globals_1.expect)(response.body.data.canReceivePayments).toBe(true);
            (0, globals_1.expect)(response.body.data.accountId).toBe('acct_test123');
        }));
        (0, globals_1.it)('should return not connected status for teacher without Stripe account', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .get('/api/stripe-connect/account-status')
                .set('Authorization', `Bearer ${authToken}`);
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(response.body.success).toBe(true);
            (0, globals_1.expect)(response.body.data.isConnected).toBe(false);
            (0, globals_1.expect)(response.body.data.isVerified).toBe(false);
            (0, globals_1.expect)(response.body.data.canReceivePayments).toBe(false);
        }));
        (0, globals_1.it)('should handle Stripe account retrieval error', () => __awaiter(void 0, void 0, void 0, function* () {
            yield teacher_model_1.Teacher.findByIdAndUpdate(teacherId, {
                stripeAccountId: 'acct_invalid',
            });
            mockStripe.accounts.retrieve.mockRejectedValue(new Error('Account not found'));
            const response = yield (0, supertest_1.default)(app_1.app)
                .get('/api/stripe-connect/account-status')
                .set('Authorization', `Bearer ${authToken}`);
            (0, globals_1.expect)(response.status).toBe(500);
            (0, globals_1.expect)(response.body.success).toBe(false);
        }));
    });
    (0, globals_1.describe)('POST /api/stripe-connect/update-account', () => {
        (0, globals_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
            yield teacher_model_1.Teacher.findByIdAndUpdate(teacherId, {
                stripeAccountId: 'acct_test123',
            });
        }));
        (0, globals_1.it)('should update account information successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockUpdatedAccount = {
                id: 'acct_test123',
                business_profile: {
                    name: 'John Doe Teaching',
                    url: 'https://johndoe.com',
                },
            };
            mockStripe.accounts.update.mockResolvedValue(mockUpdatedAccount);
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/stripe-connect/update-account')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                business_profile: {
                    name: 'John Doe Teaching',
                    url: 'https://johndoe.com',
                },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(response.body.success).toBe(true);
            (0, globals_1.expect)(response.body.data.business_profile.name).toBe('John Doe Teaching');
            (0, globals_1.expect)(mockStripe.accounts.update).toHaveBeenCalledWith('acct_test123', {
                business_profile: {
                    name: 'John Doe Teaching',
                    url: 'https://johndoe.com',
                },
            });
        }));
        (0, globals_1.it)('should return error for invalid update data', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/stripe-connect/update-account')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                invalid_field: 'invalid_value',
            });
            (0, globals_1.expect)(response.status).toBe(400);
            (0, globals_1.expect)(response.body.success).toBe(false);
        }));
    });
    (0, globals_1.describe)('Authentication', () => {
        (0, globals_1.it)('should require authentication for all endpoints', () => __awaiter(void 0, void 0, void 0, function* () {
            const endpoints = [
                { method: 'post', path: '/api/stripe-connect/create-account' },
                { method: 'post', path: '/api/stripe-connect/create-account-link' },
                { method: 'get', path: '/api/stripe-connect/account-status' },
                { method: 'post', path: '/api/stripe-connect/update-account' },
            ];
            for (const endpoint of endpoints) {
                const response = yield (0, supertest_1.default)(app_1.app)[endpoint.method](endpoint.path);
                (0, globals_1.expect)(response.status).toBe(401);
            }
        }));
        (0, globals_1.it)('should require teacher role for all endpoints', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create a student user
            const studentData = {
                name: { firstName: 'Jane', lastName: 'Student' },
                email: 'student@test.com',
                password: 'password123',
                role: 'student',
            };
            const studentSignupResponse = yield (0, supertest_1.default)(app_1.app)
                .post('/api/auth/signup')
                .send(studentData);
            const studentToken = studentSignupResponse.body.data.accessToken;
            const endpoints = [
                { method: 'post', path: '/api/stripe-connect/create-account' },
                { method: 'post', path: '/api/stripe-connect/create-account-link' },
                { method: 'get', path: '/api/stripe-connect/account-status' },
                { method: 'post', path: '/api/stripe-connect/update-account' },
            ];
            for (const endpoint of endpoints) {
                const response = yield (0, supertest_1.default)(app_1.app)[endpoint.method](endpoint.path)
                    .set('Authorization', `Bearer ${studentToken}`);
                (0, globals_1.expect)(response.status).toBe(403);
            }
        }));
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.it)('should handle network errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockStripe.accounts.create.mockRejectedValue(new Error('Network error'));
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/stripe-connect/create-account')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                type: 'express',
                country: 'US',
                email: 'teacher@test.com',
            });
            (0, globals_1.expect)(response.status).toBe(500);
            (0, globals_1.expect)(response.body.success).toBe(false);
            (0, globals_1.expect)(response.body.message).toContain('Failed to create Stripe account');
        }));
        (0, globals_1.it)('should handle malformed request data', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.app)
                .post('/api/stripe-connect/create-account')
                .set('Authorization', `Bearer ${authToken}`)
                .send('invalid json');
            (0, globals_1.expect)(response.status).toBe(400);
        }));
    });
});
