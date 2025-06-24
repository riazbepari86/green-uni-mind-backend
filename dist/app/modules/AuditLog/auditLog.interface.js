"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogCategory = exports.AuditLogLevel = exports.AuditLogAction = void 0;
var AuditLogAction;
(function (AuditLogAction) {
    // Payment Actions
    AuditLogAction["PAYMENT_CREATED"] = "payment_created";
    AuditLogAction["PAYMENT_COMPLETED"] = "payment_completed";
    AuditLogAction["PAYMENT_FAILED"] = "payment_failed";
    AuditLogAction["PAYMENT_REFUNDED"] = "payment_refunded";
    // Payout Actions
    AuditLogAction["PAYOUT_CREATED"] = "payout_created";
    AuditLogAction["PAYOUT_SCHEDULED"] = "payout_scheduled";
    AuditLogAction["PAYOUT_PROCESSING"] = "payout_processing";
    AuditLogAction["PAYOUT_COMPLETED"] = "payout_completed";
    AuditLogAction["PAYOUT_FAILED"] = "payout_failed";
    AuditLogAction["PAYOUT_CANCELLED"] = "payout_cancelled";
    AuditLogAction["PAYOUT_RETRY_ATTEMPTED"] = "payout_retry_attempted";
    // Stripe Connect Actions
    AuditLogAction["STRIPE_ACCOUNT_CREATED"] = "stripe_account_created";
    AuditLogAction["STRIPE_ACCOUNT_UPDATED"] = "stripe_account_updated";
    AuditLogAction["STRIPE_ACCOUNT_VERIFIED"] = "stripe_account_verified";
    AuditLogAction["STRIPE_ACCOUNT_RESTRICTED"] = "stripe_account_restricted";
    AuditLogAction["STRIPE_ACCOUNT_DEAUTHORIZED"] = "stripe_account_deauthorized";
    AuditLogAction["STRIPE_CAPABILITY_UPDATED"] = "stripe_capability_updated";
    AuditLogAction["STRIPE_EXTERNAL_ACCOUNT_UPDATED"] = "stripe_external_account_updated";
    // Transfer Actions
    AuditLogAction["TRANSFER_CREATED"] = "transfer_created";
    AuditLogAction["TRANSFER_PAID"] = "transfer_paid";
    AuditLogAction["TRANSFER_FAILED"] = "transfer_failed";
    AuditLogAction["TRANSFER_REVERSED"] = "transfer_reversed";
    // Webhook Actions
    AuditLogAction["WEBHOOK_RECEIVED"] = "webhook_received";
    AuditLogAction["WEBHOOK_PROCESSED"] = "webhook_processed";
    AuditLogAction["WEBHOOK_FAILED"] = "webhook_failed";
    AuditLogAction["WEBHOOK_RETRY_ATTEMPTED"] = "webhook_retry_attempted";
    // User Actions
    AuditLogAction["USER_LOGIN"] = "user_login";
    AuditLogAction["USER_LOGOUT"] = "user_logout";
    AuditLogAction["USER_PROFILE_UPDATED"] = "user_profile_updated";
    AuditLogAction["USER_PASSWORD_CHANGED"] = "user_password_changed";
    // Administrative Actions
    AuditLogAction["ADMIN_ACTION_PERFORMED"] = "admin_action_performed";
    AuditLogAction["SYSTEM_MAINTENANCE"] = "system_maintenance";
    AuditLogAction["SECURITY_EVENT"] = "security_event";
})(AuditLogAction || (exports.AuditLogAction = AuditLogAction = {}));
var AuditLogLevel;
(function (AuditLogLevel) {
    AuditLogLevel["INFO"] = "info";
    AuditLogLevel["WARNING"] = "warning";
    AuditLogLevel["ERROR"] = "error";
    AuditLogLevel["CRITICAL"] = "critical";
})(AuditLogLevel || (exports.AuditLogLevel = AuditLogLevel = {}));
var AuditLogCategory;
(function (AuditLogCategory) {
    AuditLogCategory["PAYMENT"] = "payment";
    AuditLogCategory["PAYOUT"] = "payout";
    AuditLogCategory["STRIPE_CONNECT"] = "stripe_connect";
    AuditLogCategory["TRANSFER"] = "transfer";
    AuditLogCategory["WEBHOOK"] = "webhook";
    AuditLogCategory["USER"] = "user";
    AuditLogCategory["ADMIN"] = "admin";
    AuditLogCategory["SECURITY"] = "security";
    AuditLogCategory["SYSTEM"] = "system";
})(AuditLogCategory || (exports.AuditLogCategory = AuditLogCategory = {}));
