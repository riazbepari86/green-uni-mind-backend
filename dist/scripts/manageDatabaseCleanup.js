#!/usr/bin/env node
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
exports.DatabaseManager = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../app/config"));
const logger_1 = require("../app/config/logger");
const DatabaseCleanupService_1 = require("../app/services/database/DatabaseCleanupService");
const DatabaseSeedingService_1 = require("../app/services/database/DatabaseSeedingService");
class DatabaseManager {
    constructor() {
        this.connected = false;
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.connected)
                return;
            try {
                yield mongoose_1.default.connect(config_1.default.database_url);
                this.connected = true;
                logger_1.Logger.info('✅ Connected to MongoDB');
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to connect to MongoDB:', error);
                throw error;
            }
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connected)
                return;
            try {
                yield mongoose_1.default.disconnect();
                this.connected = false;
                logger_1.Logger.info('✅ Disconnected from MongoDB');
            }
            catch (error) {
                logger_1.Logger.error('❌ Failed to disconnect from MongoDB:', error);
                throw error;
            }
        });
    }
    performCleanup(options) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🧹 Starting database cleanup operation...');
            if (!options.force && !options.dryRun) {
                logger_1.Logger.warn('⚠️ This operation will permanently delete data. Use --force to confirm or --dry-run to preview.');
                process.exit(1);
            }
            const result = yield DatabaseCleanupService_1.databaseCleanupService.performCleanup({
                completeReset: options.completeReset,
                dryRun: options.dryRun,
                batchSize: 1000
            });
            if (result.success) {
                logger_1.Logger.info('🎉 Database cleanup completed successfully!');
                this.logCleanupResults(result);
                if (!options.dryRun) {
                    // Verify integrity after cleanup
                    const integrity = yield DatabaseCleanupService_1.databaseCleanupService.verifyIntegrity();
                    if (!integrity.valid) {
                        logger_1.Logger.error('❌ Data integrity issues found:', integrity.issues);
                        process.exit(1);
                    }
                }
            }
            else {
                logger_1.Logger.error('❌ Database cleanup failed:', result.errors);
                process.exit(1);
            }
        });
    }
    performSeeding(options) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🌱 Starting database seeding operation...');
            const result = yield DatabaseSeedingService_1.databaseSeedingService.performSeeding({
                seedCategories: true,
                seedSubCategories: true,
                seedDefaultUsers: true,
                seedDefaultTeachers: true,
                seedEmptyModels: true, // Seed all models with empty states
                seedSampleData: false,
                overwriteExisting: options.force
            });
            if (result.success) {
                logger_1.Logger.info('🎉 Database seeding completed successfully!');
                this.logSeedingResults(result);
                // Verify seeding
                const verification = yield DatabaseSeedingService_1.databaseSeedingService.verifySeeding();
                if (!verification.valid) {
                    logger_1.Logger.error('❌ Seeding verification issues found:', verification.issues);
                    process.exit(1);
                }
            }
            else {
                logger_1.Logger.error('❌ Database seeding failed:', result.errors);
                process.exit(1);
            }
        });
    }
    performReset(options) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🔄 Starting database reset operation...');
            if (!options.force) {
                logger_1.Logger.warn('⚠️ This operation will completely reset the database. Use --force to confirm.');
                process.exit(1);
            }
            const result = yield DatabaseSeedingService_1.databaseSeedingService.resetToDefaults();
            if (result.success) {
                logger_1.Logger.info('🎉 Database reset completed successfully!');
                this.logSeedingResults(result);
            }
            else {
                logger_1.Logger.error('❌ Database reset failed:', result.errors);
                process.exit(1);
            }
        });
    }
    performVerification() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🔍 Starting database verification...');
            // Verify cleanup integrity
            const cleanupIntegrity = yield DatabaseCleanupService_1.databaseCleanupService.verifyIntegrity();
            // Verify seeding integrity
            const seedingIntegrity = yield DatabaseSeedingService_1.databaseSeedingService.verifySeeding();
            const allValid = cleanupIntegrity.valid && seedingIntegrity.valid;
            const allIssues = [...cleanupIntegrity.issues, ...seedingIntegrity.issues];
            if (allValid) {
                logger_1.Logger.info('✅ Database verification passed - all checks successful');
            }
            else {
                logger_1.Logger.error('❌ Database verification failed:', allIssues);
                process.exit(1);
            }
        });
    }
    logCleanupResults(result) {
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
            result.errors.forEach((error) => console.log(`  - ${error}`));
        }
    }
    logSeedingResults(result) {
        console.log('\n📊 Seeding Results:');
        console.log('==================');
        console.log(`Duration: ${result.duration}ms`);
        console.log('\n🌱 Seeded Data:');
        Object.entries(result.seededCounts).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
        });
        if (result.errors.length > 0) {
            console.log('\n❌ Errors:');
            result.errors.forEach((error) => console.log(`  - ${error}`));
        }
    }
}
exports.DatabaseManager = DatabaseManager;
function parseArguments() {
    const args = process.argv.slice(2);
    const options = {
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
                options.operation = operation;
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
function printHelp() {
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
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = parseArguments();
        const manager = new DatabaseManager();
        try {
            yield manager.connect();
            switch (options.operation) {
                case 'cleanup':
                    yield manager.performCleanup(options);
                    break;
                case 'seed':
                    yield manager.performSeeding(options);
                    break;
                case 'reset':
                    yield manager.performReset(options);
                    break;
                case 'verify':
                    yield manager.performVerification();
                    break;
            }
        }
        catch (error) {
            logger_1.Logger.error('❌ Database management operation failed:', error);
            process.exit(1);
        }
        finally {
            yield manager.disconnect();
        }
    });
}
// Run if this file is executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}
