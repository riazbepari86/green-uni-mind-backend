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
exports.jobQueueManager = exports.JobQueueManager = void 0;
const BullMQService_1 = require("./BullMQService");
const RedisServiceManager_1 = require("../redis/RedisServiceManager");
const PayoutProcessor_1 = require("./processors/PayoutProcessor");
const PayoutSyncProcessor_1 = require("./processors/PayoutSyncProcessor");
const interfaces_1 = require("./interfaces");
class JobQueueManager {
    constructor() {
        this.isInitialized = false;
        this.payoutProcessor = new PayoutProcessor_1.PayoutProcessor();
        this.payoutSyncProcessor = new PayoutSyncProcessor_1.PayoutSyncProcessor(BullMQService_1.bullMQService);
    }
    static getInstance() {
        if (!JobQueueManager.instance) {
            JobQueueManager.instance = new JobQueueManager();
        }
        return JobQueueManager.instance;
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isInitialized) {
                console.log('Job queue manager already initialized');
                return;
            }
            console.log('🚀 Initializing BullMQ job queue manager...');
            try {
                // Create all queues
                yield this.createQueues();
                // Create all workers
                yield this.createWorkers();
                // Schedule recurring jobs
                yield this.scheduleRecurringJobs();
                this.isInitialized = true;
                console.log('✅ Job queue manager initialized successfully');
            }
            catch (error) {
                console.error('❌ Failed to initialize job queue manager:', error);
                throw error;
            }
        });
    }
    createQueues() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('📋 Creating job queues...');
            // Payout queue - high priority for financial operations
            yield BullMQService_1.bullMQService.createQueue({
                name: interfaces_1.QueueNames.PAYOUT,
                redis: RedisServiceManager_1.redisServiceManager.jobsClient,
                defaultJobOptions: Object.assign(Object.assign({}, interfaces_1.RetryStrategies.CRITICAL), { priority: interfaces_1.JobPriority.HIGH }),
                concurrency: 3,
                rateLimiter: {
                    max: 10,
                    duration: 60000,
                },
            });
            // Payout sync queue
            yield BullMQService_1.bullMQService.createQueue({
                name: interfaces_1.QueueNames.PAYOUT_SYNC,
                redis: RedisServiceManager_1.redisServiceManager.jobsClient,
                defaultJobOptions: Object.assign(Object.assign({}, interfaces_1.RetryStrategies.DEFAULT), { priority: interfaces_1.JobPriority.NORMAL }),
                concurrency: 2,
            });
            // Email queue
            yield BullMQService_1.bullMQService.createQueue({
                name: interfaces_1.QueueNames.EMAIL,
                redis: RedisServiceManager_1.redisServiceManager.jobsClient,
                defaultJobOptions: Object.assign(Object.assign({}, interfaces_1.RetryStrategies.DEFAULT), { priority: interfaces_1.JobPriority.NORMAL }),
                concurrency: 5,
            });
            console.log('✅ All queues created successfully');
        });
    }
    createWorkers() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('👷 Creating job workers...');
            // Payout worker
            yield BullMQService_1.bullMQService.createWorker(interfaces_1.QueueNames.PAYOUT, this.payoutProcessor, { concurrency: 3 });
            // Payout sync worker
            yield BullMQService_1.bullMQService.createWorker(interfaces_1.QueueNames.PAYOUT_SYNC, this.payoutSyncProcessor, { concurrency: 2 });
            console.log('✅ All workers created successfully');
        });
    }
    scheduleRecurringJobs() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('⏰ Scheduling recurring jobs...');
            try {
                // Daily payout sync at 1:00 AM
                yield BullMQService_1.bullMQService.scheduleRecurringJob(interfaces_1.QueueNames.PAYOUT_SYNC, interfaces_1.JobNames.SYNC_STRIPE_PAYOUTS, {
                    syncType: 'full',
                    metadata: { scheduledBy: 'system' },
                }, '0 1 * * *');
                // Hourly payout status check
                yield BullMQService_1.bullMQService.scheduleRecurringJob(interfaces_1.QueueNames.PAYOUT_SYNC, interfaces_1.JobNames.CHECK_PAYOUT_STATUS, {
                    syncType: 'incremental',
                    metadata: { scheduledBy: 'system' },
                }, '0 * * * *');
                console.log('✅ Recurring jobs scheduled successfully');
            }
            catch (error) {
                console.error('❌ Failed to schedule recurring jobs:', error);
                throw error;
            }
        });
    }
    schedulePayoutJob(data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield BullMQService_1.bullMQService.addJob(interfaces_1.QueueNames.PAYOUT, interfaces_1.JobNames.PROCESS_PAYOUT, Object.assign(Object.assign({}, data), { priority: interfaces_1.JobPriority.HIGH }), { priority: interfaces_1.JobPriority.HIGH, attempts: 3 });
        });
    }
    getQueueStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = {};
            for (const queueName of Object.values(interfaces_1.QueueNames)) {
                try {
                    stats[queueName] = yield BullMQService_1.bullMQService.getQueueStats(queueName);
                }
                catch (error) {
                    stats[queueName] = { error: error instanceof Error ? error.message : 'Unknown error' };
                }
            }
            return stats;
        });
    }
    getHealthStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield BullMQService_1.bullMQService.getHealthStatus();
        });
    }
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Shutting down job queue manager...');
            yield BullMQService_1.bullMQService.gracefulShutdown();
            this.isInitialized = false;
            console.log('✅ Job queue manager shutdown completed');
        });
    }
    isReady() {
        return this.isInitialized;
    }
}
exports.JobQueueManager = JobQueueManager;
exports.jobQueueManager = JobQueueManager.getInstance();
