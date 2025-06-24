"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationStatus = exports.NotificationPriority = exports.NotificationChannel = exports.NotificationType = void 0;
var NotificationType;
(function (NotificationType) {
    // Payment Notifications
    NotificationType["PAYMENT_RECEIVED"] = "payment_received";
    NotificationType["PAYMENT_FAILED"] = "payment_failed";
    NotificationType["PAYMENT_REFUNDED"] = "payment_refunded";
    // Payout Notifications
    NotificationType["PAYOUT_SCHEDULED"] = "payout_scheduled";
    NotificationType["PAYOUT_PROCESSING"] = "payout_processing";
    NotificationType["PAYOUT_COMPLETED"] = "payout_completed";
    NotificationType["PAYOUT_FAILED"] = "payout_failed";
    NotificationType["PAYOUT_DELAYED"] = "payout_delayed";
    // Stripe Connect Notifications
    NotificationType["STRIPE_ACCOUNT_VERIFIED"] = "stripe_account_verified";
    NotificationType["STRIPE_ACCOUNT_RESTRICTED"] = "stripe_account_restricted";
    NotificationType["STRIPE_ACCOUNT_REQUIREMENTS_DUE"] = "stripe_account_requirements_due";
    NotificationType["STRIPE_ACCOUNT_DEAUTHORIZED"] = "stripe_account_deauthorized";
    NotificationType["STRIPE_CAPABILITY_ENABLED"] = "stripe_capability_enabled";
    NotificationType["STRIPE_CAPABILITY_DISABLED"] = "stripe_capability_disabled";
    NotificationType["STRIPE_EXTERNAL_ACCOUNT_ADDED"] = "stripe_external_account_added";
    NotificationType["STRIPE_EXTERNAL_ACCOUNT_UPDATED"] = "stripe_external_account_updated";
    // Transfer Notifications
    NotificationType["TRANSFER_CREATED"] = "transfer_created";
    NotificationType["TRANSFER_PAID"] = "transfer_paid";
    NotificationType["TRANSFER_FAILED"] = "transfer_failed";
    // Account Health Notifications
    NotificationType["ACCOUNT_HEALTH_GOOD"] = "account_health_good";
    NotificationType["ACCOUNT_HEALTH_WARNING"] = "account_health_warning";
    NotificationType["ACCOUNT_HEALTH_CRITICAL"] = "account_health_critical";
    // Compliance Notifications
    NotificationType["COMPLIANCE_DOCUMENT_REQUIRED"] = "compliance_document_required";
    NotificationType["COMPLIANCE_VERIFICATION_PENDING"] = "compliance_verification_pending";
    NotificationType["COMPLIANCE_VERIFICATION_COMPLETED"] = "compliance_verification_completed";
    // System Notifications
    NotificationType["SYSTEM_MAINTENANCE"] = "system_maintenance";
    NotificationType["SECURITY_ALERT"] = "security_alert";
    NotificationType["FEATURE_ANNOUNCEMENT"] = "feature_announcement";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["EMAIL"] = "email";
    NotificationChannel["IN_APP"] = "in_app";
    NotificationChannel["SMS"] = "sms";
    NotificationChannel["PUSH"] = "push";
    NotificationChannel["WEBHOOK"] = "webhook";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["LOW"] = "low";
    NotificationPriority["NORMAL"] = "normal";
    NotificationPriority["HIGH"] = "high";
    NotificationPriority["URGENT"] = "urgent";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["PENDING"] = "pending";
    NotificationStatus["SENT"] = "sent";
    NotificationStatus["DELIVERED"] = "delivered";
    NotificationStatus["FAILED"] = "failed";
    NotificationStatus["BOUNCED"] = "bounced";
    NotificationStatus["OPENED"] = "opened";
    NotificationStatus["CLICKED"] = "clicked";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
