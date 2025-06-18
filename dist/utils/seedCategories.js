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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCategories = void 0;
const category_model_1 = require("../app/modules/Category/category.model");
const subCategory_model_1 = require("../app/modules/SubCategory/subCategory.model");
const categoriesData = [
    {
        name: 'Development',
        slug: 'development',
        description: 'Learn programming, web development, mobile apps, and more',
        icon: '💻',
        subcategories: [
            { name: 'Web Development', slug: 'web-development', description: 'HTML, CSS, JavaScript, React, Node.js' },
            { name: 'Mobile Development', slug: 'mobile-development', description: 'iOS, Android, React Native, Flutter' },
            { name: 'Programming Languages', slug: 'programming-languages', description: 'Python, Java, C++, JavaScript' },
            { name: 'Game Development', slug: 'game-development', description: 'Unity, Unreal Engine, C#' },
            { name: 'Database Design', slug: 'database-design', description: 'SQL, MongoDB, PostgreSQL' },
            { name: 'Software Testing', slug: 'software-testing', description: 'Automated testing, QA' },
        ]
    },
    {
        name: 'Business',
        slug: 'business',
        description: 'Entrepreneurship, management, and business strategy',
        icon: '💼',
        subcategories: [
            { name: 'Entrepreneurship', slug: 'entrepreneurship', description: 'Starting and running a business' },
            { name: 'Management', slug: 'management', description: 'Leadership and team management' },
            { name: 'Sales', slug: 'sales', description: 'Sales techniques and strategies' },
            { name: 'Business Strategy', slug: 'business-strategy', description: 'Strategic planning and analysis' },
            { name: 'Operations', slug: 'operations', description: 'Business operations and processes' },
            { name: 'Project Management', slug: 'project-management', description: 'Agile, Scrum, PMP' },
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
        name: 'Design',
        slug: 'design',
        description: 'Graphic design, web design, and creative skills',
        icon: '🎨',
        subcategories: [
            { name: 'Web Design', slug: 'web-design', description: 'UI/UX design, responsive design' },
            { name: 'Graphic Design & Illustration', slug: 'graphic-design-illustration', description: 'Photoshop, Illustrator, design principles' },
            { name: 'Design Tools', slug: 'design-tools', description: 'Figma, Sketch, Adobe Creative Suite' },
            { name: 'User Experience Design', slug: 'user-experience-design', description: 'UX research, prototyping' },
            { name: 'Game Design', slug: 'game-design', description: 'Game mechanics and level design' },
            { name: '3D & Animation', slug: '3d-animation', description: 'Blender, Maya, After Effects' },
        ]
    },
    {
        name: 'Marketing',
        slug: 'marketing',
        description: 'Digital marketing, social media, and advertising',
        icon: '📢',
        subcategories: [
            { name: 'Digital Marketing', slug: 'digital-marketing', description: 'Online marketing strategies' },
            { name: 'Search Engine Optimization', slug: 'search-engine-optimization', description: 'SEO techniques and tools' },
            { name: 'Social Media Marketing', slug: 'social-media-marketing', description: 'Facebook, Instagram, Twitter marketing' },
            { name: 'Branding', slug: 'branding', description: 'Brand strategy and identity' },
            { name: 'Marketing Fundamentals', slug: 'marketing-fundamentals', description: 'Basic marketing principles' },
            { name: 'Advertising', slug: 'advertising', description: 'Google Ads, Facebook Ads' },
        ]
    }
];
const seedCategories = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🌱 Starting to seed categories and subcategories...');
        // Clear existing data
        yield category_model_1.Category.deleteMany({});
        yield subCategory_model_1.SubCategory.deleteMany({});
        console.log('🗑️ Cleared existing categories and subcategories');
        for (const categoryData of categoriesData) {
            // Create category
            const { subcategories } = categoryData, categoryInfo = __rest(categoryData, ["subcategories"]);
            const category = yield category_model_1.Category.create(categoryInfo);
            console.log(`✅ Created category: ${category.name}`);
            // Create subcategories for this category
            for (const subcategoryData of subcategories) {
                const subcategory = yield subCategory_model_1.SubCategory.create(Object.assign(Object.assign({}, subcategoryData), { categoryId: category._id }));
                console.log(`  ✅ Created subcategory: ${subcategory.name}`);
            }
        }
        console.log('🎉 Successfully seeded all categories and subcategories!');
    }
    catch (error) {
        console.error('❌ Error seeding categories:', error);
        throw error;
    }
});
exports.seedCategories = seedCategories;
