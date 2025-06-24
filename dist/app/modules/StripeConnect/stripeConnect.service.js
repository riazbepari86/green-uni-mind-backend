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
exports.StripeConnectService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const teacher_model_1 = require("../Teacher/teacher.model");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});
// Create Stripe Connect account with email pre-population
const createStripeAccount = (userId, accountData) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    let teacher = null;
    try {
        console.log('Creating Stripe account for user:', userId);
        // Check if teacher already has a Stripe account
        teacher = yield teacher_model_1.Teacher.findOne({ user: userId }).populate('user');
        if (!teacher) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
        }
        // Check if teacher already has a connected Stripe account
        if (((_a = teacher.stripeConnect) === null || _a === void 0 ? void 0 : _a.status) === 'connected' || teacher.stripeAccountId) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Teacher already has a connected Stripe account');
        }
        // Use teacher's email for Stripe account creation
        const emailToUse = accountData.email || teacher.email;
        // Update teacher status to pending
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            'stripeConnect.status': 'pending',
            'stripeConnect.lastStatusUpdate': new Date(),
            $push: {
                stripeAuditLog: {
                    action: 'account_created',
                    timestamp: new Date(),
                    details: { type: accountData.type, country: accountData.country },
                    ipAddress: accountData.ipAddress,
                    userAgent: accountData.userAgent,
                },
            },
        });
        // Create Stripe Express account with enhanced configuration
        const account = yield stripe.accounts.create({
            type: accountData.type,
            country: accountData.country,
            email: emailToUse, // Pre-populate with teacher's email
            business_type: accountData.business_type || 'individual',
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            settings: {
                payouts: {
                    schedule: {
                        interval: 'daily',
                    },
                },
            },
            metadata: {
                teacherId: teacher._id.toString(),
                userId: userId,
                platform: 'LMS',
                createdAt: new Date().toISOString(),
            },
        });
        // Update teacher with comprehensive Stripe information
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            stripeAccountId: account.id, // Legacy field
            stripeEmail: emailToUse, // Legacy field
            'stripeConnect.accountId': account.id,
            'stripeConnect.email': emailToUse,
            'stripeConnect.status': 'pending',
            'stripeConnect.onboardingComplete': false,
            'stripeConnect.verified': false,
            'stripeConnect.lastStatusUpdate': new Date(),
            'stripeConnect.connectedAt': new Date(),
        });
        console.log('Stripe account created successfully:', account.id);
        return {
            success: true,
            accountId: account.id,
            email: emailToUse,
            status: 'pending',
            isConnected: true,
            isVerified: account.details_submitted && account.charges_enabled,
            canReceivePayments: account.charges_enabled && account.payouts_enabled,
            requirements: account.requirements,
            message: 'Stripe account created successfully. Please complete onboarding.',
        };
    }
    catch (error) {
        console.error('Error creating Stripe account:', error);
        // Log the error in audit trail
        if (teacher) {
            yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
                'stripeConnect.status': 'failed',
                'stripeConnect.failureReason': error.message,
                'stripeConnect.lastStatusUpdate': new Date(),
                $push: {
                    stripeAuditLog: {
                        action: 'error_occurred',
                        timestamp: new Date(),
                        details: { error: error.message, stack: error.stack },
                        ipAddress: accountData.ipAddress,
                        userAgent: accountData.userAgent,
                    },
                },
            });
        }
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to create Stripe account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// Create account link for onboarding with enhanced tracking
const createAccountLink = (userId, linkData) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({ user: userId });
        if (!teacher || !teacher.stripeAccountId) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'No Stripe account found for this teacher');
        }
        // Create account link with enhanced return URLs for success/failure handling
        const accountLink = yield stripe.accountLinks.create({
            account: teacher.stripeAccountId,
            refresh_url: linkData.refreshUrl,
            return_url: linkData.returnUrl,
            type: linkData.type,
        });
        // Update teacher with onboarding URL and log the action
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            'stripeConnect.onboardingUrl': accountLink.url,
            'stripeConnect.lastStatusUpdate': new Date(),
            $push: {
                stripeAuditLog: {
                    action: 'onboarding_started',
                    timestamp: new Date(),
                    details: {
                        type: linkData.type,
                        expiresAt: accountLink.expires_at,
                        url: accountLink.url
                    },
                    ipAddress: linkData.ipAddress,
                    userAgent: linkData.userAgent,
                },
            },
        });
        return {
            url: accountLink.url,
            expiresAt: accountLink.expires_at,
            success: true,
            message: 'Onboarding link created successfully',
        };
    }
    catch (error) {
        console.error('Error creating account link:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to create account link: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// Get comprehensive account status
const getAccountStatus = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({ user: userId });
        if (!teacher) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
        }
        if (!teacher.stripeAccountId) {
            return {
                isConnected: false,
                isVerified: false,
                canReceivePayments: false,
                accountId: null,
                requirements: null,
                status: ((_a = teacher.stripeConnect) === null || _a === void 0 ? void 0 : _a.status) || 'not_connected',
                onboardingComplete: false,
                lastStatusUpdate: (_b = teacher.stripeConnect) === null || _b === void 0 ? void 0 : _b.lastStatusUpdate,
                failureReason: (_c = teacher.stripeConnect) === null || _c === void 0 ? void 0 : _c.failureReason,
            };
        }
        const account = yield stripe.accounts.retrieve(teacher.stripeAccountId);
        // Determine current status based on Stripe account state
        let currentStatus = 'pending';
        if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
            currentStatus = 'connected';
        }
        else if (((_d = account.requirements) === null || _d === void 0 ? void 0 : _d.errors) && account.requirements.errors.length > 0) {
            currentStatus = 'restricted';
        }
        // Update teacher status if it has changed
        if (((_e = teacher.stripeConnect) === null || _e === void 0 ? void 0 : _e.status) !== currentStatus) {
            yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
                'stripeConnect.status': currentStatus,
                'stripeConnect.verified': account.details_submitted && account.charges_enabled,
                'stripeConnect.onboardingComplete': account.details_submitted,
                'stripeConnect.requirements': ((_f = account.requirements) === null || _f === void 0 ? void 0 : _f.currently_due) || [],
                'stripeConnect.capabilities.card_payments': (_g = account.capabilities) === null || _g === void 0 ? void 0 : _g.card_payments,
                'stripeConnect.capabilities.transfers': (_h = account.capabilities) === null || _h === void 0 ? void 0 : _h.transfers,
                'stripeConnect.lastStatusUpdate': new Date(),
                // Update legacy fields for backward compatibility
                stripeVerified: account.details_submitted && account.charges_enabled,
                stripeOnboardingComplete: account.details_submitted,
                stripeRequirements: ((_j = account.requirements) === null || _j === void 0 ? void 0 : _j.currently_due) || [],
            });
        }
        return {
            isConnected: true,
            isVerified: account.details_submitted && account.charges_enabled,
            canReceivePayments: account.charges_enabled && account.payouts_enabled,
            accountId: account.id,
            status: currentStatus,
            onboardingComplete: account.details_submitted,
            requirements: {
                currently_due: ((_k = account.requirements) === null || _k === void 0 ? void 0 : _k.currently_due) || [],
                eventually_due: ((_l = account.requirements) === null || _l === void 0 ? void 0 : _l.eventually_due) || [],
                past_due: ((_m = account.requirements) === null || _m === void 0 ? void 0 : _m.past_due) || [],
                pending_verification: ((_o = account.requirements) === null || _o === void 0 ? void 0 : _o.pending_verification) || [],
                errors: ((_p = account.requirements) === null || _p === void 0 ? void 0 : _p.errors) || [],
            },
            capabilities: account.capabilities,
            country: account.country,
            defaultCurrency: account.default_currency,
            email: account.email,
            businessProfile: account.business_profile,
            lastStatusUpdate: new Date(),
            payoutsEnabled: account.payouts_enabled,
            chargesEnabled: account.charges_enabled,
        };
    }
    catch (error) {
        console.error('Error getting account status:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to get account status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// Update account information
const updateAccount = (userId, updateData) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({ user: userId });
        if (!teacher || !teacher.stripeAccountId) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'No Stripe account found for this teacher');
        }
        const updatedAccount = yield stripe.accounts.update(teacher.stripeAccountId, updateData);
        return {
            accountId: updatedAccount.id,
            businessProfile: updatedAccount.business_profile,
            capabilities: updatedAccount.capabilities,
            requirements: updatedAccount.requirements,
        };
    }
    catch (error) {
        console.error('Error updating account:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to update account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// Delete/disconnect account with comprehensive cleanup
const disconnectAccount = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({ user: userId });
        if (!teacher || !teacher.stripeAccountId) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'No Stripe account found for this teacher');
        }
        // Delete the Stripe account
        yield stripe.accounts.del(teacher.stripeAccountId);
        // Update teacher with comprehensive cleanup
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            // Update status fields
            'stripeConnect.status': 'disconnected',
            'stripeConnect.disconnectedAt': new Date(),
            'stripeConnect.lastStatusUpdate': new Date(),
            'stripeConnect.onboardingComplete': false,
            'stripeConnect.verified': false,
            // Clear legacy fields
            stripeVerified: false,
            stripeOnboardingComplete: false,
            $unset: {
                // Legacy fields
                stripeAccountId: 1,
                stripeEmail: 1,
                // New fields
                'stripeConnect.accountId': 1,
                'stripeConnect.email': 1,
                'stripeConnect.onboardingUrl': 1,
                'stripeConnect.capabilities': 1,
            },
            $push: {
                stripeAuditLog: {
                    action: 'account_disconnected',
                    timestamp: new Date(),
                    details: {
                        reason: (options === null || options === void 0 ? void 0 : options.reason) || 'Manual disconnection',
                        accountId: teacher.stripeAccountId
                    },
                    ipAddress: options === null || options === void 0 ? void 0 : options.ipAddress,
                    userAgent: options === null || options === void 0 ? void 0 : options.userAgent,
                },
            },
        });
        return {
            success: true,
            message: 'Stripe account disconnected successfully',
            status: 'disconnected',
            disconnectedAt: new Date(),
        };
    }
    catch (error) {
        console.error('Error disconnecting account:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to disconnect account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// Retry failed connection
const retryConnection = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({ user: userId });
        if (!teacher) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
        }
        if (((_a = teacher.stripeConnect) === null || _a === void 0 ? void 0 : _a.status) !== 'failed') {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'No failed connection to retry');
        }
        // Reset status to allow retry
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            'stripeConnect.status': 'not_connected',
            'stripeConnect.failureReason': undefined,
            'stripeConnect.lastStatusUpdate': new Date(),
            $push: {
                stripeAuditLog: {
                    action: 'account_created',
                    timestamp: new Date(),
                    details: { action: 'retry_connection' },
                    ipAddress: options === null || options === void 0 ? void 0 : options.ipAddress,
                    userAgent: options === null || options === void 0 ? void 0 : options.userAgent,
                },
            },
        });
        return {
            success: true,
            message: 'Connection reset successfully. You can now try connecting again.',
            status: 'not_connected',
        };
    }
    catch (error) {
        console.error('Error retrying connection:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to retry connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// Get audit log for compliance
const getAuditLog = (userId, options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({ user: userId });
        if (!teacher) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
        }
        let auditLog = teacher.stripeAuditLog || [];
        // Filter by action if specified
        if (options === null || options === void 0 ? void 0 : options.action) {
            auditLog = auditLog.filter(log => log.action === options.action);
        }
        // Sort by timestamp (newest first)
        auditLog.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        // Apply pagination
        const offset = (options === null || options === void 0 ? void 0 : options.offset) || 0;
        const limit = (options === null || options === void 0 ? void 0 : options.limit) || 50;
        const paginatedLog = auditLog.slice(offset, offset + limit);
        return {
            success: true,
            auditLog: paginatedLog,
            total: auditLog.length,
            offset,
            limit,
        };
    }
    catch (error) {
        console.error('Error getting audit log:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to get audit log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
exports.StripeConnectService = {
    createStripeAccount,
    createAccountLink,
    getAccountStatus,
    updateAccount,
    disconnectAccount,
    retryConnection,
    getAuditLog,
};
