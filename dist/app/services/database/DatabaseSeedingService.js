"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseSeedingService = exports.DatabaseSeedingService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../../config/logger");
const category_model_1 = require("../../modules/Category/category.model");
const subCategory_model_1 = require("../../modules/SubCategory/subCategory.model");
const user_model_1 = require("../../modules/User/user.model");
const teacher_model_1 = require("../../modules/Teacher/teacher.model");
const config_1 = __importDefault(require("../../config"));
class DatabaseSeedingService {
    constructor() {
        this.defaultOptions = {
            seedCategories: true,
            seedSubCategories: true,
            seedDefaultUsers: true,
            seedDefaultTeachers: true,
            seedEmptyModels: true,
            seedSampleData: false,
            overwriteExisting: false
        };
    }
    /**
     * Perform database seeding with default values
     */
    performSeeding() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            const startTime = Date.now();
            const opts = Object.assign(Object.assign({}, this.defaultOptions), options);
            logger_1.Logger.info('🌱 Starting database seeding...', { options: opts });
            const result = {
                success: false,
                seededCounts: {
                    categories: 0, subCategories: 0, users: 0, teachers: 0,
                    courses: 0, students: 0, payments: 0, transactions: 0,
                    lectures: 0, bookmarks: 0, questions: 0, notes: 0,
                    analytics: 0, messages: 0, conversations: 0
                },
                errors: [],
                duration: 0
            };
            const session = yield mongoose_1.default.startSession();
            try {
                yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    // Seed in dependency order
                    if (opts.seedCategories) {
                        result.seededCounts.categories = yield this.seedCategories(opts, session);
                    }
                    if (opts.seedSubCategories) {
                        result.seededCounts.subCategories = yield this.seedSubCategories(opts, session);
                    }
                    if (opts.seedDefaultUsers) {
                        const userCounts = yield this.seedDefaultUsers(opts, session);
                        result.seededCounts.users = userCounts.users;
                        result.seededCounts.teachers = userCounts.teachers;
                    }
                    if (opts.seedEmptyModels) {
                        // Seed all other models with their default/empty states
                        const emptyCounts = yield this.seedEmptyModels(opts, session);
                        result.seededCounts.courses = emptyCounts.courses;
                        result.seededCounts.students = emptyCounts.students;
                        result.seededCounts.payments = emptyCounts.payments;
                        result.seededCounts.transactions = emptyCounts.transactions;
                        result.seededCounts.lectures = emptyCounts.lectures;
                        result.seededCounts.bookmarks = emptyCounts.bookmarks;
                        result.seededCounts.questions = emptyCounts.questions;
                        result.seededCounts.notes = emptyCounts.notes;
                        result.seededCounts.analytics = emptyCounts.analytics;
                        result.seededCounts.messages = emptyCounts.messages;
                        result.seededCounts.conversations = emptyCounts.conversations;
                    }
                }));
                result.success = true;
                result.duration = Date.now() - startTime;
                logger_1.Logger.info('🎉 Database seeding completed successfully', {
                    duration: result.duration,
                    seededCounts: result.seededCounts
                });
            }
            catch (error) {
                result.errors.push(error instanceof Error ? error.message : 'Unknown error');
                result.duration = Date.now() - startTime;
                logger_1.Logger.error('❌ Database seeding failed:', error);
                throw error;
            }
            finally {
                yield session.endSession();
            }
            return result;
        });
    }
    /**
     * Seed default categories
     */
    seedCategories(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultCategories = [
                {
                    name: 'Programming & Development',
                    slug: 'programming-development',
                    description: 'Learn programming languages, frameworks, and development tools',
                    icon: '💻',
                    isActive: true
                },
                {
                    name: 'Business & Entrepreneurship',
                    slug: 'business-entrepreneurship',
                    description: 'Business skills, entrepreneurship, and management',
                    icon: '💼',
                    isActive: true
                },
                {
                    name: 'Design & Creative Arts',
                    slug: 'design-creative-arts',
                    description: 'Graphic design, UI/UX, and creative skills',
                    icon: '🎨',
                    isActive: true
                },
                {
                    name: 'Data Science & Analytics',
                    slug: 'data-science-analytics',
                    description: 'Data analysis, machine learning, and statistics',
                    icon: '📊',
                    isActive: true
                },
                {
                    name: 'Marketing & Sales',
                    slug: 'marketing-sales',
                    description: 'Digital marketing, sales strategies, and customer acquisition',
                    icon: '📈',
                    isActive: true
                },
                {
                    name: 'Personal Development',
                    slug: 'personal-development',
                    description: 'Self-improvement, productivity, and life skills',
                    icon: '🌟',
                    isActive: true
                }
            ];
            let seededCount = 0;
            for (const categoryData of defaultCategories) {
                const existingCategory = yield category_model_1.Category.findOne({ slug: categoryData.slug }).session(session);
                if (!existingCategory || options.overwriteExisting) {
                    if (existingCategory && options.overwriteExisting) {
                        yield category_model_1.Category.findByIdAndUpdate(existingCategory._id, categoryData).session(session);
                    }
                    else {
                        yield category_model_1.Category.create([categoryData], { session });
                    }
                    seededCount++;
                }
            }
            logger_1.Logger.info(`🌱 Categories seeding: ${seededCount} categories seeded`);
            return seededCount;
        });
    }
    /**
     * Seed default subcategories
     */
    seedSubCategories(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get categories first
            const categories = yield category_model_1.Category.find({ isActive: true }).session(session);
            const categoryMap = new Map(categories.map(cat => [cat.slug, cat._id]));
            const defaultSubCategories = [
                // Programming & Development
                { categorySlug: 'programming-development', name: 'Web Development', slug: 'web-development', description: 'Frontend and backend web development' },
                { categorySlug: 'programming-development', name: 'Mobile Development', slug: 'mobile-development', description: 'iOS, Android, and cross-platform mobile apps' },
                { categorySlug: 'programming-development', name: 'Game Development', slug: 'game-development', description: 'Video game programming and design' },
                { categorySlug: 'programming-development', name: 'DevOps & Cloud', slug: 'devops-cloud', description: 'Cloud computing, CI/CD, and infrastructure' },
                // Business & Entrepreneurship
                { categorySlug: 'business-entrepreneurship', name: 'Startup Fundamentals', slug: 'startup-fundamentals', description: 'Starting and growing a business' },
                { categorySlug: 'business-entrepreneurship', name: 'Project Management', slug: 'project-management', description: 'Agile, Scrum, and project leadership' },
                { categorySlug: 'business-entrepreneurship', name: 'Finance & Accounting', slug: 'finance-accounting', description: 'Business finance and accounting principles' },
                // Design & Creative Arts
                { categorySlug: 'design-creative-arts', name: 'UI/UX Design', slug: 'ui-ux-design', description: 'User interface and experience design' },
                { categorySlug: 'design-creative-arts', name: 'Graphic Design', slug: 'graphic-design', description: 'Visual design and branding' },
                { categorySlug: 'design-creative-arts', name: 'Video Production', slug: 'video-production', description: 'Video editing and production' },
                // Data Science & Analytics
                { categorySlug: 'data-science-analytics', name: 'Machine Learning', slug: 'machine-learning', description: 'AI and machine learning algorithms' },
                { categorySlug: 'data-science-analytics', name: 'Data Visualization', slug: 'data-visualization', description: 'Charts, graphs, and data presentation' },
                { categorySlug: 'data-science-analytics', name: 'Business Intelligence', slug: 'business-intelligence', description: 'BI tools and analytics' },
                // Marketing & Sales
                { categorySlug: 'marketing-sales', name: 'Digital Marketing', slug: 'digital-marketing', description: 'Online marketing strategies' },
                { categorySlug: 'marketing-sales', name: 'Social Media Marketing', slug: 'social-media-marketing', description: 'Social platform marketing' },
                { categorySlug: 'marketing-sales', name: 'Content Marketing', slug: 'content-marketing', description: 'Content strategy and creation' },
                // Personal Development
                { categorySlug: 'personal-development', name: 'Leadership Skills', slug: 'leadership-skills', description: 'Leadership and management skills' },
                { categorySlug: 'personal-development', name: 'Communication', slug: 'communication', description: 'Public speaking and communication' },
                { categorySlug: 'personal-development', name: 'Productivity', slug: 'productivity', description: 'Time management and productivity' }
            ];
            let seededCount = 0;
            for (const subCatData of defaultSubCategories) {
                const categoryId = categoryMap.get(subCatData.categorySlug);
                if (!categoryId) {
                    logger_1.Logger.warn(`Category not found for slug: ${subCatData.categorySlug}`);
                    continue;
                }
                const existingSubCategory = yield subCategory_model_1.SubCategory.findOne({
                    categoryId,
                    slug: subCatData.slug
                }).session(session);
                if (!existingSubCategory || options.overwriteExisting) {
                    const subCategoryData = {
                        categoryId,
                        name: subCatData.name,
                        slug: subCatData.slug,
                        description: subCatData.description,
                        isActive: true
                    };
                    if (existingSubCategory && options.overwriteExisting) {
                        yield subCategory_model_1.SubCategory.findByIdAndUpdate(existingSubCategory._id, subCategoryData).session(session);
                    }
                    else {
                        yield subCategory_model_1.SubCategory.create([subCategoryData], { session });
                    }
                    seededCount++;
                }
            }
            logger_1.Logger.info(`🌱 SubCategories seeding: ${seededCount} subcategories seeded`);
            return seededCount;
        });
    }
    /**
     * Seed default users and admin accounts
     */
    seedDefaultUsers(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            let userCount = 0;
            let teacherCount = 0;
            // Create super admin if not exists
            const superAdminEmail = 'admin@greenunimind.com';
            const existingSuperAdmin = yield user_model_1.User.findOne({ email: superAdminEmail }).session(session);
            if (!existingSuperAdmin || options.overwriteExisting) {
                // Use plain text password - the User model will hash it automatically
                const superAdminData = {
                    email: superAdminEmail,
                    password: config_1.default.super_admin_password || 'Admin123!@#',
                    role: 'user', // Using 'user' as per the existing pattern
                    status: 'in-progress',
                    isDeleted: false,
                    isVerified: true,
                    photoUrl: ''
                };
                if (existingSuperAdmin && options.overwriteExisting) {
                    yield user_model_1.User.findByIdAndUpdate(existingSuperAdmin._id, superAdminData).session(session);
                }
                else {
                    yield user_model_1.User.create([superAdminData], { session });
                }
                userCount++;
            }
            // Create demo teacher account
            const demoTeacherEmail = 'teacher@greenunimind.com';
            const existingDemoTeacher = yield user_model_1.User.findOne({ email: demoTeacherEmail }).session(session);
            if (!existingDemoTeacher || options.overwriteExisting) {
                // Use plain text password - the User model will hash it automatically
                const demoTeacherUserData = {
                    email: demoTeacherEmail,
                    password: 'Teacher123!@#',
                    role: 'teacher',
                    status: 'in-progress',
                    isDeleted: false,
                    isVerified: true,
                    photoUrl: ''
                };
                let teacherUserId;
                if (existingDemoTeacher && options.overwriteExisting) {
                    yield user_model_1.User.findByIdAndUpdate(existingDemoTeacher._id, demoTeacherUserData).session(session);
                    teacherUserId = existingDemoTeacher._id;
                }
                else {
                    const [createdUser] = yield user_model_1.User.create([demoTeacherUserData], { session });
                    teacherUserId = createdUser._id;
                }
                userCount++;
                // Create teacher profile
                const existingTeacherProfile = yield teacher_model_1.Teacher.findOne({ email: demoTeacherEmail }).session(session);
                if (!existingTeacherProfile || options.overwriteExisting) {
                    const teacherProfileData = {
                        user: teacherUserId,
                        name: {
                            firstName: 'Demo',
                            middleName: '',
                            lastName: 'Teacher'
                        },
                        gender: 'other',
                        email: demoTeacherEmail,
                        profileImg: '',
                        isDeleted: false,
                        stripeConnect: {},
                        stripeAuditLog: [],
                        earnings: { total: 0, monthly: 0, yearly: 0, weekly: 0 },
                        totalEarnings: 0,
                        payments: [],
                        courses: [],
                        averageRating: 0
                    };
                    if (existingTeacherProfile && options.overwriteExisting) {
                        yield teacher_model_1.Teacher.findByIdAndUpdate(existingTeacherProfile._id, teacherProfileData).session(session);
                    }
                    else {
                        yield teacher_model_1.Teacher.create([teacherProfileData], { session });
                    }
                    teacherCount++;
                }
            }
            logger_1.Logger.info(`🌱 Users seeding: ${userCount} users, ${teacherCount} teachers seeded`);
            return { users: userCount, teachers: teacherCount };
        });
    }
    /**
     * Seed all models with their default/empty states
     */
    seedEmptyModels(_options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🌱 Seeding all models with default/empty states...');
            // For now, we don't create any default records for these models
            // They will exist as empty collections ready for new data
            // This ensures all models are properly initialized in the database
            const counts = {
                courses: 0,
                students: 0,
                payments: 0,
                transactions: 0,
                lectures: 0,
                bookmarks: 0,
                questions: 0,
                notes: 0,
                analytics: 0,
                messages: 0,
                conversations: 0
            };
            // Import models to ensure collections are created
            const { Course } = yield Promise.resolve().then(() => __importStar(require('../../modules/Course/course.model')));
            const { Student } = yield Promise.resolve().then(() => __importStar(require('../../modules/Student/student.model')));
            const { Payment } = yield Promise.resolve().then(() => __importStar(require('../../modules/Payment/payment.model')));
            const { Transaction } = yield Promise.resolve().then(() => __importStar(require('../../modules/Payment/transaction.model')));
            const { Lecture } = yield Promise.resolve().then(() => __importStar(require('../../modules/Lecture/lecture.model')));
            const { Bookmark } = yield Promise.resolve().then(() => __importStar(require('../../modules/Bookmark/bookmark.model')));
            const { Question } = yield Promise.resolve().then(() => __importStar(require('../../modules/Question/question.model')));
            const { Note } = yield Promise.resolve().then(() => __importStar(require('../../modules/Note/note.model')));
            // Ensure collections exist by checking if they exist (this creates them if they don't)
            yield Promise.all([
                Course.countDocuments({}).session(session),
                Student.countDocuments({}).session(session),
                Payment.countDocuments({}).session(session),
                Transaction.countDocuments({}).session(session),
                Lecture.countDocuments({}).session(session),
                Bookmark.countDocuments({}).session(session),
                Question.countDocuments({}).session(session),
                Note.countDocuments({}).session(session)
            ]);
            logger_1.Logger.info('🌱 All model collections initialized with empty states');
            return counts;
        });
    }
    /**
     * Reset all models to default empty state
     */
    resetToDefaults() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🔄 Resetting database to complete fresh state...');
            // First perform complete cleanup (remove ALL data)
            const { databaseCleanupService } = yield Promise.resolve().then(() => __importStar(require('./DatabaseCleanupService')));
            yield databaseCleanupService.performCleanup({
                completeReset: true, // Complete reset - remove everything
                dryRun: false
            });
            // Then perform complete seeding
            return yield this.performSeeding({
                seedCategories: true,
                seedSubCategories: true,
                seedDefaultUsers: true,
                seedDefaultTeachers: true,
                seedEmptyModels: true, // Seed all models with empty states
                seedSampleData: false,
                overwriteExisting: true
            });
        });
    }
    /**
     * Verify seeded data integrity
     */
    verifySeeding() {
        return __awaiter(this, void 0, void 0, function* () {
            const issues = [];
            try {
                // Check essential data exists
                const [categoryCount, subCategoryCount, userCount, teacherCount] = yield Promise.all([
                    category_model_1.Category.countDocuments({ isActive: true }),
                    subCategory_model_1.SubCategory.countDocuments({ isActive: true }),
                    user_model_1.User.countDocuments({ isDeleted: { $ne: true } }),
                    teacher_model_1.Teacher.countDocuments({ isDeleted: { $ne: true } })
                ]);
                if (categoryCount === 0) {
                    issues.push('No active categories found after seeding');
                }
                if (subCategoryCount === 0) {
                    issues.push('No active subcategories found after seeding');
                }
                if (userCount === 0) {
                    issues.push('No users found after seeding');
                }
                // Check admin user exists
                const adminUser = yield user_model_1.User.findOne({ email: 'admin@greenunimind.com' });
                if (!adminUser) {
                    issues.push('Super admin user not found after seeding');
                }
                // Check category-subcategory relationships
                const orphanedSubCategories = yield subCategory_model_1.SubCategory.countDocuments({
                    categoryId: { $nin: yield category_model_1.Category.find({ isActive: true }).distinct('_id') }
                });
                if (orphanedSubCategories > 0) {
                    issues.push(`Found ${orphanedSubCategories} orphaned subcategories`);
                }
                logger_1.Logger.info('🔍 Seeding verification completed', {
                    counts: { categoryCount, subCategoryCount, userCount, teacherCount },
                    issuesFound: issues.length
                });
                return {
                    valid: issues.length === 0,
                    issues
                };
            }
            catch (error) {
                issues.push(`Seeding verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                return { valid: false, issues };
            }
        });
    }
}
exports.DatabaseSeedingService = DatabaseSeedingService;
// Export singleton instance
exports.databaseSeedingService = new DatabaseSeedingService();
