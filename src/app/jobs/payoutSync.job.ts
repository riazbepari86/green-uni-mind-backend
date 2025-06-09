import { Agenda } from 'agenda';
import { stripe } from '../utils/stripe';
import { Teacher } from '../modules/Teacher/teacher.model';
import { Payout } from '../modules/Payment/payout.model';
import { PayoutStatus } from '../modules/Payment/payout.interface';
import config from '../config';

// Initialize Agenda with MongoDB connection
const agenda = new Agenda({
  db: {
    address: config.database_url as string,
    collection: 'payoutJobs',
  },
  processEvery: '1 minute',
});

// Define job to sync payout information from Stripe
agenda.define('sync-stripe-payouts', async (job: any) => {
  console.log('Running sync-stripe-payouts job');
  
  try {
    // Get all teachers with Stripe accounts
    const teachers = await Teacher.find({
      stripeAccountId: { $exists: true, $ne: null },
      stripeVerified: true,
    });
    
    console.log(`Found ${teachers.length} teachers with verified Stripe accounts`);
    
    for (const teacher of teachers) {
      try {
        console.log(`Processing teacher: ${teacher._id} (${teacher.name.firstName} ${teacher.name.lastName})`);
        
        // Skip if no Stripe account ID
        if (!teacher.stripeAccountId) {
          console.log(`Teacher ${teacher._id} has no Stripe account ID, skipping`);
          continue;
        }
        
        // Get Stripe account balance
        const balance = await stripe.balance.retrieve({
          stripeAccount: teacher.stripeAccountId,
        });
        
        // Calculate available balance in dollars
        const availableBalance = balance.available.reduce(
          (sum, balance) => sum + balance.amount / 100,
          0
        );
        
        console.log(`Teacher ${teacher._id} has available balance: $${availableBalance}`);
        
        // Get upcoming payouts
        const payouts = await stripe.payouts.list(
          { limit: 10 },
          { stripeAccount: teacher.stripeAccountId }
        );
        
        // Process pending payouts
        for (const payout of payouts.data) {
          // Check if we already have this payout in our database
          const existingPayout = await Payout.findOne({
            stripePayoutId: payout.id,
          });
          
          if (!existingPayout) {
            console.log(`Creating new payout record for Stripe payout: ${payout.id}`);
            
            // Create a new payout record
            await Payout.create({
              teacherId: teacher._id,
              amount: payout.amount / 100, // Convert from cents to dollars
              currency: payout.currency,
              status: mapStripePayoutStatus(payout.status),
              stripePayoutId: payout.id,
              description: `Payout from Stripe (${payout.id})`,
              scheduledAt: new Date(payout.created * 1000),
              processedAt: payout.arrival_date ? new Date(payout.arrival_date * 1000) : undefined,
              metadata: {
                stripeStatus: payout.status,
                stripeType: payout.type,
                stripeMethod: payout.method,
              },
            });
          } else if (existingPayout.status !== mapStripePayoutStatus(payout.status)) {
            console.log(`Updating status for payout: ${payout.id} from ${existingPayout.status} to ${mapStripePayoutStatus(payout.status)}`);
            
            // Update the status if it has changed
            existingPayout.status = mapStripePayoutStatus(payout.status);
            if (payout.arrival_date) {
              existingPayout.processedAt = new Date(payout.arrival_date * 1000);
            }
            await existingPayout.save();
          }
        }
        
        // Update teacher's payout information
        await Teacher.findByIdAndUpdate(teacher._id, {
          $set: {
            'payoutInfo.availableBalance': availableBalance,
            'payoutInfo.lastSyncedAt': new Date(),
          },
        });
        
        console.log(`Successfully processed teacher: ${teacher._id}`);
      } catch (error) {
        console.error(`Error processing teacher ${teacher._id}:`, error);
        // Continue with next teacher
      }
    }
    
    console.log('Completed sync-stripe-payouts job');
  } catch (error) {
    console.error('Error in sync-stripe-payouts job:', error);
    throw error;
  }
});

// Helper function to map Stripe payout status to our status
function mapStripePayoutStatus(stripeStatus: string): PayoutStatus {
  switch (stripeStatus) {
    case 'paid':
      return PayoutStatus.COMPLETED;
    case 'pending':
      return PayoutStatus.PROCESSING;
    case 'in_transit':
      return PayoutStatus.PROCESSING;
    case 'canceled':
    case 'failed':
      return PayoutStatus.FAILED;
    default:
      return PayoutStatus.PENDING;
  }
}

// Start the agenda
export const startPayoutSyncJob = async () => {
  await agenda.start();
  
  // Schedule the job to run daily at 1 AM
  await agenda.every('0 1 * * *', 'sync-stripe-payouts');
  
  console.log('Payout sync job scheduled');
};

// Graceful shutdown
export const stopPayoutSyncJob = async () => {
  await agenda.stop();
  console.log('Payout sync job stopped');
};
