import { bullMQService } from './BullMQService';
import { redisServiceManager } from '../redis/RedisServiceManager';
import { PayoutProcessor } from './processors/PayoutProcessor';
import { PayoutSyncProcessor } from './processors/PayoutSyncProcessor';
import { QueueNames, JobNames, RetryStrategies, JobPriority } from './interfaces';

export class JobQueueManager {
  private static instance: JobQueueManager;
  private isInitialized = false;
  private payoutProcessor: PayoutProcessor;
  private payoutSyncProcessor: PayoutSyncProcessor;

  private constructor() {
    this.payoutProcessor = new PayoutProcessor();
    this.payoutSyncProcessor = new PayoutSyncProcessor(bullMQService);
  }

  public static getInstance(): JobQueueManager {
    if (!JobQueueManager.instance) {
      JobQueueManager.instance = new JobQueueManager();
    }
    return JobQueueManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Job queue manager already initialized');
      return;
    }

    console.log('🚀 Initializing BullMQ job queue manager...');

    try {
      // Create all queues
      await this.createQueues();
      
      // Create all workers
      await this.createWorkers();
      
      // Schedule recurring jobs
      await this.scheduleRecurringJobs();

      this.isInitialized = true;
      console.log('✅ Job queue manager initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize job queue manager:', error);
      throw error;
    }
  }

  private async createQueues(): Promise<void> {
    console.log('📋 Creating job queues...');

    // Payout queue - high priority for financial operations
    await bullMQService.createQueue({
      name: QueueNames.PAYOUT,
      redis: redisServiceManager.jobsClient,
      defaultJobOptions: {
        ...RetryStrategies.CRITICAL,
        priority: JobPriority.HIGH,
      },
      concurrency: 3,
      rateLimiter: {
        max: 10,
        duration: 60000,
      },
    });

    // Payout sync queue
    await bullMQService.createQueue({
      name: QueueNames.PAYOUT_SYNC,
      redis: redisServiceManager.jobsClient,
      defaultJobOptions: {
        ...RetryStrategies.DEFAULT,
        priority: JobPriority.NORMAL,
      },
      concurrency: 2,
    });

    // Email queue
    await bullMQService.createQueue({
      name: QueueNames.EMAIL,
      redis: redisServiceManager.jobsClient,
      defaultJobOptions: {
        ...RetryStrategies.DEFAULT,
        priority: JobPriority.NORMAL,
      },
      concurrency: 5,
    });

    console.log('✅ All queues created successfully');
  }

  private async createWorkers(): Promise<void> {
    console.log('👷 Creating job workers...');

    // Payout worker
    await bullMQService.createWorker(
      QueueNames.PAYOUT,
      this.payoutProcessor,
      { concurrency: 3 }
    );

    // Payout sync worker
    await bullMQService.createWorker(
      QueueNames.PAYOUT_SYNC,
      this.payoutSyncProcessor,
      { concurrency: 2 }
    );

    console.log('✅ All workers created successfully');
  }

  private async scheduleRecurringJobs(): Promise<void> {
    console.log('⏰ Scheduling recurring jobs...');

    try {
      // Daily payout sync at 1:00 AM
      await bullMQService.scheduleRecurringJob(
        QueueNames.PAYOUT_SYNC,
        JobNames.SYNC_STRIPE_PAYOUTS,
        {
          syncType: 'full',
          metadata: { scheduledBy: 'system' },
        },
        '0 1 * * *'
      );

      // Hourly payout status check
      await bullMQService.scheduleRecurringJob(
        QueueNames.PAYOUT_SYNC,
        JobNames.CHECK_PAYOUT_STATUS,
        {
          syncType: 'incremental',
          metadata: { scheduledBy: 'system' },
        },
        '0 * * * *'
      );

      console.log('✅ Recurring jobs scheduled successfully');
    } catch (error) {
      console.error('❌ Failed to schedule recurring jobs:', error);
      throw error;
    }
  }

  async schedulePayoutJob(data: {
    teacherId: string;
    amount: number;
    currency: string;
    payoutPreferenceId: string;
    stripeAccountId: string;
    description?: string;
  }): Promise<void> {
    await bullMQService.addJob(
      QueueNames.PAYOUT,
      JobNames.PROCESS_PAYOUT,
      { ...data, priority: JobPriority.HIGH },
      { priority: JobPriority.HIGH, attempts: 3 }
    );
  }

  async getQueueStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    for (const queueName of Object.values(QueueNames)) {
      try {
        stats[queueName] = await bullMQService.getQueueStats(queueName);
      } catch (error) {
        stats[queueName] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    return stats;
  }

  async getHealthStatus(): Promise<any> {
    return await bullMQService.getHealthStatus();
  }

  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down job queue manager...');
    await bullMQService.gracefulShutdown();
    this.isInitialized = false;
    console.log('✅ Job queue manager shutdown completed');
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const jobQueueManager = JobQueueManager.getInstance();
