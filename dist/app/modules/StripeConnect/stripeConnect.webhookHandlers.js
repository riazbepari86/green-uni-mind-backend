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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeConnectWebhookHandlers = void 0;
const teacher_model_1 = require("../Teacher/teacher.model");
const payout_model_1 = require("../Payment/payout.model");
const auditLog_model_1 = require("../AuditLog/auditLog.model");
const notification_service_1 = require("../Notification/notification.service");
const auditLog_interface_1 = require("../AuditLog/auditLog.interface");
const notification_interface_1 = require("../Notification/notification.interface");
const payout_interface_1 = require("../Payment/payout.interface");
// Handle account.updated event with comprehensive status tracking
const handleAccountUpdated = (event) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const startTime = Date.now();
    try {
        const account = event.data.object;
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: account.id },
                { 'stripeConnect.accountId': account.id }
            ]
        });
        if (!teacher) {
            console.log(`Teacher not found for Stripe account: ${account.id}`);
            return {
                success: true,
                error: 'Teacher not found - skipping',
                processingTime: Date.now() - startTime,
            };
        }
        // Determine comprehensive status
        let status = 'pending';
        let statusReason = '';
        let accountHealthScore = 0;
        if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
            status = 'connected';
            statusReason = 'Account fully verified and operational';
            accountHealthScore = 100;
        }
        else if (((_a = account.requirements) === null || _a === void 0 ? void 0 : _a.errors) && account.requirements.errors.length > 0) {
            status = 'restricted';
            statusReason = `Account restricted: ${account.requirements.errors.map(e => e.reason).join(', ')}`;
            accountHealthScore = 25;
        }
        else if (((_b = account.requirements) === null || _b === void 0 ? void 0 : _b.currently_due) && account.requirements.currently_due.length > 0) {
            status = 'pending';
            statusReason = `Pending verification: ${account.requirements.currently_due.join(', ')}`;
            accountHealthScore = 60;
        }
        else if (!account.details_submitted) {
            status = 'pending';
            statusReason = 'Onboarding not completed';
            accountHealthScore = 30;
        }
        // Update teacher with comprehensive information
        const updateResult = yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            $set: {
                'stripeConnect.status': status,
                'stripeConnect.verified': account.details_submitted && account.charges_enabled,
                'stripeConnect.onboardingComplete': account.details_submitted,
                'stripeConnect.requirements': ((_c = account.requirements) === null || _c === void 0 ? void 0 : _c.currently_due) || [],
                'stripeConnect.capabilities.card_payments': (_d = account.capabilities) === null || _d === void 0 ? void 0 : _d.card_payments,
                'stripeConnect.capabilities.transfers': (_e = account.capabilities) === null || _e === void 0 ? void 0 : _e.transfers,
                'stripeConnect.lastStatusUpdate': new Date(),
                'stripeConnect.lastWebhookReceived': new Date(),
                'stripeConnect.failureReason': status === 'restricted' ? statusReason : undefined,
                'stripeConnect.accountHealthScore': accountHealthScore,
                'stripeConnect.businessProfile': account.business_profile,
                'stripeConnect.settings': account.settings,
                // Legacy fields for backward compatibility
                stripeVerified: account.details_submitted && account.charges_enabled,
                stripeOnboardingComplete: account.details_submitted,
                stripeRequirements: ((_f = account.requirements) === null || _f === void 0 ? void 0 : _f.currently_due) || [],
            },
            $push: {
                'stripeConnect.auditTrail': {
                    action: 'account_updated',
                    timestamp: new Date(),
                    details: {
                        event: 'account.updated',
                        status,
                        statusReason,
                        accountHealthScore,
                        charges_enabled: account.charges_enabled,
                        payouts_enabled: account.payouts_enabled,
                        details_submitted: account.details_submitted,
                        requirements: account.requirements,
                        capabilities: account.capabilities,
                    },
                },
            },
        }, { new: true });
        // Log audit event
        yield auditLog_model_1.AuditLog.create({
            action: auditLog_interface_1.AuditLogAction.STRIPE_ACCOUNT_UPDATED,
            category: auditLog_interface_1.AuditLogCategory.STRIPE_CONNECT,
            level: auditLog_interface_1.AuditLogLevel.INFO,
            message: `Stripe account updated: ${status}`,
            userId: teacher._id,
            userType: 'teacher',
            resourceType: 'stripe_account',
            resourceId: account.id,
            metadata: {
                stripeEventId: event.id,
                stripeAccountId: account.id,
                previousStatus: (_g = teacher.stripeConnect) === null || _g === void 0 ? void 0 : _g.status,
                newStatus: status,
                accountHealthScore,
                statusReason,
            },
            timestamp: new Date(),
        });
        // Send notification based on status change
        if (((_h = teacher.stripeConnect) === null || _h === void 0 ? void 0 : _h.status) !== status) {
            let notificationType;
            let priority = notification_interface_1.NotificationPriority.NORMAL;
            switch (status) {
                case 'connected':
                    notificationType = notification_interface_1.NotificationType.STRIPE_ACCOUNT_VERIFIED;
                    priority = notification_interface_1.NotificationPriority.HIGH;
                    break;
                case 'restricted':
                    notificationType = notification_interface_1.NotificationType.STRIPE_ACCOUNT_RESTRICTED;
                    priority = notification_interface_1.NotificationPriority.URGENT;
                    break;
                case 'pending':
                    notificationType = notification_interface_1.NotificationType.STRIPE_ACCOUNT_REQUIREMENTS_DUE;
                    priority = notification_interface_1.NotificationPriority.HIGH;
                    break;
                default:
                    notificationType = notification_interface_1.NotificationType.STRIPE_ACCOUNT_VERIFIED;
            }
            yield notification_service_1.NotificationService.createNotification({
                type: notificationType,
                priority,
                userId: teacher._id,
                userType: 'teacher',
                title: `Stripe Account Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                body: statusReason,
                relatedResourceType: 'stripe_account',
                relatedResourceId: account.id,
                metadata: {
                    accountHealthScore,
                    requirements: (_j = account.requirements) === null || _j === void 0 ? void 0 : _j.currently_due,
                    capabilities: account.capabilities,
                },
            });
        }
        return {
            success: true,
            processingTime: Date.now() - startTime,
            affectedUserId: teacher._id.toString(),
            affectedUserType: 'teacher',
            relatedResourceIds: [account.id],
        };
    }
    catch (error) {
        console.error('Error handling account.updated webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Handle account.application.deauthorized event
const handleAccountDeauthorized = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        const deauthorization = event.data.object;
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: deauthorization.account },
                { 'stripeConnect.accountId': deauthorization.account }
            ]
        });
        if (!teacher) {
            return {
                success: true,
                error: 'Teacher not found - skipping',
                processingTime: Date.now() - startTime,
            };
        }
        // Update teacher account status
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            $set: {
                'stripeConnect.status': 'disconnected',
                'stripeConnect.disconnectedAt': new Date(),
                'stripeConnect.lastStatusUpdate': new Date(),
                'stripeConnect.failureReason': 'Account deauthorized by user',
                'stripeConnect.accountHealthScore': 0,
                // Clear sensitive data
                'stripeConnect.onboardingUrl': undefined,
                'stripeConnect.capabilities': undefined,
            },
            $push: {
                'stripeConnect.auditTrail': {
                    action: 'account_deauthorized',
                    timestamp: new Date(),
                    details: {
                        event: 'account.application.deauthorized',
                        reason: 'Account deauthorized by user',
                        accountId: deauthorization.account,
                    },
                },
            },
        });
        // Log audit event
        yield auditLog_model_1.AuditLog.create({
            action: auditLog_interface_1.AuditLogAction.STRIPE_ACCOUNT_DEAUTHORIZED,
            category: auditLog_interface_1.AuditLogCategory.STRIPE_CONNECT,
            level: auditLog_interface_1.AuditLogLevel.WARNING,
            message: 'Stripe account deauthorized',
            userId: teacher._id,
            userType: 'teacher',
            resourceType: 'stripe_account',
            resourceId: deauthorization.account,
            metadata: {
                stripeEventId: event.id,
                stripeAccountId: deauthorization.account,
                reason: 'User deauthorized application',
            },
            timestamp: new Date(),
        });
        // Send notification
        yield notification_service_1.NotificationService.createNotification({
            type: notification_interface_1.NotificationType.STRIPE_ACCOUNT_DEAUTHORIZED,
            priority: notification_interface_1.NotificationPriority.URGENT,
            userId: teacher._id,
            userType: 'teacher',
            title: 'Stripe Account Disconnected',
            body: 'Your Stripe account has been disconnected. You will need to reconnect to receive payments.',
            relatedResourceType: 'stripe_account',
            relatedResourceId: deauthorization.account,
        });
        return {
            success: true,
            processingTime: Date.now() - startTime,
            affectedUserId: teacher._id.toString(),
            affectedUserType: 'teacher',
            relatedResourceIds: [deauthorization.account],
        };
    }
    catch (error) {
        console.error('Error handling account.application.deauthorized webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Handle capability.updated event
const handleCapabilityUpdated = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        const capability = event.data.object;
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: capability.account },
                { 'stripeConnect.accountId': capability.account }
            ]
        });
        if (!teacher) {
            return {
                success: true,
                error: 'Teacher not found - skipping',
                processingTime: Date.now() - startTime,
            };
        }
        // Update specific capability
        const updateField = `stripeConnect.capabilities.${capability.id}`;
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            $set: {
                [updateField]: capability.status,
                'stripeConnect.lastStatusUpdate': new Date(),
            },
            $push: {
                'stripeConnect.auditTrail': {
                    action: 'capability_updated',
                    timestamp: new Date(),
                    details: {
                        event: 'capability.updated',
                        capability: capability.id,
                        status: capability.status,
                        requirements: capability.requirements,
                    },
                },
            },
        });
        // Log audit event
        yield auditLog_model_1.AuditLog.create({
            action: auditLog_interface_1.AuditLogAction.STRIPE_CAPABILITY_UPDATED,
            category: auditLog_interface_1.AuditLogCategory.STRIPE_CONNECT,
            level: auditLog_interface_1.AuditLogLevel.INFO,
            message: `Capability ${capability.id} updated to ${capability.status}`,
            userId: teacher._id,
            userType: 'teacher',
            resourceType: 'stripe_capability',
            resourceId: capability.id,
            metadata: {
                stripeEventId: event.id,
                stripeAccountId: capability.account,
                capability: capability.id,
                status: capability.status,
                requirements: capability.requirements,
            },
            timestamp: new Date(),
        });
        // Send notification for important capability changes
        if (capability.status === 'active') {
            yield notification_service_1.NotificationService.createNotification({
                type: notification_interface_1.NotificationType.STRIPE_CAPABILITY_ENABLED,
                priority: notification_interface_1.NotificationPriority.NORMAL,
                userId: teacher._id,
                userType: 'teacher',
                title: `${capability.id} Capability Enabled`,
                body: `Your ${capability.id} capability is now active and ready to use.`,
                relatedResourceType: 'stripe_capability',
                relatedResourceId: capability.id,
            });
        }
        else if (capability.status === 'inactive') {
            yield notification_service_1.NotificationService.createNotification({
                type: notification_interface_1.NotificationType.STRIPE_CAPABILITY_DISABLED,
                priority: notification_interface_1.NotificationPriority.HIGH,
                userId: teacher._id,
                userType: 'teacher',
                title: `${capability.id} Capability Disabled`,
                body: `Your ${capability.id} capability has been disabled. Please check your account requirements.`,
                relatedResourceType: 'stripe_capability',
                relatedResourceId: capability.id,
            });
        }
        return {
            success: true,
            processingTime: Date.now() - startTime,
            affectedUserId: teacher._id.toString(),
            affectedUserType: 'teacher',
            relatedResourceIds: [capability.account, capability.id],
        };
    }
    catch (error) {
        console.error('Error handling capability.updated webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Handle person.created and person.updated events
const handlePersonUpdated = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        const person = event.data.object;
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: person.account },
                { 'stripeConnect.accountId': person.account }
            ]
        });
        if (!teacher) {
            return {
                success: true,
                error: 'Teacher not found - skipping',
                processingTime: Date.now() - startTime,
            };
        }
        // Update teacher with person information
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            $set: {
                'stripeConnect.lastWebhookReceived': new Date(),
            },
            $push: {
                'stripeConnect.auditTrail': {
                    action: 'person_updated',
                    timestamp: new Date(),
                    details: {
                        event: event.type,
                        person_id: person.id,
                        verification: person.verification,
                        requirements: person.requirements,
                    },
                },
            },
        });
        // Log audit event
        yield auditLog_model_1.AuditLog.create({
            action: auditLog_interface_1.AuditLogAction.WEBHOOK_RECEIVED,
            category: auditLog_interface_1.AuditLogCategory.STRIPE_CONNECT,
            level: auditLog_interface_1.AuditLogLevel.INFO,
            message: `Person ${event.type.split('.')[1]} for account`,
            userId: teacher._id,
            userType: 'teacher',
            resourceType: 'stripe_person',
            resourceId: person.id,
            metadata: {
                stripeEventId: event.id,
                stripeAccountId: person.account,
                personId: person.id,
                verification: person.verification,
                requirements: person.requirements,
            },
            timestamp: new Date(),
        });
        return {
            success: true,
            processingTime: Date.now() - startTime,
            affectedUserId: teacher._id.toString(),
            affectedUserType: 'teacher',
            relatedResourceIds: [person.account, person.id],
        };
    }
    catch (error) {
        console.error('Error handling person webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Handle external account events
const handleExternalAccountUpdated = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        const externalAccount = event.data.object;
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: externalAccount.account },
                { 'stripeConnect.accountId': externalAccount.account }
            ]
        });
        if (!teacher) {
            return {
                success: true,
                error: 'Teacher not found - skipping',
                processingTime: Date.now() - startTime,
            };
        }
        // Update teacher with external account information
        yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
            $set: {
                'stripeConnect.lastWebhookReceived': new Date(),
            },
            $push: {
                'stripeConnect.auditTrail': {
                    action: 'external_account_updated',
                    timestamp: new Date(),
                    details: {
                        event: event.type,
                        external_account_id: externalAccount.id,
                        object: externalAccount.object,
                        status: externalAccount.status,
                        last4: externalAccount.last4,
                        bank_name: externalAccount.bank_name,
                    },
                },
            },
        });
        // Log audit event
        yield auditLog_model_1.AuditLog.create({
            action: auditLog_interface_1.AuditLogAction.STRIPE_EXTERNAL_ACCOUNT_UPDATED,
            category: auditLog_interface_1.AuditLogCategory.STRIPE_CONNECT,
            level: auditLog_interface_1.AuditLogLevel.INFO,
            message: `External account ${event.type.split('.')[2]}`,
            userId: teacher._id,
            userType: 'teacher',
            resourceType: 'stripe_external_account',
            resourceId: externalAccount.id,
            metadata: {
                stripeEventId: event.id,
                stripeAccountId: externalAccount.account,
                externalAccountId: externalAccount.id,
                accountType: externalAccount.object,
                status: externalAccount.status,
            },
            timestamp: new Date(),
        });
        // Send notification for external account changes
        if (event.type.includes('created')) {
            yield notification_service_1.NotificationService.createNotification({
                type: notification_interface_1.NotificationType.STRIPE_EXTERNAL_ACCOUNT_ADDED,
                priority: notification_interface_1.NotificationPriority.NORMAL,
                userId: teacher._id,
                userType: 'teacher',
                title: 'Bank Account Added',
                body: `A new ${externalAccount.object} has been added to your Stripe account.`,
                relatedResourceType: 'stripe_external_account',
                relatedResourceId: externalAccount.id,
            });
        }
        else if (event.type.includes('updated')) {
            yield notification_service_1.NotificationService.createNotification({
                type: notification_interface_1.NotificationType.STRIPE_EXTERNAL_ACCOUNT_UPDATED,
                priority: notification_interface_1.NotificationPriority.NORMAL,
                userId: teacher._id,
                userType: 'teacher',
                title: 'Bank Account Updated',
                body: `Your ${externalAccount.object} information has been updated.`,
                relatedResourceType: 'stripe_external_account',
                relatedResourceId: externalAccount.id,
            });
        }
        return {
            success: true,
            processingTime: Date.now() - startTime,
            affectedUserId: teacher._id.toString(),
            affectedUserType: 'teacher',
            relatedResourceIds: [externalAccount.account, externalAccount.id],
        };
    }
    catch (error) {
        console.error('Error handling external account webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Handle payout.created event
const handlePayoutCreated = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        const stripePayout = event.data.object;
        // Find the teacher by Stripe account ID
        const teacher = yield teacher_model_1.Teacher.findOne({
            $or: [
                { stripeAccountId: stripePayout.destination },
                { 'stripeConnect.accountId': stripePayout.destination }
            ]
        });
        if (!teacher) {
            return {
                success: true,
                error: 'Teacher not found - skipping',
                processingTime: Date.now() - startTime,
            };
        }
        // Create or update payout record
        const existingPayout = yield payout_model_1.Payout.findOne({ stripePayoutId: stripePayout.id });
        if (!existingPayout) {
            const newPayout = new payout_model_1.Payout({
                teacherId: teacher._id,
                amount: stripePayout.amount / 100, // Convert from cents
                currency: stripePayout.currency,
                status: payout_interface_1.PayoutStatus.SCHEDULED,
                stripePayoutId: stripePayout.id,
                stripeAccountId: stripePayout.destination,
                description: stripePayout.description || 'Automatic payout',
                scheduledAt: new Date(stripePayout.arrival_date * 1000),
                requestedAt: new Date(stripePayout.created * 1000),
                metadata: {
                    stripeEventId: event.id,
                    method: stripePayout.method,
                    type: stripePayout.type,
                    statement_descriptor: stripePayout.statement_descriptor,
                },
                auditTrail: [{
                        action: 'payout_created',
                        timestamp: new Date(),
                        details: {
                            stripePayoutId: stripePayout.id,
                            amount: stripePayout.amount / 100,
                            currency: stripePayout.currency,
                            method: stripePayout.method,
                        },
                    }],
            });
            yield newPayout.save();
        }
        // Log audit event
        yield auditLog_model_1.AuditLog.create({
            action: auditLog_interface_1.AuditLogAction.PAYOUT_CREATED,
            category: auditLog_interface_1.AuditLogCategory.PAYOUT,
            level: auditLog_interface_1.AuditLogLevel.INFO,
            message: `Payout created: ${stripePayout.amount / 100} ${stripePayout.currency}`,
            userId: teacher._id,
            userType: 'teacher',
            resourceType: 'payout',
            resourceId: stripePayout.id,
            metadata: {
                stripeEventId: event.id,
                stripePayoutId: stripePayout.id,
                amount: stripePayout.amount / 100,
                currency: stripePayout.currency,
                arrivalDate: new Date(stripePayout.arrival_date * 1000),
            },
            timestamp: new Date(),
        });
        // Send notification
        yield notification_service_1.NotificationService.createNotification({
            type: notification_interface_1.NotificationType.PAYOUT_SCHEDULED,
            priority: notification_interface_1.NotificationPriority.NORMAL,
            userId: teacher._id,
            userType: 'teacher',
            title: 'Payout Scheduled',
            body: `Your payout of ${stripePayout.amount / 100} ${stripePayout.currency.toUpperCase()} has been scheduled and will arrive on ${new Date(stripePayout.arrival_date * 1000).toLocaleDateString()}.`,
            relatedResourceType: 'payout',
            relatedResourceId: stripePayout.id,
            metadata: {
                amount: stripePayout.amount / 100,
                currency: stripePayout.currency,
                arrivalDate: new Date(stripePayout.arrival_date * 1000),
            },
        });
        return {
            success: true,
            processingTime: Date.now() - startTime,
            affectedUserId: teacher._id.toString(),
            affectedUserType: 'teacher',
            relatedResourceIds: [stripePayout.id],
        };
    }
    catch (error) {
        console.error('Error handling payout.created webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Handle payout.paid event
const handlePayoutPaid = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        const stripePayout = event.data.object;
        // Update payout status
        const payout = yield payout_model_1.Payout.findOneAndUpdate({ stripePayoutId: stripePayout.id }, {
            $set: {
                status: payout_interface_1.PayoutStatus.COMPLETED,
                completedAt: new Date(),
                actualArrival: new Date(),
                processingDuration: Date.now() - new Date(stripePayout.created * 1000).getTime(),
            },
            $push: {
                auditTrail: {
                    action: 'payout_completed',
                    timestamp: new Date(),
                    details: {
                        stripePayoutId: stripePayout.id,
                        completedAt: new Date(),
                    },
                },
            },
        }, { new: true });
        if (!payout) {
            return {
                success: true,
                error: 'Payout not found - skipping',
                processingTime: Date.now() - startTime,
            };
        }
        // Log audit event
        yield auditLog_model_1.AuditLog.create({
            action: auditLog_interface_1.AuditLogAction.PAYOUT_COMPLETED,
            category: auditLog_interface_1.AuditLogCategory.PAYOUT,
            level: auditLog_interface_1.AuditLogLevel.INFO,
            message: `Payout completed: ${payout.amount} ${payout.currency}`,
            userId: payout.teacherId,
            userType: 'teacher',
            resourceType: 'payout',
            resourceId: stripePayout.id,
            metadata: {
                stripeEventId: event.id,
                stripePayoutId: stripePayout.id,
                amount: payout.amount,
                currency: payout.currency,
                processingDuration: payout.processingDuration,
            },
            timestamp: new Date(),
        });
        // Send notification
        yield notification_service_1.NotificationService.createNotification({
            type: notification_interface_1.NotificationType.PAYOUT_COMPLETED,
            priority: notification_interface_1.NotificationPriority.NORMAL,
            userId: payout.teacherId,
            userType: 'teacher',
            title: 'Payout Completed',
            body: `Your payout of ${payout.amount} ${payout.currency.toUpperCase()} has been successfully transferred to your bank account.`,
            relatedResourceType: 'payout',
            relatedResourceId: stripePayout.id,
            metadata: {
                amount: payout.amount,
                currency: payout.currency,
                completedAt: new Date(),
            },
        });
        return {
            success: true,
            processingTime: Date.now() - startTime,
            affectedUserId: payout.teacherId.toString(),
            affectedUserType: 'teacher',
            relatedResourceIds: [stripePayout.id],
        };
    }
    catch (error) {
        console.error('Error handling payout.paid webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Handle payout.failed event
const handlePayoutFailed = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        const stripePayout = event.data.object;
        // Determine failure category
        let failureCategory = payout_interface_1.PayoutFailureCategory.UNKNOWN;
        const failureCode = stripePayout.failure_code;
        if (failureCode) {
            switch (failureCode) {
                case 'insufficient_funds':
                    failureCategory = payout_interface_1.PayoutFailureCategory.INSUFFICIENT_FUNDS;
                    break;
                case 'account_closed':
                    failureCategory = payout_interface_1.PayoutFailureCategory.ACCOUNT_CLOSED;
                    break;
                case 'invalid_account_number':
                case 'invalid_routing_number':
                    failureCategory = payout_interface_1.PayoutFailureCategory.INVALID_ACCOUNT;
                    break;
                case 'debit_not_authorized':
                    failureCategory = payout_interface_1.PayoutFailureCategory.BANK_DECLINED;
                    break;
                default:
                    failureCategory = payout_interface_1.PayoutFailureCategory.TECHNICAL_ERROR;
            }
        }
        // Update payout status
        const payout = yield payout_model_1.Payout.findOneAndUpdate({ stripePayoutId: stripePayout.id }, {
            $set: {
                status: payout_interface_1.PayoutStatus.FAILED,
                failedAt: new Date(),
                failureReason: stripePayout.failure_message || 'Payout failed',
                failureCategory,
            },
            $push: {
                auditTrail: {
                    action: 'payout_failed',
                    timestamp: new Date(),
                    details: {
                        stripePayoutId: stripePayout.id,
                        failureCode: stripePayout.failure_code,
                        failureMessage: stripePayout.failure_message,
                        failureCategory,
                    },
                },
                attempts: {
                    attemptNumber: 1,
                    attemptedAt: new Date(),
                    status: payout_interface_1.PayoutStatus.FAILED,
                    stripePayoutId: stripePayout.id,
                    failureReason: stripePayout.failure_message,
                    failureCategory,
                },
            },
        }, { new: true });
        if (!payout) {
            return {
                success: true,
                error: 'Payout not found - skipping',
                processingTime: Date.now() - startTime,
            };
        }
        // Log audit event
        yield auditLog_model_1.AuditLog.create({
            action: auditLog_interface_1.AuditLogAction.PAYOUT_FAILED,
            category: auditLog_interface_1.AuditLogCategory.PAYOUT,
            level: auditLog_interface_1.AuditLogLevel.ERROR,
            message: `Payout failed: ${stripePayout.failure_message}`,
            userId: payout.teacherId,
            userType: 'teacher',
            resourceType: 'payout',
            resourceId: stripePayout.id,
            metadata: {
                stripeEventId: event.id,
                stripePayoutId: stripePayout.id,
                failureCode: stripePayout.failure_code,
                failureMessage: stripePayout.failure_message,
                failureCategory,
                amount: payout.amount,
                currency: payout.currency,
            },
            timestamp: new Date(),
        });
        // Send notification
        yield notification_service_1.NotificationService.createNotification({
            type: notification_interface_1.NotificationType.PAYOUT_FAILED,
            priority: notification_interface_1.NotificationPriority.URGENT,
            userId: payout.teacherId,
            userType: 'teacher',
            title: 'Payout Failed',
            body: `Your payout of ${payout.amount} ${payout.currency.toUpperCase()} failed: ${stripePayout.failure_message}. Please check your bank account details.`,
            relatedResourceType: 'payout',
            relatedResourceId: stripePayout.id,
            metadata: {
                amount: payout.amount,
                currency: payout.currency,
                failureReason: stripePayout.failure_message,
                failureCategory,
            },
        });
        return {
            success: true,
            processingTime: Date.now() - startTime,
            affectedUserId: payout.teacherId.toString(),
            affectedUserType: 'teacher',
            relatedResourceIds: [stripePayout.id],
        };
    }
    catch (error) {
        console.error('Error handling payout.failed webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Handle payout.canceled event
const handlePayoutCanceled = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        const stripePayout = event.data.object;
        // Update payout status
        const payout = yield payout_model_1.Payout.findOneAndUpdate({ stripePayoutId: stripePayout.id }, {
            $set: {
                status: payout_interface_1.PayoutStatus.CANCELLED,
                cancelledAt: new Date(),
            },
            $push: {
                auditTrail: {
                    action: 'payout_cancelled',
                    timestamp: new Date(),
                    details: {
                        stripePayoutId: stripePayout.id,
                        cancelledAt: new Date(),
                    },
                },
            },
        }, { new: true });
        if (payout) {
            // Log audit event
            yield auditLog_model_1.AuditLog.create({
                action: auditLog_interface_1.AuditLogAction.PAYOUT_CANCELLED,
                category: auditLog_interface_1.AuditLogCategory.PAYOUT,
                level: auditLog_interface_1.AuditLogLevel.WARNING,
                message: `Payout cancelled: ${payout.amount} ${payout.currency}`,
                userId: payout.teacherId,
                userType: 'teacher',
                resourceType: 'payout',
                resourceId: stripePayout.id,
                metadata: {
                    stripeEventId: event.id,
                    stripePayoutId: stripePayout.id,
                    amount: payout.amount,
                    currency: payout.currency,
                },
                timestamp: new Date(),
            });
        }
        return {
            success: true,
            processingTime: Date.now() - startTime,
            affectedUserId: payout === null || payout === void 0 ? void 0 : payout.teacherId.toString(),
            affectedUserType: 'teacher',
            relatedResourceIds: [stripePayout.id],
        };
    }
    catch (error) {
        console.error('Error handling payout.canceled webhook:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime,
        };
    }
});
// Placeholder handlers for transfer events
const handleTransferCreated = (event) => __awaiter(void 0, void 0, void 0, function* () {
    // Implementation for transfer.created
    return { success: true, processingTime: 0 };
});
const handleTransferPaid = (event) => __awaiter(void 0, void 0, void 0, function* () {
    // Implementation for transfer.paid
    return { success: true, processingTime: 0 };
});
const handleTransferFailed = (event) => __awaiter(void 0, void 0, void 0, function* () {
    // Implementation for transfer.failed
    return { success: true, processingTime: 0 };
});
const handleTransferReversed = (event) => __awaiter(void 0, void 0, void 0, function* () {
    // Implementation for transfer.reversed
    return { success: true, processingTime: 0 };
});
exports.StripeConnectWebhookHandlers = {
    handleAccountUpdated,
    handleAccountDeauthorized,
    handleCapabilityUpdated,
    handlePersonUpdated,
    handleExternalAccountUpdated,
    handlePayoutCreated,
    handlePayoutPaid,
    handlePayoutFailed,
    handlePayoutCanceled,
    handleTransferCreated,
    handleTransferPaid,
    handleTransferFailed,
    handleTransferReversed,
};
