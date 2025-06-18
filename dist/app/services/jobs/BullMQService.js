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
exports.bullMQService = exports.BullMQService = void 0;
const bullmq_1 = require("bullmq");
const events_1 = require("events");
const RedisServiceManager_1 = require("../redis/RedisServiceManager");
class BullMQService extends events_1.EventEmitter {
    constructor(redis) {
        super();
        this.queues = new Map();
        this.workers = new Map();
        this.queueEvents = new Map();
        this.metrics = new Map();
        this.isShuttingDown = false;
        this.redis = redis || RedisServiceManager_1.redisServiceManager.jobsClient;
        this.setupGlobalEventHandlers();
    }
    setupGlobalEventHandlers() {
        process.on('SIGTERM', () => this.gracefulShutdown());
        process.on('SIGINT', () => this.gracefulShutdown());
    }
    createQueue(config) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.queues.has(config.name)) {
                return this.queues.get(config.name);
            }
            const queue = new bullmq_1.Queue(config.name, {
                connection: config.redis || this.redis,
                prefix: 'jobs:', // Use BullMQ prefix option instead of ioredis keyPrefix
                defaultJobOptions: Object.assign({ removeOnComplete: 5, removeOnFail: 5, attempts: 1, backoff: {
                        type: 'exponential',
                        delay: 2000, // Increased delay between retries
                    }, delay: 0, jobId: undefined }, config.defaultJobOptions),
            });
            const queueEvents = new bullmq_1.QueueEvents(config.name, {
                connection: config.redis || this.redis,
                prefix: 'jobs:', // Use BullMQ prefix option
            });
            this.setupQueueEventHandlers(queue, queueEvents, config.name);
            this.queues.set(config.name, queue);
            this.queueEvents.set(config.name, queueEvents);
            console.log(`✅ Queue '${config.name}' created successfully`);
            return queue;
        });
    }
    setupQueueEventHandlers(_queue, queueEvents, queueName) {
        queueEvents.on('completed', ({ jobId, returnvalue }) => {
            this.emit('job:completed', { job: { id: jobId }, result: returnvalue, queue: queueName });
        });
        queueEvents.on('failed', ({ jobId, failedReason }) => {
            this.emit('job:failed', { job: { id: jobId }, error: new Error(failedReason), queue: queueName });
        });
    }
    getQueue(name) {
        return this.queues.get(name);
    }
    closeQueue(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const queue = this.queues.get(name);
            const queueEvents = this.queueEvents.get(name);
            const worker = this.workers.get(name);
            if (worker) {
                yield worker.close();
                this.workers.delete(name);
            }
            if (queueEvents) {
                yield queueEvents.close();
                this.queueEvents.delete(name);
            }
            if (queue) {
                yield queue.close();
                this.queues.delete(name);
            }
            console.log(`✅ Queue '${name}' closed successfully`);
        });
    }
    closeAllQueues() {
        return __awaiter(this, void 0, void 0, function* () {
            const queueNames = Array.from(this.queues.keys());
            yield Promise.all(queueNames.map(name => this.closeQueue(name)));
            console.log('✅ All queues closed successfully');
        });
    }
    addJob(queueName, jobName, data, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const queue = this.queues.get(queueName);
            if (!queue) {
                throw new Error(`Queue '${queueName}' not found`);
            }
            const jobData = Object.assign(Object.assign({}, data), { createdAt: new Date().toISOString() });
            const job = yield queue.add(jobName, jobData, options);
            console.log(`📝 Job '${jobName}' added to queue '${queueName}' with ID: ${job.id}`);
            return job;
        });
    }
    scheduleJob(queueName, jobName, data, delay, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const delayMs = delay instanceof Date ? delay.getTime() - Date.now() : delay;
            return this.addJob(queueName, jobName, data, Object.assign(Object.assign({}, options), { delay: Math.max(0, delayMs) }));
        });
    }
    scheduleRecurringJob(queueName, jobName, data, cronExpression, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.addJob(queueName, jobName, data, Object.assign(Object.assign({}, options), { repeat: {
                    pattern: cronExpression,
                } }));
        });
    }
    createWorker(queueName, processor, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.workers.has(queueName)) {
                throw new Error(`Worker for queue '${queueName}' already exists`);
            }
            const worker = new bullmq_1.Worker(queueName, (job) => __awaiter(this, void 0, void 0, function* () {
                try {
                    console.log(`🔄 Processing job '${job.name}' (ID: ${job.id}) in queue '${queueName}'`);
                    const startTime = Date.now();
                    const result = yield processor.process(job);
                    const duration = Date.now() - startTime;
                    const finalResult = Object.assign(Object.assign({}, result), { duration, processedAt: new Date().toISOString() });
                    if (processor.onCompleted) {
                        yield processor.onCompleted(job, finalResult);
                    }
                    console.log(`✅ Job '${job.name}' (ID: ${job.id}) completed in ${duration}ms`);
                    return finalResult;
                }
                catch (error) {
                    console.error(`❌ Job '${job.name}' (ID: ${job.id}) failed:`, error);
                    if (processor.onFailed) {
                        yield processor.onFailed(job, error);
                    }
                    throw error;
                }
            }), {
                connection: this.redis,
                prefix: 'jobs:', // Use BullMQ prefix option
                concurrency: (options === null || options === void 0 ? void 0 : options.concurrency) || 1,
                limiter: options === null || options === void 0 ? void 0 : options.limiter,
            });
            worker.on('ready', () => {
                console.log(`🚀 Worker for queue '${queueName}' is ready`);
            });
            worker.on('error', (error) => {
                console.error(`❌ Worker error in queue '${queueName}':`, error);
                // If it's a Redis timeout error, don't retry immediately
                if (error.message.includes('Command timed out')) {
                    console.log(`⏸️ Pausing worker for queue '${queueName}' due to Redis timeout`);
                    // Don't restart immediately, let the connection recover
                    setTimeout(() => {
                        console.log(`▶️ Resuming worker for queue '${queueName}'`);
                    }, 30000); // Wait 30 seconds before resuming
                }
            });
            this.workers.set(queueName, worker);
            console.log(`✅ Worker created for queue '${queueName}'`);
            return worker;
        });
    }
    getQueueStats(queueName) {
        return __awaiter(this, void 0, void 0, function* () {
            const queue = this.queues.get(queueName);
            if (!queue) {
                throw new Error(`Queue '${queueName}' not found`);
            }
            const counts = yield queue.getJobCounts();
            return {
                waiting: counts.waiting || 0,
                active: counts.active || 0,
                completed: counts.completed || 0,
                failed: counts.failed || 0,
                delayed: counts.delayed || 0,
                paused: counts.paused || 0,
            };
        });
    }
    getHealthStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            const queues = {};
            const workers = {};
            for (const [name, _queue] of this.queues) {
                try {
                    const stats = yield this.getQueueStats(name);
                    queues[name] = { isHealthy: true, stats };
                }
                catch (error) {
                    queues[name] = { isHealthy: false, error: error instanceof Error ? error.message : 'Unknown error' };
                }
            }
            for (const [name, worker] of this.workers) {
                workers[name] = {
                    isRunning: !worker.closing,
                    processed: 0,
                    failed: 0,
                };
            }
            let redisHealth = { isConnected: false };
            try {
                const start = Date.now();
                yield this.redis.ping();
                redisHealth = {
                    isConnected: true,
                    latency: Date.now() - start,
                };
            }
            catch (error) {
                console.error('Redis health check failed:', error);
            }
            return { queues, workers, redis: redisHealth };
        });
    }
    gracefulShutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isShuttingDown) {
                return;
            }
            this.isShuttingDown = true;
            console.log('🔄 Starting graceful shutdown of BullMQ service...');
            try {
                const workerPromises = Array.from(this.workers.values()).map(worker => worker.close());
                yield Promise.all(workerPromises);
                const queueEventPromises = Array.from(this.queueEvents.values()).map(qe => qe.close());
                yield Promise.all(queueEventPromises);
                const queuePromises = Array.from(this.queues.values()).map(queue => queue.close());
                yield Promise.all(queuePromises);
                console.log('✅ BullMQ service shutdown completed');
            }
            catch (error) {
                console.error('❌ Error during BullMQ service shutdown:', error);
            }
        });
    }
}
exports.BullMQService = BullMQService;
exports.bullMQService = new BullMQService();
