import { Redis } from 'ioredis';
import { BaseRedisService } from './BaseRedisService';
import { ICacheInvalidationService, IRedisMonitoringService } from './interfaces';
import { QueryCacheService } from './QueryCacheService';
import { ApiCacheService } from './ApiCacheService';
import { redisServiceManager } from './RedisServiceManager';

export interface InvalidationRule {
  name: string;
  triggers: string[];
  targets: {
    queryTags?: string[];
    apiTags?: string[];
    patterns?: string[];
    userSpecific?: boolean;
  };
  condition?: (data: any) => boolean;
  delay?: number; // Delay invalidation in milliseconds
}

export interface InvalidationEvent {
  type: string;
  data: any;
  userId?: string;
  timestamp: string;
  source: string;
}

export class CacheInvalidationService extends BaseRedisService implements ICacheInvalidationService {
  private queryCacheService: QueryCacheService;
  private apiCacheService: ApiCacheService;
  private invalidationRules: Map<string, InvalidationRule> = new Map();
  private eventSubscribers: Map<string, Function[]> = new Map();

  constructor(
    client: Redis,
    monitoring?: IRedisMonitoringService
  ) {
    super(client, monitoring);
    this.queryCacheService = new QueryCacheService(client, monitoring);
    this.apiCacheService = new ApiCacheService(client, monitoring);
    this.setupDefaultRules();
    this.setupEventSubscription();
  }

  private setupDefaultRules(): void {
    // User-related invalidation rules
    this.addInvalidationRule({
      name: 'user_profile_updated',
      triggers: ['user.updated', 'user.profile.changed'],
      targets: {
        queryTags: ['user_profile', 'user_data'],
        apiTags: ['user_profile', 'user_dashboard'],
        userSpecific: true,
      },
    });

    // Course-related invalidation rules
    this.addInvalidationRule({
      name: 'course_content_updated',
      triggers: ['course.updated', 'course.content.changed', 'lesson.updated'],
      targets: {
        queryTags: ['course_content', 'course_list', 'course_details'],
        apiTags: ['courses', 'course_content'],
      },
    });

    // Payment-related invalidation rules
    this.addInvalidationRule({
      name: 'payment_status_changed',
      triggers: ['payment.completed', 'payment.failed', 'payout.processed'],
      targets: {
        queryTags: ['payment_history', 'balance', 'earnings'],
        apiTags: ['payments', 'dashboard', 'earnings'],
        userSpecific: true,
      },
    });

    // Enrollment-related invalidation rules
    this.addInvalidationRule({
      name: 'enrollment_changed',
      triggers: ['enrollment.created', 'enrollment.updated', 'enrollment.cancelled'],
      targets: {
        queryTags: ['user_courses', 'course_enrollments', 'student_list'],
        apiTags: ['enrollments', 'my_courses', 'student_dashboard'],
        userSpecific: true,
      },
    });

    // System-wide invalidation rules
    this.addInvalidationRule({
      name: 'system_settings_updated',
      triggers: ['settings.updated', 'config.changed'],
      targets: {
        queryTags: ['system_config', 'app_settings'],
        apiTags: ['config', 'settings'],
        patterns: ['cache:api:*/settings*', 'cache:query:*config*'],
      },
    });
  }

  private setupEventSubscription(): void {
    try {
      // Check if Redis supports pub/sub (Upstash has limitations)
      if (process.env.REDIS_URL?.includes('upstash') || process.env.NODE_ENV === 'production') {
        console.log('⚠️ Using polling-based cache invalidation for Upstash compatibility');
        this.setupPollingInvalidation();
        return;
      }

      // Subscribe to Redis pub/sub for cache invalidation events
      const subscriber = redisServiceManager.primaryClient.duplicate();

      subscriber.subscribe('cache:invalidation', (err) => {
        if (err) {
          console.error('Error subscribing to cache invalidation channel:', err);
          // Fallback to polling if subscription fails
          this.setupPollingInvalidation();
        } else {
          console.log('✅ Subscribed to cache invalidation events');
        }
      });

      subscriber.on('message', async (channel, message) => {
        if (channel === 'cache:invalidation') {
          try {
            const event: InvalidationEvent = JSON.parse(message);
            await this.processInvalidationEvent(event);
          } catch (error) {
            console.error('Error processing invalidation event:', error);
          }
        }
      });
    } catch (error) {
      console.error('Error setting up cache invalidation subscription:', error);
      // Fallback to polling mechanism
      this.setupPollingInvalidation();
    }
  }

  // Polling-based invalidation for Upstash Redis
  private setupPollingInvalidation(): void {
    console.log('🔄 Setting up polling-based cache invalidation');
    // Check for invalidation signals every 30 seconds
    setInterval(async () => {
      try {
        const invalidationKey = 'cache:invalidation:signal';
        const signal = await this.client.get(invalidationKey);
        if (signal) {
          const data = JSON.parse(signal);
          await this.processInvalidationEvent(data);
          await this.client.del(invalidationKey); // Clear the signal
        }
      } catch (error) {
        // Silently handle polling errors to avoid spam
      }
    }, 30000);
  }

  // Add invalidation rule
  addInvalidationRule(rule: InvalidationRule): void {
    this.invalidationRules.set(rule.name, rule);
    console.log(`📋 Added invalidation rule: ${rule.name}`);
  }

  // Remove invalidation rule
  removeInvalidationRule(name: string): void {
    this.invalidationRules.delete(name);
    console.log(`🗑️ Removed invalidation rule: ${name}`);
  }

  // Trigger invalidation event
  async triggerInvalidation(
    eventType: string,
    data: any,
    userId?: string,
    source: string = 'application'
  ): Promise<void> {
    return this.executeWithMonitoring('trigger_invalidation', async () => {
      const event: InvalidationEvent = {
        type: eventType,
        data,
        userId,
        timestamp: new Date().toISOString(),
        source,
      };

      // Process immediately
      await this.processInvalidationEvent(event);

      // Broadcast to other instances
      await this.broadcastInvalidation('cache:invalidation', event);

      console.log(`🔄 Triggered invalidation: ${eventType} (user: ${userId || 'system'})`);
    });
  }

  // Process invalidation event
  private async processInvalidationEvent(event: InvalidationEvent): Promise<void> {
    const matchingRules = Array.from(this.invalidationRules.values())
      .filter(rule => rule.triggers.includes(event.type));

    for (const rule of matchingRules) {
      try {
        // Check condition if provided
        if (rule.condition && !rule.condition(event.data)) {
          continue;
        }

        // Apply delay if specified
        if (rule.delay && rule.delay > 0) {
          setTimeout(() => this.executeInvalidationRule(rule, event), rule.delay);
        } else {
          await this.executeInvalidationRule(rule, event);
        }
      } catch (error) {
        console.error(`Error executing invalidation rule ${rule.name}:`, error);
      }
    }

    // Notify event subscribers
    const subscribers = this.eventSubscribers.get(event.type) || [];
    subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in invalidation event subscriber:', error);
      }
    });
  }

  // Execute invalidation rule
  private async executeInvalidationRule(rule: InvalidationRule, event: InvalidationEvent): Promise<void> {
    const { targets } = rule;
    let totalInvalidated = 0;

    // Invalidate query cache by tags
    if (targets.queryTags && targets.queryTags.length > 0) {
      const queryInvalidated = await this.queryCacheService.invalidateByTags(targets.queryTags);
      totalInvalidated += queryInvalidated;
    }

    // Invalidate API cache by tags
    if (targets.apiTags && targets.apiTags.length > 0) {
      const apiInvalidated = await this.apiCacheService.invalidateByTags(targets.apiTags);
      totalInvalidated += apiInvalidated;
    }

    // Invalidate by patterns
    if (targets.patterns && targets.patterns.length > 0) {
      for (const pattern of targets.patterns) {
        const patternInvalidated = await this.invalidatePattern(pattern);
        totalInvalidated += patternInvalidated;
      }
    }

    // User-specific invalidation
    if (targets.userSpecific && event.userId) {
      const userInvalidated = await this.invalidateUserCache(event.userId);
      totalInvalidated += userInvalidated;
    }

    // Track invalidation metrics
    await this.trackInvalidationMetrics(rule.name, event.type, totalInvalidated);

    console.log(`🗑️ Rule '${rule.name}' invalidated ${totalInvalidated} cache entries`);
  }

  // Invalidate cache by pattern
  async invalidatePattern(pattern: string): Promise<number> {
    return this.executeWithMonitoring('invalidate_pattern', async () => {
      const keys = await this.client.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(...keys);

      console.log(`🗑️ Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
      return keys.length;
    });
  }

  // Invalidate user-specific cache
  async invalidateUserCache(userId: string): Promise<number> {
    return this.executeWithMonitoring('invalidate_user_cache', async () => {
      const patterns = [
        `cache:user:${userId}*`,
        `cache:api:*/users/${userId}*`,
        `cache:query:*user:${userId}*`,
        `session:${userId}*`,
      ];

      let totalInvalidated = 0;
      for (const pattern of patterns) {
        const invalidated = await this.invalidatePattern(pattern);
        totalInvalidated += invalidated;
      }

      console.log(`🗑️ Invalidated ${totalInvalidated} cache entries for user ${userId}`);
      return totalInvalidated;
    });
  }

  // Invalidate authentication cache
  async invalidateAuthCache(userId: string): Promise<void> {
    return this.executeWithMonitoring('invalidate_auth_cache', async () => {
      const patterns = [
        `jwt:*:${userId}`,
        `session:*:${userId}`,
        `oauth:*:${userId}`,
        `cache:user:${userId}`,
        `cache:permissions:${userId}`,
      ];

      for (const pattern of patterns) {
        await this.invalidatePattern(pattern);
      }

      console.log(`🔐 Invalidated auth cache for user ${userId}`);
    });
  }

  // Invalidate query cache
  async invalidateQueryCache(pattern: string): Promise<void> {
    return this.executeWithMonitoring('invalidate_query_cache', async () => {
      const fullPattern = `cache:query:${pattern}`;
      await this.invalidatePattern(fullPattern);
      console.log(`🔍 Invalidated query cache: ${pattern}`);
    });
  }

  // Broadcast invalidation event
  async broadcastInvalidation(channel: string, data: any): Promise<void> {
    return this.executeWithMonitoring('broadcast_invalidation', async () => {
      try {
        // Try pub/sub first
        await this.client.publish(channel, JSON.stringify(data));
      } catch (error) {
        // Fallback to polling mechanism for Upstash
        if (channel === 'cache:invalidation') {
          await this.client.setex('cache:invalidation:signal', 60, JSON.stringify(data));
        }
      }
    });
  }

  // Subscribe to invalidation events
  async subscribeToInvalidations(channel: string, callback: (data: any) => void): Promise<void> {
    const subscribers = this.eventSubscribers.get(channel) || [];
    subscribers.push(callback);
    this.eventSubscribers.set(channel, subscribers);
  }

  // Track invalidation metrics
  private async trackInvalidationMetrics(
    ruleName: string,
    eventType: string,
    invalidatedCount: number
  ): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    const pipeline = this.client.pipeline();

    // Track by rule
    pipeline.incr(`invalidation:metrics:rule:${ruleName}:count`);
    pipeline.incrby(`invalidation:metrics:rule:${ruleName}:invalidated`, invalidatedCount);
    pipeline.incr(`invalidation:metrics:rule:${ruleName}:${date}`);

    // Track by event type
    pipeline.incr(`invalidation:metrics:event:${eventType}:count`);
    pipeline.incrby(`invalidation:metrics:event:${eventType}:invalidated`, invalidatedCount);

    // Track daily totals
    pipeline.incr(`invalidation:metrics:daily:${date}:count`);
    pipeline.incrby(`invalidation:metrics:daily:${date}:invalidated`, invalidatedCount);

    // Set expiration on daily metrics
    pipeline.expire(`invalidation:metrics:rule:${ruleName}:${date}`, 86400 * 30);
    pipeline.expire(`invalidation:metrics:daily:${date}:count`, 86400 * 30);
    pipeline.expire(`invalidation:metrics:daily:${date}:invalidated`, 86400 * 30);

    await pipeline.exec();
  }

  // Get invalidation metrics
  async getInvalidationMetrics(): Promise<{
    totalInvalidations: number;
    totalEntriesInvalidated: number;
    ruleMetrics: Record<string, { count: number; invalidated: number }>;
    eventMetrics: Record<string, { count: number; invalidated: number }>;
    dailyMetrics: Record<string, { count: number; invalidated: number }>;
  }> {
    return this.executeWithMonitoring('get_invalidation_metrics', async () => {
      // Get all metric keys
      const ruleKeys = await this.client.keys('invalidation:metrics:rule:*:count');
      const eventKeys = await this.client.keys('invalidation:metrics:event:*:count');
      const dailyKeys = await this.client.keys('invalidation:metrics:daily:*:count');

      const ruleMetrics: Record<string, { count: number; invalidated: number }> = {};
      const eventMetrics: Record<string, { count: number; invalidated: number }> = {};
      const dailyMetrics: Record<string, { count: number; invalidated: number }> = {};

      // Get rule metrics
      for (const key of ruleKeys) {
        const ruleName = key.split(':')[3];
        const [count, invalidated] = await Promise.all([
          this.client.get(key),
          this.client.get(key.replace(':count', ':invalidated')),
        ]);
        
        ruleMetrics[ruleName] = {
          count: parseInt(count || '0'),
          invalidated: parseInt(invalidated || '0'),
        };
      }

      // Get event metrics
      for (const key of eventKeys) {
        const eventType = key.split(':')[3];
        const [count, invalidated] = await Promise.all([
          this.client.get(key),
          this.client.get(key.replace(':count', ':invalidated')),
        ]);
        
        eventMetrics[eventType] = {
          count: parseInt(count || '0'),
          invalidated: parseInt(invalidated || '0'),
        };
      }

      // Get daily metrics
      for (const key of dailyKeys) {
        const date = key.split(':')[3];
        const [count, invalidated] = await Promise.all([
          this.client.get(key),
          this.client.get(key.replace(':count', ':invalidated')),
        ]);
        
        dailyMetrics[date] = {
          count: parseInt(count || '0'),
          invalidated: parseInt(invalidated || '0'),
        };
      }

      // Calculate totals
      const totalInvalidations = Object.values(ruleMetrics).reduce((sum, metric) => sum + metric.count, 0);
      const totalEntriesInvalidated = Object.values(ruleMetrics).reduce((sum, metric) => sum + metric.invalidated, 0);

      return {
        totalInvalidations,
        totalEntriesInvalidated,
        ruleMetrics,
        eventMetrics,
        dailyMetrics,
      };
    });
  }

  // Smart invalidation based on data relationships
  async smartInvalidate(entityType: string, entityId: string, operation: 'create' | 'update' | 'delete'): Promise<void> {
    return this.executeWithMonitoring('smart_invalidate', async () => {
      const invalidationMap: Record<string, string[]> = {
        user: ['user_profile', 'user_data', 'user_dashboard'],
        course: ['course_content', 'course_list', 'course_details', 'course_enrollments'],
        enrollment: ['user_courses', 'course_enrollments', 'student_list'],
        payment: ['payment_history', 'balance', 'earnings', 'dashboard'],
        lesson: ['course_content', 'lesson_content'],
        assignment: ['course_content', 'assignment_list'],
      };

      const tags = invalidationMap[entityType] || [];
      if (tags.length > 0) {
        await this.triggerInvalidation(
          `${entityType}.${operation}`,
          { entityId, entityType, operation },
          entityType === 'user' ? entityId : undefined,
          'smart_invalidation'
        );
      }
    });
  }

  // Bulk invalidation for maintenance
  async bulkInvalidate(patterns: string[]): Promise<number> {
    return this.executeWithMonitoring('bulk_invalidate', async () => {
      let totalInvalidated = 0;
      
      for (const pattern of patterns) {
        const invalidated = await this.invalidatePattern(pattern);
        totalInvalidated += invalidated;
      }

      console.log(`🗑️ Bulk invalidation completed: ${totalInvalidated} entries`);
      return totalInvalidated;
    });
  }
}
