import { Redis } from 'ioredis';

// Base Redis service interface
export interface IRedisService {
  client: Redis;
  isHealthy(): Promise<boolean>;
  disconnect(): Promise<void>;
}

// Cache service interface
export interface ICacheService extends IRedisService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(keyValuePairs: Record<string, T>, ttlSeconds?: number): Promise<void>;
  invalidatePattern(pattern: string): Promise<number>;
  getWithFallback<T>(
    key: string,
    fallbackFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T>;
}

// Authentication service interface
export interface IAuthCacheService extends IRedisService {
  // JWT Token Management
  cacheToken(tokenId: string, payload: any, ttlSeconds: number): Promise<void>;
  getTokenPayload(tokenId: string): Promise<any | null>;
  blacklistToken(tokenId: string, ttlSeconds: number): Promise<void>;
  isTokenBlacklisted(tokenId: string): Promise<boolean>;
  
  // Refresh Token Management
  storeRefreshToken(tokenFamily: string, tokenId: string, userId: string, ttlSeconds: number): Promise<void>;
  getRefreshTokenInfo(tokenId: string): Promise<any | null>;
  invalidateTokenFamily(tokenFamily: string): Promise<void>;
  
  // Session Management
  createSession(sessionId: string, userId: string, sessionData: any, ttlSeconds: number): Promise<void>;
  getSession(sessionId: string): Promise<any | null>;
  updateSession(sessionId: string, sessionData: any, ttlSeconds?: number): Promise<void>;
  destroySession(sessionId: string): Promise<void>;
  destroyAllUserSessions(userId: string): Promise<void>;
  
  // User Activity Tracking
  trackUserActivity(userId: string, activity: string, metadata?: any): Promise<void>;
  getUserActivity(userId: string, limit?: number): Promise<any[]>;
}

// OAuth service interface
export interface IOAuthCacheService extends IRedisService {
  // OAuth State Management
  storeOAuthState(state: string, data: any, ttlSeconds: number): Promise<void>;
  getOAuthState(state: string): Promise<any | null>;
  deleteOAuthState(state: string): Promise<void>;
  
  // OAuth Token Caching
  cacheOAuthTokens(userId: string, provider: string, tokens: any, ttlSeconds: number): Promise<void>;
  getOAuthTokens(userId: string, provider: string): Promise<any | null>;
  refreshOAuthTokens(userId: string, provider: string, newTokens: any, ttlSeconds: number): Promise<void>;
  
  // User Profile Caching
  cacheUserProfile(userId: string, provider: string, profile: any, ttlSeconds: number): Promise<void>;
  getUserProfile(userId: string, provider: string): Promise<any | null>;
  
  // Login Attempt Tracking
  trackLoginAttempt(identifier: string, success: boolean, metadata?: any): Promise<void>;
  getLoginAttempts(identifier: string, windowSeconds: number): Promise<number>;
  isAccountLocked(identifier: string): Promise<boolean>;
  lockAccount(identifier: string, lockDurationSeconds: number, reason: string): Promise<void>;
}

// Job service interface
export interface IJobCacheService extends IRedisService {
  // Job Status Tracking
  setJobStatus(jobId: string, status: string, data?: any): Promise<void>;
  getJobStatus(jobId: string): Promise<any | null>;
  updateJobProgress(jobId: string, progress: number, message?: string): Promise<void>;
  
  // Job Result Caching
  cacheJobResult(jobId: string, result: any, ttlSeconds: number): Promise<void>;
  getJobResult(jobId: string): Promise<any | null>;
  
  // Job Queue Metrics
  incrementJobCounter(queueName: string, status: 'completed' | 'failed' | 'active'): Promise<void>;
  getJobMetrics(queueName: string): Promise<any>;
  
  // Scheduled Job Management
  setScheduledJob(jobKey: string, scheduleData: any): Promise<void>;
  getScheduledJob(jobKey: string): Promise<any | null>;
  removeScheduledJob(jobKey: string): Promise<void>;
}

// Circuit breaker interface
export interface ICircuitBreakerService {
  execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>;
  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  getMetrics(): {
    failures: number;
    successes: number;
    timeouts: number;
    lastFailureTime?: Date;
  };
}

// Cache invalidation interface
export interface ICacheInvalidationService extends IRedisService {
  invalidateUserCache(userId: string): Promise<number>;
  invalidateAuthCache(userId: string): Promise<void>;
  invalidateQueryCache(pattern: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<number>;
  broadcastInvalidation(channel: string, data: any): Promise<void>;
  subscribeToInvalidations(channel: string, callback: (data: any) => void): Promise<void>;
}

// Performance monitoring interface
export interface IRedisMonitoringService {
  recordOperation(operation: string, duration: number, success: boolean): void;
  getOperationMetrics(operation: string): Promise<any>;
  getConnectionMetrics(): Promise<any>;
  getMemoryUsage(): Promise<any>;
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    memoryUsage: number;
    connections: number;
    errors: number;
  }>;
}

// Redis configuration interface
export interface IRedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  enableOfflineQueue?: boolean;
  connectTimeout?: number;
  commandTimeout?: number;
  family?: number;
  keepAlive?: boolean;
  maxRetriesPerRequest?: number;
  tls?: any;
}

// Error types
export class RedisServiceError extends Error {
  constructor(
    message: string,
    public operation: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'RedisServiceError';
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

// Cache strategies
export enum CacheStrategy {
  CACHE_ASIDE = 'cache_aside',
  WRITE_THROUGH = 'write_through',
  WRITE_BEHIND = 'write_behind',
  REFRESH_AHEAD = 'refresh_ahead'
}

// Cache invalidation strategies
export enum InvalidationStrategy {
  TTL = 'ttl',
  MANUAL = 'manual',
  EVENT_BASED = 'event_based',
  PATTERN_BASED = 'pattern_based'
}

// Key naming conventions
export const RedisKeys = {
  // Authentication keys
  JWT_TOKEN: (tokenId: string) => `jwt:token:${tokenId}`,
  JWT_BLACKLIST: (tokenId: string) => `jwt:blacklist:${tokenId}`,
  REFRESH_TOKEN: (tokenId: string) => `jwt:refresh:${tokenId}`,
  TOKEN_FAMILY: (familyId: string) => `jwt:family:${familyId}`,
  USER_SESSION: (sessionId: string) => `session:${sessionId}`,
  USER_SESSIONS: (userId: string) => `sessions:user:${userId}`,
  USER_ACTIVITY: (userId: string) => `activity:${userId}`,
  
  // OAuth keys
  OAUTH_STATE: (state: string) => `oauth:state:${state}`,
  OAUTH_TOKENS: (userId: string, provider: string) => `oauth:tokens:${provider}:${userId}`,
  OAUTH_PROFILE: (userId: string, provider: string) => `oauth:profile:${provider}:${userId}`,
  LOGIN_ATTEMPTS: (identifier: string) => `login:attempts:${identifier}`,
  ACCOUNT_LOCK: (identifier: string) => `login:lock:${identifier}`,
  
  // Cache keys
  USER_PROFILE: (userId: string) => `cache:user:${userId}`,
  USER_PERMISSIONS: (userId: string) => `cache:permissions:${userId}`,
  QUERY_RESULT: (queryHash: string) => `cache:query:${queryHash}`,
  API_RESPONSE: (endpoint: string, params: string) => `cache:api:${endpoint}:${params}`,
  
  // Job keys
  JOB_STATUS: (jobId: string) => `job:status:${jobId}`,
  JOB_RESULT: (jobId: string) => `job:result:${jobId}`,
  JOB_METRICS: (queueName: string) => `job:metrics:${queueName}`,
  SCHEDULED_JOB: (jobKey: string) => `job:scheduled:${jobKey}`,
  
  // OTP keys (existing)
  OTP: (email: string) => `otp:${email}`,
  OTP_ATTEMPTS: (email: string) => `otp_attempts:${email}`,
  OTP_LOCK: (email: string) => `otp_lock:${email}`,
  OTP_RESEND_COOLDOWN: (email: string) => `otp_resend_cooldown:${email}`,
  
  // Monitoring keys
  CIRCUIT_BREAKER: (service: string) => `circuit:${service}`,
  OPERATION_METRICS: (operation: string) => `metrics:op:${operation}`,
  CONNECTION_METRICS: () => 'metrics:connections',
  HEALTH_CHECK: () => 'health:check'
} as const;
