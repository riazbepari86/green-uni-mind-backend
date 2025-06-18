"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobNames = exports.QueueNames = exports.RetryStrategies = exports.JobPriority = void 0;
// Job priority levels
var JobPriority;
(function (JobPriority) {
    JobPriority[JobPriority["LOW"] = 1] = "LOW";
    JobPriority[JobPriority["NORMAL"] = 5] = "NORMAL";
    JobPriority[JobPriority["HIGH"] = 10] = "HIGH";
    JobPriority[JobPriority["CRITICAL"] = 20] = "CRITICAL";
    JobPriority[JobPriority["URGENT"] = 50] = "URGENT";
})(JobPriority || (exports.JobPriority = JobPriority = {}));
// Common retry strategies
exports.RetryStrategies = {
    DEFAULT: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 50
    },
    CRITICAL: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        removeOnComplete: 200,
        removeOnFail: 100
    },
    SIMPLE: {
        attempts: 1,
        removeOnComplete: 50,
        removeOnFail: 25
    }
};
// Queue names constants
exports.QueueNames = {
    PAYOUT: 'payout-queue',
    PAYOUT_SYNC: 'payout-sync-queue',
    EMAIL: 'email-queue',
    NOTIFICATION: 'notification-queue',
    CLEANUP: 'cleanup-queue',
    HIGH_PRIORITY: 'high-priority-queue',
    LOW_PRIORITY: 'low-priority-queue'
};
// Job names constants
exports.JobNames = {
    SCHEDULE_PAYOUTS: 'schedule-payouts',
    PROCESS_PAYOUT: 'process-payout',
    CHECK_PAYOUT_STATUS: 'check-payout-status',
    SYNC_STRIPE_PAYOUTS: 'sync-stripe-payouts',
    SEND_PAYOUT_NOTIFICATION: 'send-payout-notification',
    SEND_EMAIL: 'send-email',
    SEND_NOTIFICATION: 'send-notification',
    CLEANUP_EXPIRED_TOKENS: 'cleanup-expired-tokens',
    CLEANUP_OLD_LOGS: 'cleanup-old-logs',
    HEALTH_CHECK: 'health-check'
};
