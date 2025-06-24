"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutFailureCategory = exports.PayoutSchedule = exports.PayoutStatus = void 0;
var PayoutStatus;
(function (PayoutStatus) {
    PayoutStatus["PENDING"] = "pending";
    PayoutStatus["SCHEDULED"] = "scheduled";
    PayoutStatus["PROCESSING"] = "processing";
    PayoutStatus["IN_TRANSIT"] = "in_transit";
    PayoutStatus["COMPLETED"] = "completed";
    PayoutStatus["FAILED"] = "failed";
    PayoutStatus["CANCELLED"] = "cancelled";
    PayoutStatus["REVERSED"] = "reversed";
})(PayoutStatus || (exports.PayoutStatus = PayoutStatus = {}));
var PayoutSchedule;
(function (PayoutSchedule) {
    PayoutSchedule["DAILY"] = "daily";
    PayoutSchedule["WEEKLY"] = "weekly";
    PayoutSchedule["BIWEEKLY"] = "biweekly";
    PayoutSchedule["MONTHLY"] = "monthly";
    PayoutSchedule["MANUAL"] = "manual";
})(PayoutSchedule || (exports.PayoutSchedule = PayoutSchedule = {}));
var PayoutFailureCategory;
(function (PayoutFailureCategory) {
    PayoutFailureCategory["INSUFFICIENT_FUNDS"] = "insufficient_funds";
    PayoutFailureCategory["ACCOUNT_CLOSED"] = "account_closed";
    PayoutFailureCategory["INVALID_ACCOUNT"] = "invalid_account";
    PayoutFailureCategory["BANK_DECLINED"] = "bank_declined";
    PayoutFailureCategory["COMPLIANCE_ISSUE"] = "compliance_issue";
    PayoutFailureCategory["TECHNICAL_ERROR"] = "technical_error";
    PayoutFailureCategory["NETWORK_ERROR"] = "network_error";
    PayoutFailureCategory["RATE_LIMITED"] = "rate_limited";
    PayoutFailureCategory["UNKNOWN"] = "unknown";
})(PayoutFailureCategory || (exports.PayoutFailureCategory = PayoutFailureCategory = {}));
