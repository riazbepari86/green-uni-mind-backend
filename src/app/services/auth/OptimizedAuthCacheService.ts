import { smartCacheService } from '../cache/SmartCacheService';
import { hybridStorageService } from '../storage/HybridStorageService';
import { featureToggleService } from '../redis/FeatureToggleService';
import { redisOptimizationService } from '../redis/RedisOptimizationService';

interface OTPData {
  otp: string;
  email: string;
  attempts: number;
  createdAt: number;
  expiresAt: number;
}

interface CooldownData {
  email: string;
  setAt: number;
  expiresAt: number;
}

interface AuthTokenData {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

interface RateLimitData {
  attempts: number;
  resetTime: number;
  lockUntil?: number;
}

export class OptimizedAuthCacheService {
  private readonly OTP_TTL = 300; // 5 minutes
  private readonly RATE_LIMIT_TTL = 1800; // 30 minutes
  private readonly TOKEN_CACHE_TTL = 3600; // 1 hour
  private readonly RESEND_COOLDOWN = 60; // 1 minute
  private readonly MAX_OTP_ATTEMPTS = 3; // Maximum verification attempts per OTP
  private readonly MAX_RESEND_ATTEMPTS = 5; // Maximum resend attempts per hour

  // Enhanced OTP operations with cooldown checking
  async setOTP(email: string, otp: string): Promise<{ success: boolean; cooldownRemaining?: number; expiresAt: number }> {
    // Check if user is in cooldown period
    const cooldownCheck = await this.checkResendCooldown(email);
    if (!cooldownCheck.canResend) {
      return {
        success: false,
        cooldownRemaining: cooldownCheck.remainingTime,
        expiresAt: Date.now() + this.OTP_TTL * 1000
      };
    }

    const now = Date.now();
    const expiresAt = now + this.OTP_TTL * 1000;

    const otpData: OTPData = {
      otp,
      email,
      attempts: 0,
      createdAt: now,
      expiresAt
    };

    // Use hybrid storage with high priority for OTP
    await hybridStorageService.set(
      `otp:${email}`,
      otpData,
      {
        ttl: this.OTP_TTL,
        priority: 'critical',
        fallbackToMemory: true
      }
    );

    // Set resend cooldown
    await this.setResendCooldown(email);

    console.log(`✅ OTP stored for ${email} with TTL ${this.OTP_TTL}s, expires at ${new Date(expiresAt).toISOString()}`);

    return {
      success: true,
      expiresAt
    };
  }

  async getOTP(email: string): Promise<OTPData | null> {
    try {
      const otpData = await hybridStorageService.get<OTPData>(`otp:${email}`, {
        priority: 'critical',
        fallbackToMemory: true
      });

      if (!otpData) return null;

      // Check if expired
      if (Date.now() > otpData.expiresAt) {
        await this.deleteOTP(email);
        return null;
      }

      return otpData;
    } catch (error) {
      console.error(`Error getting OTP for ${email}:`, error);
      return null;
    }
  }

  async verifyOTP(email: string, providedOTP: string): Promise<{
    valid: boolean;
    error?: string;
    remainingAttempts?: number;
  }> {
    try {
      const otpData = await this.getOTP(email);
      
      if (!otpData) {
        return { valid: false, error: 'OTP not found or expired' };
      }

      // Increment attempts
      otpData.attempts++;
      
      // Check if too many attempts
      if (otpData.attempts > 3) {
        await this.deleteOTP(email);
        await this.setRateLimit(email, 'otp_attempts', 3, this.RATE_LIMIT_TTL);
        return { valid: false, error: 'Too many attempts. Please request a new OTP.' };
      }

      // Verify OTP
      if (otpData.otp === providedOTP) {
        await this.deleteOTP(email);
        return { valid: true };
      } else {
        // Update attempts count
        await hybridStorageService.set(
          `otp:${email}`,
          otpData,
          {
            ttl: Math.max(1, Math.floor((otpData.expiresAt - Date.now()) / 1000)),
            priority: 'critical',
            fallbackToMemory: true
          }
        );
        
        return {
          valid: false,
          error: 'Invalid OTP',
          remainingAttempts: 3 - otpData.attempts
        };
      }
    } catch (error) {
      console.error(`Error verifying OTP for ${email}:`, error);
      return { valid: false, error: 'Verification failed' };
    }
  }

  async deleteOTP(email: string): Promise<void> {
    try {
      await hybridStorageService.del(`otp:${email}`);
      console.log(`✅ OTP deleted for ${email}`);
    } catch (error) {
      console.error(`Error deleting OTP for ${email}:`, error);
    }
  }

  // Resend cooldown management
  async setResendCooldown(email: string): Promise<void> {
    const cooldownKey = `otp:cooldown:${email}`;
    const cooldownData = {
      email,
      setAt: Date.now(),
      expiresAt: Date.now() + (this.RESEND_COOLDOWN * 1000)
    };

    await hybridStorageService.set(
      cooldownKey,
      cooldownData,
      {
        ttl: this.RESEND_COOLDOWN,
        priority: 'high',
        fallbackToMemory: true
      }
    );

    console.log(`✅ Resend cooldown set for ${email} for ${this.RESEND_COOLDOWN}s`);
  }

  async checkResendCooldown(email: string): Promise<{ canResend: boolean; remainingTime?: number }> {
    try {
      const cooldownKey = `otp:cooldown:${email}`;
      const cooldownData = await hybridStorageService.get(cooldownKey) as CooldownData | null;

      if (!cooldownData) {
        return { canResend: true };
      }

      const now = Date.now();
      const remainingTime = Math.max(0, Math.ceil((cooldownData.expiresAt - now) / 1000));

      if (remainingTime > 0) {
        return {
          canResend: false,
          remainingTime
        };
      }

      // Cooldown expired, clean up
      await hybridStorageService.del(cooldownKey);
      return { canResend: true };
    } catch (error) {
      console.error(`Error checking resend cooldown for ${email}:`, error);
      // On error, allow resend to prevent blocking users
      return { canResend: true };
    }
  }

  async getOTPTTL(email: string): Promise<number> {
    try {
      const otpData = await this.getOTP(email);
      if (!otpData) return -1;
      
      return Math.max(0, Math.floor((otpData.expiresAt - Date.now()) / 1000));
    } catch (error) {
      console.error(`Error getting OTP TTL for ${email}:`, error);
      return -1;
    }
  }

  // Optimized rate limiting
  async checkRateLimit(email: string, type: 'otp_attempts' | 'login_attempts' | 'resend'): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    isLocked: boolean;
  }> {
    try {
      const key = `rate_limit:${type}:${email}`;
      const rateLimitData = await hybridStorageService.get<RateLimitData>(key, {
        priority: 'high',
        fallbackToMemory: true
      });

      const now = Date.now();
      const maxAttempts = this.getMaxAttempts(type);
      const windowMs = this.getRateLimitWindow(type) * 1000;

      if (!rateLimitData) {
        // First attempt
        await this.setRateLimit(email, type, 1, this.getRateLimitWindow(type));
        return {
          allowed: true,
          remaining: maxAttempts - 1,
          resetTime: now + windowMs,
          isLocked: false
        };
      }

      // Check if locked
      if (rateLimitData.lockUntil && now < rateLimitData.lockUntil) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: rateLimitData.lockUntil,
          isLocked: true
        };
      }

      // Check if window has reset
      if (now > rateLimitData.resetTime) {
        await this.setRateLimit(email, type, 1, this.getRateLimitWindow(type));
        return {
          allowed: true,
          remaining: maxAttempts - 1,
          resetTime: now + windowMs,
          isLocked: false
        };
      }

      // Check if limit exceeded
      if (rateLimitData.attempts >= maxAttempts) {
        // Lock the account
        const lockDuration = this.getLockDuration(type);
        rateLimitData.lockUntil = now + lockDuration * 1000;
        
        await hybridStorageService.set(key, rateLimitData, {
          ttl: lockDuration,
          priority: 'high',
          fallbackToMemory: true
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime: rateLimitData.lockUntil,
          isLocked: true
        };
      }

      // Increment attempts
      rateLimitData.attempts++;
      await hybridStorageService.set(key, rateLimitData, {
        ttl: Math.max(1, Math.floor((rateLimitData.resetTime - now) / 1000)),
        priority: 'high',
        fallbackToMemory: true
      });

      return {
        allowed: true,
        remaining: maxAttempts - rateLimitData.attempts,
        resetTime: rateLimitData.resetTime,
        isLocked: false
      };

    } catch (error) {
      console.error(`Error checking rate limit for ${email}:`, error);
      // Graceful degradation - allow the operation
      return {
        allowed: true,
        remaining: 1,
        resetTime: Date.now() + 60000,
        isLocked: false
      };
    }
  }

  private async setRateLimit(email: string, type: string, attempts: number, ttlSeconds: number): Promise<void> {
    const rateLimitData: RateLimitData = {
      attempts,
      resetTime: Date.now() + ttlSeconds * 1000
    };

    await hybridStorageService.set(
      `rate_limit:${type}:${email}`,
      rateLimitData,
      {
        ttl: ttlSeconds,
        priority: 'high',
        fallbackToMemory: true
      }
    );
  }

  // Optimized token caching
  async cacheToken(tokenId: string, tokenData: AuthTokenData): Promise<void> {
    if (!featureToggleService.isFeatureEnabled('auth_caching')) {
      console.log('📵 Auth caching disabled, skipping token cache');
      return;
    }

    const ttl = Math.max(1, tokenData.exp - Math.floor(Date.now() / 1000));
    
    await smartCacheService.set(
      `jwt:${tokenId}`,
      tokenData,
      {
        ttl,
        priority: 'critical',
        compress: false // Don't compress small token data
      }
    );

    console.log(`📦 Token cached for ${tokenData.email} (TTL: ${ttl}s)`);
  }

  async getToken(tokenId: string): Promise<AuthTokenData | null> {
    if (!featureToggleService.isFeatureEnabled('auth_caching')) {
      return null;
    }

    try {
      return await smartCacheService.get<AuthTokenData>(`jwt:${tokenId}`, {
        priority: 'critical'
      });
    } catch (error) {
      console.error(`Error getting cached token ${tokenId}:`, error);
      return null;
    }
  }

  async invalidateToken(tokenId: string): Promise<void> {
    try {
      await smartCacheService.del(`jwt:${tokenId}`);
      console.log(`🗑️ Token invalidated: ${tokenId}`);
    } catch (error) {
      console.error(`Error invalidating token ${tokenId}:`, error);
    }
  }

  // Batch operations for efficiency
  async batchInvalidateUserTokens(userId: string): Promise<void> {
    try {
      // Use pattern-based invalidation
      console.log(`🗑️ Batch invalidating tokens for user: ${userId}`);
      // In a real implementation, you'd scan for keys matching the pattern
      // For now, just log the operation
    } catch (error) {
      console.error(`Error batch invalidating tokens for user ${userId}:`, error);
    }
  }

  // Helper methods
  private getMaxAttempts(type: string): number {
    switch (type) {
      case 'otp_attempts': return 3;
      case 'login_attempts': return 5;
      case 'resend': return 3;
      default: return 3;
    }
  }

  private getRateLimitWindow(type: string): number {
    switch (type) {
      case 'otp_attempts': return 1800; // 30 minutes
      case 'login_attempts': return 900; // 15 minutes
      case 'resend': return 300; // 5 minutes
      default: return 900;
    }
  }

  private getLockDuration(type: string): number {
    switch (type) {
      case 'otp_attempts': return 1800; // 30 minutes
      case 'login_attempts': return 3600; // 1 hour
      case 'resend': return 300; // 5 minutes
      default: return 1800;
    }
  }

  // Cleanup expired data
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up expired auth cache data...');
    // In a real implementation, you'd scan for expired keys
    // For now, just clear memory cache
    hybridStorageService.clearMemory();
  }

  // Get auth cache statistics
  getStats(): {
    features: {
      authCachingEnabled: boolean;
      otpStorageEnabled: boolean;
      sessionManagementEnabled: boolean;
    };
    storage: any;
  } {
    return {
      features: {
        authCachingEnabled: featureToggleService.isFeatureEnabled('auth_caching'),
        otpStorageEnabled: featureToggleService.isFeatureEnabled('otp_storage'),
        sessionManagementEnabled: featureToggleService.isFeatureEnabled('session_management')
      },
      storage: hybridStorageService.getStorageStats()
    };
  }
}

export const optimizedAuthCacheService = new OptimizedAuthCacheService();
