import mongoose from 'mongoose';
import { Logger } from '../../config/logger';

// Import models for cleanup (excluding preserved ones)
import { Course } from '../../modules/Course/course.model';
import { Student } from '../../modules/Student/student.model';
import { Payment } from '../../modules/Payment/payment.model';
import { Transaction } from '../../modules/Payment/transaction.model';
import { Lecture } from '../../modules/Lecture/lecture.model';
import { Bookmark } from '../../modules/Bookmark/bookmark.model';
import { Question } from '../../modules/Question/question.model';
import { Note } from '../../modules/Note/note.model';
import { 
  CourseAnalytics, 
  StudentEngagement, 
  RevenueAnalytics, 
  PerformanceMetrics, 
  AnalyticsSummary, 
  Activity 
} from '../../modules/Analytics/analytics.model';
import { 
  Message, 
  Conversation, 
  MessageThread, 
  MessageNotification, 
  MessageSearchIndex 
} from '../../modules/Messaging/messaging.model';

// Import preserved models for reference
import { User } from '../../modules/User/user.model';
import { Teacher } from '../../modules/Teacher/teacher.model';
import { Category } from '../../modules/Category/category.model';
import { SubCategory } from '../../modules/SubCategory/subCategory.model';

export interface CleanupOptions {
  completeReset: boolean; // New option for complete database reset
  dryRun: boolean;
  batchSize: number;
  // Legacy options (deprecated but kept for compatibility)
  preserveUsers?: boolean;
  preserveTeachers?: boolean;
  preserveCategories?: boolean;
  preserveSubCategories?: boolean;
}

export interface CleanupResult {
  success: boolean;
  cleanedCounts: {
    users: number;
    teachers: number;
    categories: number;
    subCategories: number;
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
  totalCleaned: number;
}

export class DatabaseCleanupService {
  private readonly defaultOptions: CleanupOptions = {
    completeReset: true, // Default to complete reset
    dryRun: false,
    batchSize: 1000
  };

  /**
   * Perform complete database cleanup (reset all data)
   */
  async performCleanup(options: Partial<CleanupOptions> = {}): Promise<CleanupResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    Logger.info('🧹 Starting complete database cleanup...', { options: opts });

    const result: CleanupResult = {
      success: false,
      cleanedCounts: {
        users: 0, teachers: 0, categories: 0, subCategories: 0,
        courses: 0, students: 0, payments: 0, transactions: 0,
        lectures: 0, bookmarks: 0, questions: 0, notes: 0,
        analytics: 0, messages: 0, conversations: 0
      },
      errors: [],
      duration: 0,
      totalCleaned: 0
    };

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Perform complete cleanup of ALL models
        await this.performCompleteCleanup(result, opts, session);

        if (opts.dryRun) {
          Logger.info('🔍 Dry run completed - no actual changes made');
          await session.abortTransaction();
        } else {
          Logger.info('✅ Complete database cleanup transaction committed');
        }
      });

      result.success = true;
      result.duration = Date.now() - startTime;
      result.totalCleaned = Object.values(result.cleanedCounts).reduce((sum, count) => sum + count, 0);

      Logger.info('🎉 Complete database cleanup completed successfully', {
        duration: result.duration,
        totalCleaned: result.totalCleaned,
        cleanedCounts: result.cleanedCounts
      });

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.duration = Date.now() - startTime;

      Logger.error('❌ Database cleanup failed:', error);
      throw error;
    } finally {
      await session.endSession();
    }

    return result;
  }

  /**
   * Perform complete cleanup of ALL models
   */
  private async performCompleteCleanup(
    result: CleanupResult,
    options: CleanupOptions,
    session: mongoose.ClientSession
  ): Promise<void> {
    Logger.info('🧹 Performing complete database reset - cleaning ALL models...');

    // Clean up ALL models in reverse dependency order

    // 1. Analytics and activity data (no dependencies)
    result.cleanedCounts.analytics = await this.cleanupAllAnalytics(options, session);

    // 2. Messaging data
    const messagingCounts = await this.cleanupAllMessaging(options, session);
    result.cleanedCounts.messages = messagingCounts.messages;
    result.cleanedCounts.conversations = messagingCounts.conversations;

    // 3. User-generated content
    result.cleanedCounts.bookmarks = await this.cleanupAllBookmarks(options, session);
    result.cleanedCounts.questions = await this.cleanupAllQuestions(options, session);
    result.cleanedCounts.notes = await this.cleanupAllNotes(options, session);

    // 4. Payment and transaction data
    result.cleanedCounts.payments = await this.cleanupAllPayments(options, session);
    result.cleanedCounts.transactions = await this.cleanupAllTransactions(options, session);

    // 5. Lectures (depends on courses)
    result.cleanedCounts.lectures = await this.cleanupAllLectures(options, session);

    // 6. Courses
    result.cleanedCounts.courses = await this.cleanupAllCourses(options, session);

    // 7. Students
    result.cleanedCounts.students = await this.cleanupAllStudents(options, session);

    // 8. Teachers
    result.cleanedCounts.teachers = await this.cleanupAllTeachers(options, session);

    // 9. Sub-categories
    result.cleanedCounts.subCategories = await this.cleanupAllSubCategories(options, session);

    // 10. Categories
    result.cleanedCounts.categories = await this.cleanupAllCategories(options, session);

    // 11. Users (last, as everything depends on users)
    result.cleanedCounts.users = await this.cleanupAllUsers(options, session);

    Logger.info('🧹 Complete cleanup finished - ALL models cleaned');
  }

  /**
   * Clean up ALL analytics data
   */
  private async cleanupAllAnalytics(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    let totalCleaned = 0;

    const models = [
      CourseAnalytics, StudentEngagement, RevenueAnalytics,
      PerformanceMetrics, AnalyticsSummary, Activity
    ];

    for (const Model of models) {
      if (!options.dryRun) {
        const result = await (Model as any).deleteMany({}).session(session);
        totalCleaned += result.deletedCount || 0;
      } else {
        const count = await (Model as any).countDocuments({});
        totalCleaned += count;
      }
    }

    Logger.info(`🧹 Analytics complete cleanup: ${totalCleaned} records ${options.dryRun ? 'would be' : ''} removed`);
    return totalCleaned;
  }

  /**
   * Clean up ALL messaging data
   */
  private async cleanupAllMessaging(
    options: CleanupOptions,
    session: mongoose.ClientSession
  ): Promise<{ messages: number; conversations: number }> {
    let messages = 0;
    let conversations = 0;

    // Clean up messages first
    const messageModels = [Message, MessageThread, MessageNotification, MessageSearchIndex];
    for (const Model of messageModels) {
      if (!options.dryRun) {
        const result = await (Model as any).deleteMany({}).session(session);
        messages += result.deletedCount || 0;
      } else {
        const count = await (Model as any).countDocuments({});
        messages += count;
      }
    }

    // Clean up conversations
    if (!options.dryRun) {
      const result = await (Conversation as any).deleteMany({}).session(session);
      conversations = result.deletedCount || 0;
    } else {
      conversations = await (Conversation as any).countDocuments({});
    }

    Logger.info(`🧹 Messaging complete cleanup: ${messages} messages, ${conversations} conversations ${options.dryRun ? 'would be' : ''} removed`);
    return { messages, conversations };
  }

  /**
   * Clean up ALL user-generated content
   */
  private async cleanupAllBookmarks(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (Bookmark as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 Bookmarks complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (Bookmark as any).countDocuments({});
      Logger.info(`🧹 Bookmarks complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  private async cleanupAllQuestions(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (Question as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 Questions complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (Question as any).countDocuments({});
      Logger.info(`🧹 Questions complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  private async cleanupAllNotes(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (Note as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 Notes complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (Note as any).countDocuments({});
      Logger.info(`🧹 Notes complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  /**
   * Clean up ALL payment data
   */
  private async cleanupAllPayments(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (Payment as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 Payments complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (Payment as any).countDocuments({});
      Logger.info(`🧹 Payments complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  private async cleanupAllTransactions(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (Transaction as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 Transactions complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (Transaction as any).countDocuments({});
      Logger.info(`🧹 Transactions complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  /**
   * Clean up ALL lectures
   */
  private async cleanupAllLectures(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (Lecture as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 Lectures complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (Lecture as any).countDocuments({});
      Logger.info(`🧹 Lectures complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  /**
   * Clean up ALL courses
   */
  private async cleanupAllCourses(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (Course as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 Courses complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (Course as any).countDocuments({});
      Logger.info(`🧹 Courses complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  /**
   * Clean up ALL students
   */
  private async cleanupAllStudents(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (Student as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 Students complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (Student as any).countDocuments({});
      Logger.info(`🧹 Students complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  /**
   * Clean up ALL teachers
   */
  private async cleanupAllTeachers(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (Teacher as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 Teachers complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (Teacher as any).countDocuments({});
      Logger.info(`🧹 Teachers complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  /**
   * Clean up ALL sub-categories
   */
  private async cleanupAllSubCategories(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (SubCategory as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 SubCategories complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (SubCategory as any).countDocuments({});
      Logger.info(`🧹 SubCategories complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  /**
   * Clean up ALL categories
   */
  private async cleanupAllCategories(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (Category as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 Categories complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (Category as any).countDocuments({});
      Logger.info(`🧹 Categories complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  /**
   * Clean up ALL users
   */
  private async cleanupAllUsers(options: CleanupOptions, session: mongoose.ClientSession): Promise<number> {
    if (!options.dryRun) {
      const result = await (User as any).deleteMany({}).session(session);
      const count = result.deletedCount || 0;
      Logger.info(`🧹 Users complete cleanup: ${count} records removed`);
      return count;
    } else {
      const count = await (User as any).countDocuments({});
      Logger.info(`🧹 Users complete cleanup: ${count} records would be removed`);
      return count;
    }
  }

  /**
   * Verify data integrity after cleanup
   */
  async verifyIntegrity(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // After complete cleanup, verify that all models are empty
      const [
        userCount, teacherCount, categoryCount, subCategoryCount,
        courseCount, studentCount, paymentCount, transactionCount,
        lectureCount, bookmarkCount, questionCount, noteCount
      ] = await Promise.all([
        (User as any).countDocuments({}),
        (Teacher as any).countDocuments({}),
        (Category as any).countDocuments({}),
        (SubCategory as any).countDocuments({}),
        (Course as any).countDocuments({}),
        (Student as any).countDocuments({}),
        (Payment as any).countDocuments({}),
        (Transaction as any).countDocuments({}),
        (Lecture as any).countDocuments({}),
        (Bookmark as any).countDocuments({}),
        (Question as any).countDocuments({}),
        (Note as any).countDocuments({})
      ]);

      const counts = {
        users: userCount, teachers: teacherCount, categories: categoryCount,
        subCategories: subCategoryCount, courses: courseCount, students: studentCount,
        payments: paymentCount, transactions: transactionCount, lectures: lectureCount,
        bookmarks: bookmarkCount, questions: questionCount, notes: noteCount
      };

      // After complete cleanup, all counts should be 0
      Object.entries(counts).forEach(([model, count]) => {
        if (count > 0) {
          issues.push(`Found ${count} remaining ${model} records after complete cleanup`);
        }
      });

      Logger.info('🔍 Complete cleanup integrity verification completed', {
        counts,
        issuesFound: issues.length
      });

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error) {
      issues.push(`Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, issues };
    }
  }
}

// Export singleton instance
export const databaseCleanupService = new DatabaseCleanupService();
