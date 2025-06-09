import mongoose from 'mongoose';
import config from '../config';

// Define the cached connection type
interface CachedConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Declare global mongoose type
declare global {
  var mongoose: CachedConnection | undefined;
}

// Create a global variable to store the cached connection
let cached: CachedConnection = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

const connectDB = async () => {
  // If we have a cached connection, return it
  if (cached.conn) {
    return cached.conn;
  }

  // If we don't have a connection promise, create one
  if (!cached.promise) {
    const options = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 5, // Maintain at least 5 socket connections
      retryWrites: true,
      retryReads: true,
    };

    cached.promise = mongoose.connect(config.database_url as string, options);
  }

  try {
    // Wait for the connection promise to resolve
    cached.conn = await cached.promise;
    console.log('MongoDB connected successfully');

    // Handle connection errors after initial connection
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected. Attempting to reconnect...');
      // Clear the cached connection on disconnect
      cached.conn = null;
      cached.promise = null;
      setTimeout(connectDB, 5000); // Retry connection after 5 seconds
    });

    return cached.conn;
  } catch (error) {
    // Clear the cached promise on error
    cached.promise = null;
    console.error('MongoDB connection error:', error);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
    throw error;
  }
};

export default connectDB; 