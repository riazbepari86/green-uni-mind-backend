"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisKeys = exports.InvalidationStrategy = exports.CacheStrategy = exports.CircuitBreakerOpenError = exports.RedisServiceError = void 0;
// Error types
class RedisServiceError extends Error {
    constructor(message, operation, originalError) {
        super(message);
        this.operation = operation;
        this.originalError = originalError;
        this.name = 'RedisServiceError';
    }
}
exports.RedisServiceError = RedisServiceError;
class CircuitBreakerOpenError extends Error {
    constructor(message = 'Circuit breaker is open') {
        super(message);
        this.name = 'CircuitBreakerOpenError';
    }
}
exports.CircuitBreakerOpenError = CircuitBreakerOpenError;
// Cache strategies
var CacheStrategy;
(function (CacheStrategy) {
    CacheStrategy["CACHE_ASIDE"] = "cache_aside";
    CacheStrategy["WRITE_THROUGH"] = "write_through";
    CacheStrategy["WRITE_BEHIND"] = "write_behind";
    CacheStrategy["REFRESH_AHEAD"] = "refresh_ahead";
})(CacheStrategy || (exports.CacheStrategy = CacheStrategy = {}));
// Cache invalidation strategies
var InvalidationStrategy;
(function (InvalidationStrategy) {
    InvalidationStrategy["TTL"] = "ttl";
    InvalidationStrategy["MANUAL"] = "manual";
    InvalidationStrategy["EVENT_BASED"] = "event_based";
    InvalidationStrategy["PATTERN_BASED"] = "pattern_based";
})(InvalidationStrategy || (exports.InvalidationStrategy = InvalidationStrategy = {}));
// Key naming conventions
exports.RedisKeys = {
    // Authentication keys
    JWT_TOKEN: (tokenId) => `jwt:token:${tokenId}`,
    JWT_BLACKLIST: (tokenId) => `jwt:blacklist:${tokenId}`,
    REFRESH_TOKEN: (tokenId) => `jwt:refresh:${tokenId}`,
    TOKEN_FAMILY: (familyId) => `jwt:family:${familyId}`,
    USER_SESSION: (sessionId) => `session:${sessionId}`,
    USER_SESSIONS: (userId) => `sessions:user:${userId}`,
    USER_ACTIVITY: (userId) => `activity:${userId}`,
    // OAuth keys
    OAUTH_STATE: (state) => `oauth:state:${state}`,
    OAUTH_TOKENS: (userId, provider) => `oauth:tokens:${provider}:${userId}`,
    OAUTH_PROFILE: (userId, provider) => `oauth:profile:${provider}:${userId}`,
    LOGIN_ATTEMPTS: (identifier) => `login:attempts:${identifier}`,
    ACCOUNT_LOCK: (identifier) => `login:lock:${identifier}`,
    // Cache keys
    USER_PROFILE: (userId) => `cache:user:${userId}`,
    USER_PERMISSIONS: (userId) => `cache:permissions:${userId}`,
    QUERY_RESULT: (queryHash) => `cache:query:${queryHash}`,
    API_RESPONSE: (endpoint, params) => `cache:api:${endpoint}:${params}`,
    // Job keys
    JOB_STATUS: (jobId) => `job:status:${jobId}`,
    JOB_RESULT: (jobId) => `job:result:${jobId}`,
    JOB_METRICS: (queueName) => `job:metrics:${queueName}`,
    SCHEDULED_JOB: (jobKey) => `job:scheduled:${jobKey}`,
    // OTP keys (existing)
    OTP: (email) => `otp:${email}`,
    OTP_ATTEMPTS: (email) => `otp_attempts:${email}`,
    OTP_LOCK: (email) => `otp_lock:${email}`,
    OTP_RESEND_COOLDOWN: (email) => `otp_resend_cooldown:${email}`,
    // Monitoring keys
    CIRCUIT_BREAKER: (service) => `circuit:${service}`,
    OPERATION_METRICS: (operation) => `metrics:op:${operation}`,
    CONNECTION_METRICS: () => 'metrics:connections',
    HEALTH_CHECK: () => 'health:check'
};
