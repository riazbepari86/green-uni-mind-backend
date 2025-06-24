import { Category } from '../app/modules/Category/category.model';
import { SubCategory } from '../app/modules/SubCategory/subCategory.model';

const categoriesData = [
  {
    name: 'Programming & Development',
    slug: 'programming-development',
    description: 'Master programming languages, web development, mobile apps, and software engineering',
    icon: '💻',
    subcategories: [
      { name: 'JavaScript', slug: 'javascript', description: 'Modern JavaScript, ES6+, frameworks and libraries' },
      { name: 'Python', slug: 'python', description: 'Python programming, Django, Flask, data science' },
      { name: 'React', slug: 'react', description: 'React.js, hooks, state management, component architecture' },
      { name: 'Node.js', slug: 'nodejs', description: 'Server-side JavaScript, Express.js, APIs' },
      { name: 'Full Stack Development', slug: 'full-stack-development', description: 'End-to-end web development, MERN/MEAN stack' },
      { name: 'Web Development', slug: 'web-development', description: 'HTML, CSS, responsive design, frontend frameworks' },
      { name: 'Mobile Development', slug: 'mobile-development', description: 'iOS, Android, React Native, Flutter' },
      { name: 'Database Design', slug: 'database-design', description: 'SQL, MongoDB, PostgreSQL, database optimization' },
      { name: 'DevOps & Cloud', slug: 'devops-cloud', description: 'AWS, Docker, Kubernetes, CI/CD pipelines' },
      { name: 'Software Testing', slug: 'software-testing', description: 'Unit testing, integration testing, TDD' },
    ]
  },
  {
    name: 'Business & Marketing',
    slug: 'business-marketing',
    description: 'Build business skills, marketing expertise, and entrepreneurial mindset',
    icon: '💼',
    subcategories: [
      { name: 'Digital Marketing', slug: 'digital-marketing', description: 'SEO, SEM, content marketing, analytics' },
      { name: 'Entrepreneurship', slug: 'entrepreneurship', description: 'Starting and scaling businesses, startup strategies' },
      { name: 'Project Management', slug: 'project-management', description: 'Agile, Scrum, PMP, team leadership' },
      { name: 'Sales', slug: 'sales', description: 'Sales techniques, CRM, lead generation' },
      { name: 'Social Media Marketing', slug: 'social-media-marketing', description: 'Facebook, Instagram, LinkedIn, TikTok marketing' },
      { name: 'E-commerce', slug: 'e-commerce', description: 'Online business, Shopify, Amazon FBA' },
      { name: 'Business Strategy', slug: 'business-strategy', description: 'Strategic planning, market analysis, growth hacking' },
      { name: 'Content Marketing', slug: 'content-marketing', description: 'Blogging, video marketing, brand storytelling' },
    ]
  },
  {
    name: 'Finance & Accounting',
    slug: 'finance-accounting',
    description: 'Financial planning, accounting, and investment',
    icon: '💰',
    subcategories: [
      { name: 'Accounting', slug: 'accounting', description: 'Financial accounting and bookkeeping' },
      { name: 'Finance', slug: 'finance', description: 'Personal and corporate finance' },
      { name: 'Investing & Trading', slug: 'investing-trading', description: 'Stock market, crypto, forex' },
      { name: 'Financial Modeling', slug: 'financial-modeling', description: 'Excel, financial analysis' },
      { name: 'Taxes', slug: 'taxes', description: 'Tax preparation and planning' },
    ]
  },
  {
    name: 'IT & Software',
    slug: 'it-software',
    description: 'Information technology and software tools',
    icon: '🖥️',
    subcategories: [
      { name: 'IT Certifications', slug: 'it-certifications', description: 'CompTIA, Cisco, Microsoft' },
      { name: 'Network & Security', slug: 'network-security', description: 'Cybersecurity, networking' },
      { name: 'Hardware', slug: 'hardware', description: 'Computer hardware and repair' },
      { name: 'Operating Systems', slug: 'operating-systems', description: 'Windows, Linux, macOS' },
      { name: 'Other IT & Software', slug: 'other-it-software', description: 'Various IT topics' },
    ]
  },
  {
    name: 'Office Productivity',
    slug: 'office-productivity',
    description: 'Microsoft Office, Google Workspace, and productivity tools',
    icon: '📊',
    subcategories: [
      { name: 'Microsoft', slug: 'microsoft', description: 'Excel, Word, PowerPoint, Outlook' },
      { name: 'Apple', slug: 'apple', description: 'Pages, Numbers, Keynote' },
      { name: 'Google', slug: 'google', description: 'Google Sheets, Docs, Slides' },
      { name: 'SAP', slug: 'sap', description: 'SAP software and systems' },
      { name: 'Oracle', slug: 'oracle', description: 'Oracle database and applications' },
    ]
  },
  {
    name: 'Personal Development',
    slug: 'personal-development',
    description: 'Self-improvement, productivity, and life skills',
    icon: '🌱',
    subcategories: [
      { name: 'Personal Productivity', slug: 'personal-productivity', description: 'Time management, organization' },
      { name: 'Leadership', slug: 'leadership', description: 'Leadership skills and techniques' },
      { name: 'Career Development', slug: 'career-development', description: 'Professional growth and networking' },
      { name: 'Parenting & Relationships', slug: 'parenting-relationships', description: 'Family and relationship skills' },
      { name: 'Happiness', slug: 'happiness', description: 'Well-being and life satisfaction' },
      { name: 'Religion & Spirituality', slug: 'religion-spirituality', description: 'Spiritual growth and practices' },
    ]
  },
  {
    name: 'Design & Creative',
    slug: 'design-creative',
    description: 'Master visual design, user experience, and creative digital skills',
    icon: '🎨',
    subcategories: [
      { name: 'UI/UX Design', slug: 'ui-ux-design', description: 'User interface and user experience design principles' },
      { name: 'Graphic Design', slug: 'graphic-design', description: 'Visual design, branding, typography, color theory' },
      { name: 'Web Design', slug: 'web-design', description: 'Responsive design, wireframing, prototyping' },
      { name: 'Mobile App Design', slug: 'mobile-app-design', description: 'iOS and Android app design patterns' },
      { name: 'Design Tools', slug: 'design-tools', description: 'Figma, Sketch, Adobe Creative Suite, Canva' },
      { name: 'Motion Graphics', slug: 'motion-graphics', description: 'After Effects, animation, video editing' },
      { name: '3D Design', slug: '3d-design', description: 'Blender, Maya, 3D modeling and rendering' },
      { name: 'Illustration', slug: 'illustration', description: 'Digital illustration, character design, concept art' },
    ]
  },
  {
    name: 'Data Science & Analytics',
    slug: 'data-science-analytics',
    description: 'Master data analysis, machine learning, and business intelligence',
    icon: '📊',
    subcategories: [
      { name: 'Data Analysis', slug: 'data-analysis', description: 'Excel, SQL, data visualization, statistical analysis' },
      { name: 'Machine Learning', slug: 'machine-learning', description: 'Python, scikit-learn, TensorFlow, AI algorithms' },
      { name: 'Business Intelligence', slug: 'business-intelligence', description: 'Tableau, Power BI, data dashboards' },
      { name: 'Big Data', slug: 'big-data', description: 'Hadoop, Spark, data engineering, cloud analytics' },
      { name: 'Statistics', slug: 'statistics', description: 'Statistical methods, hypothesis testing, R programming' },
      { name: 'Data Visualization', slug: 'data-visualization', description: 'Charts, graphs, storytelling with data' },
      { name: 'Database Management', slug: 'database-management', description: 'SQL, NoSQL, database optimization' },
      { name: 'Python for Data Science', slug: 'python-data-science', description: 'Pandas, NumPy, Matplotlib, Jupyter' },
    ]
  }
];

export const seedCategories = async () => {
  try {
    console.log('🌱 Starting to seed categories and subcategories...');

    // Clear existing data
    await Category.deleteMany({});
    await SubCategory.deleteMany({});
    console.log('🗑️ Cleared existing categories and subcategories');

    for (const categoryData of categoriesData) {
      // Create category
      const { subcategories, ...categoryInfo } = categoryData;
      const category = await Category.create(categoryInfo);
      console.log(`✅ Created category: ${category.name}`);

      // Create subcategories for this category
      for (const subcategoryData of subcategories) {
        const subcategory = await SubCategory.create({
          ...subcategoryData,
          categoryId: category._id,
        });
        console.log(`  ✅ Created subcategory: ${subcategory.name}`);
      }
    }

    console.log('🎉 Successfully seeded all categories and subcategories!');
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  }
};
