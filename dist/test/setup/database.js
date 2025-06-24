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
exports.seedTestData = exports.getCollectionStats = exports.createTestIndexes = exports.waitForConnection = exports.getConnectionStatus = exports.setupTestDB = exports.dropDB = exports.clearDB = exports.disconnectDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const logger_1 = require("../../app/config/logger");
let mongoServer;
/**
 * Connect to in-memory MongoDB instance for testing
 */
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Create in-memory MongoDB instance
        mongoServer = yield mongodb_memory_server_1.MongoMemoryServer.create({
            binary: {
                version: '6.0.0',
            },
            instance: {
                dbName: 'test-green-uni-mind',
            },
        });
        const mongoUri = mongoServer.getUri();
        // Connect to the in-memory database
        yield mongoose_1.default.connect(mongoUri, {
            bufferCommands: false,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        logger_1.Logger.info('✅ Connected to test database');
    }
    catch (error) {
        logger_1.Logger.error('❌ Failed to connect to test database:', error);
        throw error;
    }
});
exports.connectDB = connectDB;
/**
 * Disconnect from MongoDB and stop the in-memory server
 */
const disconnectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (mongoose_1.default.connection.readyState !== 0) {
            yield mongoose_1.default.disconnect();
        }
        if (mongoServer) {
            yield mongoServer.stop();
        }
        logger_1.Logger.info('✅ Disconnected from test database');
    }
    catch (error) {
        logger_1.Logger.error('❌ Failed to disconnect from test database:', error);
        throw error;
    }
});
exports.disconnectDB = disconnectDB;
/**
 * Clear all collections in the test database
 */
const clearDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const collections = mongoose_1.default.connection.collections;
        for (const key in collections) {
            const collection = collections[key];
            yield collection.deleteMany({});
        }
        logger_1.Logger.info('🧹 Test database cleared');
    }
    catch (error) {
        logger_1.Logger.error('❌ Failed to clear test database:', error);
        throw error;
    }
});
exports.clearDB = clearDB;
/**
 * Drop the test database
 */
const dropDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (mongoose_1.default.connection.readyState !== 0) {
            yield mongoose_1.default.connection.dropDatabase();
        }
        logger_1.Logger.info('🗑️ Test database dropped');
    }
    catch (error) {
        logger_1.Logger.error('❌ Failed to drop test database:', error);
        throw error;
    }
});
exports.dropDB = dropDB;
/**
 * Setup database for testing with proper error handling
 */
const setupTestDB = () => {
    // Connect to database before all tests
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, exports.connectDB)();
    }));
    // Clear database before each test
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, exports.clearDB)();
    }));
    // Disconnect after all tests
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, exports.disconnectDB)();
    }));
};
exports.setupTestDB = setupTestDB;
/**
 * Get database connection status
 */
const getConnectionStatus = () => {
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
    };
    return states[mongoose_1.default.connection.readyState] || 'unknown';
};
exports.getConnectionStatus = getConnectionStatus;
/**
 * Wait for database connection
 */
const waitForConnection = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (timeout = 10000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Database connection timeout'));
        }, timeout);
        if (mongoose_1.default.connection.readyState === 1) {
            clearTimeout(timeoutId);
            resolve();
            return;
        }
        mongoose_1.default.connection.once('connected', () => {
            clearTimeout(timeoutId);
            resolve();
        });
        mongoose_1.default.connection.once('error', (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
});
exports.waitForConnection = waitForConnection;
/**
 * Create test indexes for better performance
 */
const createTestIndexes = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const db = mongoose_1.default.connection.db;
        // Create basic indexes for test collections
        yield Promise.all([
            db.collection('users').createIndex({ email: 1 }, { unique: true }),
            db.collection('teachers').createIndex({ email: 1 }, { unique: true }),
            db.collection('students').createIndex({ email: 1 }, { unique: true }),
            db.collection('courses').createIndex({ creator: 1 }),
            db.collection('conversations').createIndex({ teacherId: 1, studentId: 1, courseId: 1 }),
            db.collection('messages').createIndex({ conversationId: 1, createdAt: -1 }),
            db.collection('activities').createIndex({ teacherId: 1, createdAt: -1 }),
        ]);
        logger_1.Logger.info('✅ Test indexes created');
    }
    catch (error) {
        logger_1.Logger.error('❌ Failed to create test indexes:', error);
    }
});
exports.createTestIndexes = createTestIndexes;
/**
 * Get collection statistics for debugging
 */
const getCollectionStats = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const collections = mongoose_1.default.connection.collections;
        const stats = {};
        for (const [name, collection] of Object.entries(collections)) {
            const count = yield collection.countDocuments();
            stats[name] = { count };
        }
        return stats;
    }
    catch (error) {
        logger_1.Logger.error('❌ Failed to get collection stats:', error);
        return {};
    }
});
exports.getCollectionStats = getCollectionStats;
/**
 * Seed test data for specific scenarios
 */
const seedTestData = (scenario) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        switch (scenario) {
            case 'basic':
                // Seed basic test data
                break;
            case 'analytics':
                // Seed analytics test data
                break;
            case 'messaging':
                // Seed messaging test data
                break;
            default:
                logger_1.Logger.warn('Unknown test scenario:', scenario);
        }
    }
    catch (error) {
        logger_1.Logger.error('❌ Failed to seed test data:', error);
        throw error;
    }
});
exports.seedTestData = seedTestData;
exports.default = {
    connectDB: exports.connectDB,
    disconnectDB: exports.disconnectDB,
    clearDB: exports.clearDB,
    dropDB: exports.dropDB,
    setupTestDB: exports.setupTestDB,
    getConnectionStatus: exports.getConnectionStatus,
    waitForConnection: exports.waitForConnection,
    createTestIndexes: exports.createTestIndexes,
    getCollectionStats: exports.getCollectionStats,
    seedTestData: exports.seedTestData,
};
