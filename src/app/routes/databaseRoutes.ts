import { Router, Request, Response } from 'express';
import { databaseCleanupService } from '../services/database/DatabaseCleanupService';
import { databaseSeedingService } from '../services/database/DatabaseSeedingService';
// SSE services removed - using standard API patterns
import { authAuditService } from '../services/audit/AuthAuditService';
import { Logger } from '../config/logger';
import auth from '../middlewares/auth';

const router = Router();

/**
 * Get comprehensive database status
 * GET /api/database/status
 */
router.get('/status', auth('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const [
      cleanupIntegrity,
      seedingIntegrity,
      authMetrics
    ] = await Promise.all([
      databaseCleanupService.verifyIntegrity(),
      databaseSeedingService.verifySeeding(),
      authAuditService.getMetrics()
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
  } catch (error) {
    Logger.error('❌ Failed to get database status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve database status'
    });
  }
});

/**
 * Perform database cleanup (admin only)
 * POST /api/database/cleanup
 */
router.post('/cleanup', auth('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user has admin privileges (you may want to add proper admin middleware)
    const user = (req as any).user;
    if (!user || user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin privileges required for database operations'
      });
      return;
    }

    const {
      preserveUsers = true,
      preserveTeachers = true,
      preserveCategories = true,
      preserveSubCategories = true,
      dryRun = true
    } = req.body;

    Logger.info('🧹 Database cleanup requested by admin', { 
      userId: user._id, 
      options: { preserveUsers, preserveTeachers, preserveCategories, preserveSubCategories, dryRun }
    });

    const result = await databaseCleanupService.performCleanup({
      preserveUsers,
      preserveTeachers,
      preserveCategories,
      preserveSubCategories,
      dryRun,
      batchSize: 1000
    });

    if (result.success) {
      // Verify integrity after cleanup
      const integrity = await databaseCleanupService.verifyIntegrity();
      
      res.json({
        success: true,
        data: {
          cleanup: result,
          integrity,
          message: dryRun ? 'Cleanup preview completed' : 'Database cleanup completed successfully'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Cleanup failed',
        details: result.errors
      });
    }
  } catch (error) {
    Logger.error('❌ Database cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Database cleanup operation failed'
    });
  }
});

/**
 * Perform database seeding (admin only)
 * POST /api/database/seed
 */
router.post('/seed', auth('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user has admin privileges
    const user = (req as any).user;
    if (!user || user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin privileges required for database operations'
      });
      return;
    }

    const {
      seedCategories = true,
      seedSubCategories = true,
      seedDefaultUsers = true,
      seedSampleData = false,
      overwriteExisting = false
    } = req.body;

    Logger.info('🌱 Database seeding requested by admin', { 
      userId: user._id, 
      options: { seedCategories, seedSubCategories, seedDefaultUsers, seedSampleData, overwriteExisting }
    });

    const result = await databaseSeedingService.performSeeding({
      seedCategories,
      seedSubCategories,
      seedDefaultUsers,
      seedSampleData,
      overwriteExisting
    });

    if (result.success) {
      // Verify seeding
      const verification = await databaseSeedingService.verifySeeding();
      
      res.json({
        success: true,
        data: {
          seeding: result,
          verification,
          message: 'Database seeding completed successfully'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Seeding failed',
        details: result.errors
      });
    }
  } catch (error) {
    Logger.error('❌ Database seeding failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Database seeding operation failed'
    });
  }
});

/**
 * Reset database to defaults (admin only)
 * POST /api/database/reset
 */
router.post('/reset', auth('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user has admin privileges
    const user = (req as any).user;
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

    Logger.warn('🔄 Database reset requested by admin', { userId: user._id });

    const result = await databaseSeedingService.resetToDefaults();

    if (result.success) {
      res.json({
        success: true,
        data: {
          reset: result,
          message: 'Database reset completed successfully'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Reset failed',
        details: result.errors
      });
    }
  } catch (error) {
    Logger.error('❌ Database reset failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Database reset operation failed'
    });
  }
});

/**
 * Verify database integrity
 * GET /api/database/verify
 */
router.get('/verify', auth('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const [cleanupIntegrity, seedingIntegrity] = await Promise.all([
      databaseCleanupService.verifyIntegrity(),
      databaseSeedingService.verifySeeding()
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
  } catch (error) {
    Logger.error('❌ Database verification failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Database verification failed'
    });
  }
});

/**
 * Get database statistics
 * GET /api/database/stats
 */
router.get('/stats', auth('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    // Import models dynamically to avoid circular dependencies
    const { User } = await import('../modules/User/user.model');
    const { Teacher } = await import('../modules/Teacher/teacher.model');
    const { Category } = await import('../modules/Category/category.model');
    const { SubCategory } = await import('../modules/SubCategory/subCategory.model');
    const { Course } = await import('../modules/Course/course.model');
    const { Student } = await import('../modules/Student/student.model');

    const [
      userCount,
      teacherCount,
      categoryCount,
      subCategoryCount,
      courseCount,
      studentCount
    ] = await Promise.all([
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
  } catch (error) {
    Logger.error('❌ Failed to get database stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve database statistics'
    });
  }
});

export default router;
