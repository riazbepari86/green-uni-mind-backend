"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutSchedule = exports.PayoutStatus = void 0;
var PayoutStatus;
(function (PayoutStatus) {
    PayoutStatus["PENDING"] = "pending";
    PayoutStatus["PROCESSING"] = "processing";
    PayoutStatus["COMPLETED"] = "completed";
    PayoutStatus["FAILED"] = "failed";
})(PayoutStatus || (exports.PayoutStatus = PayoutStatus = {}));
var PayoutSchedule;
(function (PayoutSchedule) {
    PayoutSchedule["DAILY"] = "daily";
    PayoutSchedule["WEEKLY"] = "weekly";
    PayoutSchedule["BIWEEKLY"] = "biweekly";
    PayoutSchedule["MONTHLY"] = "monthly";
    PayoutSchedule["MANUAL"] = "manual";
})(PayoutSchedule || (exports.PayoutSchedule = PayoutSchedule = {}));
