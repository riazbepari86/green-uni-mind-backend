import Redis from 'ioredis';
import config from './index';

// Redis connection configuration for Upstash
const redisConfig = {
  host: config.redis.host || 'localhost',
  port: config.redis.port || 6379,
  password: config.redis.password || '',
  family: 4,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxLoadingTimeout: 1000,
  lazyConnect: true, // Don't connect immediately
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
  tls: config.redis.host && config.redis.host.includes('upstash.io') ? {} : undefined,
};

// Create a single Redis client instance
const redis = new Redis(redisConfig);

// Connection state tracking
let isConnected = false;
let isConnecting = false;

// Setup connection event handlers
redis.on('connect', () => {
  console.log('✅ Redis client connected successfully');
  isConnecting = false;
});

redis.on('ready', () => {
  console.log('✅ Redis client is ready to accept commands');
  isConnected = true;
});

redis.on('error', (error) => {
  console.error('❌ Redis client connection error:', error);
  isConnected = false;
});

redis.on('close', () => {
  console.log('⚠️ Redis client connection closed');
  isConnected = false;
});

redis.on('reconnecting', (delay: number) => {
  console.log(`🔄 Redis client reconnecting in ${delay}ms...`);
  isConnecting = true;
});

// Health check function
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const result = await safeRedisOperation(
      () => redis.ping(),
      null,
      'health-check'
    );
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

// Helper function to ensure connection
const ensureConnection = async (): Promise<void> => {
  if (isConnected) return;
  
  if (isConnecting) {
    // Wait for connection to complete
    await new Promise((resolve) => {
      const checkConnection = () => {
        if (isConnected || !isConnecting) {
          resolve(void 0);
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });
    return;
  }

  try {
    isConnecting = true;
    await redis.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    isConnecting = false;
    throw error;
  }
};

// Wrapper function for Redis operations with error handling
const safeRedisOperation = async <T>(
  operation: () => Promise<T>,
  fallback?: T,
  operationName?: string
): Promise<T | undefined> => {
  try {
    await ensureConnection();
    return await operation();
  } catch (error) {
    console.warn(`Redis operation failed${operationName ? ` (${operationName})` : ''}:`, error);
    return fallback;
  }
};

// OTP-related Redis operations with error handling
export const otpOperations = {
  async storeOTP(email: string, otp: string, ttlSeconds: number = 300): Promise<void> {
    const key = `otp:${email}`;
    await safeRedisOperation(
      () => redis.setex(key, ttlSeconds, otp),
      undefined,
      'storeOTP'
    );
    console.log(`✅ OTP stored for ${email} with TTL ${ttlSeconds}s`);
  },

  async getOTP(email: string): Promise<string | null> {
    const key = `otp:${email}`;
    return await safeRedisOperation(
      () => redis.get(key),
      null,
      'getOTP'
    ) || null;
  },

  async deleteOTP(email: string): Promise<void> {
    const key = `otp:${email}`;
    await safeRedisOperation(
      () => redis.del(key),
      undefined,
      'deleteOTP'
    );
    console.log(`✅ OTP deleted for ${email}`);
  },

  async getOTPTTL(email: string): Promise<number> {
    const key = `otp:${email}`;
    return await safeRedisOperation(
      () => redis.ttl(key),
      -1,
      'getOTPTTL'
    ) || -1;
  },

  // Alias for compatibility
  setOTP: async function(email: string, otp: string, ttlSeconds: number = 300): Promise<void> {
    return this.storeOTP(email, otp, ttlSeconds);
  },

  async checkResendCooldown(email: string, cooldownSeconds: number = 60) {
    const cooldownKey = `otp:cooldown:${email}`;
    
    const exists = await safeRedisOperation(
      () => redis.exists(cooldownKey),
      0,
      'checkResendCooldown-exists'
    );
    
    if (exists) {
      const ttl = await safeRedisOperation(
        () => redis.ttl(cooldownKey),
        0,
        'checkResendCooldown-ttl'
      );
      return {
        allowed: false,
        remainingTime: ttl || 0
      };
    }

    await safeRedisOperation(
      () => redis.setex(cooldownKey, cooldownSeconds, '1'),
      undefined,
      'checkResendCooldown-set'
    );
    
    return {
      allowed: true,
      remainingTime: 0
    };
  },

  async checkOTPRateLimit(email: string, maxAttempts: number = 5, windowSeconds: number = 3600) {
    const attemptsKey = `otp:attempts:${email}`;
    const lockKey = `otp:lock:${email}`;
    
    // Check if locked
    const lockData = await safeRedisOperation(
      () => redis.get(lockKey),
      null,
      'checkOTPRateLimit-lockData'
    );
    
    if (lockData) {
      try {
        const lock = JSON.parse(lockData);
        const ttl = await safeRedisOperation(
          () => redis.ttl(lockKey),
          0,
          'checkOTPRateLimit-lockTTL'
        );

        if (lock.attempts >= maxAttempts) {
          return {
            allowed: false,
            remaining: 0,
            resetTime: Date.now() + ((ttl || 0) * 1000),
            isLocked: true,
            lockDuration: ttl || 0,
            lockReason: lock.reason || 'Too many OTP requests'
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse lock data:', parseError);
      }
    }

    const current = await safeRedisOperation(
      () => redis.get(attemptsKey),
      null,
      'checkOTPRateLimit-current'
    );
    
    const attempts = current ? parseInt(current) : 0;

    if (attempts >= maxAttempts) {
      const lockDuration = 1800; // 30 minutes
      const lockInfo = {
        attempts: attempts + 1,
        lockedAt: new Date().toISOString(),
        reason: 'Exceeded maximum OTP requests'
      };

      await safeRedisOperation(
        () => redis.setex(lockKey, lockDuration, JSON.stringify(lockInfo)),
        undefined,
        'checkOTPRateLimit-setLock'
      );
      
      await safeRedisOperation(
        () => redis.del(attemptsKey),
        undefined,
        'checkOTPRateLimit-delAttempts'
      );

      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + (lockDuration * 1000),
        isLocked: true,
        lockDuration,
        lockReason: lockInfo.reason
      };
    }

    if (current) {
      await safeRedisOperation(
        () => redis.incr(attemptsKey),
        undefined,
        'checkOTPRateLimit-incr'
      );
    } else {
      await safeRedisOperation(
        () => redis.setex(attemptsKey, windowSeconds, '1'),
        undefined,
        'checkOTPRateLimit-setex'
      );
    }

    const ttl = await safeRedisOperation(
      () => redis.ttl(attemptsKey),
      windowSeconds,
      'checkOTPRateLimit-ttl'
    );
    
    const newAttempts = attempts + 1;

    return {
      allowed: true,
      remaining: maxAttempts - newAttempts,
      resetTime: Date.now() + ((ttl || windowSeconds) * 1000),
      isLocked: false
    };
  },

  async getRateLimitStatus(email: string) {
    const attemptsKey = `otp:attempts:${email}`;
    const lockKey = `otp:lock:${email}`;
    const cooldownKey = `otp:cooldown:${email}`;

    const [attempts, lockData, cooldownTTL] = await Promise.all([
      safeRedisOperation(() => redis.get(attemptsKey), null, 'getRateLimitStatus-attempts'),
      safeRedisOperation(() => redis.get(lockKey), null, 'getRateLimitStatus-lockData'),
      safeRedisOperation(() => redis.ttl(cooldownKey), -1, 'getRateLimitStatus-cooldownTTL')
    ]);

    const currentAttempts = attempts ? parseInt(attempts) : 0;
    let lockInfo = null;
    let lockTimeRemaining = 0;

    if (lockData) {
      try {
        lockInfo = JSON.parse(lockData);
        lockTimeRemaining = await safeRedisOperation(
          () => redis.ttl(lockKey),
          0,
          'getRateLimitStatus-lockTTL'
        ) || 0;
      } catch (parseError) {
        console.warn('Failed to parse lock data in getRateLimitStatus:', parseError);
      }
    }

    return {
      attempts: currentAttempts,
      remaining: Math.max(5 - currentAttempts, 0),
      isLocked: !!lockInfo,
      lockTimeRemaining: Math.max(lockTimeRemaining, 0),
      cooldownTimeRemaining: Math.max(cooldownTTL || -1, 0)
    };
  }
};

// Test Redis connection
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    await ensureConnection();
    await redis.ping();
    console.log('✅ Redis connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Redis connection test failed:', error);
    return false;
  }
};

// Enhanced Redis operations with error handling
const redisOperations = {
  async get(key: string): Promise<string | null> {
    const result = await safeRedisOperation(
      () => redis.get(key),
      null,
      `get:${key}`
    );
    return result || null;
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await safeRedisOperation(
        () => redis.setex(key, ttlSeconds, value),
        undefined,
        `setex:${key}`
      );
    } else {
      await safeRedisOperation(
        () => redis.set(key, value),
        undefined,
        `set:${key}`
      );
    }
  },

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await safeRedisOperation(
      () => redis.setex(key, ttlSeconds, value),
      undefined,
      `setex:${key}`
    );
  },

  async del(key: string): Promise<void> {
    await safeRedisOperation(
      () => redis.del(key),
      undefined,
      `del:${key}`
    );
  },

  async exists(key: string): Promise<number> {
    return await safeRedisOperation(
      () => redis.exists(key),
      0,
      `exists:${key}`
    ) || 0;
  },

  async ttl(key: string): Promise<number> {
    return await safeRedisOperation(
      () => redis.ttl(key),
      -1,
      `ttl:${key}`
    ) || -1;
  },

  async incr(key: string): Promise<number> {
    return await safeRedisOperation(
      () => redis.incr(key),
      0,
      `incr:${key}`
    ) || 0;
  },

  async sadd(key: string, member: string): Promise<number> {
    return await safeRedisOperation(
      () => redis.sadd(key, member),
      0,
      `sadd:${key}`
    ) || 0;
  },

  async smembers(key: string): Promise<string[]> {
    return await safeRedisOperation(
      () => redis.smembers(key),
      [],
      `smembers:${key}`
    ) || [];
  },

  async expire(key: string, seconds: number): Promise<number> {
    return await safeRedisOperation(
      () => redis.expire(key, seconds),
      0,
      `expire:${key}`
    ) || 0;
  },

  async ping(): Promise<string> {
    return await safeRedisOperation(
      () => redis.ping(),
      'PONG',
      'ping'
    ) || 'PONG';
  },

  // Pipeline operations
  pipeline() {
    return redis.pipeline();
  }
};

// Export the main Redis client and operations
export default redis;
export { redis, redisOperations, safeRedisOperation, ensureConnection };