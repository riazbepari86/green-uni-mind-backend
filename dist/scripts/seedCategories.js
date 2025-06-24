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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../app/config"));
const category_model_1 = require("../app/modules/Category/category.model");
const subCategory_model_1 = require("../app/modules/SubCategory/subCategory.model");
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
function seedCategories() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield mongoose_1.default.connect(config_1.default.database_url);
            console.log('Connected to MongoDB');
            // Clear existing categories and subcategories
            yield subCategory_model_1.SubCategory.deleteMany({});
            yield category_model_1.Category.deleteMany({});
            console.log('Cleared existing categories and subcategories');
            // Create categories and subcategories
            for (const categoryData of categories) {
                const { subcategories } = categoryData, categoryInfo = __rest(categoryData, ["subcategories"]);
                // Create category
                const category = yield category_model_1.Category.create(categoryInfo);
                console.log(`Created category: ${category.name}`);
                // Create subcategories
                for (const subcategoryData of subcategories) {
                    const subcategory = yield subCategory_model_1.SubCategory.create(Object.assign(Object.assign({}, subcategoryData), { categoryId: category._id }));
                    console.log(`  Created subcategory: ${subcategory.name}`);
                }
            }
            console.log('Categories and subcategories seeded successfully!');
            process.exit(0);
        }
        catch (error) {
            console.error('Error seeding categories:', error);
            process.exit(1);
        }
    });
}
seedCategories();
