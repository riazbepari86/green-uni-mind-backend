"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceRoutes = void 0;
const express_1 = __importDefault(require("express"));
const invoice_controller_1 = require("./invoice.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const zod_1 = require("zod");
const router = express_1.default.Router();
// Validation schemas
const generateInvoiceSchema = zod_1.z.object({
    body: zod_1.z.object({
        studentId: zod_1.z.string().min(1, 'Student ID is required'),
        courseId: zod_1.z.string().min(1, 'Course ID is required'),
        amount: zod_1.z.number().positive('Amount must be positive'),
        teacherStripeAccountId: zod_1.z.string().min(1, 'Teacher Stripe account ID is required'),
    }),
});
const bulkGenerateInvoicesSchema = zod_1.z.object({
    body: zod_1.z.object({
        transactions: zod_1.z.array(zod_1.z.object({
            transactionId: zod_1.z.string().min(1, 'Transaction ID is required'),
            studentId: zod_1.z.string().min(1, 'Student ID is required'),
            courseId: zod_1.z.string().min(1, 'Course ID is required'),
            amount: zod_1.z.number().positive('Amount must be positive'),
            teacherStripeAccountId: zod_1.z.string().min(1, 'Teacher Stripe account ID is required'),
        })).min(1, 'At least one transaction is required'),
    }),
});
// Generate invoice for a specific transaction
router.post('/generate/:transactionId', (0, auth_1.default)(user_constant_1.USER_ROLE.admin, user_constant_1.USER_ROLE.teacher), (0, validateRequest_1.default)(generateInvoiceSchema), invoice_controller_1.InvoiceController.generateInvoice);
// Get invoice by transaction ID
router.get('/transaction/:transactionId', (0, auth_1.default)(user_constant_1.USER_ROLE.admin, user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.student), invoice_controller_1.InvoiceController.getInvoiceByTransaction);
// Get all invoices for a student
router.get('/student/:studentId', (0, auth_1.default)(user_constant_1.USER_ROLE.admin, user_constant_1.USER_ROLE.student), invoice_controller_1.InvoiceController.getStudentInvoices);
// Resend invoice email
router.post('/resend/:transactionId', (0, auth_1.default)(user_constant_1.USER_ROLE.admin, user_constant_1.USER_ROLE.teacher), invoice_controller_1.InvoiceController.resendInvoiceEmail);
// Get invoice statistics for teacher
router.get('/stats/teacher/:teacherId', (0, auth_1.default)(user_constant_1.USER_ROLE.admin, user_constant_1.USER_ROLE.teacher), invoice_controller_1.InvoiceController.getTeacherInvoiceStats);
// Bulk generate invoices
router.post('/bulk-generate', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), (0, validateRequest_1.default)(bulkGenerateInvoicesSchema), invoice_controller_1.InvoiceController.bulkGenerateInvoices);
exports.InvoiceRoutes = router;
