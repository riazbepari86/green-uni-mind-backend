import mongoose from 'mongoose';
import config from '../app/config';
import { Category } from '../app/modules/Category/category.model';
import { SubCategory } from '../app/modules/SubCategory/subCategory.model';

const categories = [
  {
    name: 'Programming',
    slug: 'programming',
    description: 'Learn programming languages and software development',
    icon: '💻',
    subcategories: [
      { name: 'Web Development', slug: 'web-development', description: 'Frontend and backend web development' },
      { name: 'Mobile Development', slug: 'mobile-development', description: 'iOS and Android app development' },
      { name: 'Data Science', slug: 'data-science', description: 'Data analysis and machine learning' },
      { name: 'DevOps', slug: 'devops', description: 'Development operations and deployment' },
    ]
  },
  {
    name: 'Design',
    slug: 'design',
    description: 'Creative design and visual arts',
    icon: '🎨',
    subcategories: [
      { name: 'UI/UX Design', slug: 'ui-ux-design', description: 'User interface and experience design' },
      { name: 'Graphic Design', slug: 'graphic-design', description: 'Visual communication and branding' },
      { name: 'Web Design', slug: 'web-design', description: 'Website design and layout' },
      { name: '3D Design', slug: '3d-design', description: '3D modeling and animation' },
    ]
  },
  {
    name: 'Business',
    slug: 'business',
    description: 'Business skills and entrepreneurship',
    icon: '💼',
    subcategories: [
      { name: 'Entrepreneurship', slug: 'entrepreneurship', description: 'Starting and running a business' },
      { name: 'Management', slug: 'management', description: 'Leadership and team management' },
      { name: 'Finance', slug: 'finance', description: 'Financial planning and analysis' },
      { name: 'Marketing', slug: 'marketing', description: 'Digital and traditional marketing' },
    ]
  },
  {
    name: 'Technology',
    slug: 'technology',
    description: 'Technology and IT skills',
    icon: '⚙️',
    subcategories: [
      { name: 'Cloud Computing', slug: 'cloud-computing', description: 'AWS, Azure, and Google Cloud' },
      { name: 'Cybersecurity', slug: 'cybersecurity', description: 'Information security and protection' },
      { name: 'Artificial Intelligence', slug: 'artificial-intelligence', description: 'AI and machine learning' },
      { name: 'Blockchain', slug: 'blockchain', description: 'Blockchain technology and cryptocurrencies' },
    ]
  },
  {
    name: 'Creative Arts',
    slug: 'creative-arts',
    description: 'Creative and artistic skills',
    icon: '🎭',
    subcategories: [
      { name: 'Photography', slug: 'photography', description: 'Digital and film photography' },
      { name: 'Video Production', slug: 'video-production', description: 'Video editing and production' },
      { name: 'Music Production', slug: 'music-production', description: 'Audio recording and mixing' },
      { name: 'Writing', slug: 'writing', description: 'Creative and technical writing' },
    ]
  }
];

async function seedCategories() {
  try {
    await mongoose.connect(config.database_url as string);
    console.log('Connected to MongoDB');

    // Clear existing categories and subcategories
    await SubCategory.deleteMany({});
    await Category.deleteMany({});
    console.log('Cleared existing categories and subcategories');

    // Create categories and subcategories
    for (const categoryData of categories) {
      const { subcategories, ...categoryInfo } = categoryData;
      
      // Create category
      const category = await Category.create(categoryInfo);
      console.log(`Created category: ${category.name}`);

      // Create subcategories
      for (const subcategoryData of subcategories) {
        const subcategory = await SubCategory.create({
          ...subcategoryData,
          categoryId: category._id,
        });
        console.log(`  Created subcategory: ${subcategory.name}`);
      }
    }

    console.log('Categories and subcategories seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding categories:', error);
    process.exit(1);
  }
}

seedCategories();
