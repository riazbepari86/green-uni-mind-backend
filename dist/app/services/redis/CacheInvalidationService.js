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
exports.CacheInvalidationService = void 0;
const BaseRedisService_1 = require("./BaseRedisService");
const QueryCacheService_1 = require("./QueryCacheService");
const ApiCacheService_1 = require("./ApiCacheService");
const RedisServiceManager_1 = require("./RedisServiceManager");
class CacheInvalidationService extends BaseRedisService_1.BaseRedisService {
    constructor(client, monitoring) {
        super(client, monitoring);
        this.invalidationRules = new Map();
        this.eventSubscribers = new Map();
        this.queryCacheService = new QueryCacheService_1.QueryCacheService(client, monitoring);
        this.apiCacheService = new ApiCacheService_1.ApiCacheService(client, monitoring);
        this.setupDefaultRules();
        this.setupEventSubscription();
    }
    setupDefaultRules() {
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
    setupEventSubscription() {
        var _a;
        try {
            // Check if Redis supports pub/sub (Upstash has limitations)
            if (((_a = process.env.REDIS_URL) === null || _a === void 0 ? void 0 : _a.includes('upstash')) || process.env.NODE_ENV === 'production') {
                console.log('⚠️ Using polling-based cache invalidation for Upstash compatibility');
                this.setupPollingInvalidation();
                return;
            }
            // Subscribe to Redis pub/sub for cache invalidation events
            const subscriber = RedisServiceManager_1.redisServiceManager.primaryClient.duplicate();
            subscriber.subscribe('cache:invalidation', (err) => {
                if (err) {
                    console.error('Error subscribing to cache invalidation channel:', err);
                    // Fallback to polling if subscription fails
                    this.setupPollingInvalidation();
                }
                else {
                    console.log('✅ Subscribed to cache invalidation events');
                }
            });
            subscriber.on('message', (channel, message) => __awaiter(this, void 0, void 0, function* () {
                if (channel === 'cache:invalidation') {
                    try {
                        const event = JSON.parse(message);
                        yield this.processInvalidationEvent(event);
                    }
                    catch (error) {
                        console.error('Error processing invalidation event:', error);
                    }
                }
            }));
        }
        catch (error) {
            console.error('Error setting up cache invalidation subscription:', error);
            // Fallback to polling mechanism
            this.setupPollingInvalidation();
        }
    }
    // Polling-based invalidation for Upstash Redis
    setupPollingInvalidation() {
        console.log('🔄 Setting up polling-based cache invalidation');
        // Check for invalidation signals every 30 seconds
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const invalidationKey = 'cache:invalidation:signal';
                const signal = yield this.client.get(invalidationKey);
                if (signal) {
                    const data = JSON.parse(signal);
                    yield this.processInvalidationEvent(data);
                    yield this.client.del(invalidationKey); // Clear the signal
                }
            }
            catch (error) {
                // Silently handle polling errors to avoid spam
            }
        }), 30000);
    }
    // Add invalidation rule
    addInvalidationRule(rule) {
        this.invalidationRules.set(rule.name, rule);
        console.log(`📋 Added invalidation rule: ${rule.name}`);
    }
    // Remove invalidation rule
    removeInvalidationRule(name) {
        this.invalidationRules.delete(name);
        console.log(`🗑️ Removed invalidation rule: ${name}`);
    }
    // Trigger invalidation event
    triggerInvalidation(eventType_1, data_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (eventType, data, userId, source = 'application') {
            return this.executeWithMonitoring('trigger_invalidation', () => __awaiter(this, void 0, void 0, function* () {
                const event = {
                    type: eventType,
                    data,
                    userId,
                    timestamp: new Date().toISOString(),
                    source,
                };
                // Process immediately
                yield this.processInvalidationEvent(event);
                // Broadcast to other instances
                yield this.broadcastInvalidation('cache:invalidation', event);
                console.log(`🔄 Triggered invalidation: ${eventType} (user: ${userId || 'system'})`);
            }));
        });
    }
    // Process invalidation event
    processInvalidationEvent(event) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    }
                    else {
                        yield this.executeInvalidationRule(rule, event);
                    }
                }
                catch (error) {
                    console.error(`Error executing invalidation rule ${rule.name}:`, error);
                }
            }
            // Notify event subscribers
            const subscribers = this.eventSubscribers.get(event.type) || [];
            subscribers.forEach(callback => {
                try {
                    callback(event);
                }
                catch (error) {
                    console.error('Error in invalidation event subscriber:', error);
                }
            });
        });
    }
    // Execute invalidation rule
    executeInvalidationRule(rule, event) {
        return __awaiter(this, void 0, void 0, function* () {
            const { targets } = rule;
            let totalInvalidated = 0;
            // Invalidate query cache by tags
            if (targets.queryTags && targets.queryTags.length > 0) {
                const queryInvalidated = yield this.queryCacheService.invalidateByTags(targets.queryTags);
                totalInvalidated += queryInvalidated;
            }
            // Invalidate API cache by tags
            if (targets.apiTags && targets.apiTags.length > 0) {
                const apiInvalidated = yield this.apiCacheService.invalidateByTags(targets.apiTags);
                totalInvalidated += apiInvalidated;
            }
            // Invalidate by patterns
            if (targets.patterns && targets.patterns.length > 0) {
                for (const pattern of targets.patterns) {
                    const patternInvalidated = yield this.invalidatePattern(pattern);
                    totalInvalidated += patternInvalidated;
                }
            }
            // User-specific invalidation
            if (targets.userSpecific && event.userId) {
                const userInvalidated = yield this.invalidateUserCache(event.userId);
                totalInvalidated += userInvalidated;
            }
            // Track invalidation metrics
            yield this.trackInvalidationMetrics(rule.name, event.type, totalInvalidated);
            console.log(`🗑️ Rule '${rule.name}' invalidated ${totalInvalidated} cache entries`);
        });
    }
    // Invalidate cache by pattern
    invalidatePattern(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('invalidate_pattern', () => __awaiter(this, void 0, void 0, function* () {
                const keys = yield this.client.keys(pattern);
                if (keys.length === 0) {
                    return 0;
                }
                yield this.client.del(...keys);
                console.log(`🗑️ Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
                return keys.length;
            }));
        });
    }
    // Invalidate user-specific cache
    invalidateUserCache(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('invalidate_user_cache', () => __awaiter(this, void 0, void 0, function* () {
                const patterns = [
                    `cache:user:${userId}*`,
                    `cache:api:*/users/${userId}*`,
                    `cache:query:*user:${userId}*`,
                    `session:${userId}*`,
                ];
                let totalInvalidated = 0;
                for (const pattern of patterns) {
                    const invalidated = yield this.invalidatePattern(pattern);
                    totalInvalidated += invalidated;
                }
                console.log(`🗑️ Invalidated ${totalInvalidated} cache entries for user ${userId}`);
                return totalInvalidated;
            }));
        });
    }
    // Invalidate authentication cache
    invalidateAuthCache(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('invalidate_auth_cache', () => __awaiter(this, void 0, void 0, function* () {
                const patterns = [
                    `jwt:*:${userId}`,
                    `session:*:${userId}`,
                    `oauth:*:${userId}`,
                    `cache:user:${userId}`,
                    `cache:permissions:${userId}`,
                ];
                for (const pattern of patterns) {
                    yield this.invalidatePattern(pattern);
                }
                console.log(`🔐 Invalidated auth cache for user ${userId}`);
            }));
        });
    }
    // Invalidate query cache
    invalidateQueryCache(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('invalidate_query_cache', () => __awaiter(this, void 0, void 0, function* () {
                const fullPattern = `cache:query:${pattern}`;
                yield this.invalidatePattern(fullPattern);
                console.log(`🔍 Invalidated query cache: ${pattern}`);
            }));
        });
    }
    // Broadcast invalidation event
    broadcastInvalidation(channel, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('broadcast_invalidation', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    // Try pub/sub first
                    yield this.client.publish(channel, JSON.stringify(data));
                }
                catch (error) {
                    // Fallback to polling mechanism for Upstash
                    if (channel === 'cache:invalidation') {
                        yield this.client.setex('cache:invalidation:signal', 60, JSON.stringify(data));
                    }
                }
            }));
        });
    }
    // Subscribe to invalidation events
    subscribeToInvalidations(channel, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscribers = this.eventSubscribers.get(channel) || [];
            subscribers.push(callback);
            this.eventSubscribers.set(channel, subscribers);
        });
    }
    // Track invalidation metrics
    trackInvalidationMetrics(ruleName, eventType, invalidatedCount) {
        return __awaiter(this, void 0, void 0, function* () {
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
            yield pipeline.exec();
        });
    }
    // Get invalidation metrics
    getInvalidationMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('get_invalidation_metrics', () => __awaiter(this, void 0, void 0, function* () {
                // Get all metric keys
                const ruleKeys = yield this.client.keys('invalidation:metrics:rule:*:count');
                const eventKeys = yield this.client.keys('invalidation:metrics:event:*:count');
                const dailyKeys = yield this.client.keys('invalidation:metrics:daily:*:count');
                const ruleMetrics = {};
                const eventMetrics = {};
                const dailyMetrics = {};
                // Get rule metrics
                for (const key of ruleKeys) {
                    const ruleName = key.split(':')[3];
                    const [count, invalidated] = yield Promise.all([
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
                    const [count, invalidated] = yield Promise.all([
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
                    const [count, invalidated] = yield Promise.all([
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
            }));
        });
    }
    // Smart invalidation based on data relationships
    smartInvalidate(entityType, entityId, operation) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('smart_invalidate', () => __awaiter(this, void 0, void 0, function* () {
                const invalidationMap = {
                    user: ['user_profile', 'user_data', 'user_dashboard'],
                    course: ['course_content', 'course_list', 'course_details', 'course_enrollments'],
                    enrollment: ['user_courses', 'course_enrollments', 'student_list'],
                    payment: ['payment_history', 'balance', 'earnings', 'dashboard'],
                    lesson: ['course_content', 'lesson_content'],
                    assignment: ['course_content', 'assignment_list'],
                };
                const tags = invalidationMap[entityType] || [];
                if (tags.length > 0) {
                    yield this.triggerInvalidation(`${entityType}.${operation}`, { entityId, entityType, operation }, entityType === 'user' ? entityId : undefined, 'smart_invalidation');
                }
            }));
        });
    }
    // Bulk invalidation for maintenance
    bulkInvalidate(patterns) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('bulk_invalidate', () => __awaiter(this, void 0, void 0, function* () {
                let totalInvalidated = 0;
                for (const pattern of patterns) {
                    const invalidated = yield this.invalidatePattern(pattern);
                    totalInvalidated += invalidated;
                }
                console.log(`🗑️ Bulk invalidation completed: ${totalInvalidated} entries`);
                return totalInvalidated;
            }));
        });
    }
}
exports.CacheInvalidationService = CacheInvalidationService;
