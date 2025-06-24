import cron from 'node-cron';
import { AuditLogService } from '../modules/AuditLog/auditLog.service';
import { NotificationService } from '../modules/Notification/notification.service';
import { 
  AuditLogAction, 
  AuditLogCategory, 
  AuditLogLevel 
} from '../modules/AuditLog/auditLog.interface';
import { 
  NotificationType,
  NotificationPriority 
} from '../modules/Notification/notification.interface';

interface ComplianceAlert {
  type: 'data_retention' | 'security_breach' | 'failed_payments' | 'gdpr_violation' | 'audit_gap';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  recommendedActions: string[];
  affectedRecords?: number;
  detectedAt: Date;
}

interface ComplianceMetrics {
  dataRetentionCompliance: number; // percentage
  auditLogCoverage: number; // percentage
  securityIncidents: number;
  gdprCompliance: number; // percentage
  paymentFailureRate: number; // percentage
  lastComplianceCheck: Date;
}

class ComplianceService {
  private alerts: ComplianceAlert[] = [];
  private metrics: ComplianceMetrics | null = null;

  // Run comprehensive compliance check
  async runComplianceCheck(): Promise<{
    alerts: ComplianceAlert[];
    metrics: ComplianceMetrics;
    summary: string;
  }> {
    console.log('Starting compliance check...');
    
    try {
      const alerts: ComplianceAlert[] = [];
      
      // Check data retention compliance
      const retentionAlerts = await this.checkDataRetentionCompliance();
      alerts.push(...retentionAlerts);

      // Check for security incidents
      const securityAlerts = await this.checkSecurityCompliance();
      alerts.push(...securityAlerts);

      // Check payment compliance
      const paymentAlerts = await this.checkPaymentCompliance();
      alerts.push(...paymentAlerts);

      // Check GDPR compliance
      const gdprAlerts = await this.checkGDPRCompliance();
      alerts.push(...gdprAlerts);

      // Check audit log gaps
      const auditAlerts = await this.checkAuditLogGaps();
      alerts.push(...auditAlerts);

      // Calculate compliance metrics
      const metrics = await this.calculateComplianceMetrics();

      // Store results
      this.alerts = alerts;
      this.metrics = metrics;

      // Send notifications for critical alerts
      await this.sendCriticalAlerts(alerts);

      // Log compliance check
      await AuditLogService.createAuditLog({
        action: AuditLogAction.SYSTEM_MAINTENANCE,
        category: AuditLogCategory.SYSTEM,
        level: alerts.some(a => a.severity === 'critical') ? AuditLogLevel.ERROR : AuditLogLevel.INFO,
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
    } catch (error: any) {
      console.error('Error in compliance check:', error);
      throw error;
    }
  }

  // Check data retention compliance
  private async checkDataRetentionCompliance(): Promise<ComplianceAlert[]> {
    const alerts: ComplianceAlert[] = [];
    
    try {
      // Check for logs that should be archived
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 7); // 7 years retention

      const oldLogs = await AuditLogService.queryAuditLogs({
        endDate: cutoffDate,
        limit: 1000,
      });

      if (oldLogs.total > 0) {
        alerts.push({
          type: 'data_retention',
          severity: 'medium',
          message: `${oldLogs.total} audit logs older than 7 years should be archived`,
          details: {
            oldestRecord: oldLogs.logs[0]?.timestamp,
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
      const logsWithoutRetention = await AuditLogService.queryAuditLogs({
        limit: 100,
      });

      const missingRetentionCount = logsWithoutRetention.logs.filter(
        log => !log.retentionDate
      ).length;

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
    } catch (error: any) {
      console.error('Error checking data retention compliance:', error);
    }

    return alerts;
  }

  // Check security compliance
  private async checkSecurityCompliance(): Promise<ComplianceAlert[]> {
    const alerts: ComplianceAlert[] = [];
    
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Check for security incidents
      const securityLogs = await AuditLogService.queryAuditLogs({
        category: AuditLogCategory.SECURITY,
        level: AuditLogLevel.ERROR,
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
      const failedLogins = await AuditLogService.queryAuditLogs({
        action: AuditLogAction.USER_LOGIN,
        level: AuditLogLevel.ERROR,
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
    } catch (error: any) {
      console.error('Error checking security compliance:', error);
    }

    return alerts;
  }

  // Check payment compliance
  private async checkPaymentCompliance(): Promise<ComplianceAlert[]> {
    const alerts: ComplianceAlert[] = [];
    
    try {
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Check payment failure rate
      const paymentLogs = await AuditLogService.queryAuditLogs({
        category: AuditLogCategory.PAYMENT,
        startDate: last7Days,
        limit: 1000,
      });

      const failedPayments = paymentLogs.logs.filter(
        log => log.action === AuditLogAction.PAYMENT_FAILED
      ).length;

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
      const payoutLogs = await AuditLogService.queryAuditLogs({
        category: AuditLogCategory.PAYOUT,
        action: AuditLogAction.PAYOUT_FAILED,
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
    } catch (error: any) {
      console.error('Error checking payment compliance:', error);
    }

    return alerts;
  }

  // Check GDPR compliance
  private async checkGDPRCompliance(): Promise<ComplianceAlert[]> {
    const alerts: ComplianceAlert[] = [];
    
    try {
      // Check for data processing without legal basis
      const userLogs = await AuditLogService.queryAuditLogs({
        category: AuditLogCategory.USER,
        limit: 1000,
      });

      const logsWithoutGDPRBasis = userLogs.logs.filter(
        log => !log.metadata?.gdprProcessingBasis
      ).length;

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
    } catch (error: any) {
      console.error('Error checking GDPR compliance:', error);
    }

    return alerts;
  }

  // Check for audit log gaps
  private async checkAuditLogGaps(): Promise<ComplianceAlert[]> {
    const alerts: ComplianceAlert[] = [];
    
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Check if we have recent audit logs
      const recentLogs = await AuditLogService.queryAuditLogs({
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
    } catch (error: any) {
      console.error('Error checking audit log gaps:', error);
    }

    return alerts;
  }

  // Calculate compliance metrics
  private async calculateComplianceMetrics(): Promise<ComplianceMetrics> {
    try {
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Data retention compliance
      const totalLogs = await AuditLogService.queryAuditLogs({ limit: 1 });
      const logsWithRetention = await AuditLogService.queryAuditLogs({ limit: 1000 });
      const retentionCompliance = logsWithRetention.logs.filter(log => log.retentionDate).length / Math.min(logsWithRetention.logs.length, 1000) * 100;

      // Security incidents
      const securityLogs = await AuditLogService.queryAuditLogs({
        category: AuditLogCategory.SECURITY,
        level: AuditLogLevel.ERROR,
        startDate: last30Days,
        limit: 1,
      });

      // Payment failure rate
      const paymentLogs = await AuditLogService.queryAuditLogs({
        category: AuditLogCategory.PAYMENT,
        startDate: last30Days,
        limit: 1000,
      });
      const failedPayments = paymentLogs.logs.filter(log => log.action === AuditLogAction.PAYMENT_FAILED).length;
      const paymentFailureRate = paymentLogs.total > 0 ? (failedPayments / paymentLogs.total) * 100 : 0;

      return {
        dataRetentionCompliance: Math.round(retentionCompliance),
        auditLogCoverage: 95, // Placeholder - would need more complex calculation
        securityIncidents: securityLogs.total,
        gdprCompliance: 90, // Placeholder - would need more complex calculation
        paymentFailureRate: Math.round(paymentFailureRate * 100) / 100,
        lastComplianceCheck: new Date(),
      };
    } catch (error: any) {
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
  }

  // Send critical alerts to administrators
  private async sendCriticalAlerts(alerts: ComplianceAlert[]): Promise<void> {
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    
    for (const alert of criticalAlerts) {
      try {
        // This would need to be implemented to send to all admins
        // For now, just log the critical alert
        console.error('CRITICAL COMPLIANCE ALERT:', alert);
        
        await AuditLogService.createAuditLog({
          action: AuditLogAction.SECURITY_EVENT,
          category: AuditLogCategory.SECURITY,
          level: AuditLogLevel.CRITICAL,
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
      } catch (error: any) {
        console.error('Error sending critical alert:', error);
      }
    }
  }

  // Generate compliance summary
  private generateComplianceSummary(alerts: ComplianceAlert[], metrics: ComplianceMetrics): string {
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
  initializeComplianceMonitoring(): void {
    // Run compliance check daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        await this.runComplianceCheck();
      } catch (error) {
        console.error('Error in scheduled compliance check:', error);
      }
    });

    // Archive old logs weekly on Sunday at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      try {
        await AuditLogService.archiveOldLogs(2555); // 7 years
        console.log('Weekly audit log archival completed');
      } catch (error) {
        console.error('Error in weekly log archival:', error);
      }
    });

    console.log('Compliance monitoring initialized');
  }

  // Get current compliance status
  getCurrentComplianceStatus(): {
    alerts: ComplianceAlert[];
    metrics: ComplianceMetrics | null;
  } {
    return {
      alerts: this.alerts,
      metrics: this.metrics,
    };
  }
}

// Export singleton instance
export const complianceService = new ComplianceService();
export default complianceService;
