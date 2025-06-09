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
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = __importDefault(require("../../config"));
const date_fns_1 = require("date-fns");
// Create a transporter
const transporter = nodemailer_1.default.createTransport({
    host: config_1.default.email.host,
    port: config_1.default.email.port,
    secure: config_1.default.email.secure,
    auth: {
        user: config_1.default.email.user,
        pass: config_1.default.email.pass,
    },
});
// Email templates
const templates = {
    upcomingPayout: (data) => {
        const formattedDate = (0, date_fns_1.format)(new Date(data.date), 'MMMM dd, yyyy');
        const formattedAmount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(data.amount);
        return {
            subject: `Upcoming Payout of ${formattedAmount} on ${formattedDate}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #4CAF50; margin-bottom: 5px;">Upcoming Payout</h1>
            <p style="color: #666; font-size: 16px;">Your earnings are on the way!</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Hello ${data.teacherName},</h2>
            <p style="color: #555; line-height: 1.5;">
              We're pleased to inform you that your payout of <strong style="color: #4CAF50;">${formattedAmount}</strong> 
              is scheduled to be processed on <strong>${formattedDate}</strong>.
            </p>
            <p style="color: #555; line-height: 1.5;">
              This payout includes your earnings from course sales and will be transferred to your connected bank account.
            </p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">Payout Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; color: #666;">Amount:</td>
                <td style="padding: 8px; font-weight: bold;">${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 8px; color: #666;">Expected Date:</td>
                <td style="padding: 8px;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px; color: #666;">Payout ID:</td>
                <td style="padding: 8px; font-family: monospace;">${data.payoutId}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <p style="color: #555; margin: 0;">
              <strong>Note:</strong> The actual arrival date may vary depending on your bank's processing times.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 14px;">
              Thank you for being a valued instructor at GreenUniMind!
            </p>
            <p style="color: #888; font-size: 12px;">
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      `,
        };
    },
    payoutProcessed: (data) => {
        const formattedDate = (0, date_fns_1.format)(new Date(data.date), 'MMMM dd, yyyy');
        const formattedAmount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(data.amount);
        return {
            subject: `Your Payout of ${formattedAmount} Has Been Processed`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #4CAF50; margin-bottom: 5px;">Payout Processed</h1>
            <p style="color: #666; font-size: 16px;">Your earnings are on the way to your bank account!</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Hello ${data.teacherName},</h2>
            <p style="color: #555; line-height: 1.5;">
              We're pleased to inform you that your payout of <strong style="color: #4CAF50;">${formattedAmount}</strong> 
              has been processed on <strong>${formattedDate}</strong>.
            </p>
            <p style="color: #555; line-height: 1.5;">
              The funds should arrive in your bank account within 2-5 business days, depending on your bank's processing times.
            </p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">Payout Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; color: #666;">Amount:</td>
                <td style="padding: 8px; font-weight: bold;">${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding: 8px; color: #666;">Processing Date:</td>
                <td style="padding: 8px;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px; color: #666;">Payout ID:</td>
                <td style="padding: 8px; font-family: monospace;">${data.payoutId}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 14px;">
              Thank you for being a valued instructor at GreenUniMind!
            </p>
            <p style="color: #888; font-size: 12px;">
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      `,
        };
    },
};
// Send email function
const sendEmail = (to, subject, html) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const info = yield transporter.sendMail({
            from: `"GreenUniMind" <${config_1.default.email.user}>`,
            to,
            subject,
            html,
        });
        console.log(`Email sent: ${info.messageId}`);
        return true;
    }
    catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
});
// Send upcoming payout notification
const sendUpcomingPayoutNotification = (teacherEmail, teacherName, amount, date, payoutId) => __awaiter(void 0, void 0, void 0, function* () {
    const { subject, html } = templates.upcomingPayout({
        teacherName,
        amount,
        date,
        payoutId,
    });
    return sendEmail(teacherEmail, subject, html);
});
// Send payout processed notification
const sendPayoutProcessedNotification = (teacherEmail, teacherName, amount, date, payoutId) => __awaiter(void 0, void 0, void 0, function* () {
    const { subject, html } = templates.payoutProcessed({
        teacherName,
        amount,
        date,
        payoutId,
    });
    return sendEmail(teacherEmail, subject, html);
});
exports.EmailService = {
    sendUpcomingPayoutNotification,
    sendPayoutProcessedNotification,
};
