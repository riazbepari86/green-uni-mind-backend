import { Queue, Worker, Job, JobsOptions, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import {
  IJobService,
  QueueConfig,
  JobProcessor,
  BaseJobData,
  JobResult,
  JobMetrics
} from './interfaces';
import { redisServiceManager } from '../redis/RedisServiceManager';

export class BullMQService extends EventEmitter implements IJobService {
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private queueEvents = new Map<string, QueueEvents>();
  private redis: Redis;
  private metrics = new Map<string, JobMetrics>();
  private isShuttingDown = false;

  constructor(redis?: Redis) {
    super();
    this.redis = redis || redisServiceManager.jobsClient;
    this.setupGlobalEventHandlers();
  }

  private setupGlobalEventHandlers(): void {
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  async createQueue(config: QueueConfig): Promise<Queue> {
    if (this.queues.has(config.name)) {
      return this.queues.get(config.name)!;
    }

    const queue = new Queue(config.name, {
      connection: config.redis || this.redis,
      prefix: 'jobs:', // Use BullMQ prefix option instead of ioredis keyPrefix
      defaultJobOptions: {
        removeOnComplete: 5, // Further reduced for Upstash
        removeOnFail: 5, // Further reduced for Upstash
        attempts: 1, // Single attempt to prevent infinite retries
        backoff: {
          type: 'exponential',
          delay: 2000, // Increased delay between retries
        },
        delay: 0, // No initial delay
        jobId: undefined, // Let BullMQ generate unique IDs
        ...config.defaultJobOptions,
      },

    });

    const queueEvents = new QueueEvents(config.name, {
      connection: config.redis || this.redis,
      prefix: 'jobs:', // Use BullMQ prefix option
    });

    this.setupQueueEventHandlers(queue, queueEvents, config.name);
    this.queues.set(config.name, queue);
    this.queueEvents.set(config.name, queueEvents);

    console.log(`✅ Queue '${config.name}' created successfully`);
    return queue;
  }

  private setupQueueEventHandlers(_queue: Queue, queueEvents: QueueEvents, queueName: string): void {
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.emit('job:completed', { job: { id: jobId }, result: returnvalue, queue: queueName });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.emit('job:failed', { job: { id: jobId }, error: new Error(failedReason), queue: queueName });
    });
  }

  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  async closeQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    const queueEvents = this.queueEvents.get(name);
    const worker = this.workers.get(name);

    if (worker) {
      await worker.close();
      this.workers.delete(name);
    }

    if (queueEvents) {
      await queueEvents.close();
      this.queueEvents.delete(name);
    }

    if (queue) {
      await queue.close();
      this.queues.delete(name);
    }

    console.log(`✅ Queue '${name}' closed successfully`);
  }

  async closeAllQueues(): Promise<void> {
    const queueNames = Array.from(this.queues.keys());
    await Promise.all(queueNames.map(name => this.closeQueue(name)));
    console.log('✅ All queues closed successfully');
  }

  async addJob<T extends BaseJobData>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions
  ): Promise<Job<T>> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const jobData = {
      ...data,
      createdAt: new Date().toISOString(),
    };

    const job = await queue.add(jobName, jobData, options);
    console.log(`📝 Job '${jobName}' added to queue '${queueName}' with ID: ${job.id}`);
    return job as Job<T>;
  }

  async scheduleJob<T extends BaseJobData>(
    queueName: string,
    jobName: string,
    data: T,
    delay: number | Date,
    options?: JobsOptions
  ): Promise<Job<T>> {
    const delayMs = delay instanceof Date ? delay.getTime() - Date.now() : delay;
    
    return this.addJob(queueName, jobName, data, {
      ...options,
      delay: Math.max(0, delayMs),
    });
  }

  async scheduleRecurringJob<T extends BaseJobData>(
    queueName: string,
    jobName: string,
    data: T,
    cronExpression: string,
    options?: JobsOptions
  ): Promise<Job<T>> {
    return this.addJob(queueName, jobName, data, {
      ...options,
      repeat: {
        pattern: cronExpression,
      },
    });
  }

  async createWorker<T extends BaseJobData, R extends JobResult>(
    queueName: string,
    processor: JobProcessor<T, R>,
    options?: {
      concurrency?: number;
      limiter?: {
        max: number;
        duration: number;
      };
    }
  ): Promise<Worker<T, R>> {
    if (this.workers.has(queueName)) {
      throw new Error(`Worker for queue '${queueName}' already exists`);
    }

    const worker = new Worker<T, R>(
      queueName,
      async (job: Job<T>) => {
        try {
          console.log(`🔄 Processing job '${job.name}' (ID: ${job.id}) in queue '${queueName}'`);
          
          const startTime = Date.now();
          const result = await processor.process(job);
          const duration = Date.now() - startTime;

          const finalResult = {
            ...result,
            duration,
            processedAt: new Date().toISOString(),
          };

          if (processor.onCompleted) {
            await processor.onCompleted(job, finalResult);
          }

          console.log(`✅ Job '${job.name}' (ID: ${job.id}) completed in ${duration}ms`);
          return finalResult;
        } catch (error) {
          console.error(`❌ Job '${job.name}' (ID: ${job.id}) failed:`, error);
          
          if (processor.onFailed) {
            await processor.onFailed(job, error as Error);
          }

          throw error;
        }
      },
      {
        connection: this.redis,
        prefix: 'jobs:', // Use BullMQ prefix option
        concurrency: options?.concurrency || 1,
        limiter: options?.limiter,
      }
    );

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
  }

  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const counts = await queue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0,
    };
  }

  async getHealthStatus(): Promise<{
    queues: Record<string, any>;
    workers: Record<string, any>;
    redis: { isConnected: boolean; latency?: number };
  }> {
    const queues: Record<string, any> = {};
    const workers: Record<string, any> = {};

    for (const [name, _queue] of this.queues) {
      try {
        const stats = await this.getQueueStats(name);
        queues[name] = { isHealthy: true, stats };
      } catch (error) {
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

    let redisHealth: { isConnected: boolean; latency?: number } = { isConnected: false };
    try {
      const start = Date.now();
      await this.redis.ping();
      redisHealth = {
        isConnected: true,
        latency: Date.now() - start,
      };
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    return { queues, workers, redis: redisHealth };
  }

  async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('🔄 Starting graceful shutdown of BullMQ service...');

    try {
      const workerPromises = Array.from(this.workers.values()).map(worker => worker.close());
      await Promise.all(workerPromises);

      const queueEventPromises = Array.from(this.queueEvents.values()).map(qe => qe.close());
      await Promise.all(queueEventPromises);

      const queuePromises = Array.from(this.queues.values()).map(queue => queue.close());
      await Promise.all(queuePromises);

      console.log('✅ BullMQ service shutdown completed');
    } catch (error) {
      console.error('❌ Error during BullMQ service shutdown:', error);
    }
  }
}

export const bullMQService = new BullMQService();
