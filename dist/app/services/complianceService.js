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
exports.complianceService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const auditLog_service_1 = require("../modules/AuditLog/auditLog.service");
const auditLog_interface_1 = require("../modules/AuditLog/auditLog.interface");
class ComplianceService {
    constructor() {
        this.alerts = [];
        this.metrics = null;
    }
    // Run comprehensive compliance check
    runComplianceCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Starting compliance check...');
            try {
                const alerts = [];
                // Check data retention compliance
                const retentionAlerts = yield this.checkDataRetentionCompliance();
                alerts.push(...retentionAlerts);
                // Check for security incidents
                const securityAlerts = yield this.checkSecurityCompliance();
                alerts.push(...securityAlerts);
                // Check payment compliance
                const paymentAlerts = yield this.checkPaymentCompliance();
                alerts.push(...paymentAlerts);
                // Check GDPR compliance
                const gdprAlerts = yield this.checkGDPRCompliance();
                alerts.push(...gdprAlerts);
                // Check audit log gaps
                const auditAlerts = yield this.checkAuditLogGaps();
                alerts.push(...auditAlerts);
                // Calculate compliance metrics
                const metrics = yield this.calculateComplianceMetrics();
                // Store results
                this.alerts = alerts;
                this.metrics = metrics;
                // Send notifications for critical alerts
                yield this.sendCriticalAlerts(alerts);
                // Log compliance check
                yield auditLog_service_1.AuditLogService.createAuditLog({
                    action: auditLog_interface_1.AuditLogAction.SYSTEM_MAINTENANCE,
                    category: auditLog_interface_1.AuditLogCategory.SYSTEM,
                    level: alerts.some(a => a.severity === 'critical') ? auditLog_interface_1.AuditLogLevel.ERROR : auditLog_interface_1.AuditLogLevel.INFO,
                    message: `Compliance check completed: ${alerts.length} alerts found`,
                    userType: 'system',
                    resourceType: 'compliance_check',
                    metadata: {
                        alertCount: alerts.length,
                        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
                        metrics,
                    },
                });
                const summary = this.generateComplianceSummary(alerts, metrics);
                console.log(`Compliance check completed: ${alerts.length} alerts, ${alerts.filter(a => a.severity === 'critical').length} critical`);
                return { alerts, metrics, summary };
            }
            catch (error) {
                console.error('Error in compliance check:', error);
                throw error;
            }
        });
    }
    // Check data retention compliance
    checkDataRetentionCompliance() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const alerts = [];
            try {
                // Check for logs that should be archived
                const cutoffDate = new Date();
                cutoffDate.setFullYear(cutoffDate.getFullYear() - 7); // 7 years retention
                const oldLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
                    endDate: cutoffDate,
                    limit: 1000,
                });
                if (oldLogs.total > 0) {
                    alerts.push({
                        type: 'data_retention',
                        severity: 'medium',
                        message: `${oldLogs.total} audit logs older than 7 years should be archived`,
                        details: {
                            oldestRecord: (_a = oldLogs.logs[0]) === null || _a === void 0 ? void 0 : _a.timestamp,
                            recordCount: oldLogs.total,
                        },
                        recommendedActions: [
                            'Archive old audit logs',
                            'Review data retention policy',
                            'Set up automated archival process',
                        ],
                        affectedRecords: oldLogs.total,
                        detectedAt: new Date(),
                    });
                }
                // Check for logs without retention dates
                const logsWithoutRetention = yield auditLog_service_1.AuditLogService.queryAuditLogs({
                    limit: 100,
                });
                const missingRetentionCount = logsWithoutRetention.logs.filter(log => !log.retentionDate).length;
                if (missingRetentionCount > 0) {
                    alerts.push({
                        type: 'data_retention',
                        severity: 'low',
                        message: `${missingRetentionCount} audit logs missing retention dates`,
                        details: {
                            missingRetentionCount,
                            sampleSize: logsWithoutRetention.logs.length,
                        },
                        recommendedActions: [
                            'Update audit logs with retention dates',
                            'Fix data retention policy implementation',
                        ],
                        affectedRecords: missingRetentionCount,
                        detectedAt: new Date(),
                    });
                }
            }
            catch (error) {
                console.error('Error checking data retention compliance:', error);
            }
            return alerts;
        });
    }
    // Check security compliance
    checkSecurityCompliance() {
        return __awaiter(this, void 0, void 0, function* () {
            const alerts = [];
            try {
                const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
                // Check for security incidents
                const securityLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
                    category: auditLog_interface_1.AuditLogCategory.SECURITY,
                    level: auditLog_interface_1.AuditLogLevel.ERROR,
                    startDate: last24Hours,
                    limit: 1000,
                });
                if (securityLogs.total > 10) { // Threshold for security incidents
                    alerts.push({
                        type: 'security_breach',
                        severity: 'high',
                        message: `${securityLogs.total} security incidents in the last 24 hours`,
                        details: {
                            incidentCount: securityLogs.total,
                            timeframe: '24 hours',
                            incidents: securityLogs.logs.slice(0, 5), // Sample
                        },
                        recommendedActions: [
                            'Investigate security incidents',
                            'Review access controls',
                            'Check for suspicious patterns',
                            'Consider additional security measures',
                        ],
                        affectedRecords: securityLogs.total,
                        detectedAt: new Date(),
                    });
                }
                // Check for failed login attempts
                const failedLogins = yield auditLog_service_1.AuditLogService.queryAuditLogs({
                    action: auditLog_interface_1.AuditLogAction.USER_LOGIN,
                    level: auditLog_interface_1.AuditLogLevel.ERROR,
                    startDate: last24Hours,
                    limit: 1000,
                });
                if (failedLogins.total > 50) { // Threshold for failed logins
                    alerts.push({
                        type: 'security_breach',
                        severity: 'medium',
                        message: `${failedLogins.total} failed login attempts in the last 24 hours`,
                        details: {
                            failedLoginCount: failedLogins.total,
                            timeframe: '24 hours',
                        },
                        recommendedActions: [
                            'Review failed login patterns',
                            'Consider implementing rate limiting',
                            'Check for brute force attacks',
                        ],
                        affectedRecords: failedLogins.total,
                        detectedAt: new Date(),
                    });
                }
            }
            catch (error) {
                console.error('Error checking security compliance:', error);
            }
            return alerts;
        });
    }
    // Check payment compliance
    checkPaymentCompliance() {
        return __awaiter(this, void 0, void 0, function* () {
            const alerts = [];
            try {
                const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                // Check payment failure rate
                const paymentLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
                    category: auditLog_interface_1.AuditLogCategory.PAYMENT,
                    startDate: last7Days,
                    limit: 1000,
                });
                const failedPayments = paymentLogs.logs.filter(log => log.action === auditLog_interface_1.AuditLogAction.PAYMENT_FAILED).length;
                const failureRate = paymentLogs.total > 0 ? (failedPayments / paymentLogs.total) * 100 : 0;
                if (failureRate > 5) { // 5% failure rate threshold
                    alerts.push({
                        type: 'failed_payments',
                        severity: failureRate > 15 ? 'high' : 'medium',
                        message: `Payment failure rate is ${failureRate.toFixed(1)}% (${failedPayments}/${paymentLogs.total})`,
                        details: {
                            failureRate,
                            failedPayments,
                            totalPayments: paymentLogs.total,
                            timeframe: '7 days',
                        },
                        recommendedActions: [
                            'Investigate payment failures',
                            'Review payment processing',
                            'Check Stripe account status',
                            'Analyze failure patterns',
                        ],
                        affectedRecords: failedPayments,
                        detectedAt: new Date(),
                    });
                }
                // Check payout failures
                const payoutLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
                    category: auditLog_interface_1.AuditLogCategory.PAYOUT,
                    action: auditLog_interface_1.AuditLogAction.PAYOUT_FAILED,
                    startDate: last7Days,
                    limit: 1000,
                });
                if (payoutLogs.total > 5) { // Threshold for payout failures
                    alerts.push({
                        type: 'failed_payments',
                        severity: 'medium',
                        message: `${payoutLogs.total} payout failures in the last 7 days`,
                        details: {
                            failedPayouts: payoutLogs.total,
                            timeframe: '7 days',
                        },
                        recommendedActions: [
                            'Review payout failures',
                            'Check teacher bank account details',
                            'Verify Stripe Connect setup',
                        ],
                        affectedRecords: payoutLogs.total,
                        detectedAt: new Date(),
                    });
                }
            }
            catch (error) {
                console.error('Error checking payment compliance:', error);
            }
            return alerts;
        });
    }
    // Check GDPR compliance
    checkGDPRCompliance() {
        return __awaiter(this, void 0, void 0, function* () {
            const alerts = [];
            try {
                // Check for data processing without legal basis
                const userLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
                    category: auditLog_interface_1.AuditLogCategory.USER,
                    limit: 1000,
                });
                const logsWithoutGDPRBasis = userLogs.logs.filter(log => { var _a; return !((_a = log.metadata) === null || _a === void 0 ? void 0 : _a.gdprProcessingBasis); }).length;
                if (logsWithoutGDPRBasis > 0) {
                    alerts.push({
                        type: 'gdpr_violation',
                        severity: 'medium',
                        message: `${logsWithoutGDPRBasis} user data processing events without GDPR legal basis`,
                        details: {
                            eventsWithoutBasis: logsWithoutGDPRBasis,
                            totalUserEvents: userLogs.total,
                        },
                        recommendedActions: [
                            'Add GDPR processing basis to audit logs',
                            'Review data processing procedures',
                            'Update privacy policy if needed',
                        ],
                        affectedRecords: logsWithoutGDPRBasis,
                        detectedAt: new Date(),
                    });
                }
            }
            catch (error) {
                console.error('Error checking GDPR compliance:', error);
            }
            return alerts;
        });
    }
    // Check for audit log gaps
    checkAuditLogGaps() {
        return __awaiter(this, void 0, void 0, function* () {
            const alerts = [];
            try {
                const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
                // Check if we have recent audit logs
                const recentLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
                    startDate: last24Hours,
                    limit: 10,
                });
                if (recentLogs.total === 0) {
                    alerts.push({
                        type: 'audit_gap',
                        severity: 'critical',
                        message: 'No audit logs found in the last 24 hours',
                        details: {
                            timeframe: '24 hours',
                            lastLogTime: null,
                        },
                        recommendedActions: [
                            'Check audit logging system',
                            'Verify application is running',
                            'Review log collection process',
                        ],
                        detectedAt: new Date(),
                    });
                }
            }
            catch (error) {
                console.error('Error checking audit log gaps:', error);
            }
            return alerts;
        });
    }
    // Calculate compliance metrics
    calculateComplianceMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                // Data retention compliance
                const totalLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({ limit: 1 });
                const logsWithRetention = yield auditLog_service_1.AuditLogService.queryAuditLogs({ limit: 1000 });
                const retentionCompliance = logsWithRetention.logs.filter(log => log.retentionDate).length / Math.min(logsWithRetention.logs.length, 1000) * 100;
                // Security incidents
                const securityLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
                    category: auditLog_interface_1.AuditLogCategory.SECURITY,
                    level: auditLog_interface_1.AuditLogLevel.ERROR,
                    startDate: last30Days,
                    limit: 1,
                });
                // Payment failure rate
                const paymentLogs = yield auditLog_service_1.AuditLogService.queryAuditLogs({
                    category: auditLog_interface_1.AuditLogCategory.PAYMENT,
                    startDate: last30Days,
                    limit: 1000,
                });
                const failedPayments = paymentLogs.logs.filter(log => log.action === auditLog_interface_1.AuditLogAction.PAYMENT_FAILED).length;
                const paymentFailureRate = paymentLogs.total > 0 ? (failedPayments / paymentLogs.total) * 100 : 0;
                return {
                    dataRetentionCompliance: Math.round(retentionCompliance),
                    auditLogCoverage: 95, // Placeholder - would need more complex calculation
                    securityIncidents: securityLogs.total,
                    gdprCompliance: 90, // Placeholder - would need more complex calculation
                    paymentFailureRate: Math.round(paymentFailureRate * 100) / 100,
                    lastComplianceCheck: new Date(),
                };
            }
            catch (error) {
                console.error('Error calculating compliance metrics:', error);
                return {
                    dataRetentionCompliance: 0,
                    auditLogCoverage: 0,
                    securityIncidents: 0,
                    gdprCompliance: 0,
                    paymentFailureRate: 0,
                    lastComplianceCheck: new Date(),
                };
            }
        });
    }
    // Send critical alerts to administrators
    sendCriticalAlerts(alerts) {
        return __awaiter(this, void 0, void 0, function* () {
            const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
            for (const alert of criticalAlerts) {
                try {
                    // This would need to be implemented to send to all admins
                    // For now, just log the critical alert
                    console.error('CRITICAL COMPLIANCE ALERT:', alert);
                    yield auditLog_service_1.AuditLogService.createAuditLog({
                        action: auditLog_interface_1.AuditLogAction.SECURITY_EVENT,
                        category: auditLog_interface_1.AuditLogCategory.SECURITY,
                        level: auditLog_interface_1.AuditLogLevel.CRITICAL,
                        message: `Critical compliance alert: ${alert.message}`,
                        userType: 'system',
                        resourceType: 'compliance_alert',
                        metadata: {
                            alertType: alert.type,
                            severity: alert.severity,
                            details: alert.details,
                            recommendedActions: alert.recommendedActions,
                        },
                    });
                }
                catch (error) {
                    console.error('Error sending critical alert:', error);
                }
            }
        });
    }
    // Generate compliance summary
    generateComplianceSummary(alerts, metrics) {
        const criticalCount = alerts.filter(a => a.severity === 'critical').length;
        const highCount = alerts.filter(a => a.severity === 'high').length;
        const mediumCount = alerts.filter(a => a.severity === 'medium').length;
        const lowCount = alerts.filter(a => a.severity === 'low').length;
        let summary = `Compliance Check Summary:\n`;
        summary += `- ${alerts.length} total alerts found\n`;
        summary += `- ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low severity\n`;
        summary += `- Data retention compliance: ${metrics.dataRetentionCompliance}%\n`;
        summary += `- Security incidents (30 days): ${metrics.securityIncidents}\n`;
        summary += `- Payment failure rate: ${metrics.paymentFailureRate}%\n`;
        if (criticalCount > 0) {
            summary += `\nIMMEDIATE ACTION REQUIRED for ${criticalCount} critical alerts!`;
        }
        return summary;
    }
    // Initialize compliance monitoring
    initializeComplianceMonitoring() {
        // Run compliance check daily at 2 AM
        node_cron_1.default.schedule('0 2 * * *', () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.runComplianceCheck();
            }
            catch (error) {
                console.error('Error in scheduled compliance check:', error);
            }
        }));
        // Archive old logs weekly on Sunday at 3 AM
        node_cron_1.default.schedule('0 3 * * 0', () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield auditLog_service_1.AuditLogService.archiveOldLogs(2555); // 7 years
                console.log('Weekly audit log archival completed');
            }
            catch (error) {
                console.error('Error in weekly log archival:', error);
            }
        }));
        console.log('Compliance monitoring initialized');
    }
    // Get current compliance status
    getCurrentComplianceStatus() {
        return {
            alerts: this.alerts,
            metrics: this.metrics,
        };
    }
}
// Export singleton instance
exports.complianceService = new ComplianceService();
exports.default = exports.complianceService;
