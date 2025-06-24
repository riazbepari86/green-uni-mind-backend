"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookEventSource = exports.WebhookEventStatus = exports.WebhookEventType = void 0;
var WebhookEventType;
(function (WebhookEventType) {
    // Stripe Connect Account Events
    WebhookEventType["ACCOUNT_UPDATED"] = "account.updated";
    WebhookEventType["ACCOUNT_APPLICATION_DEAUTHORIZED"] = "account.application.deauthorized";
    WebhookEventType["CAPABILITY_UPDATED"] = "capability.updated";
    WebhookEventType["PERSON_CREATED"] = "person.created";
    WebhookEventType["PERSON_UPDATED"] = "person.updated";
    WebhookEventType["EXTERNAL_ACCOUNT_CREATED"] = "account.external_account.created";
    WebhookEventType["EXTERNAL_ACCOUNT_UPDATED"] = "account.external_account.updated";
    WebhookEventType["EXTERNAL_ACCOUNT_DELETED"] = "account.external_account.deleted";
    // Payout Events
    WebhookEventType["PAYOUT_CREATED"] = "payout.created";
    WebhookEventType["PAYOUT_PAID"] = "payout.paid";
    WebhookEventType["PAYOUT_FAILED"] = "payout.failed";
    WebhookEventType["PAYOUT_CANCELED"] = "payout.canceled";
    WebhookEventType["PAYOUT_UPDATED"] = "payout.updated";
    // Transfer Events
    WebhookEventType["TRANSFER_CREATED"] = "transfer.created";
    WebhookEventType["TRANSFER_PAID"] = "transfer.paid";
    WebhookEventType["TRANSFER_FAILED"] = "transfer.failed";
    WebhookEventType["TRANSFER_REVERSED"] = "transfer.reversed";
    WebhookEventType["TRANSFER_UPDATED"] = "transfer.updated";
    // Payment Events
    WebhookEventType["PAYMENT_INTENT_SUCCEEDED"] = "payment_intent.succeeded";
    WebhookEventType["PAYMENT_INTENT_PAYMENT_FAILED"] = "payment_intent.payment_failed";
    WebhookEventType["CHARGE_SUCCEEDED"] = "charge.succeeded";
    WebhookEventType["CHARGE_FAILED"] = "charge.failed";
    WebhookEventType["CHARGE_DISPUTE_CREATED"] = "charge.dispute.created";
    // Checkout Events
    WebhookEventType["CHECKOUT_SESSION_COMPLETED"] = "checkout.session.completed";
    WebhookEventType["CHECKOUT_SESSION_EXPIRED"] = "checkout.session.expired";
    // Application Fee Events
    WebhookEventType["APPLICATION_FEE_CREATED"] = "application_fee.created";
    WebhookEventType["APPLICATION_FEE_REFUNDED"] = "application_fee.refunded";
    // Balance Events
    WebhookEventType["BALANCE_AVAILABLE"] = "balance.available";
    // Review Events
    WebhookEventType["REVIEW_OPENED"] = "review.opened";
    WebhookEventType["REVIEW_CLOSED"] = "review.closed";
    // Topup Events
    WebhookEventType["TOPUP_CREATED"] = "topup.created";
    WebhookEventType["TOPUP_SUCCEEDED"] = "topup.succeeded";
    WebhookEventType["TOPUP_FAILED"] = "topup.failed";
})(WebhookEventType || (exports.WebhookEventType = WebhookEventType = {}));
var WebhookEventStatus;
(function (WebhookEventStatus) {
    WebhookEventStatus["PENDING"] = "pending";
    WebhookEventStatus["PROCESSING"] = "processing";
    WebhookEventStatus["PROCESSED"] = "processed";
    WebhookEventStatus["FAILED"] = "failed";
    WebhookEventStatus["SKIPPED"] = "skipped";
    WebhookEventStatus["DUPLICATE"] = "duplicate";
})(WebhookEventStatus || (exports.WebhookEventStatus = WebhookEventStatus = {}));
var WebhookEventSource;
(function (WebhookEventSource) {
    WebhookEventSource["STRIPE_MAIN"] = "stripe_main";
    WebhookEventSource["STRIPE_CONNECT"] = "stripe_connect";
})(WebhookEventSource || (exports.WebhookEventSource = WebhookEventSource = {}));
