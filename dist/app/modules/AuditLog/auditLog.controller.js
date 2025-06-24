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
exports.AuditLogController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const auditLog_service_1 = require("./auditLog.service");
const auditLog_interface_1 = require("./auditLog.interface");
// Get audit logs with advanced filtering
const getAuditLogs = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { action, category, level, userId, userType, resourceType, resourceId, startDate, endDate, tags, searchText, limit = 100, offset = 0, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
    const query = {
        action: action ? (Array.isArray(action) ? action : [action]) : undefined,
        category: category ? (Array.isArray(category) ? category : [category]) : undefined,
        level: level ? (Array.isArray(level) ? level : [level]) : undefined,
        userId: userId,
        userType: userType,
        resourceType: resourceType,
        resourceId: resourceId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        searchText: searchText,
        limit: parseInt(limit),
        offset: parseInt(offset),
        sortBy: sortBy,
        sortOrder: sortOrder,
    };
    const result = yield auditLog_service_1.AuditLogService.queryAuditLogs(query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Audit logs retrieved successfully',
        data: result,
    });
}));
// Get audit log summary and statistics
const getAuditLogSummary = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { startDate, endDate, category, level, userId } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const filters = {};
    if (category)
        filters.category = category;
    if (level)
        filters.level = level;
    if (userId)
        filters.userId = userId;
    const summary = yield auditLog_service_1.AuditLogService.getAuditLogSummary(start, end, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Audit log summary retrieved successfully',
        data: summary,
    });
}));
// Get audit logs for a specific user
const getUserAuditLogs = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { limit = 50, offset = 0, startDate, endDate, category, level } = req.query;
    const options = {
        limit: parseInt(limit),
        offset: parseInt(offset),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        category: category,
        level: level,
    };
    const result = yield auditLog_service_1.AuditLogService.getUserAuditLogs(userId, options);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'User audit logs retrieved successfully',
        data: result,
    });
}));
// Get audit logs for a specific resource
const getResourceAuditLogs = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { resourceType, resourceId } = req.params;
    const { limit = 50, offset = 0, startDate, endDate } = req.query;
    const options = {
        limit: parseInt(limit),
        offset: parseInt(offset),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
    };
    const result = yield auditLog_service_1.AuditLogService.getResourceAuditLogs(resourceType, resourceId, options);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Resource audit logs retrieved successfully',
        data: result,
    });
}));
// Export audit logs (for compliance)
const exportAuditLogs = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { format = 'csv', startDate, endDate, category, level, userId, resourceType } = req.query;
    const query = {
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Default 90 days
        endDate: endDate ? new Date(endDate) : new Date(),
        category: category,
        level: level,
        userId: userId,
        resourceType: resourceType,
        limit: 10000, // Large limit for export
        sortBy: 'timestamp',
        sortOrder: 'desc',
    };
    const result = yield auditLog_service_1.AuditLogService.queryAuditLogs(query);
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
        const csvRows = result.logs.map(log => {
            var _a, _b;
            return [
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
                ((_a = log.metadata) === null || _a === void 0 ? void 0 : _a.ipAddress) || '',
                ((_b = log.metadata) === null || _b === void 0 ? void 0 : _b.errorMessage) || ''
            ];
        });
        const csvContent = [csvHeaders, ...csvRows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
    }
    else {
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
}));
// Archive old audit logs
const archiveOldLogs = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { olderThanDays = 2555 } = req.body; // Default 7 years
    const result = yield auditLog_service_1.AuditLogService.archiveOldLogs(olderThanDays);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Old audit logs archived successfully',
        data: result,
    });
}));
// Delete archived logs (permanent deletion)
const deleteArchivedLogs = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { archivedBeforeDays = 2920 } = req.body; // Default 8 years
    const result = yield auditLog_service_1.AuditLogService.deleteArchivedLogs(archivedBeforeDays);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Archived audit logs deleted successfully',
        data: result,
    });
}));
// Get compliance report
const getComplianceReport = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { startDate, endDate, reportType = 'general' } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default 90 days
    const end = endDate ? new Date(endDate) : new Date();
    // Generate compliance report based on type
    let report = {};
    switch (reportType) {
        case 'payment':
            report = yield generatePaymentComplianceReport(start, end);
            break;
        case 'security':
            report = yield generateSecurityComplianceReport(start, end);
            break;
        case 'gdpr':
            report = yield generateGDPRComplianceReport(start, end);
            break;
        default:
            report = yield generateGeneralComplianceReport(start, end);
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Compliance report generated successfully',
        data: report,
    });
}));
// Helper functions for compliance reports
const generatePaymentComplianceReport = (startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
    const paymentLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
        category: auditLog_interface_1.AuditLogCategory.PAYMENT,
        startDate,
        endDate,
        limit: 10000,
    });
    const payoutLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
        category: auditLog_interface_1.AuditLogCategory.PAYOUT,
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
});
const generateSecurityComplianceReport = (startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
    const securityLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
        category: auditLog_interface_1.AuditLogCategory.SECURITY,
        startDate,
        endDate,
        limit: 10000,
    });
    const loginLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
        action: auditLog_interface_1.AuditLogAction.USER_LOGIN,
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
            suspiciousActivities: securityLogs.logs.filter(log => log.level === auditLog_interface_1.AuditLogLevel.ERROR).length,
        },
        details: {
            securityEvents: securityLogs.logs.slice(0, 100),
            recentLogins: loginLogs.logs.slice(0, 50),
        },
    };
});
const generateGDPRComplianceReport = (startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
    const userLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
        category: auditLog_interface_1.AuditLogCategory.USER,
        startDate,
        endDate,
        limit: 10000,
    });
    return {
        reportType: 'gdpr',
        period: { start: startDate, end: endDate },
        summary: {
            totalUserEvents: userLogs.total,
            dataProcessingEvents: userLogs.logs.filter(log => { var _a; return (_a = log.metadata) === null || _a === void 0 ? void 0 : _a.gdprProcessingBasis; }).length,
            dataRetentionCompliance: userLogs.logs.filter(log => log.retentionDate && log.retentionDate > new Date()).length,
        },
        details: {
            userEvents: userLogs.logs.slice(0, 100),
        },
    };
});
const generateGeneralComplianceReport = (startDate, endDate) => __awaiter(void 0, void 0, void 0, function* () {
    const summary = yield auditLog_service_1.AuditLogService.getAuditLogSummary(startDate, endDate);
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
});
exports.AuditLogController = {
    getAuditLogs,
    getAuditLogSummary,
    getUserAuditLogs,
    getResourceAuditLogs,
    exportAuditLogs,
    archiveOldLogs,
    deleteArchivedLogs,
    getComplianceReport,
};
