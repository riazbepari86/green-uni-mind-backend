import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import config from '../config';
import { AuditLogService } from '../modules/AuditLog/auditLog.service';
import { 
  NotificationType,
  NotificationStatus 
} from '../modules/Notification/notification.interface';
import { 
  AuditLogAction, 
  AuditLogCategory, 
  AuditLogLevel 
} from '../modules/AuditLog/auditLog.interface';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: any[];
  metadata?: Record<string, any>;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private templates: Map<NotificationType, EmailTemplate> = new Map();

  async initialize(): Promise<void> {
    try {
      // Create transporter
      this.transporter = nodemailer.createTransporter({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });

      // Verify connection
      await this.transporter.verify();
      console.log('Email service initialized successfully');

      // Load email templates
      await this.loadEmailTemplates();
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      throw error;
    }
  }

  private async loadEmailTemplates(): Promise<void> {
    const templatesDir = path.join(__dirname, '../templates/email');
    
    // Ensure templates directory exists
    if (!fs.existsSync(templatesDir)) {
      console.warn('Email templates directory not found, creating default templates');
      await this.createDefaultTemplates();
      return;
    }

    try {
      const templateFiles = fs.readdirSync(templatesDir);
      
      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const templateName = file.replace('.hbs', '') as NotificationType;
          const templatePath = path.join(templatesDir, file);
          const templateContent = fs.readFileSync(templatePath, 'utf8');
          
          // Parse template metadata (subject, etc.) from comments
          const subjectMatch = templateContent.match(/{{!-- subject: (.*?) --}}/);
          const subject = subjectMatch ? subjectMatch[1] : 'Notification from Green Uni Mind';
          
          const template = handlebars.compile(templateContent);
          
          this.templates.set(templateName, {
            subject,
            html: templateContent,
            text: this.htmlToText(templateContent),
          });
        }
      }

      console.log(`Loaded ${this.templates.size} email templates`);
    } catch (error) {
      console.error('Error loading email templates:', error);
      await this.createDefaultTemplates();
    }
  }

  private async createDefaultTemplates(): Promise<void> {
    // Create default templates for key notification types
    const defaultTemplates = {
      [NotificationType.PAYMENT_RECEIVED]: {
        subject: 'Payment Received - {{courseName}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Payment Received</h2>
            <p>Hello {{userName}},</p>
            <p>We've successfully received your payment for <strong>{{courseName}}</strong>.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Payment Details:</h3>
              <p><strong>Amount:</strong> {{amount}} {{currency}}</p>
              <p><strong>Course:</strong> {{courseName}}</p>
              <p><strong>Date:</strong> {{paymentDate}}</p>
            </div>
            <p>You now have full access to the course. Happy learning!</p>
            <a href="{{courseUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Access Course</a>
          </div>
        `,
        text: 'Payment received for {{courseName}}. Amount: {{amount}} {{currency}}. Access your course at {{courseUrl}}',
      },
      
      [NotificationType.PAYOUT_COMPLETED]: {
        subject: 'Payout Completed - {{amount}} {{currency}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Payout Completed</h2>
            <p>Hello {{teacherName}},</p>
            <p>Great news! Your payout has been successfully processed.</p>
            <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Payout Details:</h3>
              <p><strong>Amount:</strong> {{amount}} {{currency}}</p>
              <p><strong>Processed:</strong> {{processedDate}}</p>
              <p><strong>Expected Arrival:</strong> {{arrivalDate}}</p>
            </div>
            <p>The funds should appear in your bank account within 1-2 business days.</p>
            <a href="{{earningsUrl}}" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Earnings</a>
          </div>
        `,
        text: 'Payout completed: {{amount}} {{currency}}. Expected arrival: {{arrivalDate}}. View details at {{earningsUrl}}',
      },

      [NotificationType.STRIPE_ACCOUNT_VERIFIED]: {
        subject: 'Stripe Account Verified - Start Earning!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Account Verified!</h2>
            <p>Hello {{teacherName}},</p>
            <p>Congratulations! Your Stripe account has been successfully verified.</p>
            <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>What's Next?</h3>
              <ul>
                <li>You can now receive payments from students</li>
                <li>Automatic payouts are enabled</li>
                <li>Your courses are ready for enrollment</li>
              </ul>
            </div>
            <a href="{{dashboardUrl}}" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a>
          </div>
        `,
        text: 'Your Stripe account has been verified! You can now receive payments. Visit {{dashboardUrl}}',
      },

      [NotificationType.PAYOUT_FAILED]: {
        subject: 'Payout Failed - Action Required',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Payout Failed</h2>
            <p>Hello {{teacherName}},</p>
            <p>We encountered an issue processing your payout of {{amount}} {{currency}}.</p>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h3>Issue Details:</h3>
              <p><strong>Reason:</strong> {{failureReason}}</p>
              <p><strong>Amount:</strong> {{amount}} {{currency}}</p>
              <p><strong>Failed:</strong> {{failedDate}}</p>
            </div>
            <p>Please check your bank account details and try again.</p>
            <a href="{{payoutSettingsUrl}}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Bank Details</a>
          </div>
        `,
        text: 'Payout failed: {{amount}} {{currency}}. Reason: {{failureReason}}. Update your details at {{payoutSettingsUrl}}',
      },
    };

    // Store default templates
    for (const [type, template] of Object.entries(defaultTemplates)) {
      this.templates.set(type as NotificationType, template);
    }

    console.log('Created default email templates');
  }

  async sendEmail(emailData: EmailData): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    try {
      const result = await this.transporter.sendMail({
        from: `"Green Uni Mind" <${config.email.user}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        attachments: emailData.attachments,
      });

      // Log successful email
      await AuditLogService.createAuditLog({
        action: AuditLogAction.SYSTEM_MAINTENANCE,
        category: AuditLogCategory.SYSTEM,
        level: AuditLogLevel.INFO,
        message: 'Email sent successfully',
        resourceType: 'email',
        resourceId: result.messageId,
        metadata: {
          to: emailData.to,
          subject: emailData.subject,
          messageId: result.messageId,
          ...emailData.metadata,
        },
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error: any) {
      console.error('Error sending email:', error);

      // Log failed email
      await AuditLogService.createAuditLog({
        action: AuditLogAction.SYSTEM_MAINTENANCE,
        category: AuditLogCategory.SYSTEM,
        level: AuditLogLevel.ERROR,
        message: 'Email sending failed',
        resourceType: 'email',
        metadata: {
          to: emailData.to,
          subject: emailData.subject,
          error: error.message,
          ...emailData.metadata,
        },
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendNotificationEmail(
    type: NotificationType,
    to: string,
    variables: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = this.templates.get(type);
    
    if (!template) {
      console.warn(`No email template found for notification type: ${type}`);
      return { success: false, error: 'Template not found' };
    }

    try {
      // Compile templates with variables
      const subjectTemplate = handlebars.compile(template.subject);
      const htmlTemplate = handlebars.compile(template.html);
      const textTemplate = handlebars.compile(template.text);

      const emailData: EmailData = {
        to,
        subject: subjectTemplate(variables),
        html: htmlTemplate(variables),
        text: textTemplate(variables),
        metadata: {
          notificationType: type,
          variables,
        },
      };

      return await this.sendEmail(emailData);
    } catch (error: any) {
      console.error('Error sending notification email:', error);
      return { success: false, error: error.message };
    }
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Get email template for a notification type
  getTemplate(type: NotificationType): EmailTemplate | undefined {
    return this.templates.get(type);
  }

  // Update email template
  updateTemplate(type: NotificationType, template: EmailTemplate): void {
    this.templates.set(type, template);
  }

  // Test email configuration
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
