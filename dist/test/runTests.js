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
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("../app/config/logger");
class TestRunner {
    constructor() {
        this.testSuites = [
            {
                name: 'Unit Tests',
                pattern: '**/*.test.ts',
                timeout: 30000,
                coverage: true,
                parallel: true,
            },
            {
                name: 'Integration Tests',
                pattern: '**/integration/*.test.ts',
                timeout: 60000,
                coverage: true,
                parallel: false,
            },
            {
                name: 'Analytics Tests',
                pattern: '**/analytics.test.ts',
                timeout: 45000,
                coverage: true,
                parallel: true,
            },
            {
                name: 'Messaging Tests',
                pattern: '**/messaging.test.ts',
                timeout: 45000,
                coverage: true,
                parallel: true,
            },
            {
                name: 'WebSocket Tests',
                pattern: '**/websocket.test.ts',
                timeout: 60000,
                coverage: false,
                parallel: false,
            },
            {
                name: 'Cache Tests',
                pattern: '**/cache.test.ts',
                timeout: 30000,
                coverage: true,
                parallel: true,
            },
            {
                name: 'Performance Tests',
                pattern: '**/performance/*.test.ts',
                timeout: 120000,
                coverage: false,
                parallel: false,
            },
            {
                name: 'Enhanced Analytics Tests',
                pattern: '**/enhanced-analytics.test.ts',
                timeout: 60000,
                coverage: true,
                parallel: true,
            },
            {
                name: 'Enhanced Messaging Tests',
                pattern: '**/enhanced-messaging.test.ts',
                timeout: 60000,
                coverage: true,
                parallel: true,
            },
            {
                name: 'Enhanced Activity Tests',
                pattern: '**/enhanced-activity.test.ts',
                timeout: 60000,
                coverage: true,
                parallel: true,
            },
        ];
        this.results = [];
    }
    /**
     * Run all test suites
     */
    runAll() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🧪 Starting comprehensive test suite...');
            const startTime = Date.now();
            try {
                // Setup test environment
                yield this.setupTestEnvironment();
                // Run each test suite
                for (const suite of this.testSuites) {
                    yield this.runTestSuite(suite);
                }
                // Generate reports
                yield this.generateReports();
                const duration = Date.now() - startTime;
                logger_1.Logger.info(`✅ All tests completed in ${duration}ms`);
                // Print summary
                this.printSummary();
            }
            catch (error) {
                logger_1.Logger.error('❌ Test execution failed:', error);
                process.exit(1);
            }
        });
    }
    /**
     * Run specific test suite
     */
    runSuite(suiteName) {
        return __awaiter(this, void 0, void 0, function* () {
            const suite = this.testSuites.find(s => s.name === suiteName);
            if (!suite) {
                logger_1.Logger.error(`❌ Test suite '${suiteName}' not found`);
                return;
            }
            yield this.setupTestEnvironment();
            yield this.runTestSuite(suite);
            this.printSummary();
        });
    }
    /**
     * Setup test environment
     */
    setupTestEnvironment() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('🔧 Setting up test environment...');
            // Set test environment variables
            process.env.NODE_ENV = 'test';
            process.env.LOG_LEVEL = 'error';
            process.env.REDIS_URL = process.env.REDIS_TEST_URL || 'redis://localhost:6379/1';
            // Create test directories
            const testDirs = ['coverage', 'reports', 'logs'];
            for (const dir of testDirs) {
                const dirPath = path_1.default.join(process.cwd(), dir);
                if (!fs_1.default.existsSync(dirPath)) {
                    fs_1.default.mkdirSync(dirPath, { recursive: true });
                }
            }
            logger_1.Logger.info('✅ Test environment ready');
        });
    }
    /**
     * Run a single test suite
     */
    runTestSuite(suite) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info(`🏃 Running ${suite.name}...`);
            const startTime = Date.now();
            try {
                const result = yield this.executeJest(suite);
                const duration = Date.now() - startTime;
                this.results.push({
                    suite: suite.name,
                    passed: result.passed,
                    failed: result.failed,
                    skipped: result.skipped,
                    duration,
                    coverage: result.coverage,
                });
                if (result.failed > 0) {
                    logger_1.Logger.warn(`⚠️ ${suite.name} completed with ${result.failed} failures`);
                }
                else {
                    logger_1.Logger.info(`✅ ${suite.name} completed successfully`);
                }
            }
            catch (error) {
                logger_1.Logger.error(`❌ ${suite.name} failed:`, error);
                this.results.push({
                    suite: suite.name,
                    passed: 0,
                    failed: 1,
                    skipped: 0,
                    duration: Date.now() - startTime,
                });
            }
        });
    }
    /**
     * Execute Jest for a test suite
     */
    executeJest(suite) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                var _a, _b, _c;
                const jestArgs = [
                    '--testPathPattern', suite.pattern,
                    '--testTimeout', ((_a = suite.timeout) === null || _a === void 0 ? void 0 : _a.toString()) || '30000',
                    '--verbose',
                    '--forceExit',
                    '--detectOpenHandles',
                ];
                if (suite.coverage) {
                    jestArgs.push('--coverage', '--coverageReporters', 'json', 'lcov', 'text');
                }
                if (suite.parallel) {
                    jestArgs.push('--maxWorkers', '4');
                }
                else {
                    jestArgs.push('--runInBand');
                }
                // Add JSON reporter for parsing results
                jestArgs.push('--json', '--outputFile', `reports/${suite.name.replace(/\s+/g, '-').toLowerCase()}-results.json`);
                const jest = (0, child_process_1.spawn)('npx', ['jest', ...jestArgs], {
                    stdio: ['inherit', 'pipe', 'pipe'],
                    cwd: process.cwd(),
                });
                let stdout = '';
                let stderr = '';
                (_b = jest.stdout) === null || _b === void 0 ? void 0 : _b.on('data', (data) => {
                    stdout += data.toString();
                });
                (_c = jest.stderr) === null || _c === void 0 ? void 0 : _c.on('data', (data) => {
                    stderr += data.toString();
                });
                jest.on('close', (code) => {
                    try {
                        // Parse Jest JSON output
                        const resultsFile = `reports/${suite.name.replace(/\s+/g, '-').toLowerCase()}-results.json`;
                        if (fs_1.default.existsSync(resultsFile)) {
                            const results = JSON.parse(fs_1.default.readFileSync(resultsFile, 'utf8'));
                            resolve({
                                passed: results.numPassedTests || 0,
                                failed: results.numFailedTests || 0,
                                skipped: results.numPendingTests || 0,
                                coverage: results.coverageMap ? this.calculateCoverage(results.coverageMap) : undefined,
                            });
                        }
                        else {
                            // Fallback parsing from stdout/stderr
                            resolve(this.parseJestOutput(stdout, stderr));
                        }
                    }
                    catch (error) {
                        reject(error);
                    }
                });
                jest.on('error', (error) => {
                    reject(error);
                });
            });
        });
    }
    /**
     * Parse Jest output when JSON file is not available
     */
    parseJestOutput(stdout, stderr) {
        const output = stdout + stderr;
        // Extract test results using regex
        const passedMatch = output.match(/(\d+) passed/);
        const failedMatch = output.match(/(\d+) failed/);
        const skippedMatch = output.match(/(\d+) skipped/);
        return {
            passed: passedMatch ? parseInt(passedMatch[1]) : 0,
            failed: failedMatch ? parseInt(failedMatch[1]) : 0,
            skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
        };
    }
    /**
     * Calculate overall coverage percentage
     */
    calculateCoverage(coverageMap) {
        if (!coverageMap)
            return 0;
        let totalStatements = 0;
        let coveredStatements = 0;
        for (const file in coverageMap) {
            const fileCoverage = coverageMap[file];
            if (fileCoverage.s) {
                for (const statement in fileCoverage.s) {
                    totalStatements++;
                    if (fileCoverage.s[statement] > 0) {
                        coveredStatements++;
                    }
                }
            }
        }
        return totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100) : 0;
    }
    /**
     * Generate test reports
     */
    generateReports() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.Logger.info('📊 Generating test reports...');
            // Generate HTML report
            yield this.generateHtmlReport();
            // Generate JSON report
            yield this.generateJsonReport();
            // Generate coverage report
            yield this.generateCoverageReport();
            logger_1.Logger.info('✅ Reports generated');
        });
    }
    /**
     * Generate HTML test report
     */
    generateHtmlReport() {
        return __awaiter(this, void 0, void 0, function* () {
            const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Results - Green Uni Mind</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .suite { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .passed { color: green; }
        .failed { color: red; }
        .skipped { color: orange; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Test Results - Green Uni Mind Backend</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Total Suites: ${this.results.length}</p>
        <p>Total Tests: ${this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0)}</p>
        <p class="passed">Passed: ${this.results.reduce((sum, r) => sum + r.passed, 0)}</p>
        <p class="failed">Failed: ${this.results.reduce((sum, r) => sum + r.failed, 0)}</p>
        <p class="skipped">Skipped: ${this.results.reduce((sum, r) => sum + r.skipped, 0)}</p>
        <p>Total Duration: ${this.results.reduce((sum, r) => sum + r.duration, 0)}ms</p>
    </div>
    
    <h2>Test Suites</h2>
    <table>
        <tr>
            <th>Suite</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Skipped</th>
            <th>Duration</th>
            <th>Coverage</th>
        </tr>
        ${this.results.map(result => `
        <tr>
            <td>${result.suite}</td>
            <td class="passed">${result.passed}</td>
            <td class="failed">${result.failed}</td>
            <td class="skipped">${result.skipped}</td>
            <td>${result.duration}ms</td>
            <td>${result.coverage ? result.coverage + '%' : 'N/A'}</td>
        </tr>
        `).join('')}
    </table>
    
    <p><em>Generated on ${new Date().toISOString()}</em></p>
</body>
</html>
    `;
            fs_1.default.writeFileSync('reports/test-results.html', html);
        });
    }
    /**
     * Generate JSON test report
     */
    generateJsonReport() {
        return __awaiter(this, void 0, void 0, function* () {
            const report = {
                timestamp: new Date().toISOString(),
                summary: {
                    totalSuites: this.results.length,
                    totalTests: this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0),
                    passed: this.results.reduce((sum, r) => sum + r.passed, 0),
                    failed: this.results.reduce((sum, r) => sum + r.failed, 0),
                    skipped: this.results.reduce((sum, r) => sum + r.skipped, 0),
                    duration: this.results.reduce((sum, r) => sum + r.duration, 0),
                },
                suites: this.results,
            };
            fs_1.default.writeFileSync('reports/test-results.json', JSON.stringify(report, null, 2));
        });
    }
    /**
     * Generate coverage report
     */
    generateCoverageReport() {
        return __awaiter(this, void 0, void 0, function* () {
            // Coverage reports are generated by Jest, just log the location
            if (fs_1.default.existsSync('coverage/lcov-report/index.html')) {
                logger_1.Logger.info('📊 Coverage report available at: coverage/lcov-report/index.html');
            }
        });
    }
    /**
     * Print test summary to console
     */
    printSummary() {
        const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0);
        const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
        const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
        const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
        const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Suites: ${this.results.length}`);
        console.log(`Total Tests:  ${totalTests}`);
        console.log(`✅ Passed:    ${totalPassed}`);
        console.log(`❌ Failed:    ${totalFailed}`);
        console.log(`⏭️ Skipped:   ${totalSkipped}`);
        console.log(`⏱️ Duration:  ${totalDuration}ms`);
        console.log('='.repeat(60));
        if (totalFailed > 0) {
            console.log('❌ Some tests failed. Check the reports for details.');
            process.exit(1);
        }
        else {
            console.log('✅ All tests passed!');
        }
    }
}
// CLI interface
const args = process.argv.slice(2);
const testRunner = new TestRunner();
if (args.length === 0) {
    testRunner.runAll();
}
else if (args[0] === '--suite' && args[1]) {
    testRunner.runSuite(args[1]);
}
else {
    console.log('Usage:');
    console.log('  npm run test:all           # Run all test suites');
    console.log('  npm run test:suite <name>  # Run specific test suite');
    console.log('');
    console.log('Available test suites:');
    console.log('  - Unit Tests');
    console.log('  - Integration Tests');
    console.log('  - Analytics Tests');
    console.log('  - Messaging Tests');
    console.log('  - WebSocket Tests');
    console.log('  - Cache Tests');
    console.log('  - Performance Tests');
    console.log('  - Enhanced Analytics Tests');
    console.log('  - Enhanced Messaging Tests');
    console.log('  - Enhanced Activity Tests');
}
exports.default = TestRunner;
