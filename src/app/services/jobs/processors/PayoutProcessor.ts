import { Job } from 'bullmq';
import { JobProcessor, PayoutJobData, PayoutJobResult } from '../interfaces';

export class PayoutProcessor implements JobProcessor<PayoutJobData, PayoutJobResult> {
  async process(job: Job<PayoutJobData>): Promise<PayoutJobResult> {
    const { teacherId, amount, currency, payoutPreferenceId, stripeAccountId, description } = job.data;
    
    console.log(`Processing payout for teacher ${teacherId}, amount: ${amount} ${currency}`);
    
    await job.updateProgress(10);

    try {
      // Simulate payout processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      await job.updateProgress(50);
      
      // Simulate Stripe API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      await job.updateProgress(90);
      
      const payoutId = `payout_${Date.now()}`;
      const stripePayoutId = `po_${Date.now()}`;
      
      await job.updateProgress(100);

      console.log(`✅ Payout created successfully: ${payoutId}`);

      return {
        success: true,
        data: {
          payoutId,
          stripePayoutId,
          amount,
          currency,
          teacherId,
        },
        status: 'pending',
        processedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error(`❌ Payout processing failed for teacher ${teacherId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Unknown error',
        processedAt: new Date().toISOString(),
      };
    }
  }

  async onCompleted(job: Job<PayoutJobData>, result: PayoutJobResult): Promise<void> {
    console.log(`✅ Payout job ${job.id} completed for teacher ${job.data.teacherId}`);
  }

  async onFailed(job: Job<PayoutJobData>, error: Error): Promise<void> {
    console.error(`❌ Payout job ${job.id} failed for teacher ${job.data.teacherId}:`, error);
  }

  async onProgress(job: Job<PayoutJobData>, progress: number | object): Promise<void> {
    const progressValue = typeof progress === 'number' ? progress : 0;
    console.log(`🔄 Payout job ${job.id} progress: ${progressValue}%`);
  }
}
