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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopPayoutSyncJob = exports.startPayoutSyncJob = void 0;
const agenda_1 = require("agenda");
const stripe_1 = require("../utils/stripe");
const teacher_model_1 = require("../modules/Teacher/teacher.model");
const payout_model_1 = require("../modules/Payment/payout.model");
const payout_interface_1 = require("../modules/Payment/payout.interface");
const config_1 = __importDefault(require("../config"));
// Initialize Agenda with MongoDB connection
const agenda = new agenda_1.Agenda({
    db: {
        address: config_1.default.database_url,
        collection: 'payoutJobs',
    },
    processEvery: '1 minute',
});
// Define job to sync payout information from Stripe
agenda.define('sync-stripe-payouts', (job) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Running sync-stripe-payouts job');
    try {
        // Get all teachers with Stripe accounts
        const teachers = yield teacher_model_1.Teacher.find({
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
                const balance = yield stripe_1.stripe.balance.retrieve({
                    stripeAccount: teacher.stripeAccountId,
                });
                // Calculate available balance in dollars
                const availableBalance = balance.available.reduce((sum, balance) => sum + balance.amount / 100, 0);
                console.log(`Teacher ${teacher._id} has available balance: $${availableBalance}`);
                // Get upcoming payouts
                const payouts = yield stripe_1.stripe.payouts.list({ limit: 10 }, { stripeAccount: teacher.stripeAccountId });
                // Process pending payouts
                for (const payout of payouts.data) {
                    // Check if we already have this payout in our database
                    const existingPayout = yield payout_model_1.Payout.findOne({
                        stripePayoutId: payout.id,
                    });
                    if (!existingPayout) {
                        console.log(`Creating new payout record for Stripe payout: ${payout.id}`);
                        // Create a new payout record
                        yield payout_model_1.Payout.create({
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
                    }
                    else if (existingPayout.status !== mapStripePayoutStatus(payout.status)) {
                        console.log(`Updating status for payout: ${payout.id} from ${existingPayout.status} to ${mapStripePayoutStatus(payout.status)}`);
                        // Update the status if it has changed
                        existingPayout.status = mapStripePayoutStatus(payout.status);
                        if (payout.arrival_date) {
                            existingPayout.processedAt = new Date(payout.arrival_date * 1000);
                        }
                        yield existingPayout.save();
                    }
                }
                // Update teacher's payout information
                yield teacher_model_1.Teacher.findByIdAndUpdate(teacher._id, {
                    $set: {
                        'payoutInfo.availableBalance': availableBalance,
                        'payoutInfo.lastSyncedAt': new Date(),
                    },
                });
                console.log(`Successfully processed teacher: ${teacher._id}`);
            }
            catch (error) {
                console.error(`Error processing teacher ${teacher._id}:`, error);
                // Continue with next teacher
            }
        }
        console.log('Completed sync-stripe-payouts job');
    }
    catch (error) {
        console.error('Error in sync-stripe-payouts job:', error);
        throw error;
    }
}));
// Helper function to map Stripe payout status to our status
function mapStripePayoutStatus(stripeStatus) {
    switch (stripeStatus) {
        case 'paid':
            return payout_interface_1.PayoutStatus.COMPLETED;
        case 'pending':
            return payout_interface_1.PayoutStatus.PROCESSING;
        case 'in_transit':
            return payout_interface_1.PayoutStatus.PROCESSING;
        case 'canceled':
        case 'failed':
            return payout_interface_1.PayoutStatus.FAILED;
        default:
            return payout_interface_1.PayoutStatus.PENDING;
    }
}
// Start the agenda
const startPayoutSyncJob = () => __awaiter(void 0, void 0, void 0, function* () {
    yield agenda.start();
    // Schedule the job to run daily at 1 AM
    yield agenda.every('0 1 * * *', 'sync-stripe-payouts');
    console.log('Payout sync job scheduled');
});
exports.startPayoutSyncJob = startPayoutSyncJob;
// Graceful shutdown
const stopPayoutSyncJob = () => __awaiter(void 0, void 0, void 0, function* () {
    yield agenda.stop();
    console.log('Payout sync job stopped');
});
exports.stopPayoutSyncJob = stopPayoutSyncJob;
