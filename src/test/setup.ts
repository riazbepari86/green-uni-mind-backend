import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { config } from '../app/config';

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

let mongoServer: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
  
  console.log('Connected to in-memory MongoDB for testing');
});

// Cleanup after each test
afterEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connection
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  
  // Stop the in-memory MongoDB instance
  await mongoServer.stop();
  
  console.log('Disconnected from in-memory MongoDB');
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

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
export const createTestUser = async (userData: any) => {
  const { User } = require('../app/modules/User/user.model');
  return await User.create(userData);
};

export const createTestTeacher = async (teacherData: any) => {
  const { Teacher } = require('../app/modules/Teacher/teacher.model');
  return await Teacher.create(teacherData);
};

export const createTestStudent = async (studentData: any) => {
  const { Student } = require('../app/modules/Student/student.model');
  return await Student.create(studentData);
};

export const createTestCourse = async (courseData: any) => {
  const { Course } = require('../app/modules/Course/course.model');
  return await Course.create(courseData);
};

export const createTestTransaction = async (transactionData: any) => {
  const { Transaction } = require('../app/modules/Payment/transaction.model');
  return await Transaction.create(transactionData);
};

export const generateTestJWT = (payload: any) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
};

export const mockStripeWebhookEvent = (type: string, data: any) => {
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

export const mockStripeCheckoutSession = (metadata: any = {}) => {
  return {
    id: `cs_test_${Date.now()}`,
    object: 'checkout.session',
    amount_total: 10000,
    currency: 'usd',
    customer_details: {
      email: 'test@example.com',
      name: 'Test User',
    },
    metadata: {
      courseId: '507f1f77bcf86cd799439011',
      studentId: '507f1f77bcf86cd799439012',
      teacherId: '507f1f77bcf86cd799439013',
      teacherShare: '7000',
      platformFee: '3000',
      version: '1.0',
      ...metadata,
    },
    payment_intent: `pi_test_${Date.now()}`,
    payment_status: 'paid',
    status: 'complete',
    url: null,
  };
};

export const mockStripeAccount = (overrides: any = {}) => {
  return {
    id: `acct_test_${Date.now()}`,
    object: 'account',
    business_profile: {
      name: 'Test Business',
      url: 'https://test.com',
    },
    capabilities: {
      card_payments: 'active',
      transfers: 'active',
    },
    charges_enabled: true,
    country: 'US',
    created: Math.floor(Date.now() / 1000),
    default_currency: 'usd',
    details_submitted: true,
    email: 'test@example.com',
    payouts_enabled: true,
    requirements: {
      alternatives: [],
      currently_due: [],
      disabled_reason: null,
      eventually_due: [],
      past_due: [],
      pending_verification: [],
    },
    type: 'express',
    ...overrides,
  };
};

export const mockStripeInvoice = (overrides: any = {}) => {
  return {
    id: `in_test_${Date.now()}`,
    object: 'invoice',
    amount_due: 10000,
    amount_paid: 10000,
    amount_remaining: 0,
    created: Math.floor(Date.now() / 1000),
    currency: 'usd',
    customer: `cus_test_${Date.now()}`,
    hosted_invoice_url: 'https://invoice.stripe.com/test',
    invoice_pdf: 'https://invoice.stripe.com/test.pdf',
    status: 'paid',
    ...overrides,
  };
};

// Test data factories
export const testUserData = {
  name: {
    firstName: 'Test',
    lastName: 'User',
  },
  email: 'test@example.com',
  password: 'password123',
  role: 'student',
  isEmailVerified: true,
};

export const testTeacherData = {
  ...testUserData,
  role: 'teacher',
  bio: 'Test teacher bio',
  expertise: ['JavaScript', 'React'],
  experience: 5,
  education: 'Computer Science Degree',
  stripeAccountId: null,
  totalEarnings: 0,
  courses: [],
  payments: [],
};

export const testStudentData = {
  ...testUserData,
  role: 'student',
  enrolledCourses: [],
  completedCourses: [],
  certificates: [],
};

export const testCourseData = {
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

export const testTransactionData = {
  totalAmount: 99.99,
  teacherEarning: 69.99,
  platformEarning: 29.99,
  stripeTransactionId: 'pi_test_123',
  stripeTransferStatus: 'pending',
  status: 'success',
};
