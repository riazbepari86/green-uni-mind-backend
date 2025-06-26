import mongoose from 'mongoose';
import { Logger } from '../../config/logger';
import { Category } from '../../modules/Category/category.model';
import { SubCategory } from '../../modules/SubCategory/subCategory.model';
import { User } from '../../modules/User/user.model';
import { Teacher } from '../../modules/Teacher/teacher.model';
import config from '../../config';

export interface SeedingOptions {
  seedCategories: boolean;
  seedSubCategories: boolean;
  seedDefaultUsers: boolean;
  seedDefaultTeachers: boolean;
  seedEmptyModels: boolean; // New option to seed all models with empty/default states
  seedSampleData: boolean;
  overwriteExisting: boolean;
}

export interface SeedingResult {
  success: boolean;
  seededCounts: {
    categories: number;
    subCategories: number;
    users: number;
    teachers: number;
    courses: number;
    students: number;
    payments: number;
    transactions: number;
    lectures: number;
    bookmarks: number;
    questions: number;
    notes: number;
    analytics: number;
    messages: number;
    conversations: number;
  };
  errors: string[];
  duration: number;
}

export class DatabaseSeedingService {
  private readonly defaultOptions: SeedingOptions = {
    seedCategories: true,
    seedSubCategories: true,
    seedDefaultUsers: true,
    seedDefaultTeachers: true,
    seedEmptyModels: true,
    seedSampleData: false,
    overwriteExisting: false
  };

  /**
   * Perform database seeding with default values
   */
  async performSeeding(options: Partial<SeedingOptions> = {}): Promise<SeedingResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    
    Logger.info('🌱 Starting database seeding...', { options: opts });

    const result: SeedingResult = {
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

    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Seed in dependency order
        if (opts.seedCategories) {
          result.seededCounts.categories = await this.seedCategories(opts, session);
        }

        if (opts.seedSubCategories) {
          result.seededCounts.subCategories = await this.seedSubCategories(opts, session);
        }

        if (opts.seedDefaultUsers) {
          const userCounts = await this.seedDefaultUsers(opts, session);
          result.seededCounts.users = userCounts.users;
          result.seededCounts.teachers = userCounts.teachers;
        }

        if (opts.seedEmptyModels) {
          // Seed all other models with their default/empty states
          const emptyCounts = await this.seedEmptyModels(opts, session);
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
      });

      result.success = true;
      result.duration = Date.now() - startTime;
      
      Logger.info('🎉 Database seeding completed successfully', {
        duration: result.duration,
        seededCounts: result.seededCounts
      });

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.duration = Date.now() - startTime;
      
      Logger.error('❌ Database seeding failed:', error);
      throw error;
    } finally {
      await session.endSession();
    }

    return result;
  }

  /**
   * Seed default categories
   */
  private async seedCategories(options: SeedingOptions, session: mongoose.ClientSession): Promise<number> {
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
      const existingCategory = await Category.findOne({ slug: categoryData.slug }).session(session);
      
      if (!existingCategory || options.overwriteExisting) {
        if (existingCategory && options.overwriteExisting) {
          await Category.findByIdAndUpdate(existingCategory._id, categoryData).session(session);
        } else {
          await Category.create([categoryData], { session });
        }
        seededCount++;
      }
    }

    Logger.info(`🌱 Categories seeding: ${seededCount} categories seeded`);
    return seededCount;
  }

  /**
   * Seed default subcategories
   */
  private async seedSubCategories(options: SeedingOptions, session: mongoose.ClientSession): Promise<number> {
    // Get categories first
    const categories = await Category.find({ isActive: true }).session(session);
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
        Logger.warn(`Category not found for slug: ${subCatData.categorySlug}`);
        continue;
      }

      const existingSubCategory = await SubCategory.findOne({ 
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
          await SubCategory.findByIdAndUpdate(existingSubCategory._id, subCategoryData).session(session);
        } else {
          await SubCategory.create([subCategoryData], { session });
        }
        seededCount++;
      }
    }

    Logger.info(`🌱 SubCategories seeding: ${seededCount} subcategories seeded`);
    return seededCount;
  }

  /**
   * Seed default users and admin accounts
   */
  private async seedDefaultUsers(
    options: SeedingOptions, 
    session: mongoose.ClientSession
  ): Promise<{ users: number; teachers: number }> {
    let userCount = 0;
    let teacherCount = 0;

    // Create super admin if not exists
    const superAdminEmail = 'admin@greenunimind.com';
    const existingSuperAdmin = await User.findOne({ email: superAdminEmail }).session(session);
    
    if (!existingSuperAdmin || options.overwriteExisting) {
      // Use plain text password - the User model will hash it automatically
      const superAdminData = {
        email: superAdminEmail,
        password: config.super_admin_password || 'Admin123!@#',
        role: 'user', // Using 'user' as per the existing pattern
        status: 'in-progress',
        isDeleted: false,
        isVerified: true,
        photoUrl: ''
      };

      if (existingSuperAdmin && options.overwriteExisting) {
        await User.findByIdAndUpdate(existingSuperAdmin._id, superAdminData).session(session);
      } else {
        await User.create([superAdminData], { session });
      }
      userCount++;
    }

    // Create demo teacher account
    const demoTeacherEmail = 'teacher@greenunimind.com';
    const existingDemoTeacher = await User.findOne({ email: demoTeacherEmail }).session(session);
    
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
        await User.findByIdAndUpdate(existingDemoTeacher._id, demoTeacherUserData).session(session);
        teacherUserId = existingDemoTeacher._id;
      } else {
        const [createdUser] = await User.create([demoTeacherUserData], { session });
        teacherUserId = createdUser._id;
      }
      userCount++;

      // Create teacher profile
      const existingTeacherProfile = await Teacher.findOne({ email: demoTeacherEmail }).session(session);
      
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
          await Teacher.findByIdAndUpdate(existingTeacherProfile._id, teacherProfileData).session(session);
        } else {
          await Teacher.create([teacherProfileData], { session });
        }
        teacherCount++;
      }
    }

    Logger.info(`🌱 Users seeding: ${userCount} users, ${teacherCount} teachers seeded`);
    return { users: userCount, teachers: teacherCount };
  }

  /**
   * Seed all models with their default/empty states
   */
  private async seedEmptyModels(
    _options: SeedingOptions,
    session: mongoose.ClientSession
  ): Promise<{
    courses: number;
    students: number;
    payments: number;
    transactions: number;
    lectures: number;
    bookmarks: number;
    questions: number;
    notes: number;
    analytics: number;
    messages: number;
    conversations: number;
  }> {
    Logger.info('🌱 Seeding all models with default/empty states...');

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
    const { Course } = await import('../../modules/Course/course.model');
    const { Student } = await import('../../modules/Student/student.model');
    const { Payment } = await import('../../modules/Payment/payment.model');
    const { Transaction } = await import('../../modules/Payment/transaction.model');
    const { Lecture } = await import('../../modules/Lecture/lecture.model');
    const { Bookmark } = await import('../../modules/Bookmark/bookmark.model');
    const { Question } = await import('../../modules/Question/question.model');
    const { Note } = await import('../../modules/Note/note.model');

    // Ensure collections exist by checking if they exist (this creates them if they don't)
    await Promise.all([
      Course.countDocuments({}).session(session),
      Student.countDocuments({}).session(session),
      Payment.countDocuments({}).session(session),
      Transaction.countDocuments({}).session(session),
      Lecture.countDocuments({}).session(session),
      Bookmark.countDocuments({}).session(session),
      Question.countDocuments({}).session(session),
      Note.countDocuments({}).session(session)
    ]);

    Logger.info('🌱 All model collections initialized with empty states');
    return counts;
  }

  /**
   * Reset all models to default empty state
   */
  async resetToDefaults(): Promise<SeedingResult> {
    Logger.info('🔄 Resetting database to complete fresh state...');

    // First perform complete cleanup (remove ALL data)
    const { databaseCleanupService } = await import('./DatabaseCleanupService');
    await databaseCleanupService.performCleanup({
      completeReset: true, // Complete reset - remove everything
      dryRun: false
    });

    // Then perform complete seeding
    return await this.performSeeding({
      seedCategories: true,
      seedSubCategories: true,
      seedDefaultUsers: true,
      seedDefaultTeachers: true,
      seedEmptyModels: true, // Seed all models with empty states
      seedSampleData: false,
      overwriteExisting: true
    });
  }

  /**
   * Verify seeded data integrity
   */
  async verifySeeding(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check essential data exists
      const [categoryCount, subCategoryCount, userCount, teacherCount] = await Promise.all([
        Category.countDocuments({ isActive: true }),
        SubCategory.countDocuments({ isActive: true }),
        User.countDocuments({ isDeleted: { $ne: true } }),
        Teacher.countDocuments({ isDeleted: { $ne: true } })
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
      const adminUser = await User.findOne({ email: 'admin@greenunimind.com' });
      if (!adminUser) {
        issues.push('Super admin user not found after seeding');
      }

      // Check category-subcategory relationships
      const orphanedSubCategories = await SubCategory.countDocuments({
        categoryId: { $nin: await Category.find({ isActive: true }).distinct('_id') }
      });

      if (orphanedSubCategories > 0) {
        issues.push(`Found ${orphanedSubCategories} orphaned subcategories`);
      }

      Logger.info('🔍 Seeding verification completed', {
        counts: { categoryCount, subCategoryCount, userCount, teacherCount },
        issuesFound: issues.length
      });

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error) {
      issues.push(`Seeding verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, issues };
    }
  }
}

// Export singleton instance
export const databaseSeedingService = new DatabaseSeedingService();
