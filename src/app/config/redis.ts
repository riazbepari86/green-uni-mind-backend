import Redis from 'ioredis';
import config from './index';

// Redis connection configuration with optimized settings
const redisConfig = (() => {
  // If REDIS_URL is provided (common in cloud deployments), use it directly
  if (config.redis.url) {
    return {
      connectionName: 'green-uni-mind',
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // TLS configuration for Upstash Redis
      tls: config.redis.url.includes('upstash.io') || config.redis.url.includes('rediss://') ? {} : undefined,
      // Connection pool settings for better performance
      family: 4, // Use IPv4
      keepAlive: 0,
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      retryDelayOnClusterDown: 300,
    };
  }

  // Fallback to individual host/port/password configuration
  const host = config.redis.host || 'localhost';
  const port = config.redis.port || 6379;
  const password = config.redis.password || '';

  return {
    host,
    port,
    password,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    // TLS configuration for Upstash Redis
    tls: host && host.includes('upstash.io') ? {} : undefined,
    // Connection pool settings for better performance
    family: 4, // Use IPv4
    keepAlive: 0,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    retryDelayOnClusterDown: 300,
  };
})();

// Create primary Redis client instance
const redis = config.redis.url
  ? new Redis(config.redis.url, redisConfig)
  : new Redis(redisConfig);

// Create separate Redis clients for different use cases
const redisAuth = config.redis.url
  ? new Redis(config.redis.url, redisConfig)
  : new Redis(redisConfig); // For authentication operations
const redisCache = config.redis.url
  ? new Redis(config.redis.url, redisConfig)
  : new Redis(redisConfig); // For caching operations
const redisJobs = config.redis.url
  ? new Redis(config.redis.url, redisConfig)
  : new Redis(redisConfig); // For job queue operations
const redisSessions = config.redis.url
  ? new Redis(config.redis.url, redisConfig)
  : new Redis(redisConfig); // For session management

// Handle Redis connection events for primary client
redis.on('connect', () => {
  console.log('✅ Redis primary client connected successfully');
});

redis.on('ready', () => {
  console.log('✅ Redis primary client is ready to accept commands');
});

redis.on('error', (error) => {
  console.error('❌ Redis primary client connection error:', error);
});

redis.on('close', () => {
  console.log('⚠️ Redis primary client connection closed');
});

redis.on('reconnecting', () => {
  console.log('🔄 Redis primary client reconnecting...');
});

// Setup connection event handlers for specialized clients
const setupClientEvents = (client: Redis, name: string) => {
  client.on('connect', () => console.log(`✅ Redis ${name} client connected`));
  client.on('error', (error) => console.error(`❌ Redis ${name} client error:`, error));
  client.on('close', () => console.log(`⚠️ Redis ${name} client connection closed`));
  client.on('reconnecting', () => console.log(`🔄 Redis ${name} client reconnecting...`));
};

setupClientEvents(redisAuth, 'auth');
setupClientEvents(redisCache, 'cache');
setupClientEvents(redisJobs, 'jobs');
setupClientEvents(redisSessions, 'sessions');

// Import and use the new Redis Service Manager
import {
  redisServiceManager,
  redis as newRedis,
  redisAuth as newRedisAuth,
  redisCache as newRedisCache,
  redisJobs as newRedisJobs,
  redisSessions as newRedisSessions,
  redisMonitoring,
  cacheService
} from '../services/redis/RedisServiceManager';

// Export the new Redis clients and services (maintaining backward compatibility)
export {
  redis,
  redisAuth,
  redisCache,
  redisJobs,
  redisSessions,
  redisServiceManager,
  redisMonitoring,
  cacheService
};

// Also export the new clients for migration
export {
  newRedis,
  newRedisAuth,
  newRedisCache,
  newRedisJobs,
  newRedisSessions
};

// OTP-related Redis operations
export const otpOperations = {
  // Store OTP with TTL (5 minutes = 300 seconds)
  async setOTP(email: string, otp: string, ttlSeconds: number = 300): Promise<void> {
    const key = `otp:${email}`;
    await redis.setex(key, ttlSeconds, otp);
    console.log(`✅ OTP stored for ${email} with TTL ${ttlSeconds}s`);
  },

  // Get OTP for email
  async getOTP(email: string): Promise<string | null> {
    const key = `otp:${email}`;
    const otp = await redis.get(key);
    return otp;
  },

  // Delete OTP after successful verification
  async deleteOTP(email: string): Promise<void> {
    const key = `otp:${email}`;
    await redis.del(key);
    console.log(`✅ OTP deleted for ${email}`);
  },

  // Check if OTP exists and get TTL
  async getOTPTTL(email: string): Promise<number> {
    const key = `otp:${email}`;
    return await redis.ttl(key);
  },

  // Professional-grade rate limiting for OTP requests
  async checkOTPRateLimit(email: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    isLocked: boolean;
    lockReason?: string;
    lockDuration?: number;
  }> {
    const attemptsKey = `otp_attempts:${email}`;
    const lockKey = `otp_lock:${email}`;
    const maxAttempts = 3;
    const windowSeconds = 1800; // 30 minutes
    const lockDuration = 1800; // 30 minutes
    const extendedLockDuration = 3600; // 1 hour

    try {
      // Check if account is currently locked
      const lockData = await redis.get(lockKey);
      if (lockData) {
        const lock = JSON.parse(lockData);
        const ttl = await redis.ttl(lockKey);

        // If locked account receives more requests, extend lock to 1 hour
        if (lock.attempts >= maxAttempts) {
          await redis.setex(lockKey, extendedLockDuration, JSON.stringify({
            ...lock,
            attempts: lock.attempts + 1,
            extendedLock: true,
            lastAttempt: Date.now()
          }));

          console.warn(`🚨 Suspicious activity detected for ${email}: Extended lock applied`);

          return {
            allowed: false,
            remaining: 0,
            resetTime: Date.now() + (extendedLockDuration * 1000),
            isLocked: true,
            lockReason: 'Too many requests detected. Account locked for 1 hour due to suspicious activity.',
            lockDuration: extendedLockDuration
          };
        }

        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + (ttl * 1000),
          isLocked: true,
          lockReason: 'Account temporarily locked due to too many OTP requests. Please try again in 30 minutes.',
          lockDuration: ttl
        };
      }

      // Check current attempts
      const current = await redis.get(attemptsKey);
      const attempts = current ? parseInt(current) : 0;

      if (attempts >= maxAttempts) {
        // Lock the account
        const lockInfo = {
          attempts: attempts + 1,
          lockedAt: Date.now(),
          reason: 'rate_limit_exceeded'
        };

        await redis.setex(lockKey, lockDuration, JSON.stringify(lockInfo));
        await redis.del(attemptsKey); // Clean up attempts counter

        console.warn(`🔒 Account locked for ${email}: Rate limit exceeded (${attempts + 1} attempts)`);

        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + (lockDuration * 1000),
          isLocked: true,
          lockReason: 'Account temporarily locked due to too many OTP requests. Please try again in 30 minutes.',
          lockDuration: lockDuration
        };
      }

      // Increment attempts
      if (current) {
        await redis.incr(attemptsKey);
      } else {
        await redis.setex(attemptsKey, windowSeconds, '1');
      }

      const ttl = await redis.ttl(attemptsKey);
      const newAttempts = attempts + 1;

      console.log(`📊 OTP rate limit check for ${email}: ${newAttempts}/${maxAttempts} attempts`);

      return {
        allowed: true,
        remaining: maxAttempts - newAttempts,
        resetTime: Date.now() + (ttl * 1000),
        isLocked: false
      };

    } catch (error) {
      console.error('❌ Redis rate limiting error:', error);
      // Graceful degradation - allow request if Redis fails
      return {
        allowed: true,
        remaining: 2,
        resetTime: Date.now() + (windowSeconds * 1000),
        isLocked: false
      };
    }
  },

  // Resend cooldown management (1-minute cooldown between resend requests)
  async checkResendCooldown(email: string): Promise<{
    allowed: boolean;
    remainingTime: number;
  }> {
    const cooldownKey = `otp_resend_cooldown:${email}`;
    const cooldownSeconds = 60; // 1 minute

    try {
      const exists = await redis.exists(cooldownKey);

      if (exists) {
        const ttl = await redis.ttl(cooldownKey);
        console.log(`⏰ Resend cooldown active for ${email}: ${ttl} seconds remaining`);

        return {
          allowed: false,
          remainingTime: ttl
        };
      }

      // Set cooldown
      await redis.setex(cooldownKey, cooldownSeconds, '1');
      console.log(`✅ Resend cooldown set for ${email}: ${cooldownSeconds} seconds`);

      return {
        allowed: true,
        remainingTime: 0
      };

    } catch (error) {
      console.error('❌ Redis resend cooldown error:', error);
      // Graceful degradation - allow resend if Redis fails
      return {
        allowed: true,
        remainingTime: 0
      };
    }
  },

  // Get comprehensive rate limiting status
  async getRateLimitStatus(email: string): Promise<{
    attempts: number;
    remaining: number;
    isLocked: boolean;
    lockReason?: string;
    lockTimeRemaining?: number;
    resendCooldownRemaining?: number;
    canResend: boolean;
  }> {
    const attemptsKey = `otp_attempts:${email}`;
    const lockKey = `otp_lock:${email}`;
    const cooldownKey = `otp_resend_cooldown:${email}`;
    const maxAttempts = 3;

    try {
      const [attempts, lockData, cooldownTTL] = await Promise.all([
        redis.get(attemptsKey),
        redis.get(lockKey),
        redis.ttl(cooldownKey)
      ]);

      const currentAttempts = attempts ? parseInt(attempts) : 0;
      const isLocked = !!lockData;
      let lockInfo = null;
      let lockTimeRemaining = 0;

      if (isLocked) {
        lockInfo = JSON.parse(lockData);
        lockTimeRemaining = await redis.ttl(lockKey);
      }

      return {
        attempts: currentAttempts,
        remaining: Math.max(0, maxAttempts - currentAttempts),
        isLocked,
        lockReason: lockInfo?.extendedLock
          ? 'Too many requests detected. Account locked for 1 hour due to suspicious activity.'
          : isLocked
            ? 'Account temporarily locked due to too many OTP requests. Please try again in 30 minutes.'
            : undefined,
        lockTimeRemaining: lockTimeRemaining > 0 ? lockTimeRemaining : undefined,
        resendCooldownRemaining: cooldownTTL > 0 ? cooldownTTL : undefined,
        canResend: !isLocked && cooldownTTL <= 0
      };

    } catch (error) {
      console.error('❌ Redis rate limit status error:', error);
      return {
        attempts: 0,
        remaining: maxAttempts,
        isLocked: false,
        canResend: true
      };
    }
  },

  // Utility functions for testing and debugging
  async clearOTP(email: string): Promise<void> {
    const key = `otp:${email}`;
    await redis.del(key);
    console.log(`✅ OTP cleared for ${email}`);
  },

  async clearRateLimit(email: string): Promise<void> {
    const attemptsKey = `otp_attempts:${email}`;
    const lockKey = `otp_lock:${email}`;
    const cooldownKey = `otp_resend_cooldown:${email}`;

    await Promise.all([
      redis.del(attemptsKey),
      redis.del(lockKey),
      redis.del(cooldownKey)
    ]);
    console.log(`✅ Rate limit data cleared for ${email}`);
  },

  // Clear all OTP-related data for an email (useful for testing)
  async clearAllOTPData(email: string): Promise<void> {
    await Promise.all([
      this.clearOTP(email),
      this.clearRateLimit(email)
    ]);
    console.log(`✅ All OTP data cleared for ${email}`);
  },

  // Reset rate limiting for an email (admin function)
  async resetRateLimit(email: string): Promise<void> {
    await this.clearRateLimit(email);
    console.log(`🔓 Rate limit reset for ${email}`);
  }
};

// Test Redis connection (enhanced with service manager)
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    // For Upstash, use a simpler connection test
    if (process.env.REDIS_URL?.includes('upstash')) {
      console.log('🔍 Testing Upstash Redis connection...');

      // Simple ping test with timeout
      const pingPromise = redis.ping();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      );

      await Promise.race([pingPromise, timeoutPromise]);
      console.log('✅ Upstash Redis connection test successful');
      return true;
    }

    // Test legacy connection for other Redis providers
    await redis.ping();
    console.log('✅ Legacy Redis connection test successful');

    // Test new service manager
    const healthCheck = await redisServiceManager.healthCheck();
    console.log('✅ Redis Service Manager health check:', healthCheck.overall);

    // Test cache service
    await cacheService.set('test:connection', 'success', 10);
    const testValue = await cacheService.get('test:connection');
    await cacheService.del('test:connection');

    if (testValue === 'success') {
      console.log('✅ Cache service test successful');
    }

    return healthCheck.overall !== 'unhealthy';
  } catch (error) {
    console.error('❌ Redis connection test failed:', error);
    return false;
  }
};

export default redis;
