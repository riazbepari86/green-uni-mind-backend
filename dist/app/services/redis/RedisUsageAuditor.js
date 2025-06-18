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
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisUsageAuditor = exports.RedisUsageAuditor = void 0;
const RedisServiceManager_1 = require("./RedisServiceManager");
class RedisUsageAuditor {
    constructor() {
        this.redis = RedisServiceManager_1.redisServiceManager.primaryClient;
    }
    auditRedisUsage() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔍 Starting Redis usage audit...');
            try {
                const [totalKeys, keysByPattern, memoryInfo, connectionInfo, keyAnalysis] = yield Promise.all([
                    this.getTotalKeys(),
                    this.analyzeKeyPatterns(),
                    this.getMemoryUsage(),
                    this.getConnectionStats(),
                    this.analyzeKeyUsage()
                ]);
                const highUsagePatterns = this.identifyHighUsagePatterns(keyAnalysis);
                const recommendations = this.generateRecommendations(keyAnalysis, memoryInfo);
                const metrics = {
                    totalKeys,
                    keysByPattern,
                    memoryUsage: memoryInfo,
                    operationCounts: yield this.getOperationCounts(),
                    connectionStats: connectionInfo,
                    highUsagePatterns,
                    recommendations
                };
                console.log('✅ Redis usage audit completed');
                return metrics;
            }
            catch (error) {
                console.error('❌ Redis usage audit failed:', error);
                throw error;
            }
        });
    }
    getTotalKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const info = yield this.redis.info('keyspace');
                const dbMatch = info.match(/db0:keys=(\d+)/);
                return dbMatch ? parseInt(dbMatch[1]) : 0;
            }
            catch (error) {
                console.warn('Could not get total keys, using SCAN fallback');
                return yield this.countKeysWithScan();
            }
        });
    }
    countKeysWithScan() {
        return __awaiter(this, void 0, void 0, function* () {
            let count = 0;
            let cursor = '0';
            do {
                const result = yield this.redis.scan(cursor, 'COUNT', 100);
                cursor = result[0];
                count += result[1].length;
            } while (cursor !== '0');
            return count;
        });
    }
    analyzeKeyPatterns() {
        return __awaiter(this, void 0, void 0, function* () {
            const patterns = {};
            let cursor = '0';
            do {
                const result = yield this.redis.scan(cursor, 'COUNT', 100);
                cursor = result[0];
                for (const key of result[1]) {
                    const pattern = this.extractPattern(key);
                    patterns[pattern] = (patterns[pattern] || 0) + 1;
                }
            } while (cursor !== '0');
            return patterns;
        });
    }
    extractPattern(key) {
        // Extract meaningful patterns from keys
        if (key.startsWith('jwt:'))
            return 'jwt:*';
        if (key.startsWith('otp:'))
            return 'otp:*';
        if (key.startsWith('session:'))
            return 'session:*';
        if (key.startsWith('cache:'))
            return 'cache:*';
        if (key.startsWith('metrics:'))
            return 'metrics:*';
        if (key.startsWith('jobs:'))
            return 'jobs:*';
        if (key.startsWith('oauth:'))
            return 'oauth:*';
        if (key.startsWith('login:'))
            return 'login:*';
        if (key.startsWith('api:cache:'))
            return 'api:cache:*';
        // Extract first part for unknown patterns
        const parts = key.split(':');
        return parts.length > 1 ? `${parts[0]}:*` : key;
    }
    getMemoryUsage() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const info = yield this.redis.info('memory');
                const usedMatch = info.match(/used_memory:(\d+)/);
                const peakMatch = info.match(/used_memory_peak:(\d+)/);
                const used = usedMatch ? parseInt(usedMatch[1]) : 0;
                const peak = peakMatch ? parseInt(peakMatch[1]) : 0;
                // Upstash free tier limit is typically 256MB
                const freeLimit = 256 * 1024 * 1024; // 256MB in bytes
                const percentage = (used / freeLimit) * 100;
                return { used, peak, percentage };
            }
            catch (error) {
                console.warn('Could not get memory usage:', error);
                return { used: 0, peak: 0, percentage: 0 };
            }
        });
    }
    getConnectionStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const info = yield this.redis.info('clients');
                const connectedMatch = info.match(/connected_clients:(\d+)/);
                return {
                    totalConnections: connectedMatch ? parseInt(connectedMatch[1]) : 0,
                    activeConnections: connectedMatch ? parseInt(connectedMatch[1]) : 0
                };
            }
            catch (error) {
                console.warn('Could not get connection stats:', error);
                return { totalConnections: 0, activeConnections: 0 };
            }
        });
    }
    analyzeKeyUsage() {
        return __awaiter(this, void 0, void 0, function* () {
            const analysis = [];
            const patterns = yield this.analyzeKeyPatterns();
            for (const [pattern, count] of Object.entries(patterns)) {
                const sampleKeys = yield this.getSampleKeys(pattern, 5);
                const avgTTL = yield this.getAverageTTL(sampleKeys);
                const memoryEstimate = yield this.estimateMemoryUsage(sampleKeys);
                analysis.push({
                    pattern,
                    count,
                    sampleKeys,
                    avgTTL,
                    memoryEstimate,
                    category: this.categorizePattern(pattern),
                    priority: this.prioritizePattern(pattern, count, memoryEstimate)
                });
            }
            return analysis.sort((a, b) => b.count - a.count);
        });
    }
    getSampleKeys(pattern, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchPattern = pattern.replace('*', '*');
            let cursor = '0';
            const keys = [];
            do {
                const result = yield this.redis.scan(cursor, 'MATCH', searchPattern, 'COUNT', 50);
                cursor = result[0];
                keys.push(...result[1]);
                if (keys.length >= limit)
                    break;
            } while (cursor !== '0');
            return keys.slice(0, limit);
        });
    }
    getAverageTTL(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keys.length === 0)
                return -1;
            const ttls = yield Promise.all(keys.map(key => this.redis.ttl(key).catch(() => -1)));
            const validTTLs = ttls.filter(ttl => ttl > 0);
            return validTTLs.length > 0 ? validTTLs.reduce((a, b) => a + b, 0) / validTTLs.length : -1;
        });
    }
    estimateMemoryUsage(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keys.length === 0)
                return 0;
            let totalSize = 0;
            for (const key of keys.slice(0, 3)) { // Sample first 3 keys
                try {
                    const value = yield this.redis.get(key);
                    if (value) {
                        totalSize += Buffer.byteLength(key, 'utf8') + Buffer.byteLength(value, 'utf8');
                    }
                }
                catch (error) {
                    // Ignore errors for individual keys
                }
            }
            return keys.length > 0 ? (totalSize / Math.min(keys.length, 3)) * keys.length : 0;
        });
    }
    categorizePattern(pattern) {
        if (pattern.includes('jwt') || pattern.includes('session') || pattern.includes('oauth'))
            return 'auth';
        if (pattern.includes('otp'))
            return 'auth';
        if (pattern.includes('cache'))
            return 'cache';
        if (pattern.includes('metrics') || pattern.includes('stats'))
            return 'monitoring';
        if (pattern.includes('jobs') || pattern.includes('bull'))
            return 'jobs';
        return 'other';
    }
    prioritizePattern(pattern, count, memoryEstimate) {
        // Critical: Authentication and OTP (essential for app function)
        if (pattern.includes('jwt') || pattern.includes('otp') || pattern.includes('session')) {
            return 'critical';
        }
        // High: High count or high memory usage
        if (count > 1000 || memoryEstimate > 1024 * 1024) { // > 1MB
            return 'high';
        }
        // Medium: Moderate usage
        if (count > 100 || memoryEstimate > 100 * 1024) { // > 100KB
            return 'medium';
        }
        return 'low';
    }
    identifyHighUsagePatterns(analysis) {
        return analysis
            .filter(item => item.priority === 'high' || item.count > 500)
            .map(item => ({
            pattern: item.pattern,
            count: item.count,
            estimatedMemory: item.memoryEstimate,
            priority: item.priority
        }))
            .slice(0, 10); // Top 10 high usage patterns
    }
    generateRecommendations(analysis, memoryInfo) {
        const recommendations = [];
        // Memory usage recommendations
        if (memoryInfo.percentage > 80) {
            recommendations.push('🚨 CRITICAL: Redis memory usage is above 80%. Immediate action required.');
        }
        else if (memoryInfo.percentage > 60) {
            recommendations.push('⚠️ WARNING: Redis memory usage is above 60%. Consider optimization.');
        }
        // Pattern-specific recommendations
        const cachePatterns = analysis.filter(a => a.category === 'cache');
        const totalCacheKeys = cachePatterns.reduce((sum, p) => sum + p.count, 0);
        if (totalCacheKeys > 5000) {
            recommendations.push('📦 Consider implementing cache key compression and shorter TTLs for cache entries.');
        }
        const monitoringPatterns = analysis.filter(a => a.category === 'monitoring');
        const totalMonitoringKeys = monitoringPatterns.reduce((sum, p) => sum + p.count, 0);
        if (totalMonitoringKeys > 1000) {
            recommendations.push('📊 Consider disabling detailed monitoring features to reduce Redis usage.');
        }
        // TTL recommendations
        const noTTLPatterns = analysis.filter(a => a.avgTTL === -1);
        if (noTTLPatterns.length > 0) {
            recommendations.push('⏰ Some keys have no TTL set. Consider adding expiration to prevent memory leaks.');
        }
        // Connection recommendations
        recommendations.push('🔗 Consider consolidating multiple Redis clients into a single client with key prefixes.');
        return recommendations;
    }
    getOperationCounts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const info = yield this.redis.info('stats');
                const operations = {};
                const patterns = [
                    'total_commands_processed',
                    'total_connections_received',
                    'keyspace_hits',
                    'keyspace_misses'
                ];
                for (const pattern of patterns) {
                    const match = info.match(new RegExp(`${pattern}:(\\d+)`));
                    if (match) {
                        operations[pattern] = parseInt(match[1]);
                    }
                }
                return operations;
            }
            catch (error) {
                console.warn('Could not get operation counts:', error);
                return {};
            }
        });
    }
    // Generate detailed report
    generateDetailedReport() {
        return __awaiter(this, void 0, void 0, function* () {
            const metrics = yield this.auditRedisUsage();
            let report = '# Redis Usage Audit Report\n\n';
            report += `**Generated:** ${new Date().toISOString()}\n\n`;
            report += '## Summary\n';
            report += `- **Total Keys:** ${metrics.totalKeys.toLocaleString()}\n`;
            report += `- **Memory Usage:** ${(metrics.memoryUsage.used / 1024 / 1024).toFixed(2)} MB (${metrics.memoryUsage.percentage.toFixed(1)}% of free tier limit)\n`;
            report += `- **Active Connections:** ${metrics.connectionStats.activeConnections}\n\n`;
            report += '## Key Patterns\n';
            const sortedPatterns = Object.entries(metrics.keysByPattern)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10);
            for (const [pattern, count] of sortedPatterns) {
                report += `- **${pattern}:** ${count.toLocaleString()} keys\n`;
            }
            report += '\n## High Usage Patterns\n';
            for (const pattern of metrics.highUsagePatterns) {
                report += `- **${pattern.pattern}:** ${pattern.count.toLocaleString()} keys, ~${(pattern.estimatedMemory / 1024).toFixed(1)} KB (Priority: ${pattern.priority})\n`;
            }
            report += '\n## Recommendations\n';
            for (const recommendation of metrics.recommendations) {
                report += `- ${recommendation}\n`;
            }
            return report;
        });
    }
    // Quick health check for Redis usage
    quickHealthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const memoryInfo = yield this.getMemoryUsage();
                const totalKeys = yield this.getTotalKeys();
                const issues = [];
                let status = 'healthy';
                if (memoryInfo.percentage > 80) {
                    status = 'critical';
                    issues.push('Memory usage above 80%');
                }
                else if (memoryInfo.percentage > 60) {
                    status = 'warning';
                    issues.push('Memory usage above 60%');
                }
                if (totalKeys > 10000) {
                    if (status === 'healthy')
                        status = 'warning';
                    issues.push('High number of keys (>10,000)');
                }
                return {
                    status,
                    memoryPercentage: memoryInfo.percentage,
                    totalKeys,
                    issues
                };
            }
            catch (error) {
                return {
                    status: 'critical',
                    memoryPercentage: 0,
                    totalKeys: 0,
                    issues: ['Unable to connect to Redis']
                };
            }
        });
    }
}
exports.RedisUsageAuditor = RedisUsageAuditor;
exports.redisUsageAuditor = new RedisUsageAuditor();
