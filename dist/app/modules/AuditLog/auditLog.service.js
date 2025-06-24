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
exports.AuditLogService = void 0;
const auditLog_model_1 = require("./auditLog.model");
const auditLog_interface_1 = require("./auditLog.interface");
// Create audit log entry
const createAuditLog = (data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const auditLog = new auditLog_model_1.AuditLog({
            action: data.action,
            category: data.category,
            level: data.level,
            message: data.message,
            userId: data.userId,
            userType: data.userType,
            userEmail: data.userEmail,
            resourceType: data.resourceType,
            resourceId: data.resourceId,
            metadata: data.metadata,
            timestamp: new Date(),
            tags: data.tags || [],
        });
        yield auditLog.save();
        return auditLog;
    }
    catch (error) {
        console.error('Error creating audit log:', error);
        throw error;
    }
});
// Query audit logs with advanced filtering
const queryAuditLogs = (query) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filter = {};
        // Build filter conditions
        if (query.action) {
            filter.action = Array.isArray(query.action) ? { $in: query.action } : query.action;
        }
        if (query.category) {
            filter.category = Array.isArray(query.category) ? { $in: query.category } : query.category;
        }
        if (query.level) {
            filter.level = Array.isArray(query.level) ? { $in: query.level } : query.level;
        }
        if (query.userId) {
            filter.userId = query.userId;
        }
        if (query.userType) {
            filter.userType = query.userType;
        }
        if (query.resourceType) {
            filter.resourceType = query.resourceType;
        }
        if (query.resourceId) {
            filter.resourceId = query.resourceId;
        }
        if (query.startDate || query.endDate) {
            filter.timestamp = {};
            if (query.startDate)
                filter.timestamp.$gte = query.startDate;
            if (query.endDate)
                filter.timestamp.$lte = query.endDate;
        }
        if (query.tags && query.tags.length > 0) {
            filter.tags = { $in: query.tags };
        }
        if (query.searchText) {
            filter.$text = { $search: query.searchText };
        }
        // Execute query
        const limit = Math.min(query.limit || 100, 1000); // Max 1000 records
        const offset = query.offset || 0;
        const sortField = query.sortBy || 'timestamp';
        const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
        const [logs, total] = yield Promise.all([
            auditLog_model_1.AuditLog.find(filter)
                .sort({ [sortField]: sortOrder })
                .limit(limit)
                .skip(offset)
                .lean(),
            auditLog_model_1.AuditLog.countDocuments(filter),
        ]);
        return {
            logs: logs,
            total,
            hasMore: offset + logs.length < total,
        };
    }
    catch (error) {
        console.error('Error querying audit logs:', error);
        throw error;
    }
});
// Get audit log summary and statistics
const getAuditLogSummary = (startDate, endDate, filters) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const matchStage = {
            timestamp: { $gte: startDate, $lte: endDate },
        };
        // Apply additional filters
        if (filters === null || filters === void 0 ? void 0 : filters.category) {
            matchStage.category = Array.isArray(filters.category) ? { $in: filters.category } : filters.category;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.level) {
            matchStage.level = Array.isArray(filters.level) ? { $in: filters.level } : filters.level;
        }
        if (filters === null || filters === void 0 ? void 0 : filters.userId) {
            matchStage.userId = filters.userId;
        }
        const pipeline = [
            { $match: matchStage },
            {
                $facet: {
                    totalEvents: [{ $count: 'count' }],
                    eventsByCategory: [
                        { $group: { _id: '$category', count: { $sum: 1 } } },
                    ],
                    eventsByLevel: [
                        { $group: { _id: '$level', count: { $sum: 1 } } },
                    ],
                    eventsByAction: [
                        { $group: { _id: '$action', count: { $sum: 1 } } },
                    ],
                    topUsers: [
                        { $match: { userId: { $exists: true } } },
                        { $group: { _id: { userId: '$userId', userEmail: '$userEmail' }, count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 10 },
                    ],
                    errorEvents: [
                        { $match: { level: auditLog_interface_1.AuditLogLevel.ERROR } },
                        { $count: 'count' },
                    ],
                    processingTimes: [
                        { $match: { 'metadata.processingTime': { $exists: true } } },
                        { $group: { _id: null, avgTime: { $avg: '$metadata.processingTime' } } },
                    ],
                },
            },
        ];
        const [result] = yield auditLog_model_1.AuditLog.aggregate(pipeline);
        // Process results
        const totalEvents = ((_a = result.totalEvents[0]) === null || _a === void 0 ? void 0 : _a.count) || 0;
        const errorEvents = ((_b = result.errorEvents[0]) === null || _b === void 0 ? void 0 : _b.count) || 0;
        const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
        const averageProcessingTime = ((_c = result.processingTimes[0]) === null || _c === void 0 ? void 0 : _c.avgTime) || 0;
        // Convert arrays to objects
        const eventsByCategory = {};
        result.eventsByCategory.forEach((item) => {
            eventsByCategory[item._id] = item.count;
        });
        const eventsByLevel = {};
        result.eventsByLevel.forEach((item) => {
            eventsByLevel[item._id] = item.count;
        });
        const eventsByAction = {};
        result.eventsByAction.forEach((item) => {
            eventsByAction[item._id] = item.count;
        });
        const topUsers = result.topUsers.map((item) => ({
            userId: item._id.userId,
            userEmail: item._id.userEmail || 'Unknown',
            eventCount: item.count,
        }));
        return {
            totalEvents,
            eventsByCategory,
            eventsByLevel,
            eventsByAction,
            timeRange: { start: startDate, end: endDate },
            topUsers,
            errorRate,
            averageProcessingTime,
        };
    }
    catch (error) {
        console.error('Error getting audit log summary:', error);
        throw error;
    }
});
// Get audit logs for a specific user
const getUserAuditLogs = (userId_1, ...args_1) => __awaiter(void 0, [userId_1, ...args_1], void 0, function* (userId, options = {}) {
    const query = {
        userId,
        limit: options.limit || 50,
        offset: options.offset || 0,
        startDate: options.startDate,
        endDate: options.endDate,
        category: options.category,
        level: options.level,
        sortBy: 'timestamp',
        sortOrder: 'desc',
    };
    const result = yield queryAuditLogs(query);
    return {
        logs: result.logs,
        total: result.total,
    };
});
// Get audit logs for a specific resource
const getResourceAuditLogs = (resourceType_1, resourceId_1, ...args_1) => __awaiter(void 0, [resourceType_1, resourceId_1, ...args_1], void 0, function* (resourceType, resourceId, options = {}) {
    const query = {
        resourceType,
        resourceId,
        limit: options.limit || 50,
        offset: options.offset || 0,
        startDate: options.startDate,
        endDate: options.endDate,
        sortBy: 'timestamp',
        sortOrder: 'desc',
    };
    const result = yield queryAuditLogs(query);
    return {
        logs: result.logs,
        total: result.total,
    };
});
// Archive old audit logs (for compliance and performance)
const archiveOldLogs = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (olderThanDays = 2555) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        const result = yield auditLog_model_1.AuditLog.updateMany({
            timestamp: { $lt: cutoffDate },
            isArchived: { $ne: true },
        }, {
            $set: {
                isArchived: true,
                archivedAt: new Date(),
            },
        });
        return { archived: result.modifiedCount };
    }
    catch (error) {
        console.error('Error archiving old logs:', error);
        throw error;
    }
});
// Delete archived logs (permanent deletion for storage management)
const deleteArchivedLogs = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (archivedBeforeDays = 2920) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - archivedBeforeDays);
        const result = yield auditLog_model_1.AuditLog.deleteMany({
            isArchived: true,
            archivedAt: { $lt: cutoffDate },
        });
        return { deleted: result.deletedCount };
    }
    catch (error) {
        console.error('Error deleting archived logs:', error);
        throw error;
    }
});
exports.AuditLogService = {
    createAuditLog,
    queryAuditLogs,
    getAuditLogSummary,
    getUserAuditLogs,
    getResourceAuditLogs,
    archiveOldLogs,
    deleteArchivedLogs,
};
