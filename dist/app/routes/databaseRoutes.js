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
const express_1 = require("express");
const DatabaseCleanupService_1 = require("../services/database/DatabaseCleanupService");
const DatabaseSeedingService_1 = require("../services/database/DatabaseSeedingService");
// SSE services removed - using standard API patterns
const AuthAuditService_1 = require("../services/audit/AuthAuditService");
const logger_1 = require("../config/logger");
const auth_1 = __importDefault(require("../middlewares/auth"));
const router = (0, express_1.Router)();
/**
 * Get comprehensive database status
 * GET /api/database/status
 */
router.get('/status', (0, auth_1.default)('admin'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [cleanupIntegrity, seedingIntegrity, authMetrics] = yield Promise.all([
            DatabaseCleanupService_1.databaseCleanupService.verifyIntegrity(),
            DatabaseSeedingService_1.databaseSeedingService.verifySeeding(),
            AuthAuditService_1.authAuditService.getMetrics()
        ]);
        res.json({
            success: true,
            data: {
                database: {
                    cleanup: {
                        valid: cleanupIntegrity.valid,
                        issues: cleanupIntegrity.issues
                    },
                    seeding: {
                        valid: seedingIntegrity.valid,
                        issues: seedingIntegrity.issues
                    }
                },
                authentication: {
                    metrics: authMetrics
                },
                overall: {
                    healthy: cleanupIntegrity.valid && seedingIntegrity.valid,
                    timestamp: new Date()
                }
            }
        });
    }
    catch (error) {
        logger_1.Logger.error('❌ Failed to get database status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to retrieve database status'
        });
    }
}));
/**
 * Perform database cleanup (admin only)
 * POST /api/database/cleanup
 */
router.post('/cleanup', (0, auth_1.default)('admin'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Check if user has admin privileges (you may want to add proper admin middleware)
        const user = req.user;
        if (!user || user.role !== 'admin') {
            res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Admin privileges required for database operations'
            });
            return;
        }
        const { preserveUsers = true, preserveTeachers = true, preserveCategories = true, preserveSubCategories = true, dryRun = true } = req.body;
        logger_1.Logger.info('🧹 Database cleanup requested by admin', {
            userId: user._id,
            options: { preserveUsers, preserveTeachers, preserveCategories, preserveSubCategories, dryRun }
        });
        const result = yield DatabaseCleanupService_1.databaseCleanupService.performCleanup({
            preserveUsers,
            preserveTeachers,
            preserveCategories,
            preserveSubCategories,
            dryRun,
            batchSize: 1000
        });
        if (result.success) {
            // Verify integrity after cleanup
            const integrity = yield DatabaseCleanupService_1.databaseCleanupService.verifyIntegrity();
            res.json({
                success: true,
                data: {
                    cleanup: result,
                    integrity,
                    message: dryRun ? 'Cleanup preview completed' : 'Database cleanup completed successfully'
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Cleanup failed',
                details: result.errors
            });
        }
    }
    catch (error) {
        logger_1.Logger.error('❌ Database cleanup failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Database cleanup operation failed'
        });
    }
}));
/**
 * Perform database seeding (admin only)
 * POST /api/database/seed
 */
router.post('/seed', (0, auth_1.default)('admin'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Check if user has admin privileges
        const user = req.user;
        if (!user || user.role !== 'admin') {
            res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Admin privileges required for database operations'
            });
            return;
        }
        const { seedCategories = true, seedSubCategories = true, seedDefaultUsers = true, seedSampleData = false, overwriteExisting = false } = req.body;
        logger_1.Logger.info('🌱 Database seeding requested by admin', {
            userId: user._id,
            options: { seedCategories, seedSubCategories, seedDefaultUsers, seedSampleData, overwriteExisting }
        });
        const result = yield DatabaseSeedingService_1.databaseSeedingService.performSeeding({
            seedCategories,
            seedSubCategories,
            seedDefaultUsers,
            seedSampleData,
            overwriteExisting
        });
        if (result.success) {
            // Verify seeding
            const verification = yield DatabaseSeedingService_1.databaseSeedingService.verifySeeding();
            res.json({
                success: true,
                data: {
                    seeding: result,
                    verification,
                    message: 'Database seeding completed successfully'
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Seeding failed',
                details: result.errors
            });
        }
    }
    catch (error) {
        logger_1.Logger.error('❌ Database seeding failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Database seeding operation failed'
        });
    }
}));
/**
 * Reset database to defaults (admin only)
 * POST /api/database/reset
 */
router.post('/reset', (0, auth_1.default)('admin'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Check if user has admin privileges
        const user = req.user;
        if (!user || user.role !== 'admin') {
            res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Admin privileges required for database operations'
            });
            return;
        }
        const { confirmReset } = req.body;
        if (!confirmReset) {
            res.status(400).json({
                success: false,
                error: 'Confirmation required',
                message: 'Please set confirmReset: true to proceed with database reset'
            });
            return;
        }
        logger_1.Logger.warn('🔄 Database reset requested by admin', { userId: user._id });
        const result = yield DatabaseSeedingService_1.databaseSeedingService.resetToDefaults();
        if (result.success) {
            res.json({
                success: true,
                data: {
                    reset: result,
                    message: 'Database reset completed successfully'
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Reset failed',
                details: result.errors
            });
        }
    }
    catch (error) {
        logger_1.Logger.error('❌ Database reset failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Database reset operation failed'
        });
    }
}));
/**
 * Verify database integrity
 * GET /api/database/verify
 */
router.get('/verify', (0, auth_1.default)('admin'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [cleanupIntegrity, seedingIntegrity] = yield Promise.all([
            DatabaseCleanupService_1.databaseCleanupService.verifyIntegrity(),
            DatabaseSeedingService_1.databaseSeedingService.verifySeeding()
        ]);
        const allValid = cleanupIntegrity.valid && seedingIntegrity.valid;
        const allIssues = [...cleanupIntegrity.issues, ...seedingIntegrity.issues];
        res.json({
            success: true,
            data: {
                valid: allValid,
                cleanup: cleanupIntegrity,
                seeding: seedingIntegrity,
                issues: allIssues,
                message: allValid ? 'Database verification passed' : 'Database verification found issues'
            }
        });
    }
    catch (error) {
        logger_1.Logger.error('❌ Database verification failed:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Database verification failed'
        });
    }
}));
/**
 * Get database statistics
 * GET /api/database/stats
 */
router.get('/stats', (0, auth_1.default)('admin'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Import models dynamically to avoid circular dependencies
        const { User } = yield Promise.resolve().then(() => __importStar(require('../modules/User/user.model')));
        const { Teacher } = yield Promise.resolve().then(() => __importStar(require('../modules/Teacher/teacher.model')));
        const { Category } = yield Promise.resolve().then(() => __importStar(require('../modules/Category/category.model')));
        const { SubCategory } = yield Promise.resolve().then(() => __importStar(require('../modules/SubCategory/subCategory.model')));
        const { Course } = yield Promise.resolve().then(() => __importStar(require('../modules/Course/course.model')));
        const { Student } = yield Promise.resolve().then(() => __importStar(require('../modules/Student/student.model')));
        const [userCount, teacherCount, categoryCount, subCategoryCount, courseCount, studentCount] = yield Promise.all([
            User.countDocuments({ isDeleted: { $ne: true } }),
            Teacher.countDocuments({ isDeleted: { $ne: true } }),
            Category.countDocuments({ isActive: true }),
            SubCategory.countDocuments({ isActive: true }),
            Course.countDocuments({}),
            Student.countDocuments({})
        ]);
        res.json({
            success: true,
            data: {
                counts: {
                    users: userCount,
                    teachers: teacherCount,
                    categories: categoryCount,
                    subCategories: subCategoryCount,
                    courses: courseCount,
                    students: studentCount
                },
                timestamp: new Date()
            }
        });
    }
    catch (error) {
        logger_1.Logger.error('❌ Failed to get database stats:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to retrieve database statistics'
        });
    }
}));
exports.default = router;
