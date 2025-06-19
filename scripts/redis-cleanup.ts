#!/usr/bin/env ts-node

/**
 * Redis Cleanup Script
 * 
 * This script cleans up excessive Redis keys that are consuming storage
 * Run this script when Redis usage is high or when you need to free up space
 * 
 * Usage:
 *   bun run scripts/redis-cleanup.ts [--emergency]
 *   
 * Options:
 *   --emergency    Performs emergency cleanup (removes all non-essential keys)
 */

import { redisCleanupService } from '../src/app/services/redis/RedisCleanupService';

async function main() {
  const args = process.argv.slice(2);
  const isEmergency = args.includes('--emergency');

  console.log('🧹 Redis Cleanup Script Started');
  console.log('================================');

  try {
    // Show current memory stats
    console.log('\n📊 Current Redis Memory Usage:');
    await redisCleanupService.getMemoryStats();

    if (isEmergency) {
      console.log('\n🚨 EMERGENCY CLEANUP MODE');
      console.log('This will remove ALL non-essential keys!');
      console.log('Only auth, OTP, sessions, user, and JWT keys will be kept.');
      
      // Wait for confirmation in emergency mode
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question('Are you sure you want to proceed? (yes/no): ', resolve);
      });
      
      rl.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Emergency cleanup cancelled');
        process.exit(0);
      }

      await redisCleanupService.emergencyCleanup();
    } else {
      console.log('\n🧹 Standard Cleanup Mode');
      console.log('Removing performance metrics and monitoring data...');
      
      // Standard cleanup
      await redisCleanupService.cleanupPerformanceMetrics();
      await redisCleanupService.cleanupLargeCacheKeys();
    }

    // Show final memory stats
    console.log('\n📊 Final Redis Memory Usage:');
    await redisCleanupService.getMemoryStats();

    console.log('\n✅ Redis cleanup completed successfully!');
    console.log('\n💡 Tips to prevent future Redis overload:');
    console.log('   - Keep monitoring services disabled');
    console.log('   - Use memory caching instead of Redis for non-critical data');
    console.log('   - Run this cleanup script regularly if needed');
    console.log('   - Monitor Redis usage through Upstash dashboard');

  } catch (error) {
    console.error('❌ Redis cleanup failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n⚠️ Cleanup interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Cleanup terminated');
  process.exit(0);
});

// Run the script
main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
