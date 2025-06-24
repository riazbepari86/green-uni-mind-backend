import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

export const connectDB = async (): Promise<void> => {
  try {
    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '6.0.0',
      },
    });
    
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      bufferCommands: false,
    });
    
    console.log('Connected to in-memory MongoDB for testing');
  } catch (error) {
    console.error('Error connecting to test database:', error);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    // Close mongoose connection
    await mongoose.connection.close();
    
    // Stop the in-memory MongoDB instance
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    console.log('Disconnected from test database');
  } catch (error) {
    console.error('Error disconnecting from test database:', error);
    throw error;
  }
};

export const clearDB = async (): Promise<void> => {
  try {
    const collections = mongoose.connection.collections;
    
    // Clear all collections
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
    
    console.log('Cleared test database');
  } catch (error) {
    console.error('Error clearing test database:', error);
    throw error;
  }
};

export const seedTestData = async (): Promise<void> => {
  try {
    // Add any common test data seeding here
    console.log('Seeded test data');
  } catch (error) {
    console.error('Error seeding test data:', error);
    throw error;
  }
};

// Global test setup
export const setupTestDatabase = async (): Promise<void> => {
  await connectDB();
  await seedTestData();
};

// Global test teardown
export const teardownTestDatabase = async (): Promise<void> => {
  await clearDB();
  await disconnectDB();
};

export default {
  connectDB,
  disconnectDB,
  clearDB,
  seedTestData,
  setupTestDatabase,
  teardownTestDatabase,
};
