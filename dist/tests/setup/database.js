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
exports.teardownTestDatabase = exports.setupTestDatabase = exports.seedTestData = exports.clearDB = exports.disconnectDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
let mongoServer;
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Create in-memory MongoDB instance
        mongoServer = yield mongodb_memory_server_1.MongoMemoryServer.create({
            binary: {
                version: '6.0.0',
            },
        });
        const mongoUri = mongoServer.getUri();
        // Connect to the in-memory database
        yield mongoose_1.default.connect(mongoUri, {
            bufferCommands: false,
        });
        console.log('Connected to in-memory MongoDB for testing');
    }
    catch (error) {
        console.error('Error connecting to test database:', error);
        throw error;
    }
});
exports.connectDB = connectDB;
const disconnectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Close mongoose connection
        yield mongoose_1.default.connection.close();
        // Stop the in-memory MongoDB instance
        if (mongoServer) {
            yield mongoServer.stop();
        }
        console.log('Disconnected from test database');
    }
    catch (error) {
        console.error('Error disconnecting from test database:', error);
        throw error;
    }
});
exports.disconnectDB = disconnectDB;
const clearDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const collections = mongoose_1.default.connection.collections;
        // Clear all collections
        for (const key in collections) {
            const collection = collections[key];
            yield collection.deleteMany({});
        }
        console.log('Cleared test database');
    }
    catch (error) {
        console.error('Error clearing test database:', error);
        throw error;
    }
});
exports.clearDB = clearDB;
const seedTestData = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Add any common test data seeding here
        console.log('Seeded test data');
    }
    catch (error) {
        console.error('Error seeding test data:', error);
        throw error;
    }
});
exports.seedTestData = seedTestData;
// Global test setup
const setupTestDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, exports.connectDB)();
    yield (0, exports.seedTestData)();
});
exports.setupTestDatabase = setupTestDatabase;
// Global test teardown
const teardownTestDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, exports.clearDB)();
    yield (0, exports.disconnectDB)();
});
exports.teardownTestDatabase = teardownTestDatabase;
exports.default = {
    connectDB: exports.connectDB,
    disconnectDB: exports.disconnectDB,
    clearDB: exports.clearDB,
    seedTestData: exports.seedTestData,
    setupTestDatabase: exports.setupTestDatabase,
    teardownTestDatabase: exports.teardownTestDatabase,
};
