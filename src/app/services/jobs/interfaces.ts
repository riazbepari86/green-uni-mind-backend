import { Job, JobsOptions, Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

// Job data interfaces
export interface BaseJobData {
  id?: string;
  userId?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  priority?: number;
}

export interface PayoutJobData extends BaseJobData {
  teacherId: string;
  amount: number;
  currency: string;
  payoutPreferenceId: string;
  stripeAccountId: string;
  description?: string;
}

export interface PayoutSyncJobData extends BaseJobData {
  stripeAccountId?: string;
  syncType: 'full' | 'incremental' | 'single';
  lastSyncTime?: string;
}

export interface EmailJobData extends BaseJobData {
  to: string | string[];
  subject: string;
  body: string;
  template?: string;
  templateData?: Record<string, any>;
}

export interface CleanupJobData extends BaseJobData {
  type: 'expired_tokens' | 'old_logs' | 'temp_files' | 'cache_cleanup';
  olderThan?: string;
  batchSize?: number;
}

// Job result interfaces
export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
  processedAt: string;
  metadata?: Record<string, any>;
}

// Job metrics interface
export interface JobMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  lastProcessedAt?: string;
  errorRate: number;
}

export interface PayoutJobResult extends JobResult {
  payoutId?: string;
  stripePayoutId?: string;
  status: 'pending' | 'in_transit' | 'paid' | 'failed' | 'canceled';
  failureReason?: string;
}

// Job queue configuration
export interface QueueConfig {
  name: string;
  redis: Redis;
  defaultJobOptions?: JobsOptions;
  concurrency?: number;
  rateLimiter?: {
    max: number;
    duration: number;
  };
  settings?: {
    stalledInterval?: number;
    maxStalledCount?: number;
    retryProcessDelay?: number;
  };
}

// Job processor interface
export interface JobProcessor<T extends BaseJobData = BaseJobData, R extends JobResult = JobResult> {
  process(job: Job<T>): Promise<R>;
  onCompleted?(job: Job<T>, result: R): Promise<void>;
  onFailed?(job: Job<T>, error: Error): Promise<void>;
  onProgress?(job: Job<T>, progress: number | object): Promise<void>;
}

// Job service interface
export interface IJobService {
  createQueue(config: QueueConfig): Promise<Queue>;
  getQueue(name: string): Queue | undefined;
  closeQueue(name: string): Promise<void>;
  closeAllQueues(): Promise<void>;
  addJob<T extends BaseJobData>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions
  ): Promise<Job<T>>;
  scheduleJob<T extends BaseJobData>(
    queueName: string,
    jobName: string,
    data: T,
    delay: number | Date,
    options?: JobsOptions
  ): Promise<Job<T>>;
  scheduleRecurringJob<T extends BaseJobData>(
    queueName: string,
    jobName: string,
    data: T,
    cronExpression: string,
    options?: JobsOptions
  ): Promise<Job<T>>;
  createWorker<T extends BaseJobData, R extends JobResult>(
    queueName: string,
    processor: JobProcessor<T, R>,
    options?: {
      concurrency?: number;
      limiter?: {
        max: number;
        duration: number;
      };
    }
  ): Promise<Worker<T, R>>;
  getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }>;
  getHealthStatus(): Promise<any>;
}

// Job priority levels
export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20,
  URGENT = 50
}

// Job retry strategies
export interface RetryStrategy {
  attempts: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete?: number;
  removeOnFail?: number;
}

// Common retry strategies
export const RetryStrategies = {
  DEFAULT: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  },
  CRITICAL: {
    attempts: 5,
    backoff: {
      type: 'exponential' as const,
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
} as const;

// Queue names constants
export const QueueNames = {
  PAYOUT: 'payout-queue',
  PAYOUT_SYNC: 'payout-sync-queue',
  EMAIL: 'email-queue',
  NOTIFICATION: 'notification-queue',
  CLEANUP: 'cleanup-queue',
  HIGH_PRIORITY: 'high-priority-queue',
  LOW_PRIORITY: 'low-priority-queue'
} as const;

// Job names constants
export const JobNames = {
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
} as const;
