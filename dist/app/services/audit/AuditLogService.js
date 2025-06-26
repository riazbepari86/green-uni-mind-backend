"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.auditLogService = void 0;
const logger_1 = require("../../config/logger");
const mongoose_1 = __importDefault(require("mongoose"));
const auditLog_model_1 = require("../../modules/AuditLog/auditLog.model");
// MongoDB Schema for audit logs
const auditLogSchema = new mongoose_1.default.Schema({
    id: { type: String, required: true, unique: true },
    timestamp: { type: Date, required: true, index: true },
    service: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    userType: { type: String, enum: ['student', 'teacher', 'admin'] },
    resourceId: { type: String, index: true },
    resourceType: { type: String },
    details: { type: mongoose_1.default.Schema.Types.Mixed },
    severity: { type: String, enum: ['info', 'warning', 'error', 'critical'], required: true, index: true },
    source: { type: String, enum: ['backend', 'frontend'], required: true },
    sessionId: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    correlationId: { type: String, index: true },
    duration: { type: Number },
    success: { type: Boolean, required: true, index: true },
    errorMessage: { type: String },
    metadata: { type: mongoose_1.default.Schema.Types.Mixed }
}, {
    timestamps: false, // We handle timestamps manually
    collection: 'audit_logs'
});
// Create indexes for better query performance
auditLogSchema.index({ timestamp: -1, service: 1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ success: 1, timestamp: -1 });
// Use a different model name to avoid conflicts with the main AuditLog model
const ServiceAuditLog = (() => {
    try {
        return mongoose_1.default.model('ServiceAuditLog');
    }
    catch (error) {
        return mongoose_1.default.model('ServiceAuditLog', auditLogSchema);
    }
})();
class AuditLogService {
    constructor() {
        this.logQueue = [];
        this.flushInterval = null;
        this.stats = {
            totalLogs: 0,
            logsByService: {},
            logsBySeverity: {},
            errorRate: 0,
            averageDuration: 0,
            topActions: [],
            topUsers: []
        };
        this.BATCH_SIZE = 100;
        this.FLUSH_INTERVAL = 5000; // 5 seconds
        this.MAX_QUEUE_SIZE = 1000;
        this.startBatchProcessing();
        logger_1.Logger.info('📋 Audit Log Service initialized');
    }
    /**
     * Log an audit entry
     */
    log(entry) {
        return __awaiter(this, void 0, void 0, function* () {
            const auditEntry = Object.assign(Object.assign({}, entry), { id: this.generateId(), timestamp: new Date() });
            // Add to queue for batch processing
            this.logQueue.push(auditEntry);
            // Update stats
            this.updateStats(auditEntry);
            // Flush immediately for critical entries
            if (entry.severity === 'critical') {
                yield this.flushQueue();
            }
            // Prevent queue overflow
            if (this.logQueue.length >= this.MAX_QUEUE_SIZE) {
                yield this.flushQueue();
            }
        });
    }
    /**
     * Log SSE connection events
     */
    logSSEConnection(userId, userType, action, details) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.log({
                service: 'sse',
                action: `sse_${action}`,
                userId,
                userType: userType,
                details,
                severity: action === 'error' ? 'error' : 'info',
                source: 'backend',
                success: action !== 'error'
            });
        });
    }
    /**
     * Log polling events
     */
    logPollingEvent(userId, userType, action, details) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.log({
                service: 'polling',
                action: `polling_${action}`,
                userId,
                userType: userType,
                details,
                severity: action === 'error' ? 'error' : 'info',
                source: 'backend',
                success: action !== 'error'
            });
        });
    }
    /**
     * Log analytics events
     */
    logAnalyticsEvent(teacherId_1, action_1, details_1) {
        return __awaiter(this, arguments, void 0, function* (teacherId, action, details, success = true) {
            yield this.log({
                service: 'analytics',
                action: `analytics_${action}`,
                userId: teacherId,
                userType: 'teacher',
                details,
                severity: success ? 'info' : 'error',
                source: 'backend',
                success
            });
        });
    }
    /**
     * Log messaging events
     */
    logMessagingEvent(userId_1, userType_1, action_1, details_1) {
        return __awaiter(this, arguments, void 0, function* (userId, userType, action, details, success = true) {
            yield this.log({
                service: 'messaging',
                action: `messaging_${action}`,
                userId,
                userType: userType,
                details,
                severity: success ? 'info' : 'error',
                source: 'backend',
                success
            });
        });
    }
    /**
     * Log course events
     */
    logCourseEvent(userId_1, userType_1, action_1, courseId_1, details_1) {
        return __awaiter(this, arguments, void 0, function* (userId, userType, action, courseId, details, success = true) {
            yield this.log({
                service: 'course',
                action: `course_${action}`,
                userId,
                userType: userType,
                resourceId: courseId,
                resourceType: 'course',
                details,
                severity: success ? 'info' : 'error',
                source: 'backend',
                success
            });
        });
    }
    /**
     * Log performance metrics
     */
    logPerformance(service_1, action_1, duration_1, success_1) {
        return __awaiter(this, arguments, void 0, function* (service, action, duration, success, details = {}) {
            yield this.log({
                service: service,
                action: `performance_${action}`,
                details: Object.assign(Object.assign({}, details), { duration, performanceMetric: true }),
                severity: success ? 'info' : 'warning',
                source: 'backend',
                duration,
                success
            });
        });
    }
    /**
     * Log security events
     */
    logSecurityEvent(action_1, userId_1, details_1) {
        return __awaiter(this, arguments, void 0, function* (action, userId, details, severity = 'warning') {
            yield this.log({
                service: 'auth',
                action: `security_${action}`,
                userId,
                details,
                severity,
                source: 'backend',
                success: false // Security events are typically failures
            });
        });
    }
    /**
     * Query audit logs
     */
    queryLogs(query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filter = {};
                if (query.service)
                    filter.service = query.service;
                if (query.action)
                    filter.action = query.action;
                if (query.userId)
                    filter.userId = query.userId;
                if (query.severity)
                    filter.severity = query.severity;
                if (query.success !== undefined)
                    filter.success = query.success;
                if (query.startDate || query.endDate) {
                    filter.timestamp = {};
                    if (query.startDate)
                        filter.timestamp.$gte = query.startDate;
                    if (query.endDate)
                        filter.timestamp.$lte = query.endDate;
                }
                const logs = yield auditLog_model_1.AuditLog
                    .find(filter)
                    .sort({ timestamp: -1 })
                    .limit(query.limit || 100)
                    .skip(query.offset || 0)
                    .lean();
                return logs.map((log) => (Object.assign(Object.assign({}, log), { timestamp: new Date(log.timestamp) })));
            }
            catch (error) {
                logger_1.Logger.error('Failed to query audit logs:', error);
                return [];
            }
        });
    }
    /**
     * Get audit log statistics
     */
    getStats() {
        return __awaiter(this, arguments, void 0, function* (days = 7) {
            try {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                const pipeline = [
                    { $match: { timestamp: { $gte: startDate } } },
                    {
                        $group: {
                            _id: null,
                            totalLogs: { $sum: 1 },
                            errorCount: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } },
                            avgDuration: { $avg: '$duration' },
                            serviceStats: {
                                $push: {
                                    service: '$service',
                                    severity: '$severity',
                                    action: '$action',
                                    userId: '$userId'
                                }
                            }
                        }
                    }
                ];
                const result = yield ServiceAuditLog.aggregate(pipeline);
                if (result.length === 0) {
                    return this.stats;
                }
                const data = result[0];
                const serviceStats = data.serviceStats || [];
                // Calculate service distribution
                const logsByService = {};
                const logsBySeverity = {};
                const actionCounts = {};
                const userCounts = {};
                for (const stat of serviceStats) {
                    logsByService[stat.service] = (logsByService[stat.service] || 0) + 1;
                    logsBySeverity[stat.severity] = (logsBySeverity[stat.severity] || 0) + 1;
                    actionCounts[stat.action] = (actionCounts[stat.action] || 0) + 1;
                    if (stat.userId) {
                        userCounts[stat.userId] = (userCounts[stat.userId] || 0) + 1;
                    }
                }
                // Get top actions and users
                const topActions = Object.entries(actionCounts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([action, count]) => ({ action, count }));
                const topUsers = Object.entries(userCounts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([userId, count]) => ({ userId, count }));
                return {
                    totalLogs: data.totalLogs,
                    logsByService,
                    logsBySeverity,
                    errorRate: data.totalLogs > 0 ? (data.errorCount / data.totalLogs) * 100 : 0,
                    averageDuration: data.avgDuration || 0,
                    topActions,
                    topUsers
                };
            }
            catch (error) {
                logger_1.Logger.error('Failed to get audit log stats:', error);
                return this.stats;
            }
        });
    }
    /**
     * Export audit logs
     */
    exportLogs(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, format = 'json') {
            const logs = yield this.queryLogs(Object.assign(Object.assign({}, query), { limit: 10000 }));
            if (format === 'csv') {
                return this.convertToCSV(logs);
            }
            else {
                return JSON.stringify(logs, null, 2);
            }
        });
    }
    /**
     * Private helper methods
     */
    generateId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    updateStats(entry) {
        this.stats.totalLogs++;
        this.stats.logsByService[entry.service] = (this.stats.logsByService[entry.service] || 0) + 1;
        this.stats.logsBySeverity[entry.severity] = (this.stats.logsBySeverity[entry.severity] || 0) + 1;
        if (!entry.success) {
            this.stats.errorRate = ((this.stats.errorRate * (this.stats.totalLogs - 1)) + 1) / this.stats.totalLogs;
        }
        if (entry.duration) {
            this.stats.averageDuration = ((this.stats.averageDuration * (this.stats.totalLogs - 1)) + entry.duration) / this.stats.totalLogs;
        }
    }
    startBatchProcessing() {
        this.flushInterval = setInterval(() => {
            if (this.logQueue.length > 0) {
                this.flushQueue();
            }
        }, this.FLUSH_INTERVAL);
    }
    flushQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.logQueue.length === 0)
                return;
            const batch = this.logQueue.splice(0, this.BATCH_SIZE);
            try {
                yield ServiceAuditLog.insertMany(batch, { ordered: false });
                logger_1.Logger.debug(`📋 Flushed ${batch.length} audit log entries`);
            }
            catch (error) {
                logger_1.Logger.error('Failed to flush audit log batch:', error);
                // Try to store in Redis as backup
                try {
                    // Use direct Redis client since lpush is not in redisOperations
                    const redis = (yield Promise.resolve().then(() => __importStar(require('../../config/redis')))).default;
                    yield redis.lpush('audit_log_backup', JSON.stringify(batch));
                }
                catch (redisError) {
                    logger_1.Logger.error('Failed to backup audit logs to Redis:', redisError);
                }
            }
        });
    }
    convertToCSV(logs) {
        if (logs.length === 0)
            return '';
        const headers = Object.keys(logs[0]).join(',');
        const rows = logs.map(log => Object.values(log).map(value => typeof value === 'object' ? JSON.stringify(value) : String(value)).join(','));
        return [headers, ...rows].join('\n');
    }
    /**
     * Cleanup old logs
     */
    cleanupOldLogs() {
        return __awaiter(this, arguments, void 0, function* (daysToKeep = 90) {
            try {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
                const result = yield ServiceAuditLog.deleteMany({
                    timestamp: { $lt: cutoffDate }
                });
                logger_1.Logger.info(`📋 Cleaned up ${result.deletedCount} old audit log entries`);
                return result.deletedCount || 0;
            }
            catch (error) {
                logger_1.Logger.error('Failed to cleanup old audit logs:', error);
                return 0;
            }
        });
    }
    /**
     * Shutdown service
     */
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.flushInterval) {
                clearInterval(this.flushInterval);
            }
            // Flush remaining logs
            yield this.flushQueue();
            logger_1.Logger.info('📋 Audit Log Service shutdown complete');
        });
    }
}
// Create singleton instance
const auditLogService = new AuditLogService();
exports.auditLogService = auditLogService;
exports.default = AuditLogService;
