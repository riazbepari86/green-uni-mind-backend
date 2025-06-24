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
exports.optimizeDatabase = optimizeDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../config/logger");
const config_1 = __importDefault(require("../config"));
/**
 * Database optimization script to create proper indexes for analytics, messaging, and other collections
 */
class DatabaseOptimizer {
    constructor() {
        this.db = mongoose_1.default.connection;
    }
    /**
     * Run all database optimizations
     */
    optimize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.Logger.info('🔧 Starting database optimization...');
                // Connect to MongoDB if not already connected
                if (this.db.readyState !== 1) {
                    yield mongoose_1.default.connect(config_1.default.database_url);
                    logger_1.Logger.info('📊 Connected to MongoDB for optimization');
                }
                // Create indexes for all collections
                yield this.createAnalyticsIndexes();
                yield this.createMessagingIndexes();
                yield this.createCoreIndexes();
                yield this.createPaymentIndexes();
                // Analyze and optimize existing collections
                yield this.analyzeCollectionStats();
                logger_1.Logger.info('✅ Database optimization completed successfully');
            }
            catch (error) {
                logger_1.Logger.error('❌ Database optimization failed:', error);
                throw error;
            }
        });
    }
    /**
     * Create indexes for analytics collections
     */
    createAnalyticsIndexes() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('📈 Creating analytics indexes...');
            const analyticsIndexes = [
                {
                    collection: 'courseanalytics',
                    indexes: [
                        { name: 'teacherId_courseId_unique', key: { teacherId: 1, courseId: 1 }, options: { unique: true } },
                        { name: 'teacherId_lastUpdated', key: { teacherId: 1, lastUpdated: -1 } },
                        { name: 'courseId_completionRate', key: { courseId: 1, completionRate: -1 } },
                        { name: 'totalEnrollments_desc', key: { totalEnrollments: -1 } },
                        { name: 'lastUpdated_desc', key: { lastUpdated: -1 } },
                    ],
                },
                {
                    collection: 'studentengagements',
                    indexes: [
                        { name: 'teacherId_courseId_studentId_unique', key: { teacherId: 1, courseId: 1, studentId: 1 }, options: { unique: true } },
                        { name: 'teacherId_engagementScore', key: { teacherId: 1, engagementScore: -1 } },
                        { name: 'courseId_lastActivity', key: { courseId: 1, lastActivity: -1 } },
                        { name: 'studentId_lastActivity', key: { studentId: 1, lastActivity: -1 } },
                        { name: 'engagementScore_desc', key: { engagementScore: -1 } },
                        { name: 'lastActivity_desc', key: { lastActivity: -1 } },
                    ],
                },
                {
                    collection: 'revenueanalytics',
                    indexes: [
                        { name: 'teacherId_courseId', key: { teacherId: 1, courseId: 1 } },
                        { name: 'teacherId_totalRevenue', key: { teacherId: 1, totalRevenue: -1 } },
                        { name: 'lastUpdated_desc', key: { lastUpdated: -1 } },
                        { name: 'totalRevenue_desc', key: { totalRevenue: -1 } },
                    ],
                },
                {
                    collection: 'performancemetrics',
                    indexes: [
                        { name: 'teacherId_courseId', key: { teacherId: 1, courseId: 1 } },
                        { name: 'teacherId_averageRating', key: { teacherId: 1, averageRating: -1 } },
                        { name: 'averageRating_desc', key: { averageRating: -1 } },
                        { name: 'courseCompletionRate_desc', key: { courseCompletionRate: -1 } },
                        { name: 'lastUpdated_desc', key: { lastUpdated: -1 } },
                    ],
                },
                {
                    collection: 'analyticssummaries',
                    indexes: [
                        { name: 'teacherId_period_dateRange', key: { teacherId: 1, period: 1, 'dateRange.startDate': 1 } },
                        { name: 'teacherId_generatedAt', key: { teacherId: 1, generatedAt: -1 } },
                        { name: 'generatedAt_desc', key: { generatedAt: -1 } },
                    ],
                },
                {
                    collection: 'activities',
                    indexes: [
                        { name: 'teacherId_createdAt', key: { teacherId: 1, createdAt: -1 } },
                        { name: 'teacherId_isRead_priority', key: { teacherId: 1, isRead: 1, priority: -1 } },
                        { name: 'teacherId_type_createdAt', key: { teacherId: 1, type: 1, createdAt: -1 } },
                        { name: 'courseId_createdAt', key: { courseId: 1, createdAt: -1 } },
                        { name: 'studentId_createdAt', key: { studentId: 1, createdAt: -1 } },
                        { name: 'type_priority_createdAt', key: { type: 1, priority: -1, createdAt: -1 } },
                        { name: 'actionRequired_createdAt', key: { actionRequired: 1, createdAt: -1 } },
                    ],
                },
            ];
            yield this.createIndexesForCollections(analyticsIndexes);
            logger_1.Logger.info('✅ Analytics indexes created');
        });
    }
    /**
     * Create indexes for messaging collections
     */
    createMessagingIndexes() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('💬 Creating messaging indexes...');
            const messagingIndexes = [
                {
                    collection: 'conversations',
                    indexes: [
                        { name: 'teacherId_studentId_courseId_unique', key: { teacherId: 1, studentId: 1, courseId: 1 }, options: { unique: true } },
                        { name: 'teacherId_lastMessageAt', key: { teacherId: 1, lastMessageAt: -1 } },
                        { name: 'studentId_lastMessageAt', key: { studentId: 1, lastMessageAt: -1 } },
                        { name: 'courseId_isActive', key: { courseId: 1, isActive: 1 } },
                        { name: 'isActive_isArchived', key: { isActive: 1, isArchived: 1 } },
                        { name: 'lastMessageAt_desc', key: { lastMessageAt: -1 } },
                    ],
                },
                {
                    collection: 'messages',
                    indexes: [
                        { name: 'conversationId_createdAt', key: { conversationId: 1, createdAt: -1 } },
                        { name: 'senderId_receiverId_createdAt', key: { senderId: 1, receiverId: 1, createdAt: -1 } },
                        { name: 'courseId_createdAt', key: { courseId: 1, createdAt: -1 } },
                        { name: 'status_createdAt', key: { status: 1, createdAt: -1 } },
                        { name: 'messageType_createdAt', key: { messageType: 1, createdAt: -1 } },
                        { name: 'receiverId_status', key: { receiverId: 1, status: 1 } },
                        { name: 'replyTo_createdAt', key: { replyTo: 1, createdAt: -1 } },
                    ],
                },
                {
                    collection: 'messagethreads',
                    indexes: [
                        { name: 'conversationId_isResolved', key: { conversationId: 1, isResolved: 1 } },
                        { name: 'parentMessageId', key: { parentMessageId: 1 } },
                        { name: 'priority_createdAt', key: { priority: -1, createdAt: -1 } },
                    ],
                },
                {
                    collection: 'messagenotifications',
                    indexes: [
                        { name: 'userId_isRead_createdAt', key: { userId: 1, isRead: 1, createdAt: -1 } },
                        { name: 'conversationId_createdAt', key: { conversationId: 1, createdAt: -1 } },
                        { name: 'messageId', key: { messageId: 1 } },
                        { name: 'userType_isRead', key: { userType: 1, isRead: 1 } },
                    ],
                },
                {
                    collection: 'messagesearchindices',
                    indexes: [
                        { name: 'messageId_unique', key: { messageId: 1 }, options: { unique: true } },
                        { name: 'teacherId_createdAt', key: { teacherId: 1, createdAt: -1 } },
                        { name: 'courseId_createdAt', key: { courseId: 1, createdAt: -1 } },
                        { name: 'conversationId_createdAt', key: { conversationId: 1, createdAt: -1 } },
                        { name: 'searchableContent_text', key: { searchableContent: 'text', attachmentNames: 'text' } },
                    ],
                },
            ];
            yield this.createIndexesForCollections(messagingIndexes);
            logger_1.Logger.info('✅ Messaging indexes created');
        });
    }
    /**
     * Create indexes for core collections (courses, students, teachers)
     */
    createCoreIndexes() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🏗️ Creating core collection indexes...');
            const coreIndexes = [
                {
                    collection: 'courses',
                    indexes: [
                        { name: 'creator_isPublished', key: { creator: 1, isPublished: 1 } },
                        { name: 'categoryId_subcategoryId', key: { categoryId: 1, subcategoryId: 1 } },
                        { name: 'isPublished_status', key: { isPublished: 1, status: 1 } },
                        { name: 'totalEnrollment_desc', key: { totalEnrollment: -1 } },
                        { name: 'createdAt_desc', key: { createdAt: -1 } },
                        { name: 'title_description_text', key: { title: 'text', description: 'text' } },
                    ],
                },
                {
                    collection: 'students',
                    indexes: [
                        { name: 'user_unique', key: { user: 1 }, options: { unique: true } },
                        { name: 'email_unique', key: { email: 1 }, options: { unique: true } },
                        { name: 'isDeleted', key: { isDeleted: 1 } },
                        { name: 'enrolledCourses_courseId', key: { 'enrolledCourses.courseId': 1 } },
                        { name: 'enrolledCourses_enrolledAt', key: { 'enrolledCourses.enrolledAt': -1 } },
                    ],
                },
                {
                    collection: 'teachers',
                    indexes: [
                        { name: 'user_unique', key: { user: 1 }, options: { unique: true } },
                        { name: 'email_unique', key: { email: 1 }, options: { unique: true } },
                        { name: 'isDeleted', key: { isDeleted: 1 } },
                        { name: 'stripeVerified', key: { stripeVerified: 1 } },
                        { name: 'averageRating_desc', key: { averageRating: -1 } },
                        { name: 'totalEarnings_desc', key: { totalEarnings: -1 } },
                    ],
                },
            ];
            yield this.createIndexesForCollections(coreIndexes);
            logger_1.Logger.info('✅ Core collection indexes created');
        });
    }
    /**
     * Create indexes for payment collections
     */
    createPaymentIndexes() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('💳 Creating payment indexes...');
            const paymentIndexes = [
                {
                    collection: 'payments',
                    indexes: [
                        { name: 'teacherId_status', key: { teacherId: 1, status: 1 } },
                        { name: 'studentId_courseId', key: { studentId: 1, courseId: 1 } },
                        { name: 'courseId_createdAt', key: { courseId: 1, createdAt: -1 } },
                        { name: 'status_createdAt', key: { status: 1, createdAt: -1 } },
                        { name: 'stripePaymentId', key: { stripePaymentId: 1 } },
                        { name: 'amount_desc', key: { amount: -1 } },
                    ],
                },
                {
                    collection: 'transactions',
                    indexes: [
                        { name: 'teacherId_createdAt', key: { teacherId: 1, createdAt: -1 } },
                        { name: 'studentId_courseId', key: { studentId: 1, courseId: 1 } },
                        { name: 'stripeTransactionId_unique', key: { stripeTransactionId: 1 }, options: { unique: true } },
                        { name: 'stripeTransferStatus', key: { stripeTransferStatus: 1 } },
                        { name: 'totalAmount_desc', key: { totalAmount: -1 } },
                    ],
                },
            ];
            yield this.createIndexesForCollections(paymentIndexes);
            logger_1.Logger.info('✅ Payment indexes created');
        });
    }
    /**
     * Create indexes for multiple collections
     */
    createIndexesForCollections(collectionsInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const collectionInfo of collectionsInfo) {
                try {
                    const collection = this.db.collection(collectionInfo.collection);
                    for (const indexInfo of collectionInfo.indexes) {
                        try {
                            yield collection.createIndex(indexInfo.key, Object.assign({ name: indexInfo.name, background: true }, indexInfo.options));
                            logger_1.Logger.info(`  ✓ Created index ${indexInfo.name} on ${collectionInfo.collection}`);
                        }
                        catch (error) {
                            if (error.code === 85) {
                                // Index already exists with different options
                                logger_1.Logger.warn(`  ⚠️ Index ${indexInfo.name} already exists on ${collectionInfo.collection} with different options`);
                            }
                            else if (error.code === 11000) {
                                // Index already exists
                                logger_1.Logger.info(`  ℹ️ Index ${indexInfo.name} already exists on ${collectionInfo.collection}`);
                            }
                            else {
                                logger_1.Logger.error(`  ❌ Failed to create index ${indexInfo.name} on ${collectionInfo.collection}:`, error);
                            }
                        }
                    }
                }
                catch (error) {
                    logger_1.Logger.error(`❌ Failed to access collection ${collectionInfo.collection}:`, error);
                }
            }
        });
    }
    /**
     * Analyze collection statistics for optimization insights
     */
    analyzeCollectionStats() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('📊 Analyzing collection statistics...');
            const collections = [
                'courses', 'students', 'teachers', 'payments', 'transactions',
                'courseanalytics', 'studentengagements', 'revenueanalytics', 'performancemetrics',
                'activities', 'conversations', 'messages', 'messagenotifications'
            ];
            for (const collectionName of collections) {
                try {
                    const collection = this.db.collection(collectionName);
                    const stats = yield collection.stats();
                    logger_1.Logger.info(`📈 ${collectionName}: ${stats.count} documents, ${Math.round(stats.size / 1024 / 1024 * 100) / 100}MB`);
                    // Check if collection is large and might benefit from additional optimization
                    if (stats.count > 10000) {
                        logger_1.Logger.info(`  💡 Large collection detected: Consider implementing data archiving for ${collectionName}`);
                    }
                    if (stats.avgObjSize > 10000) {
                        logger_1.Logger.info(`  💡 Large documents detected in ${collectionName}: Consider document size optimization`);
                    }
                }
                catch (error) {
                    logger_1.Logger.warn(`⚠️ Could not analyze stats for ${collectionName}:`, error);
                }
            }
        });
    }
    /**
     * Drop unused indexes (cleanup)
     */
    dropUnusedIndexes() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🧹 Checking for unused indexes...');
            // This would require MongoDB 4.4+ with $indexStats aggregation
            // For now, we'll just log that this feature is available
            logger_1.Logger.info('💡 To identify unused indexes, use MongoDB Compass or db.collection.aggregate([{$indexStats: {}}])');
        });
    }
}
/**
 * Main optimization function
 */
function optimizeDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        const optimizer = new DatabaseOptimizer();
        yield optimizer.optimize();
    });
}
/**
 * CLI script runner
 */
if (require.main === module) {
    optimizeDatabase()
        .then(() => {
        logger_1.Logger.info('🎉 Database optimization completed successfully');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.Logger.error('💥 Database optimization failed:', error);
        process.exit(1);
    });
}
exports.default = DatabaseOptimizer;
