import mongoose from 'mongoose';
import config from '../app/config';
import { seedCategories } from '../utils/seedCategories';

const seedDatabase = async () => {
  try {
    console.log('🚀 Starting database seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(config.database_url as string);
    console.log('✅ Connected to MongoDB');

    // Seed categories and subcategories
    await seedCategories();

    console.log('🎉 Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

export default seedDatabase;
