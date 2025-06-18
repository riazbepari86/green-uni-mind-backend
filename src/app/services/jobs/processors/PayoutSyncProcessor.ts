import { Job } from 'bullmq';
import { JobProcessor, PayoutSyncJobData, JobResult } from '../interfaces';
import { BullMQService } from '../BullMQService';

export class PayoutSyncProcessor implements JobProcessor<PayoutSyncJobData, JobResult> {
  constructor(private jobService: BullMQService) {}

  async process(job: Job<PayoutSyncJobData>): Promise<JobResult> {
    const { stripeAccountId, syncType, lastSyncTime } = job.data;
    
    console.log(`Starting payout sync: ${syncType} ${stripeAccountId ? `for account ${stripeAccountId}` : 'for all accounts'}`);
    
    await job.updateProgress(5);

    try {
      let syncResults: any[] = [];

      switch (syncType) {
        case 'full':
          syncResults = await this.performFullSync(job);
          break;
        case 'incremental':
          syncResults = await this.performIncrementalSync(job, lastSyncTime);
          break;
        case 'single':
          if (!stripeAccountId) {
            throw new Error('Stripe account ID is required for single account sync');
          }
          syncResults = await this.performSingleAccountSync(job, stripeAccountId);
          break;
        default:
          throw new Error(`Unknown sync type: ${syncType}`);
      }

      await job.updateProgress(100);

      return {
        success: true,
        data: {
          syncType,
          accountsProcessed: syncResults.length,
          results: syncResults,
          syncedAt: new Date().toISOString(),
        },
        processedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error(`❌ Payout sync failed:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processedAt: new Date().toISOString(),
      };
    }
  }

  private async performFullSync(job: Job<PayoutSyncJobData>): Promise<any[]> {
    console.log('🔄 Performing full payout sync...');
    
    // Simulate full sync
    await new Promise(resolve => setTimeout(resolve, 3000));
    await job.updateProgress(50);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await job.updateProgress(80);

    console.log(`✅ Full sync completed`);
    return [{ type: 'full_sync', processed: 10, success: true }];
  }

  private async performIncrementalSync(job: Job<PayoutSyncJobData>, lastSyncTime?: string): Promise<any[]> {
    console.log('🔄 Performing incremental payout sync...');
    
    // Simulate incremental sync
    await new Promise(resolve => setTimeout(resolve, 1500));
    await job.updateProgress(60);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await job.updateProgress(90);

    console.log(`✅ Incremental sync completed`);
    return [{ type: 'incremental_sync', processed: 5, success: true }];
  }

  private async performSingleAccountSync(job: Job<PayoutSyncJobData>, stripeAccountId: string): Promise<any[]> {
    console.log(`🔄 Performing single account sync for ${stripeAccountId}...`);
    
    // Simulate single account sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    await job.updateProgress(75);

    return [{
      type: 'single_account_sync',
      stripeAccountId,
      processed: 1,
      success: true,
    }];
  }

  async onCompleted(job: Job<PayoutSyncJobData>, result: JobResult): Promise<void> {
    console.log(`✅ Payout sync job ${job.id} completed: ${result.data?.syncType}`);
  }

  async onFailed(job: Job<PayoutSyncJobData>, error: Error): Promise<void> {
    console.error(`❌ Payout sync job ${job.id} failed:`, error);
  }

  async onProgress(job: Job<PayoutSyncJobData>, progress: number | object): Promise<void> {
    const progressValue = typeof progress === 'number' ? progress : 0;
    console.log(`🔄 Payout sync job ${job.id} progress: ${progressValue}%`);
  }
}
