import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../app';
import { Teacher } from '../../Teacher/teacher.model';
import { connectDB, disconnectDB } from '../../../config/database';
import Stripe from 'stripe';

// Mock Stripe
jest.mock('stripe');
const MockedStripe = Stripe as jest.MockedClass<typeof Stripe>;

describe('Stripe Connect Integration Tests', () => {
  let mockStripe: jest.Mocked<Stripe>;
  let authToken: string;
  let teacherId: string;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock Stripe instance
    mockStripe = {
      accounts: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
      },
      accountLinks: {
        create: jest.fn(),
      },
      oauth: {
        token: jest.fn(),
      },
    } as any;

    MockedStripe.mockImplementation(() => mockStripe);

    // Create a test teacher and get auth token
    const teacherData = {
      name: { firstName: 'John', lastName: 'Doe' },
      email: 'teacher@test.com',
      password: 'password123',
      role: 'teacher',
    };

    const signupResponse = await request(app)
      .post('/api/auth/signup')
      .send(teacherData);

    authToken = signupResponse.body.data.accessToken;
    teacherId = signupResponse.body.data.user._id;
  });

  afterEach(async () => {
    // Clean up test data
    await Teacher.deleteMany({});
  });

  describe('POST /api/stripe-connect/create-account', () => {
    it('should create Stripe Connect account successfully', async () => {
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

      mockStripe.accounts.create.mockResolvedValue(mockAccount as any);

      const response = await request(app)
        .post('/api/stripe-connect/create-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'express',
          country: 'US',
          email: 'teacher@test.com',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accountId).toBe('acct_test123');
      expect(response.body.data.isConnected).toBe(true);
      expect(response.body.data.isVerified).toBe(false);

      // Verify teacher was updated in database
      const updatedTeacher = await Teacher.findById(teacherId);
      expect(updatedTeacher?.stripeAccountId).toBe('acct_test123');
    });

    it('should return error for invalid account type', async () => {
      const response = await request(app)
        .post('/api/stripe-connect/create-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'invalid',
          country: 'US',
          email: 'teacher@test.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle Stripe account creation error', async () => {
      mockStripe.accounts.create.mockRejectedValue(new Error('Stripe error'));

      const response = await request(app)
        .post('/api/stripe-connect/create-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'express',
          country: 'US',
          email: 'teacher@test.com',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to create Stripe account');
    });
  });

  describe('POST /api/stripe-connect/create-account-link', () => {
    beforeEach(async () => {
      // Set up teacher with Stripe account
      await Teacher.findByIdAndUpdate(teacherId, {
        stripeAccountId: 'acct_test123',
      });
    });

    it('should create account link successfully', async () => {
      const mockAccountLink = {
        object: 'account_link',
        url: 'https://connect.stripe.com/setup/s/acct_test123',
        created: 1640995200,
        expires_at: 1640998800,
      };

      mockStripe.accountLinks.create.mockResolvedValue(mockAccountLink as any);

      const response = await request(app)
        .post('/api/stripe-connect/create-account-link')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'account_onboarding',
          refreshUrl: 'http://localhost:3000/teacher/stripe-connect?refresh=true',
          returnUrl: 'http://localhost:3000/teacher/stripe-connect?success=true',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toBe('https://connect.stripe.com/setup/s/acct_test123');

      expect(mockStripe.accountLinks.create).toHaveBeenCalledWith({
        account: 'acct_test123',
        type: 'account_onboarding',
        refresh_url: 'http://localhost:3000/teacher/stripe-connect?refresh=true',
        return_url: 'http://localhost:3000/teacher/stripe-connect?success=true',
      });
    });

    it('should return error if teacher has no Stripe account', async () => {
      await Teacher.findByIdAndUpdate(teacherId, {
        $unset: { stripeAccountId: 1 },
      });

      const response = await request(app)
        .post('/api/stripe-connect/create-account-link')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'account_onboarding',
          refreshUrl: 'http://localhost:3000/teacher/stripe-connect?refresh=true',
          returnUrl: 'http://localhost:3000/teacher/stripe-connect?success=true',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No Stripe account found');
    });
  });

  describe('GET /api/stripe-connect/account-status', () => {
    it('should return account status for connected account', async () => {
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

      await Teacher.findByIdAndUpdate(teacherId, {
        stripeAccountId: 'acct_test123',
      });

      mockStripe.accounts.retrieve.mockResolvedValue(mockAccount as any);

      const response = await request(app)
        .get('/api/stripe-connect/account-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isConnected).toBe(true);
      expect(response.body.data.isVerified).toBe(true);
      expect(response.body.data.canReceivePayments).toBe(true);
      expect(response.body.data.accountId).toBe('acct_test123');
    });

    it('should return not connected status for teacher without Stripe account', async () => {
      const response = await request(app)
        .get('/api/stripe-connect/account-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isConnected).toBe(false);
      expect(response.body.data.isVerified).toBe(false);
      expect(response.body.data.canReceivePayments).toBe(false);
    });

    it('should handle Stripe account retrieval error', async () => {
      await Teacher.findByIdAndUpdate(teacherId, {
        stripeAccountId: 'acct_invalid',
      });

      mockStripe.accounts.retrieve.mockRejectedValue(new Error('Account not found'));

      const response = await request(app)
        .get('/api/stripe-connect/account-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/stripe-connect/update-account', () => {
    beforeEach(async () => {
      await Teacher.findByIdAndUpdate(teacherId, {
        stripeAccountId: 'acct_test123',
      });
    });

    it('should update account information successfully', async () => {
      const mockUpdatedAccount = {
        id: 'acct_test123',
        business_profile: {
          name: 'John Doe Teaching',
          url: 'https://johndoe.com',
        },
      };

      mockStripe.accounts.update.mockResolvedValue(mockUpdatedAccount as any);

      const response = await request(app)
        .post('/api/stripe-connect/update-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_profile: {
            name: 'John Doe Teaching',
            url: 'https://johndoe.com',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.business_profile.name).toBe('John Doe Teaching');

      expect(mockStripe.accounts.update).toHaveBeenCalledWith(
        'acct_test123',
        {
          business_profile: {
            name: 'John Doe Teaching',
            url: 'https://johndoe.com',
          },
        }
      );
    });

    it('should return error for invalid update data', async () => {
      const response = await request(app)
        .post('/api/stripe-connect/update-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invalid_field: 'invalid_value',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'post', path: '/api/stripe-connect/create-account' },
        { method: 'post', path: '/api/stripe-connect/create-account-link' },
        { method: 'get', path: '/api/stripe-connect/account-status' },
        { method: 'post', path: '/api/stripe-connect/update-account' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });

    it('should require teacher role for all endpoints', async () => {
      // Create a student user
      const studentData = {
        name: { firstName: 'Jane', lastName: 'Student' },
        email: 'student@test.com',
        password: 'password123',
        role: 'student',
      };

      const studentSignupResponse = await request(app)
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
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${studentToken}`);
        expect(response.status).toBe(403);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockStripe.accounts.create.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .post('/api/stripe-connect/create-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'express',
          country: 'US',
          email: 'teacher@test.com',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to create Stripe account');
    });

    it('should handle malformed request data', async () => {
      const response = await request(app)
        .post('/api/stripe-connect/create-account')
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid json');

      expect(response.status).toBe(400);
    });
  });
});
