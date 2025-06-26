#!/usr/bin/env node

import mongoose from 'mongoose';
import config from '../app/config';
import { Logger } from '../app/config/logger';
import { databaseCleanupService } from '../app/services/database/DatabaseCleanupService';
import { databaseSeedingService } from '../app/services/database/DatabaseSeedingService';

interface ManagementOptions {
  operation: 'cleanup' | 'seed' | 'reset' | 'verify';
  dryRun: boolean;
  completeReset: boolean; // New option for complete database reset
  force: boolean;
  // Legacy options (deprecated but kept for compatibility)
  preserveUsers?: boolean;
  preserveTeachers?: boolean;
  preserveCategories?: boolean;
  preserveSubCategories?: boolean;
}

class DatabaseManager {
  private connected = false;

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      await mongoose.connect(config.database_url as string);
      this.connected = true;
      Logger.info('✅ Connected to MongoDB');
    } catch (error) {
      Logger.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      await mongoose.disconnect();
      this.connected = false;
      Logger.info('✅ Disconnected from MongoDB');
    } catch (error) {
      Logger.error('❌ Failed to disconnect from MongoDB:', error);
      throw error;
    }
  }

  async performCleanup(options: ManagementOptions): Promise<void> {
    Logger.info('🧹 Starting database cleanup operation...');

    if (!options.force && !options.dryRun) {
      Logger.warn('⚠️ This operation will permanently delete data. Use --force to confirm or --dry-run to preview.');
      process.exit(1);
    }

    const result = await databaseCleanupService.performCleanup({
      completeReset: options.completeReset,
      dryRun: options.dryRun,
      batchSize: 1000
    });

    if (result.success) {
      Logger.info('🎉 Database cleanup completed successfully!');
      this.logCleanupResults(result);
      
      if (!options.dryRun) {
        // Verify integrity after cleanup
        const integrity = await databaseCleanupService.verifyIntegrity();
        if (!integrity.valid) {
          Logger.error('❌ Data integrity issues found:', integrity.issues);
          process.exit(1);
        }
      }
    } else {
      Logger.error('❌ Database cleanup failed:', result.errors);
      process.exit(1);
    }
  }

  async performSeeding(options: ManagementOptions): Promise<void> {
    Logger.info('🌱 Starting database seeding operation...');

    const result = await databaseSeedingService.performSeeding({
      seedCategories: true,
      seedSubCategories: true,
      seedDefaultUsers: true,
      seedDefaultTeachers: true,
      seedEmptyModels: true, // Seed all models with empty states
      seedSampleData: false,
      overwriteExisting: options.force
    });

    if (result.success) {
      Logger.info('🎉 Database seeding completed successfully!');
      this.logSeedingResults(result);
      
      // Verify seeding
      const verification = await databaseSeedingService.verifySeeding();
      if (!verification.valid) {
        Logger.error('❌ Seeding verification issues found:', verification.issues);
        process.exit(1);
      }
    } else {
      Logger.error('❌ Database seeding failed:', result.errors);
      process.exit(1);
    }
  }

  async performReset(options: ManagementOptions): Promise<void> {
    Logger.info('🔄 Starting database reset operation...');

    if (!options.force) {
      Logger.warn('⚠️ This operation will completely reset the database. Use --force to confirm.');
      process.exit(1);
    }

    const result = await databaseSeedingService.resetToDefaults();

    if (result.success) {
      Logger.info('🎉 Database reset completed successfully!');
      this.logSeedingResults(result);
    } else {
      Logger.error('❌ Database reset failed:', result.errors);
      process.exit(1);
    }
  }

  async performVerification(): Promise<void> {
    Logger.info('🔍 Starting database verification...');

    // Verify cleanup integrity
    const cleanupIntegrity = await databaseCleanupService.verifyIntegrity();
    
    // Verify seeding integrity
    const seedingIntegrity = await databaseSeedingService.verifySeeding();

    const allValid = cleanupIntegrity.valid && seedingIntegrity.valid;
    const allIssues = [...cleanupIntegrity.issues, ...seedingIntegrity.issues];

    if (allValid) {
      Logger.info('✅ Database verification passed - all checks successful');
    } else {
      Logger.error('❌ Database verification failed:', allIssues);
      process.exit(1);
    }
  }

  private logCleanupResults(result: any): void {
    console.log('\n📊 Cleanup Results:');
    console.log('==================');
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Total Cleaned: ${result.totalCleaned || 0}`);
    console.log('\n🧹 Cleaned Data:');
    if (result.cleanedCounts) {
      Object.entries(result.cleanedCounts).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach((error: string) => console.log(`  - ${error}`));
    }
  }

  private logSeedingResults(result: any): void {
    console.log('\n📊 Seeding Results:');
    console.log('==================');
    console.log(`Duration: ${result.duration}ms`);
    console.log('\n🌱 Seeded Data:');
    Object.entries(result.seededCounts).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach((error: string) => console.log(`  - ${error}`));
    }
  }
}

function parseArguments(): ManagementOptions {
  const args = (process as any).argv.slice(2);
  
  const options: ManagementOptions = {
    operation: 'verify',
    dryRun: false,
    completeReset: true, // Default to complete reset
    force: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--operation':
      case '-o':
        const operation = args[++i];
        if (!['cleanup', 'seed', 'reset', 'verify'].includes(operation)) {
          console.error('❌ Invalid operation. Use: cleanup, seed, reset, or verify');
          process.exit(1);
        }
        options.operation = operation as ManagementOptions['operation'];
        break;
        
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
        
      case '--force':
      case '-f':
        options.force = true;
        break;
        
      case '--no-preserve-users':
        options.preserveUsers = false;
        break;
        
      case '--no-preserve-teachers':
        options.preserveTeachers = false;
        break;
        
      case '--no-preserve-categories':
        options.preserveCategories = false;
        break;
        
      case '--no-preserve-subcategories':
        options.preserveSubCategories = false;
        break;
        
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        
      default:
        console.error(`❌ Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
🗄️  Database Management Tool
============================

Usage: npm run db:manage [options]

Operations:
  --operation, -o <op>           Operation to perform (cleanup|seed|reset|verify)

Options:
  --dry-run, -d                  Preview changes without executing
  --force, -f                    Force operation without confirmation
  --no-preserve-users            Don't preserve user data during cleanup
  --no-preserve-teachers         Don't preserve teacher data during cleanup
  --no-preserve-categories       Don't preserve category data during cleanup
  --no-preserve-subcategories    Don't preserve subcategory data during cleanup
  --help, -h                     Show this help message

Examples:
  npm run db:manage --operation cleanup --dry-run
  npm run db:manage --operation seed --force
  npm run db:manage --operation reset --force
  npm run db:manage --operation verify

Operations:
  cleanup    - Remove all data except preserved models
  seed       - Populate database with default data
  reset      - Complete cleanup + seeding (fresh start)
  verify     - Check database integrity and seeding
`);
}

async function main(): Promise<void> {
  const options = parseArguments();
  const manager = new DatabaseManager();

  try {
    await manager.connect();

    switch (options.operation) {
      case 'cleanup':
        await manager.performCleanup(options);
        break;
      case 'seed':
        await manager.performSeeding(options);
        break;
      case 'reset':
        await manager.performReset(options);
        break;
      case 'verify':
        await manager.performVerification();
        break;
    }

  } catch (error) {
    Logger.error('❌ Database management operation failed:', error);
    process.exit(1);
  } finally {
    await manager.disconnect();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { DatabaseManager, ManagementOptions };
