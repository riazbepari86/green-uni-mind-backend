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
exports.testTransactionData = exports.testCourseData = exports.testStudentData = exports.testTeacherData = exports.testUserData = exports.mockStripeInvoice = exports.mockStripeAccount = exports.mockStripeCheckoutSession = exports.mockStripeWebhookEvent = exports.generateTestJWT = exports.createTestTransaction = exports.createTestCourse = exports.createTestStudent = exports.createTestTeacher = exports.createTestUser = void 0;
const mongodb_memory_server_1 = require("mongodb-memory-server");
const mongoose_1 = __importDefault(require("mongoose"));
// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_secret';
process.env.EMAIL_FROM = 'test@example.com';
process.env.EMAIL_HOST = 'smtp.test.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'test@example.com';
process.env.EMAIL_PASS = 'test-password';
let mongoServer;
// Setup before all tests
beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
    // Start in-memory MongoDB instance
    mongoServer = yield mongodb_memory_server_1.MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    // Connect to the in-memory database
    yield mongoose_1.default.connect(mongoUri);
    console.log('Connected to in-memory MongoDB for testing');
}));
// Cleanup after each test
afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
    // Clear all collections
    const collections = mongoose_1.default.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        yield collection.deleteMany({});
    }
}));
// Cleanup after all tests
afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
    // Close database connection
    yield mongoose_1.default.connection.dropDatabase();
    yield mongoose_1.default.connection.close();
    // Stop the in-memory MongoDB instance
    yield mongoServer.stop();
    console.log('Disconnected from in-memory MongoDB');
}));
// Mock console methods to reduce noise in tests
global.console = Object.assign(Object.assign({}, console), { log: jest.fn(), debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() });
// Mock Stripe globally
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        paymentIntents: {
            create: jest.fn(),
            retrieve: jest.fn(),
            confirm: jest.fn(),
        },
        checkout: {
            sessions: {
                create: jest.fn(),
                retrieve: jest.fn(),
                list: jest.fn(),
            },
        },
        accounts: {
            create: jest.fn(),
            retrieve: jest.fn(),
            update: jest.fn(),
        },
        accountLinks: {
            create: jest.fn(),
        },
        customers: {
            create: jest.fn(),
            retrieve: jest.fn(),
            list: jest.fn(),
        },
        invoices: {
            create: jest.fn(),
            retrieve: jest.fn(),
            finalizeInvoice: jest.fn(),
        },
        invoiceItems: {
            create: jest.fn(),
        },
        webhooks: {
            constructEvent: jest.fn(),
        },
        transfers: {
            create: jest.fn(),
        },
        payouts: {
            create: jest.fn(),
            retrieve: jest.fn(),
            list: jest.fn(),
        },
    }));
});
// Mock email service
jest.mock('../app/utils/sendEmail', () => ({
    sendEmail: jest.fn().mockResolvedValue(true),
}));
// Mock file upload service
jest.mock('../app/utils/fileUpload', () => ({
    uploadFile: jest.fn().mockResolvedValue({
        url: 'https://test-bucket.s3.amazonaws.com/test-file.jpg',
        key: 'test-file.jpg',
    }),
    deleteFile: jest.fn().mockResolvedValue(true),
}));
// Mock Redis for caching
jest.mock('redis', () => ({
    createClient: jest.fn(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        expire: jest.fn(),
    })),
}));
// Helper functions for tests
const createTestUser = (userData) => __awaiter(void 0, void 0, void 0, function* () {
    const { User } = require('../app/modules/User/user.model');
    return yield User.create(userData);
});
exports.createTestUser = createTestUser;
const createTestTeacher = (teacherData) => __awaiter(void 0, void 0, void 0, function* () {
    const { Teacher } = require('../app/modules/Teacher/teacher.model');
    return yield Teacher.create(teacherData);
});
exports.createTestTeacher = createTestTeacher;
const createTestStudent = (studentData) => __awaiter(void 0, void 0, void 0, function* () {
    const { Student } = require('../app/modules/Student/student.model');
    return yield Student.create(studentData);
});
exports.createTestStudent = createTestStudent;
const createTestCourse = (courseData) => __awaiter(void 0, void 0, void 0, function* () {
    const { Course } = require('../app/modules/Course/course.model');
    return yield Course.create(courseData);
});
exports.createTestCourse = createTestCourse;
const createTestTransaction = (transactionData) => __awaiter(void 0, void 0, void 0, function* () {
    const { Transaction } = require('../app/modules/Payment/transaction.model');
    return yield Transaction.create(transactionData);
});
exports.createTestTransaction = createTestTransaction;
const generateTestJWT = (payload) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
};
exports.generateTestJWT = generateTestJWT;
const mockStripeWebhookEvent = (type, data) => {
    return {
        id: `evt_test_${Date.now()}`,
        object: 'event',
        api_version: '2024-06-20',
        created: Math.floor(Date.now() / 1000),
        data: {
            object: data,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
            id: `req_test_${Date.now()}`,
            idempotency_key: null,
        },
        type,
    };
};
exports.mockStripeWebhookEvent = mockStripeWebhookEvent;
const mockStripeCheckoutSession = (metadata = {}) => {
    return {
        id: `cs_test_${Date.now()}`,
        object: 'checkout.session',
        amount_total: 10000,
        currency: 'usd',
        customer_details: {
            email: 'test@example.com',
            name: 'Test User',
        },
        metadata: Object.assign({ courseId: '507f1f77bcf86cd799439011', studentId: '507f1f77bcf86cd799439012', teacherId: '507f1f77bcf86cd799439013', teacherShare: '7000', platformFee: '3000', version: '1.0' }, metadata),
        payment_intent: `pi_test_${Date.now()}`,
        payment_status: 'paid',
        status: 'complete',
        url: null,
    };
};
exports.mockStripeCheckoutSession = mockStripeCheckoutSession;
const mockStripeAccount = (overrides = {}) => {
    return Object.assign({ id: `acct_test_${Date.now()}`, object: 'account', business_profile: {
            name: 'Test Business',
            url: 'https://test.com',
        }, capabilities: {
            card_payments: 'active',
            transfers: 'active',
        }, charges_enabled: true, country: 'US', created: Math.floor(Date.now() / 1000), default_currency: 'usd', details_submitted: true, email: 'test@example.com', payouts_enabled: true, requirements: {
            alternatives: [],
            currently_due: [],
            disabled_reason: null,
            eventually_due: [],
            past_due: [],
            pending_verification: [],
        }, type: 'express' }, overrides);
};
exports.mockStripeAccount = mockStripeAccount;
const mockStripeInvoice = (overrides = {}) => {
    return Object.assign({ id: `in_test_${Date.now()}`, object: 'invoice', amount_due: 10000, amount_paid: 10000, amount_remaining: 0, created: Math.floor(Date.now() / 1000), currency: 'usd', customer: `cus_test_${Date.now()}`, hosted_invoice_url: 'https://invoice.stripe.com/test', invoice_pdf: 'https://invoice.stripe.com/test.pdf', status: 'paid' }, overrides);
};
exports.mockStripeInvoice = mockStripeInvoice;
// Test data factories
exports.testUserData = {
    name: {
        firstName: 'Test',
        lastName: 'User',
    },
    email: 'test@example.com',
    password: 'password123',
    role: 'student',
    isEmailVerified: true,
};
exports.testTeacherData = Object.assign(Object.assign({}, exports.testUserData), { role: 'teacher', bio: 'Test teacher bio', expertise: ['JavaScript', 'React'], experience: 5, education: 'Computer Science Degree', stripeAccountId: null, totalEarnings: 0, courses: [], payments: [] });
exports.testStudentData = Object.assign(Object.assign({}, exports.testUserData), { role: 'student', enrolledCourses: [], completedCourses: [], certificates: [] });
exports.testCourseData = {
    title: 'Test Course',
    description: 'A comprehensive test course',
    price: 99.99,
    category: 'Programming',
    level: 'Beginner',
    duration: 120,
    thumbnail: 'https://test.com/thumbnail.jpg',
    lectures: [],
    enrolledStudents: [],
    totalEnrollment: 0,
    rating: 0,
    reviews: [],
    isPublished: true,
};
exports.testTransactionData = {
    totalAmount: 99.99,
    teacherEarning: 69.99,
    platformEarning: 29.99,
    stripeTransactionId: 'pi_test_123',
    stripeTransferStatus: 'pending',
    status: 'success',
};
