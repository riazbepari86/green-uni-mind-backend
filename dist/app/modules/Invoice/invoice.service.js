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
exports.InvoiceService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const mongoose_1 = require("mongoose");
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const student_model_1 = require("../Student/student.model");
const course_model_1 = require("../Course/course.model");
const transaction_model_1 = require("../Payment/transaction.model");
const sendEmail_1 = require("../../utils/sendEmail");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});
// Invoice configuration
const INVOICE_CONFIG = {
    CURRENCY: 'usd',
    PAYMENT_TERMS: 'due_on_receipt',
    COLLECTION_METHOD: 'send_invoice',
    AUTO_ADVANCE: true,
    DAYS_UNTIL_DUE: 7,
    FOOTER: 'Thank you for your purchase! For support, contact us at support@yourlms.com',
    DESCRIPTION_TEMPLATE: 'Course enrollment: {courseTitle}',
};
// Enhanced invoice creation with comprehensive error handling
const createStripeInvoice = (studentId, courseId, transactionId, amount, teacherStripeAccountId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('Creating Stripe invoice:', {
            studentId,
            courseId,
            transactionId,
            amount,
            teacherStripeAccountId,
        });
        // Validate inputs
        if (!studentId || !courseId || !transactionId || !amount || !teacherStripeAccountId) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Missing required parameters for invoice creation');
        }
        // Get student, course, and teacher data
        const [student, course, transaction] = yield Promise.all([
            student_model_1.Student.findById(studentId),
            course_model_1.Course.findById(courseId).populate('creator'),
            transaction_model_1.Transaction.findById(transactionId),
        ]);
        if (!student) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student not found');
        }
        if (!course) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Course not found');
        }
        if (!transaction) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Transaction not found');
        }
        const teacher = course.creator;
        if (!teacher) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
        }
        // Create or retrieve Stripe customer
        let stripeCustomer;
        try {
            // First, try to find existing customer by email
            const existingCustomers = yield stripe.customers.list({
                email: student.email,
                limit: 1,
            });
            if (existingCustomers.data.length > 0) {
                stripeCustomer = existingCustomers.data[0];
                console.log('Found existing Stripe customer:', stripeCustomer.id);
            }
            else {
                // Create new customer
                stripeCustomer = yield stripe.customers.create({
                    email: student.email,
                    name: `${student.name.firstName} ${student.name.lastName}`,
                    metadata: {
                        studentId: studentId,
                        platform: 'LMS',
                    },
                });
                console.log('Created new Stripe customer:', stripeCustomer.id);
            }
        }
        catch (error) {
            console.error('Error creating/retrieving Stripe customer:', error);
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to create or retrieve customer');
        }
        // Create invoice with comprehensive details
        const invoiceData = {
            customer: stripeCustomer.id,
            currency: INVOICE_CONFIG.CURRENCY,
            collection_method: INVOICE_CONFIG.COLLECTION_METHOD,
            auto_advance: INVOICE_CONFIG.AUTO_ADVANCE,
            days_until_due: INVOICE_CONFIG.DAYS_UNTIL_DUE,
            footer: INVOICE_CONFIG.FOOTER,
            metadata: {
                studentId,
                courseId,
                transactionId,
                teacherId: teacher._id.toString(),
                platform: 'LMS',
                invoiceType: 'course_enrollment',
            },
            // Connect to teacher's Stripe account for payment processing
            on_behalf_of: teacherStripeAccountId,
            transfer_data: {
                destination: teacherStripeAccountId,
            },
        };
        const invoice = yield stripe.invoices.create(invoiceData);
        console.log('Created Stripe invoice:', invoice.id);
        // Add invoice item
        yield stripe.invoiceItems.create({
            customer: stripeCustomer.id,
            invoice: invoice.id,
            amount: Math.round(amount * 100), // Convert to cents
            currency: INVOICE_CONFIG.CURRENCY,
            description: INVOICE_CONFIG.DESCRIPTION_TEMPLATE.replace('{courseTitle}', course.title),
            metadata: {
                courseId,
                courseTitle: course.title,
                teacherName: `${teacher.name.firstName} ${teacher.name.lastName}`,
            },
        });
        // Finalize the invoice
        const finalizedInvoice = yield stripe.invoices.finalizeInvoice(invoice.id);
        console.log('Finalized invoice:', finalizedInvoice.id);
        // Update transaction with invoice details
        yield transaction_model_1.Transaction.findByIdAndUpdate(transactionId, {
            stripeInvoiceId: finalizedInvoice.id,
            stripeInvoiceUrl: finalizedInvoice.hosted_invoice_url,
            stripePdfUrl: finalizedInvoice.invoice_pdf,
            invoiceStatus: finalizedInvoice.status,
        });
        return {
            invoiceId: finalizedInvoice.id,
            invoiceUrl: finalizedInvoice.hosted_invoice_url,
            pdfUrl: finalizedInvoice.invoice_pdf,
            status: finalizedInvoice.status,
            customer: stripeCustomer,
        };
    }
    catch (error) {
        console.error('Error creating Stripe invoice:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// Send invoice email with enhanced template
const sendInvoiceEmail = (studentEmail, studentName, courseTitle, teacherName, invoiceUrl, pdfUrl, amount) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const emailTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Course Enrollment Invoice</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Course Enrollment Invoice</h1>
            <p>Thank you for your purchase!</p>
          </div>
          
          <div class="content">
            <h2>Hello ${studentName},</h2>
            
            <p>Thank you for enrolling in <strong>${courseTitle}</strong> with instructor ${teacherName}. Your payment has been processed successfully.</p>
            
            <div class="invoice-details">
              <h3>Invoice Details</h3>
              <p><strong>Course:</strong> ${courseTitle}</p>
              <p><strong>Instructor:</strong> ${teacherName}</p>
              <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
              <p><strong>Status:</strong> Paid</p>
            </div>
            
            <p>You can view and download your invoice using the links below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invoiceUrl}" class="button">View Invoice Online</a>
              <a href="${pdfUrl}" class="button">Download PDF</a>
            </div>
            
            <p>You now have full access to the course content. Start learning today!</p>
            
            <p>If you have any questions or need support, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>The Learning Platform Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>For support, contact us at support@yourlms.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
        yield (0, sendEmail_1.sendEmail)({
            to: studentEmail,
            subject: `Invoice for ${courseTitle} - Course Enrollment`,
            html: emailTemplate,
        });
        console.log('Invoice email sent successfully to:', studentEmail);
        return { success: true };
    }
    catch (error) {
        console.error('Error sending invoice email:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to send invoice email');
    }
});
// Process invoice generation for completed payment
const processInvoiceGeneration = (studentId, courseId, transactionId, amount, teacherStripeAccountId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('Processing invoice generation for transaction:', transactionId);
        // Create Stripe invoice
        const invoiceResult = yield createStripeInvoice(studentId, courseId, transactionId, amount, teacherStripeAccountId);
        // Get student and course details for email
        const [student, course] = yield Promise.all([
            student_model_1.Student.findById(studentId),
            course_model_1.Course.findById(courseId).populate('creator'),
        ]);
        if (!student || !course) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student or course not found');
        }
        const teacher = course.creator;
        const teacherName = `${teacher.name.firstName} ${teacher.name.lastName}`;
        const studentName = `${student.name.firstName} ${student.name.lastName}`;
        // Send invoice email
        yield sendInvoiceEmail(student.email, studentName, course.title, teacherName, invoiceResult.invoiceUrl, invoiceResult.pdfUrl, amount);
        console.log('Invoice generation completed successfully');
        return invoiceResult;
    }
    catch (error) {
        console.error('Error processing invoice generation:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to process invoice generation');
    }
});
// Get invoice by transaction ID
const getInvoiceByTransactionId = (transactionId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const transaction = yield transaction_model_1.Transaction.findById(transactionId);
        if (!transaction) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Transaction not found');
        }
        if (!transaction.stripeInvoiceId) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Invoice not found for this transaction');
        }
        const invoice = yield stripe.invoices.retrieve(transaction.stripeInvoiceId);
        return {
            invoiceId: invoice.id,
            invoiceUrl: invoice.hosted_invoice_url,
            pdfUrl: invoice.invoice_pdf,
            status: invoice.status,
            amount: invoice.amount_paid / 100,
            created: new Date(invoice.created * 1000),
        };
    }
    catch (error) {
        console.error('Error retrieving invoice:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to retrieve invoice');
    }
});
// Get all invoices for a student
const getStudentInvoices = (studentId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const transactions = yield transaction_model_1.Transaction.find({
            studentId: new mongoose_1.Types.ObjectId(studentId),
            stripeInvoiceId: { $exists: true, $ne: null },
        })
            .populate('courseId', 'title')
            .populate('teacherId', 'name')
            .sort({ createdAt: -1 });
        const invoices = yield Promise.all(transactions.map((transaction) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            try {
                const invoice = yield stripe.invoices.retrieve(transaction.stripeInvoiceId);
                return {
                    transactionId: transaction._id,
                    invoiceId: invoice.id,
                    invoiceUrl: invoice.hosted_invoice_url,
                    pdfUrl: invoice.invoice_pdf,
                    status: invoice.status,
                    amount: invoice.amount_paid / 100,
                    courseTitle: ((_a = transaction.courseId) === null || _a === void 0 ? void 0 : _a.title) || 'Unknown Course',
                    teacherName: ((_b = transaction.teacherId) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown Teacher',
                    created: new Date(invoice.created * 1000),
                };
            }
            catch (error) {
                console.error('Error retrieving invoice for transaction:', transaction._id, error);
                return null;
            }
        })));
        return invoices.filter(Boolean);
    }
    catch (error) {
        console.error('Error retrieving student invoices:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to retrieve student invoices');
    }
});
exports.InvoiceService = {
    createStripeInvoice,
    sendInvoiceEmail,
    processInvoiceGeneration,
    getInvoiceByTransactionId,
    getStudentInvoices,
};
