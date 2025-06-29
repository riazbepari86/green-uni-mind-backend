"use strict";
/**
 * Jest Test Setup
 * Global test configuration and setup
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.DATABASE_URL = 'mongodb://localhost:27017/green-uni-mind-test';
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.BCRYPT_SALT_ROUNDS = '10';
// Mock Redis for tests to avoid external dependencies
jest.mock('../app/config/redis', () => ({
    redis: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        exists: jest.fn().mockResolvedValue(0),
        keys: jest.fn().mockResolvedValue([]),
        ping: jest.fn().mockResolvedValue('PONG'),
        pipeline: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([])
        })
    },
    redisOperations: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        setex: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(0),
        exists: jest.fn().mockResolvedValue(0),
        keys: jest.fn().mockResolvedValue([]),
        ping: jest.fn().mockResolvedValue('PONG'),
        pipeline: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([])
        })
    },
    isRedisHealthy: jest.fn().mockResolvedValue(true),
    ensureConnection: jest.fn().mockResolvedValue(true)
}));
// Mock Redis services
jest.mock('../app/services/redis/RedisServiceManager', () => ({
    redisServiceManager: {
        primaryClient: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
            ping: jest.fn().mockResolvedValue('PONG')
        },
        healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
        initialize: jest.fn().mockResolvedValue(undefined)
    }
}));
// Mock Redis optimization service
jest.mock('../app/services/redis/RedisOptimizationService', () => ({
    redisOptimizationService: {
        getCircuitBreakerStatus: jest.fn().mockReturnValue({}),
        getOptimizationStats: jest.fn().mockReturnValue({
            circuitBreakers: {},
            batchQueueSize: 0,
            config: {}
        }),
        optimizedGet: jest.fn().mockResolvedValue(null),
        optimizedSet: jest.fn().mockResolvedValue(undefined),
        multiGet: jest.fn().mockResolvedValue({}),
        multiSet: jest.fn().mockResolvedValue(undefined)
    }
}));
// Increase timeout for all tests
jest.setTimeout(30000);
// Global test cleanup
afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
    // Clean up any global resources
    yield new Promise(resolve => setTimeout(resolve, 100));
}));
