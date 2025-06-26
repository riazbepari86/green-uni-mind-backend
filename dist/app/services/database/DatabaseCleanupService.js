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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseCleanupService = exports.DatabaseCleanupService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../../config/logger");
// Import models for cleanup (excluding preserved ones)
const course_model_1 = require("../../modules/Course/course.model");
const student_model_1 = require("../../modules/Student/student.model");
const payment_model_1 = require("../../modules/Payment/payment.model");
const transaction_model_1 = require("../../modules/Payment/transaction.model");
const lecture_model_1 = require("../../modules/Lecture/lecture.model");
const bookmark_model_1 = require("../../modules/Bookmark/bookmark.model");
const question_model_1 = require("../../modules/Question/question.model");
const note_model_1 = require("../../modules/Note/note.model");
const analytics_model_1 = require("../../modules/Analytics/analytics.model");
const messaging_model_1 = require("../../modules/Messaging/messaging.model");
// Import preserved models for reference
const user_model_1 = require("../../modules/User/user.model");
const teacher_model_1 = require("../../modules/Teacher/teacher.model");
const category_model_1 = require("../../modules/Category/category.model");
const subCategory_model_1 = require("../../modules/SubCategory/subCategory.model");
class DatabaseCleanupService {
    constructor() {
        this.defaultOptions = {
            completeReset: true, // Default to complete reset
            dryRun: false,
            batchSize: 1000
        };
    }
    /**
     * Perform complete database cleanup (reset all data)
     */
    performCleanup() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            const startTime = Date.now();
            const opts = Object.assign(Object.assign({}, this.defaultOptions), options);
            logger_1.Logger.info('🧹 Starting complete database cleanup...', { options: opts });
            const result = {
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
            const session = yield mongoose_1.default.startSession();
            try {
                yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    // Perform complete cleanup of ALL models
                    yield this.performCompleteCleanup(result, opts, session);
                    if (opts.dryRun) {
                        logger_1.Logger.info('🔍 Dry run completed - no actual changes made');
                        yield session.abortTransaction();
                    }
                    else {
                        logger_1.Logger.info('✅ Complete database cleanup transaction committed');
                    }
                }));
                result.success = true;
                result.duration = Date.now() - startTime;
                result.totalCleaned = Object.values(result.cleanedCounts).reduce((sum, count) => sum + count, 0);
                logger_1.Logger.info('🎉 Complete database cleanup completed successfully', {
                    duration: result.duration,
                    totalCleaned: result.totalCleaned,
                    cleanedCounts: result.cleanedCounts
                });
            }
            catch (error) {
                result.errors.push(error instanceof Error ? error.message : 'Unknown error');
                result.duration = Date.now() - startTime;
                logger_1.Logger.error('❌ Database cleanup failed:', error);
                throw error;
            }
            finally {
                yield session.endSession();
            }
            return result;
        });
    }
    /**
     * Perform complete cleanup of ALL models
     */
    performCompleteCleanup(result, options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🧹 Performing complete database reset - cleaning ALL models...');
            // Clean up ALL models in reverse dependency order
            // 1. Analytics and activity data (no dependencies)
            result.cleanedCounts.analytics = yield this.cleanupAllAnalytics(options, session);
            // 2. Messaging data
            const messagingCounts = yield this.cleanupAllMessaging(options, session);
            result.cleanedCounts.messages = messagingCounts.messages;
            result.cleanedCounts.conversations = messagingCounts.conversations;
            // 3. User-generated content
            result.cleanedCounts.bookmarks = yield this.cleanupAllBookmarks(options, session);
            result.cleanedCounts.questions = yield this.cleanupAllQuestions(options, session);
            result.cleanedCounts.notes = yield this.cleanupAllNotes(options, session);
            // 4. Payment and transaction data
            result.cleanedCounts.payments = yield this.cleanupAllPayments(options, session);
            result.cleanedCounts.transactions = yield this.cleanupAllTransactions(options, session);
            // 5. Lectures (depends on courses)
            result.cleanedCounts.lectures = yield this.cleanupAllLectures(options, session);
            // 6. Courses
            result.cleanedCounts.courses = yield this.cleanupAllCourses(options, session);
            // 7. Students
            result.cleanedCounts.students = yield this.cleanupAllStudents(options, session);
            // 8. Teachers
            result.cleanedCounts.teachers = yield this.cleanupAllTeachers(options, session);
            // 9. Sub-categories
            result.cleanedCounts.subCategories = yield this.cleanupAllSubCategories(options, session);
            // 10. Categories
            result.cleanedCounts.categories = yield this.cleanupAllCategories(options, session);
            // 11. Users (last, as everything depends on users)
            result.cleanedCounts.users = yield this.cleanupAllUsers(options, session);
            logger_1.Logger.info('🧹 Complete cleanup finished - ALL models cleaned');
        });
    }
    /**
     * Clean up ALL analytics data
     */
    cleanupAllAnalytics(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            let totalCleaned = 0;
            const models = [
                analytics_model_1.CourseAnalytics, analytics_model_1.StudentEngagement, analytics_model_1.RevenueAnalytics,
                analytics_model_1.PerformanceMetrics, analytics_model_1.AnalyticsSummary, analytics_model_1.Activity
            ];
            for (const Model of models) {
                if (!options.dryRun) {
                    const result = yield Model.deleteMany({}).session(session);
                    totalCleaned += result.deletedCount || 0;
                }
                else {
                    const count = yield Model.countDocuments({});
                    totalCleaned += count;
                }
            }
            logger_1.Logger.info(`🧹 Analytics complete cleanup: ${totalCleaned} records ${options.dryRun ? 'would be' : ''} removed`);
            return totalCleaned;
        });
    }
    /**
     * Clean up ALL messaging data
     */
    cleanupAllMessaging(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            let messages = 0;
            let conversations = 0;
            // Clean up messages first
            const messageModels = [messaging_model_1.Message, messaging_model_1.MessageThread, messaging_model_1.MessageNotification, messaging_model_1.MessageSearchIndex];
            for (const Model of messageModels) {
                if (!options.dryRun) {
                    const result = yield Model.deleteMany({}).session(session);
                    messages += result.deletedCount || 0;
                }
                else {
                    const count = yield Model.countDocuments({});
                    messages += count;
                }
            }
            // Clean up conversations
            if (!options.dryRun) {
                const result = yield messaging_model_1.Conversation.deleteMany({}).session(session);
                conversations = result.deletedCount || 0;
            }
            else {
                conversations = yield messaging_model_1.Conversation.countDocuments({});
            }
            logger_1.Logger.info(`🧹 Messaging complete cleanup: ${messages} messages, ${conversations} conversations ${options.dryRun ? 'would be' : ''} removed`);
            return { messages, conversations };
        });
    }
    /**
     * Clean up ALL user-generated content
     */
    cleanupAllBookmarks(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield bookmark_model_1.Bookmark.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 Bookmarks complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield bookmark_model_1.Bookmark.countDocuments({});
                logger_1.Logger.info(`🧹 Bookmarks complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    cleanupAllQuestions(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield question_model_1.Question.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 Questions complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield question_model_1.Question.countDocuments({});
                logger_1.Logger.info(`🧹 Questions complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    cleanupAllNotes(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield note_model_1.Note.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 Notes complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield note_model_1.Note.countDocuments({});
                logger_1.Logger.info(`🧹 Notes complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    /**
     * Clean up ALL payment data
     */
    cleanupAllPayments(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield payment_model_1.Payment.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 Payments complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield payment_model_1.Payment.countDocuments({});
                logger_1.Logger.info(`🧹 Payments complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    cleanupAllTransactions(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield transaction_model_1.Transaction.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 Transactions complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield transaction_model_1.Transaction.countDocuments({});
                logger_1.Logger.info(`🧹 Transactions complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    /**
     * Clean up ALL lectures
     */
    cleanupAllLectures(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield lecture_model_1.Lecture.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 Lectures complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield lecture_model_1.Lecture.countDocuments({});
                logger_1.Logger.info(`🧹 Lectures complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    /**
     * Clean up ALL courses
     */
    cleanupAllCourses(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield course_model_1.Course.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 Courses complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield course_model_1.Course.countDocuments({});
                logger_1.Logger.info(`🧹 Courses complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    /**
     * Clean up ALL students
     */
    cleanupAllStudents(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield student_model_1.Student.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 Students complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield student_model_1.Student.countDocuments({});
                logger_1.Logger.info(`🧹 Students complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    /**
     * Clean up ALL teachers
     */
    cleanupAllTeachers(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield teacher_model_1.Teacher.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 Teachers complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield teacher_model_1.Teacher.countDocuments({});
                logger_1.Logger.info(`🧹 Teachers complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    /**
     * Clean up ALL sub-categories
     */
    cleanupAllSubCategories(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield subCategory_model_1.SubCategory.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 SubCategories complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield subCategory_model_1.SubCategory.countDocuments({});
                logger_1.Logger.info(`🧹 SubCategories complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    /**
     * Clean up ALL categories
     */
    cleanupAllCategories(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield category_model_1.Category.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 Categories complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield category_model_1.Category.countDocuments({});
                logger_1.Logger.info(`🧹 Categories complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    /**
     * Clean up ALL users
     */
    cleanupAllUsers(options, session) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.dryRun) {
                const result = yield user_model_1.User.deleteMany({}).session(session);
                const count = result.deletedCount || 0;
                logger_1.Logger.info(`🧹 Users complete cleanup: ${count} records removed`);
                return count;
            }
            else {
                const count = yield user_model_1.User.countDocuments({});
                logger_1.Logger.info(`🧹 Users complete cleanup: ${count} records would be removed`);
                return count;
            }
        });
    }
    /**
     * Verify data integrity after cleanup
     */
    verifyIntegrity() {
        return __awaiter(this, void 0, void 0, function* () {
            const issues = [];
            try {
                // After complete cleanup, verify that all models are empty
                const [userCount, teacherCount, categoryCount, subCategoryCount, courseCount, studentCount, paymentCount, transactionCount, lectureCount, bookmarkCount, questionCount, noteCount] = yield Promise.all([
                    user_model_1.User.countDocuments({}),
                    teacher_model_1.Teacher.countDocuments({}),
                    category_model_1.Category.countDocuments({}),
                    subCategory_model_1.SubCategory.countDocuments({}),
                    course_model_1.Course.countDocuments({}),
                    student_model_1.Student.countDocuments({}),
                    payment_model_1.Payment.countDocuments({}),
                    transaction_model_1.Transaction.countDocuments({}),
                    lecture_model_1.Lecture.countDocuments({}),
                    bookmark_model_1.Bookmark.countDocuments({}),
                    question_model_1.Question.countDocuments({}),
                    note_model_1.Note.countDocuments({})
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
                logger_1.Logger.info('🔍 Complete cleanup integrity verification completed', {
                    counts,
                    issuesFound: issues.length
                });
                return {
                    valid: issues.length === 0,
                    issues
                };
            }
            catch (error) {
                issues.push(`Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                return { valid: false, issues };
            }
        });
    }
}
exports.DatabaseCleanupService = DatabaseCleanupService;
// Export singleton instance
exports.databaseCleanupService = new DatabaseCleanupService();
