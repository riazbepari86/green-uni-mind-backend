import Stripe from 'stripe';
import { Types } from 'mongoose';
import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { Student } from '../Student/student.model';
import { Teacher } from '../Teacher/teacher.model';
import { Course } from '../Course/course.model';
import { Transaction } from '../Payment/transaction.model';
import { sendEmail } from '../../utils/sendEmail';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-04-30.basil',
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
const createStripeInvoice = async (
  studentId: string,
  courseId: string,
  transactionId: string,
  amount: number,
  teacherStripeAccountId: string
) => {
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
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Missing required parameters for invoice creation'
      );
    }

    // Get student, course, and teacher data
    const [student, course, transaction] = await Promise.all([
      Student.findById(studentId),
      Course.findById(courseId).populate('creator'),
      Transaction.findById(transactionId),
    ]);

    if (!student) {
      throw new AppError(httpStatus.NOT_FOUND, 'Student not found');
    }

    if (!course) {
      throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
    }

    if (!transaction) {
      throw new AppError(httpStatus.NOT_FOUND, 'Transaction not found');
    }

    const teacher = course.creator as any;
    if (!teacher) {
      throw new AppError(httpStatus.NOT_FOUND, 'Teacher not found');
    }

    // Create or retrieve Stripe customer
    let stripeCustomer;
    try {
      // First, try to find existing customer by email
      const existingCustomers = await stripe.customers.list({
        email: student.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomer = existingCustomers.data[0];
        console.log('Found existing Stripe customer:', stripeCustomer.id);
      } else {
        // Create new customer
        stripeCustomer = await stripe.customers.create({
          email: student.email,
          name: `${student.name.firstName} ${student.name.lastName}`,
          metadata: {
            studentId: studentId,
            platform: 'LMS',
          },
        });
        console.log('Created new Stripe customer:', stripeCustomer.id);
      }
    } catch (error) {
      console.error('Error creating/retrieving Stripe customer:', error);
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to create or retrieve customer'
      );
    }

    // Create invoice with comprehensive details
    const invoiceData: Stripe.InvoiceCreateParams = {
      customer: stripeCustomer.id,
      currency: INVOICE_CONFIG.CURRENCY,
      collection_method: INVOICE_CONFIG.COLLECTION_METHOD as any,
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

    const invoice = await stripe.invoices.create(invoiceData);
    console.log('Created Stripe invoice:', invoice.id);

    // Add invoice item
    await stripe.invoiceItems.create({
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
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id!);
    console.log('Finalized invoice:', finalizedInvoice.id);

    // Update transaction with invoice details
    await Transaction.findByIdAndUpdate(transactionId, {
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
  } catch (error) {
    console.error('Error creating Stripe invoice:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

// Send invoice email with enhanced template
const sendInvoiceEmail = async (
  studentEmail: string,
  studentName: string,
  courseTitle: string,
  teacherName: string,
  invoiceUrl: string,
  pdfUrl: string,
  amount: number
) => {
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

    await sendEmail(
      studentEmail,
      emailTemplate,
      `Invoice for ${courseTitle} - Course Enrollment`
    );

    console.log('Invoice email sent successfully to:', studentEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending invoice email:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to send invoice email'
    );
  }
};

// Process invoice generation for completed payment
const processInvoiceGeneration = async (
  studentId: string,
  courseId: string,
  transactionId: string,
  amount: number,
  teacherStripeAccountId: string
) => {
  try {
    console.log('Processing invoice generation for transaction:', transactionId);

    // Create Stripe invoice
    const invoiceResult = await createStripeInvoice(
      studentId,
      courseId,
      transactionId,
      amount,
      teacherStripeAccountId
    );

    // Get student and course details for email
    const [student, course] = await Promise.all([
      Student.findById(studentId),
      Course.findById(courseId).populate('creator'),
    ]);

    if (!student || !course) {
      throw new AppError(httpStatus.NOT_FOUND, 'Student or course not found');
    }

    const teacher = course.creator as any;
    const teacherName = `${teacher.name.firstName} ${teacher.name.lastName}`;
    const studentName = `${student.name.firstName} ${student.name.lastName}`;

    // Send invoice email
    await sendInvoiceEmail(
      student.email,
      studentName,
      course.title,
      teacherName,
      invoiceResult.invoiceUrl || '',
      invoiceResult.pdfUrl || '',
      amount
    );

    console.log('Invoice generation completed successfully');
    return invoiceResult;
  } catch (error) {
    console.error('Error processing invoice generation:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to process invoice generation'
    );
  }
};

// Get invoice by transaction ID
const getInvoiceByTransactionId = async (transactionId: string) => {
  try {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      throw new AppError(httpStatus.NOT_FOUND, 'Transaction not found');
    }

    if (!transaction.stripeInvoiceUrl) {
      throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found for this transaction');
    }

    // Extract invoice ID from URL or use stored transaction ID
    const invoiceId = transaction.stripeTransactionId;
    const invoice = await stripe.invoices.retrieve(invoiceId);
    return {
      invoiceId: invoice.id,
      invoiceUrl: invoice.hosted_invoice_url,
      pdfUrl: invoice.invoice_pdf,
      status: invoice.status,
      amount: invoice.amount_paid / 100,
      created: new Date(invoice.created * 1000),
    };
  } catch (error) {
    console.error('Error retrieving invoice:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to retrieve invoice'
    );
  }
};

// Get all invoices for a student
const getStudentInvoices = async (studentId: string) => {
  try {
    const transactions = await Transaction.find({
      studentId: new Types.ObjectId(studentId),
      stripeInvoiceId: { $exists: true, $ne: null },
    })
      .populate('courseId', 'title')
      .populate('teacherId', 'name')
      .sort({ createdAt: -1 });

    const invoices = await Promise.all(
      transactions.map(async (transaction) => {
        try {
          const invoice = await stripe.invoices.retrieve(transaction.stripeTransactionId);
          return {
            transactionId: transaction._id,
            invoiceId: invoice.id,
            invoiceUrl: invoice.hosted_invoice_url,
            pdfUrl: invoice.invoice_pdf,
            status: invoice.status,
            amount: invoice.amount_paid / 100,
            courseTitle: (transaction.courseId as any)?.title || 'Unknown Course',
            teacherName: (transaction.teacherId as any)?.name || 'Unknown Teacher',
            created: new Date(invoice.created * 1000),
          };
        } catch (error) {
          console.error('Error retrieving invoice for transaction:', transaction._id, error);
          return null;
        }
      })
    );

    return invoices.filter(Boolean);
  } catch (error) {
    console.error('Error retrieving student invoices:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to retrieve student invoices'
    );
  }
};

export const InvoiceService = {
  createStripeInvoice,
  sendInvoiceEmail,
  processInvoiceGeneration,
  getInvoiceByTransactionId,
  getStudentInvoices,
};
