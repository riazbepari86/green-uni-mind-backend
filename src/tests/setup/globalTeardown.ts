import { teardownTestDatabase } from './database';

export default async (): Promise<void> => {
  console.log('🧹 Tearing down global test environment...');
  
  try {
    // Clean up test database
    await teardownTestDatabase();
    
    console.log('✅ Global test teardown completed');
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
};
