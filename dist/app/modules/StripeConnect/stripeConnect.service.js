"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const http_status_1 = __importDefault(require("http-status"));
const stripe_1 = __importDefault(require("stripe"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const teacher_model_1 = require("../Teacher/teacher.model");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-04-30.basil',
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
        if (((_a = teacher.stripeConnect) === null || _a === void 0 ? void 0 : _a.status) === 'connected' ||
            teacher.stripeAccountId) {
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
                        url: accountLink.url,
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
// Get comprehensive account status with optimized performance and Redis caching
const getAccountStatus = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, forceRefresh = false) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    try {
        // Check Redis cache first (unless force refresh is requested)
        const cacheKey = `stripe:account:status:${userId}`;
        const { redisOperations } = yield Promise.resolve().then(() => __importStar(require('../../config/redis')));
        if (!forceRefresh) {
            try {
                const cachedData = yield redisOperations.get(cacheKey);
                if (cachedData) {
                    console.log(`🎯 Cache hit for account status: ${userId}`);
                    return JSON.parse(cachedData);
                }
            }
            catch (cacheError) {
                console.warn('Redis cache read failed for account status:', cacheError);
            }
        }
        const teacher = yield teacher_model_1.Teacher.findOne({ user: userId });
        if (!teacher) {
            throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Teacher not found');
        }
        if (!teacher.stripeAccountId) {
            const notConnectedResult = {
                isConnected: false,
                isVerified: false,
                canReceivePayments: false,
                accountId: null,
                requirements: null,
                status: ((_a = teacher.stripeConnect) === null || _a === void 0 ? void 0 : _a.status) || 'not_connected',
                onboardingComplete: false,
                lastStatusUpdate: (_b = teacher.stripeConnect) === null || _b === void 0 ? void 0 : _b.lastStatusUpdate,
                failureReason: (_c = teacher.stripeConnect) === null || _c === void 0 ? void 0 : _c.failureReason,
                estimatedCompletionTime: null,
                verificationStage: 'not_started',
            };
            // Cache not connected status for 10 minutes
            try {
                yield redisOperations.setex(cacheKey, 600, JSON.stringify(notConnectedResult));
            }
            catch (cacheError) {
                console.warn('Redis cache write failed:', cacheError);
            }
            return notConnectedResult;
        }
        // Check if we have recent status data and don't need to refresh
        const lastUpdate = (_d = teacher.stripeConnect) === null || _d === void 0 ? void 0 : _d.lastStatusUpdate;
        const isRecentUpdate = lastUpdate && Date.now() - new Date(lastUpdate).getTime() < 30000; // 30 seconds
        let account;
        if (!forceRefresh &&
            isRecentUpdate &&
            ((_e = teacher.stripeConnect) === null || _e === void 0 ? void 0 : _e.status) === 'connected') {
            // Use cached data for completed accounts to reduce API calls
            account = {
                id: teacher.stripeAccountId,
                details_submitted: ((_f = teacher.stripeConnect) === null || _f === void 0 ? void 0 : _f.onboardingComplete) || false,
                charges_enabled: ((_g = teacher.stripeConnect) === null || _g === void 0 ? void 0 : _g.verified) || false,
                payouts_enabled: ((_h = teacher.stripeConnect) === null || _h === void 0 ? void 0 : _h.verified) || false,
                requirements: {
                    currently_due: ((_j = teacher.stripeConnect) === null || _j === void 0 ? void 0 : _j.requirements) || [],
                },
                capabilities: ((_k = teacher.stripeConnect) === null || _k === void 0 ? void 0 : _k.capabilities) || {},
            };
        }
        else {
            // Fetch fresh data from Stripe
            account = yield stripe.accounts.retrieve(teacher.stripeAccountId);
        }
        // Determine current status and verification stage
        let currentStatus = 'pending';
        let verificationStage = 'account_created';
        let estimatedCompletionTime = null;
        if (account.details_submitted &&
            account.charges_enabled &&
            account.payouts_enabled) {
            currentStatus = 'connected';
            verificationStage = 'completed';
        }
        else if (((_l = account.requirements) === null || _l === void 0 ? void 0 : _l.errors) &&
            account.requirements.errors.length > 0) {
            currentStatus = 'restricted';
            verificationStage = 'action_required';
        }
        else if (account.details_submitted && !account.charges_enabled) {
            currentStatus = 'pending';
            verificationStage = 'under_review';
            // Estimate completion time based on typical Stripe processing
            estimatedCompletionTime = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
        }
        else if (account.details_submitted) {
            currentStatus = 'pending';
            verificationStage = 'processing_capabilities';
            estimatedCompletionTime = new Date(Date.now() + 90 * 1000); // 90 seconds from now
        }
        // Update teacher status if it has changed or if forced refresh
        const statusChanged = ((_m = teacher.stripeConnect) === null || _m === void 0 ? void 0 : _m.status) !== currentStatus;
        const stageChanged = ((_o = teacher.stripeConnect) === null || _o === void 0 ? void 0 : _o.verificationStage) !== verificationStage;
        if (statusChanged || stageChanged || forceRefresh) {
            yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
                'stripeConnect.status': currentStatus,
                'stripeConnect.verified': account.details_submitted && account.charges_enabled,
                'stripeConnect.onboardingComplete': account.details_submitted,
                'stripeConnect.requirements': ((_p = account.requirements) === null || _p === void 0 ? void 0 : _p.currently_due) || [],
                'stripeConnect.capabilities.card_payments': (_q = account.capabilities) === null || _q === void 0 ? void 0 : _q.card_payments,
                'stripeConnect.capabilities.transfers': (_r = account.capabilities) === null || _r === void 0 ? void 0 : _r.transfers,
                'stripeConnect.verificationStage': verificationStage,
                'stripeConnect.estimatedCompletionTime': estimatedCompletionTime,
                'stripeConnect.lastStatusUpdate': new Date(),
                // Update legacy fields for backward compatibility
                stripeVerified: account.details_submitted && account.charges_enabled,
                stripeOnboardingComplete: account.details_submitted,
                stripeRequirements: ((_s = account.requirements) === null || _s === void 0 ? void 0 : _s.currently_due) || [],
            });
        }
        const result = {
            isConnected: true,
            isVerified: account.details_submitted && account.charges_enabled,
            canReceivePayments: account.charges_enabled && account.payouts_enabled,
            accountId: account.id,
            status: currentStatus,
            onboardingComplete: account.details_submitted,
            verificationStage,
            estimatedCompletionTime,
            requirements: {
                currently_due: ((_t = account.requirements) === null || _t === void 0 ? void 0 : _t.currently_due) || [],
                eventually_due: ((_u = account.requirements) === null || _u === void 0 ? void 0 : _u.eventually_due) || [],
                past_due: ((_v = account.requirements) === null || _v === void 0 ? void 0 : _v.past_due) || [],
                pending_verification: ((_w = account.requirements) === null || _w === void 0 ? void 0 : _w.pending_verification) || [],
                errors: ((_x = account.requirements) === null || _x === void 0 ? void 0 : _x.errors) || [],
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
        // Cache the result based on status
        const cacheTime = currentStatus === 'connected' ? 600 : 180; // 10 min for connected, 3 min for others
        try {
            yield redisOperations.setex(cacheKey, cacheTime, JSON.stringify(result));
            console.log(`💾 Cached account status for user: ${userId} (${cacheTime}s)`);
        }
        catch (cacheError) {
            console.warn('Redis cache write failed for account status:', cacheError);
        }
        return result;
    }
    catch (error) {
        console.error('Error getting account status:', error);
        if (error instanceof AppError_1.default) {
            throw error;
        }
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to get account status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// Quick status check for real-time updates (optimized for frequent polling)
const quickStatusCheck = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({ user: userId }).select('stripeAccountId stripeConnect.status stripeConnect.verified stripeConnect.onboardingComplete stripeConnect.verificationStage stripeConnect.estimatedCompletionTime stripeConnect.lastStatusUpdate');
        if (!teacher || !teacher.stripeAccountId) {
            return {
                isConnected: false,
                status: 'not_connected',
                verificationStage: 'not_started',
                needsFullRefresh: false,
            };
        }
        const lastUpdate = (_a = teacher.stripeConnect) === null || _a === void 0 ? void 0 : _a.lastStatusUpdate;
        const timeSinceUpdate = lastUpdate
            ? Date.now() - new Date(lastUpdate).getTime()
            : Infinity;
        // If status is already connected and recently updated, return cached data
        if (((_b = teacher.stripeConnect) === null || _b === void 0 ? void 0 : _b.status) === 'connected' &&
            timeSinceUpdate < 60000) {
            return {
                isConnected: true,
                isVerified: teacher.stripeConnect.verified,
                status: teacher.stripeConnect.status,
                verificationStage: teacher.stripeConnect.verificationStage,
                estimatedCompletionTime: teacher.stripeConnect.estimatedCompletionTime,
                needsFullRefresh: false,
            };
        }
        // If we're in a pending state and it's been less than 30 seconds, return cached data
        if (((_c = teacher.stripeConnect) === null || _c === void 0 ? void 0 : _c.status) === 'pending' &&
            timeSinceUpdate < 30000) {
            return {
                isConnected: true,
                isVerified: teacher.stripeConnect.verified,
                status: teacher.stripeConnect.status,
                verificationStage: teacher.stripeConnect.verificationStage,
                estimatedCompletionTime: teacher.stripeConnect.estimatedCompletionTime,
                needsFullRefresh: false,
            };
        }
        // Suggest a full refresh for more detailed status
        return {
            isConnected: true,
            status: ((_d = teacher.stripeConnect) === null || _d === void 0 ? void 0 : _d.status) || 'pending',
            verificationStage: ((_e = teacher.stripeConnect) === null || _e === void 0 ? void 0 : _e.verificationStage) || 'unknown',
            needsFullRefresh: true,
        };
    }
    catch (error) {
        console.error('Error in quick status check:', error);
        return {
            isConnected: false,
            status: 'error',
            verificationStage: 'error',
            needsFullRefresh: true,
        };
    }
});
// Proactive verification check - called after onboarding completion
const proactiveVerificationCheck = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teacher = yield teacher_model_1.Teacher.findOne({ user: userId });
        if (!teacher || !teacher.stripeAccountId) {
            return null;
        }
        // Immediately check Stripe for the latest status
        const account = yield stripe.accounts.retrieve(teacher.stripeAccountId);
        // If account is now fully verified, update immediately
        if (account.details_submitted &&
            account.charges_enabled &&
            account.payouts_enabled) {
            yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
                'stripeConnect.status': 'connected',
                'stripeConnect.verified': true,
                'stripeConnect.onboardingComplete': true,
                'stripeConnect.verificationStage': 'completed',
                'stripeConnect.estimatedCompletionTime': null,
                'stripeConnect.lastStatusUpdate': new Date(),
                stripeVerified: true,
                stripeOnboardingComplete: true,
            });
            return {
                status: 'connected',
                verificationStage: 'completed',
                isVerified: true,
                canReceivePayments: true,
            };
        }
        // Update with current status
        return yield getAccountStatus(userId, true);
    }
    catch (error) {
        console.error('Error in proactive verification check:', error);
        return null;
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
                        accountId: teacher.stripeAccountId,
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
            auditLog = auditLog.filter((log) => log.action === options.action);
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
    quickStatusCheck,
    proactiveVerificationCheck,
    updateAccount,
    disconnectAccount,
    retryConnection,
    getAuditLog,
};
