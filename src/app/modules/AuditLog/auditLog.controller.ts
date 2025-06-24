import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuditLogService } from './auditLog.service';
import { 
  AuditLogAction, 
  AuditLogCategory, 
  AuditLogLevel,
  IAuditLogQuery 
} from './auditLog.interface';

// Get audit logs with advanced filtering
const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const {
    action,
    category,
    level,
    userId,
    userType,
    resourceType,
    resourceId,
    startDate,
    endDate,
    tags,
    searchText,
    limit = 100,
    offset = 0,
    sortBy = 'timestamp',
    sortOrder = 'desc'
  } = req.query;

  const query: IAuditLogQuery = {
    action: action ? (Array.isArray(action) ? action as AuditLogAction[] : [action as AuditLogAction]) : undefined,
    category: category ? (Array.isArray(category) ? category as AuditLogCategory[] : [category as AuditLogCategory]) : undefined,
    level: level ? (Array.isArray(level) ? level as AuditLogLevel[] : [level as AuditLogLevel]) : undefined,
    userId: userId as string,
    userType: userType as string,
    resourceType: resourceType as string,
    resourceId: resourceId as string,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
    searchText: searchText as string,
    limit: parseInt(limit as string),
    offset: parseInt(offset as string),
    sortBy: sortBy as string,
    sortOrder: sortOrder as 'asc' | 'desc',
  };

  const result = await AuditLogService.queryAuditLogs(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Audit logs retrieved successfully',
    data: result,
  });
});

// Get audit log summary and statistics
const getAuditLogSummary = catchAsync(async (req: Request, res: Response) => {
  const {
    startDate,
    endDate,
    category,
    level,
    userId
  } = req.query;

  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
  const end = endDate ? new Date(endDate as string) : new Date();

  const filters: any = {};
  if (category) filters.category = category;
  if (level) filters.level = level;
  if (userId) filters.userId = userId;

  const summary = await AuditLogService.getAuditLogSummary(start, end, filters);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Audit log summary retrieved successfully',
    data: summary,
  });
});

// Get audit logs for a specific user
const getUserAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const {
    limit = 50,
    offset = 0,
    startDate,
    endDate,
    category,
    level
  } = req.query;

  const options = {
    limit: parseInt(limit as string),
    offset: parseInt(offset as string),
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    category: category as AuditLogCategory,
    level: level as AuditLogLevel,
  };

  const result = await AuditLogService.getUserAuditLogs(userId, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User audit logs retrieved successfully',
    data: result,
  });
});

// Get audit logs for a specific resource
const getResourceAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { resourceType, resourceId } = req.params;
  const {
    limit = 50,
    offset = 0,
    startDate,
    endDate
  } = req.query;

  const options = {
    limit: parseInt(limit as string),
    offset: parseInt(offset as string),
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
  };

  const result = await AuditLogService.getResourceAuditLogs(resourceType, resourceId, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Resource audit logs retrieved successfully',
    data: result,
  });
});

// Export audit logs (for compliance)
const exportAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const {
    format = 'csv',
    startDate,
    endDate,
    category,
    level,
    userId,
    resourceType
  } = req.query;

  const query: IAuditLogQuery = {
    startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Default 90 days
    endDate: endDate ? new Date(endDate as string) : new Date(),
    category: category as AuditLogCategory,
    level: level as AuditLogLevel,
    userId: userId as string,
    resourceType: resourceType as string,
    limit: 10000, // Large limit for export
    sortBy: 'timestamp',
    sortOrder: 'desc',
  };

  const result = await AuditLogService.queryAuditLogs(query);

  if (format === 'csv') {
    // Convert to CSV format
    const csvHeaders = [
      'Timestamp',
      'Action',
      'Category',
      'Level',
      'Message',
      'User ID',
      'User Type',
      'User Email',
      'Resource Type',
      'Resource ID',
      'IP Address',
      'Error Message'
    ];

    const csvRows = result.logs.map(log => [
      log.timestamp.toISOString(),
      log.action,
      log.category,
      log.level,
      log.message,
      log.userId || '',
      log.userType || '',
      log.userEmail || '',
      log.resourceType || '',
      log.resourceId || '',
      log.metadata?.ipAddress || '',
      log.metadata?.errorMessage || ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } else {
    // JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      query,
      totalRecords: result.total,
      records: result.logs,
    });
  }
});

// Archive old audit logs
const archiveOldLogs = catchAsync(async (req: Request, res: Response) => {
  const { olderThanDays = 2555 } = req.body; // Default 7 years

  const result = await AuditLogService.archiveOldLogs(olderThanDays);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Old audit logs archived successfully',
    data: result,
  });
});

// Delete archived logs (permanent deletion)
const deleteArchivedLogs = catchAsync(async (req: Request, res: Response) => {
  const { archivedBeforeDays = 2920 } = req.body; // Default 8 years

  const result = await AuditLogService.deleteArchivedLogs(archivedBeforeDays);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Archived audit logs deleted successfully',
    data: result,
  });
});

// Get compliance report
const getComplianceReport = catchAsync(async (req: Request, res: Response) => {
  const {
    startDate,
    endDate,
    reportType = 'general'
  } = req.query;

  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default 90 days
  const end = endDate ? new Date(endDate as string) : new Date();

  // Generate compliance report based on type
  let report: any = {};

  switch (reportType) {
    case 'payment':
      report = await generatePaymentComplianceReport(start, end);
      break;
    case 'security':
      report = await generateSecurityComplianceReport(start, end);
      break;
    case 'gdpr':
      report = await generateGDPRComplianceReport(start, end);
      break;
    default:
      report = await generateGeneralComplianceReport(start, end);
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Compliance report generated successfully',
    data: report,
  });
});

// Helper functions for compliance reports
const generatePaymentComplianceReport = async (startDate: Date, endDate: Date) => {
  const paymentLogs = await AuditLogService.queryAuditLogs({
    category: AuditLogCategory.PAYMENT,
    startDate,
    endDate,
    limit: 10000,
  });

  const payoutLogs = await AuditLogService.queryAuditLogs({
    category: AuditLogCategory.PAYOUT,
    startDate,
    endDate,
    limit: 10000,
  });

  return {
    reportType: 'payment',
    period: { start: startDate, end: endDate },
    summary: {
      totalPaymentEvents: paymentLogs.total,
      totalPayoutEvents: payoutLogs.total,
      failedPayments: paymentLogs.logs.filter(log => log.action.includes('failed')).length,
      failedPayouts: payoutLogs.logs.filter(log => log.action.includes('failed')).length,
    },
    details: {
      paymentEvents: paymentLogs.logs.slice(0, 100), // Sample
      payoutEvents: payoutLogs.logs.slice(0, 100), // Sample
    },
  };
};

const generateSecurityComplianceReport = async (startDate: Date, endDate: Date) => {
  const securityLogs = await AuditLogService.queryAuditLogs({
    category: AuditLogCategory.SECURITY,
    startDate,
    endDate,
    limit: 10000,
  });

  const loginLogs = await AuditLogService.queryAuditLogs({
    action: AuditLogAction.USER_LOGIN,
    startDate,
    endDate,
    limit: 10000,
  });

  return {
    reportType: 'security',
    period: { start: startDate, end: endDate },
    summary: {
      totalSecurityEvents: securityLogs.total,
      totalLogins: loginLogs.total,
      suspiciousActivities: securityLogs.logs.filter(log => log.level === AuditLogLevel.ERROR).length,
    },
    details: {
      securityEvents: securityLogs.logs.slice(0, 100),
      recentLogins: loginLogs.logs.slice(0, 50),
    },
  };
};

const generateGDPRComplianceReport = async (startDate: Date, endDate: Date) => {
  const userLogs = await AuditLogService.queryAuditLogs({
    category: AuditLogCategory.USER,
    startDate,
    endDate,
    limit: 10000,
  });

  return {
    reportType: 'gdpr',
    period: { start: startDate, end: endDate },
    summary: {
      totalUserEvents: userLogs.total,
      dataProcessingEvents: userLogs.logs.filter(log => 
        log.metadata?.gdprProcessingBasis
      ).length,
      dataRetentionCompliance: userLogs.logs.filter(log => 
        log.retentionDate && log.retentionDate > new Date()
      ).length,
    },
    details: {
      userEvents: userLogs.logs.slice(0, 100),
    },
  };
};

const generateGeneralComplianceReport = async (startDate: Date, endDate: Date) => {
  const summary = await AuditLogService.getAuditLogSummary(startDate, endDate);

  return {
    reportType: 'general',
    period: { start: startDate, end: endDate },
    summary,
    recommendations: [
      'Review failed payment events for patterns',
      'Monitor security events for anomalies',
      'Ensure data retention policies are followed',
      'Regular backup and archival of audit logs',
    ],
  };
};

export const AuditLogController = {
  getAuditLogs,
  getAuditLogSummary,
  getUserAuditLogs,
  getResourceAuditLogs,
  exportAuditLogs,
  archiveOldLogs,
  deleteArchivedLogs,
  getComplianceReport,
};
