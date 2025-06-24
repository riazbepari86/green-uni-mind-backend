import express from 'express';
import { AuditLogController } from './auditLog.controller';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';

const router = express.Router();

// Admin-only routes for audit log management
router.get(
  '/',
  auth(USER_ROLE.admin),
  AuditLogController.getAuditLogs
);

router.get(
  '/summary',
  auth(USER_ROLE.admin),
  AuditLogController.getAuditLogSummary
);

router.get(
  '/user/:userId',
  auth(USER_ROLE.admin),
  AuditLogController.getUserAuditLogs
);

router.get(
  '/resource/:resourceType/:resourceId',
  auth(USER_ROLE.admin),
  AuditLogController.getResourceAuditLogs
);

router.get(
  '/export',
  auth(USER_ROLE.admin),
  AuditLogController.exportAuditLogs
);

router.post(
  '/archive',
  auth(USER_ROLE.admin),
  AuditLogController.archiveOldLogs
);

router.delete(
  '/archived',
  auth(USER_ROLE.admin),
  AuditLogController.deleteArchivedLogs
);

router.get(
  '/compliance-report',
  auth(USER_ROLE.admin),
  AuditLogController.getComplianceReport
);

// User-specific audit log access (limited)
router.get(
  '/my-activity',
  auth(USER_ROLE.student, USER_ROLE.teacher, USER_ROLE.admin),
  async (req, res, next) => {
    // Override userId with current user's ID for security
    req.params.userId = req.user?._id;
    next();
  },
  AuditLogController.getUserAuditLogs
);

export const AuditLogRoutes = router;
