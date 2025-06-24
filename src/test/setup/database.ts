import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Logger } from '../../app/config/logger';

let mongoServer: MongoMemoryServer;

/**
 * Connect to in-memory MongoDB instance for testing
 */
export const connectDB = async (): Promise<void> => {
  try {
    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '6.0.0',
      },
      instance: {
        dbName: 'test-green-uni-mind',
      },
    });

    const mongoUri = mongoServer.getUri();

    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    Logger.info('✅ Connected to test database');
  } catch (error) {
    Logger.error('❌ Failed to connect to test database:', error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB and stop the in-memory server
 */
export const disconnectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    if (mongoServer) {
      await mongoServer.stop();
    }

    Logger.info('✅ Disconnected from test database');
  } catch (error) {
    Logger.error('❌ Failed to disconnect from test database:', error);
    throw error;
  }
};

/**
 * Clear all collections in the test database
 */
export const clearDB = async (): Promise<void> => {
  try {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    Logger.info('🧹 Test database cleared');
  } catch (error) {
    Logger.error('❌ Failed to clear test database:', error);
    throw error;
  }
};

/**
 * Drop the test database
 */
export const dropDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
    }

    Logger.info('🗑️ Test database dropped');
  } catch (error) {
    Logger.error('❌ Failed to drop test database:', error);
    throw error;
  }
};

/**
 * Setup database for testing with proper error handling
 */
export const setupTestDB = () => {
  // Connect to database before all tests
  beforeAll(async () => {
    await connectDB();
  });

  // Clear database before each test
  beforeEach(async () => {
    await clearDB();
  });

  // Disconnect after all tests
  afterAll(async () => {
    await disconnectDB();
  });
};

/**
 * Get database connection status
 */
export const getConnectionStatus = (): string => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return states[mongoose.connection.readyState as keyof typeof states] || 'unknown';
};

/**
 * Wait for database connection
 */
export const waitForConnection = async (timeout: number = 10000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Database connection timeout'));
    }, timeout);

    if (mongoose.connection.readyState === 1) {
      clearTimeout(timeoutId);
      resolve();
      return;
    }

    mongoose.connection.once('connected', () => {
      clearTimeout(timeoutId);
      resolve();
    });

    mongoose.connection.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
};

/**
 * Create test indexes for better performance
 */
export const createTestIndexes = async (): Promise<void> => {
  try {
    const db = mongoose.connection.db;
    
    // Create basic indexes for test collections
    await Promise.all([
      db.collection('users').createIndex({ email: 1 }, { unique: true }),
      db.collection('teachers').createIndex({ email: 1 }, { unique: true }),
      db.collection('students').createIndex({ email: 1 }, { unique: true }),
      db.collection('courses').createIndex({ creator: 1 }),
      db.collection('conversations').createIndex({ teacherId: 1, studentId: 1, courseId: 1 }),
      db.collection('messages').createIndex({ conversationId: 1, createdAt: -1 }),
      db.collection('activities').createIndex({ teacherId: 1, createdAt: -1 }),
    ]);

    Logger.info('✅ Test indexes created');
  } catch (error) {
    Logger.error('❌ Failed to create test indexes:', error);
  }
};

/**
 * Get collection statistics for debugging
 */
export const getCollectionStats = async (): Promise<Record<string, any>> => {
  try {
    const collections = mongoose.connection.collections;
    const stats: Record<string, any> = {};

    for (const [name, collection] of Object.entries(collections)) {
      const count = await collection.countDocuments();
      stats[name] = { count };
    }

    return stats;
  } catch (error) {
    Logger.error('❌ Failed to get collection stats:', error);
    return {};
  }
};

/**
 * Seed test data for specific scenarios
 */
export const seedTestData = async (scenario: 'basic' | 'analytics' | 'messaging'): Promise<void> => {
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
        Logger.warn('Unknown test scenario:', scenario);
    }
  } catch (error) {
    Logger.error('❌ Failed to seed test data:', error);
    throw error;
  }
};

export default {
  connectDB,
  disconnectDB,
  clearDB,
  dropDB,
  setupTestDB,
  getConnectionStatus,
  waitForConnection,
  createTestIndexes,
  getCollectionStats,
  seedTestData,
};
