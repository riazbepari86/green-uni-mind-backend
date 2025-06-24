import { Types } from 'mongoose';
import { AuditLog } from './auditLog.model';
import { 
  IAuditLog,
  IAuditLogQuery,
  IAuditLogSummary,
  AuditLogAction,
  AuditLogCategory,
  AuditLogLevel,
  IAuditLogMetadata
} from './auditLog.interface';

// Create audit log entry
const createAuditLog = async (data: {
  action: AuditLogAction;
  category: AuditLogCategory;
  level: AuditLogLevel;
  message: string;
  userId?: string | Types.ObjectId;
  userType?: 'student' | 'teacher' | 'admin' | 'system';
  userEmail?: string;
  resourceType?: string;
  resourceId?: string;
  metadata: IAuditLogMetadata;
  tags?: string[];
}): Promise<IAuditLog> => {
  try {
    const auditLog = new AuditLog({
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

    await auditLog.save();
    return auditLog;
  } catch (error: any) {
    console.error('Error creating audit log:', error);
    throw error;
  }
};

// Query audit logs with advanced filtering
const queryAuditLogs = async (query: IAuditLogQuery): Promise<{
  logs: IAuditLog[];
  total: number;
  hasMore: boolean;
}> => {
  try {
    const filter: any = {};

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
      if (query.startDate) filter.timestamp.$gte = query.startDate;
      if (query.endDate) filter.timestamp.$lte = query.endDate;
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

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ [sortField]: sortOrder })
        .limit(limit)
        .skip(offset)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return {
      logs: logs as IAuditLog[],
      total,
      hasMore: offset + logs.length < total,
    };
  } catch (error: any) {
    console.error('Error querying audit logs:', error);
    throw error;
  }
};

// Get audit log summary and statistics
const getAuditLogSummary = async (
  startDate: Date,
  endDate: Date,
  filters?: Partial<IAuditLogQuery>
): Promise<IAuditLogSummary> => {
  try {
    const matchStage: any = {
      timestamp: { $gte: startDate, $lte: endDate },
    };

    // Apply additional filters
    if (filters?.category) {
      matchStage.category = Array.isArray(filters.category) ? { $in: filters.category } : filters.category;
    }
    if (filters?.level) {
      matchStage.level = Array.isArray(filters.level) ? { $in: filters.level } : filters.level;
    }
    if (filters?.userId) {
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
            { $match: { level: AuditLogLevel.ERROR } },
            { $count: 'count' },
          ],
          processingTimes: [
            { $match: { 'metadata.processingTime': { $exists: true } } },
            { $group: { _id: null, avgTime: { $avg: '$metadata.processingTime' } } },
          ],
        },
      },
    ];

    const [result] = await AuditLog.aggregate(pipeline);

    // Process results
    const totalEvents = result.totalEvents[0]?.count || 0;
    const errorEvents = result.errorEvents[0]?.count || 0;
    const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
    const averageProcessingTime = result.processingTimes[0]?.avgTime || 0;

    // Convert arrays to objects
    const eventsByCategory: Record<AuditLogCategory, number> = {} as any;
    result.eventsByCategory.forEach((item: any) => {
      eventsByCategory[item._id] = item.count;
    });

    const eventsByLevel: Record<AuditLogLevel, number> = {} as any;
    result.eventsByLevel.forEach((item: any) => {
      eventsByLevel[item._id] = item.count;
    });

    const eventsByAction: Record<AuditLogAction, number> = {} as any;
    result.eventsByAction.forEach((item: any) => {
      eventsByAction[item._id] = item.count;
    });

    const topUsers = result.topUsers.map((item: any) => ({
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
  } catch (error: any) {
    console.error('Error getting audit log summary:', error);
    throw error;
  }
};

// Get audit logs for a specific user
const getUserAuditLogs = async (
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    category?: AuditLogCategory;
    level?: AuditLogLevel;
  } = {}
): Promise<{ logs: IAuditLog[]; total: number }> => {
  const query: IAuditLogQuery = {
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

  const result = await queryAuditLogs(query);
  return {
    logs: result.logs,
    total: result.total,
  };
};

// Get audit logs for a specific resource
const getResourceAuditLogs = async (
  resourceType: string,
  resourceId: string,
  options: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{ logs: IAuditLog[]; total: number }> => {
  const query: IAuditLogQuery = {
    resourceType,
    resourceId,
    limit: options.limit || 50,
    offset: options.offset || 0,
    startDate: options.startDate,
    endDate: options.endDate,
    sortBy: 'timestamp',
    sortOrder: 'desc',
  };

  const result = await queryAuditLogs(query);
  return {
    logs: result.logs,
    total: result.total,
  };
};

// Archive old audit logs (for compliance and performance)
const archiveOldLogs = async (olderThanDays: number = 2555): Promise<{ archived: number }> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await AuditLog.updateMany(
      {
        timestamp: { $lt: cutoffDate },
        isArchived: { $ne: true },
      },
      {
        $set: {
          isArchived: true,
          archivedAt: new Date(),
        },
      }
    );

    return { archived: result.modifiedCount };
  } catch (error: any) {
    console.error('Error archiving old logs:', error);
    throw error;
  }
};

// Delete archived logs (permanent deletion for storage management)
const deleteArchivedLogs = async (archivedBeforeDays: number = 2920): Promise<{ deleted: number }> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - archivedBeforeDays);

    const result = await AuditLog.deleteMany({
      isArchived: true,
      archivedAt: { $lt: cutoffDate },
    });

    return { deleted: result.deletedCount };
  } catch (error: any) {
    console.error('Error deleting archived logs:', error);
    throw error;
  }
};

export const AuditLogService = {
  createAuditLog,
  queryAuditLogs,
  getAuditLogSummary,
  getUserAuditLogs,
  getResourceAuditLogs,
  archiveOldLogs,
  deleteArchivedLogs,
};
