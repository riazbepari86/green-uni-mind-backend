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
Object.defineProperty(exports, "__esModule", { value: true });
const testData_1 = require("../helpers/testData");
// Set up test environment
beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, testData_1.setupTestEnvironment)();
}));
// Global test configuration
jest.setTimeout(30000);
// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;
beforeEach(() => {
    // Suppress console output during tests unless explicitly needed
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
});
afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
    // Clear all mocks
    jest.clearAllMocks();
});
// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_test_connect_secret';
process.env.EMAIL_HOST = 'smtp.test.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'test@test.com';
process.env.EMAIL_PASS = 'test_password';
