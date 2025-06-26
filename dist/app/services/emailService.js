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
exports.emailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const handlebars_1 = __importDefault(require("handlebars"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("../config"));
const auditLog_service_1 = require("../modules/AuditLog/auditLog.service");
const notification_interface_1 = require("../modules/Notification/notification.interface");
const auditLog_interface_1 = require("../modules/AuditLog/auditLog.interface");
class EmailService {
    constructor() {
        this.transporter = null;
        this.templates = new Map();
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create transporter
                this.transporter = nodemailer_1.default.createTransport({
                    host: config_1.default.email.host,
                    port: config_1.default.email.port,
                    secure: config_1.default.email.secure,
                    auth: {
                        user: config_1.default.email.user,
                        pass: config_1.default.email.pass,
                    },
                    pool: true,
                    maxConnections: 5,
                    maxMessages: 100,
                });
                // Verify connection
                yield this.transporter.verify();
                console.log('Email service initialized successfully');
                // Load email templates
                yield this.loadEmailTemplates();
            }
            catch (error) {
                console.error('Failed to initialize email service:', error);
                throw error;
            }
        });
    }
    loadEmailTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            const templatesDir = path_1.default.join(__dirname, '../templates/email');
            // Ensure templates directory exists
            if (!fs_1.default.existsSync(templatesDir)) {
                console.warn('Email templates directory not found, creating default templates');
                yield this.createDefaultTemplates();
                return;
            }
            try {
                const templateFiles = fs_1.default.readdirSync(templatesDir);
                for (const file of templateFiles) {
                    if (file.endsWith('.hbs')) {
                        const templateName = file.replace('.hbs', '');
                        const templatePath = path_1.default.join(templatesDir, file);
                        const templateContent = fs_1.default.readFileSync(templatePath, 'utf8');
                        // Parse template metadata (subject, etc.) from comments
                        const subjectMatch = templateContent.match(/{{!-- subject: (.*?) --}}/);
                        const subject = subjectMatch ? subjectMatch[1] : 'Notification from Green Uni Mind';
                        const template = handlebars_1.default.compile(templateContent);
                        this.templates.set(templateName, {
                            subject,
                            html: templateContent,
                            text: this.htmlToText(templateContent),
                        });
                    }
                }
                console.log(`Loaded ${this.templates.size} email templates`);
            }
            catch (error) {
                console.error('Error loading email templates:', error);
                yield this.createDefaultTemplates();
            }
        });
    }
    createDefaultTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            // Create default templates for key notification types
            const defaultTemplates = {
                [notification_interface_1.NotificationType.PAYMENT_RECEIVED]: {
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
                [notification_interface_1.NotificationType.PAYOUT_COMPLETED]: {
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
                [notification_interface_1.NotificationType.STRIPE_ACCOUNT_VERIFIED]: {
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
                [notification_interface_1.NotificationType.PAYOUT_FAILED]: {
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
                this.templates.set(type, template);
            }
            console.log('Created default email templates');
        });
    }
    sendEmail(emailData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.transporter) {
                throw new Error('Email service not initialized');
            }
            try {
                const result = yield this.transporter.sendMail({
                    from: `"Green Uni Mind" <${config_1.default.email.user}>`,
                    to: emailData.to,
                    subject: emailData.subject,
                    html: emailData.html,
                    text: emailData.text,
                    attachments: emailData.attachments,
                });
                // Log successful email
                yield auditLog_service_1.AuditLogService.createAuditLog({
                    action: auditLog_interface_1.AuditLogAction.SYSTEM_MAINTENANCE,
                    category: auditLog_interface_1.AuditLogCategory.SYSTEM,
                    level: auditLog_interface_1.AuditLogLevel.INFO,
                    message: 'Email sent successfully',
                    resourceType: 'email',
                    resourceId: result.messageId,
                    metadata: Object.assign({ to: emailData.to, subject: emailData.subject, messageId: result.messageId }, emailData.metadata),
                });
                return {
                    success: true,
                    messageId: result.messageId,
                };
            }
            catch (error) {
                console.error('Error sending email:', error);
                // Log failed email
                yield auditLog_service_1.AuditLogService.createAuditLog({
                    action: auditLog_interface_1.AuditLogAction.SYSTEM_MAINTENANCE,
                    category: auditLog_interface_1.AuditLogCategory.SYSTEM,
                    level: auditLog_interface_1.AuditLogLevel.ERROR,
                    message: 'Email sending failed',
                    resourceType: 'email',
                    metadata: Object.assign({ to: emailData.to, subject: emailData.subject, error: error.message }, emailData.metadata),
                });
                return {
                    success: false,
                    error: error.message,
                };
            }
        });
    }
    sendNotificationEmail(type, to, variables) {
        return __awaiter(this, void 0, void 0, function* () {
            const template = this.templates.get(type);
            if (!template) {
                console.warn(`No email template found for notification type: ${type}`);
                return { success: false, error: 'Template not found' };
            }
            try {
                // Compile templates with variables
                const subjectTemplate = handlebars_1.default.compile(template.subject);
                const htmlTemplate = handlebars_1.default.compile(template.html);
                const textTemplate = handlebars_1.default.compile(template.text);
                const emailData = {
                    to,
                    subject: subjectTemplate(variables),
                    html: htmlTemplate(variables),
                    text: textTemplate(variables),
                    metadata: {
                        notificationType: type,
                        variables,
                    },
                };
                return yield this.sendEmail(emailData);
            }
            catch (error) {
                console.error('Error sending notification email:', error);
                return { success: false, error: error.message };
            }
        });
    }
    htmlToText(html) {
        // Simple HTML to text conversion
        return html
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
    // Get email template for a notification type
    getTemplate(type) {
        return this.templates.get(type);
    }
    // Update email template
    updateTemplate(type, template) {
        this.templates.set(type, template);
    }
    // Test email configuration
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.transporter) {
                return false;
            }
            try {
                yield this.transporter.verify();
                return true;
            }
            catch (error) {
                console.error('Email connection test failed:', error);
                return false;
            }
        });
    }
}
// Export singleton instance
exports.emailService = new EmailService();
exports.default = exports.emailService;
