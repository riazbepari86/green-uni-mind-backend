import { setupTestDatabase } from './database';

export default async (): Promise<void> => {
  console.log('🧪 Setting up global test environment...');
  
  try {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Initialize test database
    await setupTestDatabase();
    
    console.log('✅ Global test setup completed');
  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    throw error;
  }
};
