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
exports.optimizedAuthCacheService = exports.OptimizedAuthCacheService = void 0;
const SmartCacheService_1 = require("../cache/SmartCacheService");
const HybridStorageService_1 = require("../storage/HybridStorageService");
const FeatureToggleService_1 = require("../redis/FeatureToggleService");
class OptimizedAuthCacheService {
    constructor() {
        this.OTP_TTL = 300; // 5 minutes
        this.RATE_LIMIT_TTL = 1800; // 30 minutes
        this.TOKEN_CACHE_TTL = 3600; // 1 hour
        this.RESEND_COOLDOWN = 60; // 1 minute
    }
    // Optimized OTP operations
    setOTP(email, otp) {
        return __awaiter(this, void 0, void 0, function* () {
            const otpData = {
                otp,
                email,
                attempts: 0,
                createdAt: Date.now(),
                expiresAt: Date.now() + this.OTP_TTL * 1000
            };
            // Use hybrid storage with high priority for OTP
            yield HybridStorageService_1.hybridStorageService.set(`otp:${email}`, otpData, {
                ttl: this.OTP_TTL,
                priority: 'critical',
                fallbackToMemory: true
            });
            console.log(`✅ OTP stored for ${email} with TTL ${this.OTP_TTL}s`);
        });
    }
    getOTP(email) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const otpData = yield HybridStorageService_1.hybridStorageService.get(`otp:${email}`, {
                    priority: 'critical',
                    fallbackToMemory: true
                });
                if (!otpData)
                    return null;
                // Check if expired
                if (Date.now() > otpData.expiresAt) {
                    yield this.deleteOTP(email);
                    return null;
                }
                return otpData;
            }
            catch (error) {
                console.error(`Error getting OTP for ${email}:`, error);
                return null;
            }
        });
    }
    verifyOTP(email, providedOTP) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const otpData = yield this.getOTP(email);
                if (!otpData) {
                    return { valid: false, error: 'OTP not found or expired' };
                }
                // Increment attempts
                otpData.attempts++;
                // Check if too many attempts
                if (otpData.attempts > 3) {
                    yield this.deleteOTP(email);
                    yield this.setRateLimit(email, 'otp_attempts', 3, this.RATE_LIMIT_TTL);
                    return { valid: false, error: 'Too many attempts. Please request a new OTP.' };
                }
                // Verify OTP
                if (otpData.otp === providedOTP) {
                    yield this.deleteOTP(email);
                    return { valid: true };
                }
                else {
                    // Update attempts count
                    yield HybridStorageService_1.hybridStorageService.set(`otp:${email}`, otpData, {
                        ttl: Math.max(1, Math.floor((otpData.expiresAt - Date.now()) / 1000)),
                        priority: 'critical',
                        fallbackToMemory: true
                    });
                    return {
                        valid: false,
                        error: 'Invalid OTP',
                        remainingAttempts: 3 - otpData.attempts
                    };
                }
            }
            catch (error) {
                console.error(`Error verifying OTP for ${email}:`, error);
                return { valid: false, error: 'Verification failed' };
            }
        });
    }
    deleteOTP(email) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield HybridStorageService_1.hybridStorageService.del(`otp:${email}`);
                console.log(`✅ OTP deleted for ${email}`);
            }
            catch (error) {
                console.error(`Error deleting OTP for ${email}:`, error);
            }
        });
    }
    getOTPTTL(email) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const otpData = yield this.getOTP(email);
                if (!otpData)
                    return -1;
                return Math.max(0, Math.floor((otpData.expiresAt - Date.now()) / 1000));
            }
            catch (error) {
                console.error(`Error getting OTP TTL for ${email}:`, error);
                return -1;
            }
        });
    }
    // Optimized rate limiting
    checkRateLimit(email, type) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const key = `rate_limit:${type}:${email}`;
                const rateLimitData = yield HybridStorageService_1.hybridStorageService.get(key, {
                    priority: 'high',
                    fallbackToMemory: true
                });
                const now = Date.now();
                const maxAttempts = this.getMaxAttempts(type);
                const windowMs = this.getRateLimitWindow(type) * 1000;
                if (!rateLimitData) {
                    // First attempt
                    yield this.setRateLimit(email, type, 1, this.getRateLimitWindow(type));
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
                    yield this.setRateLimit(email, type, 1, this.getRateLimitWindow(type));
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
                    yield HybridStorageService_1.hybridStorageService.set(key, rateLimitData, {
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
                yield HybridStorageService_1.hybridStorageService.set(key, rateLimitData, {
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
            }
            catch (error) {
                console.error(`Error checking rate limit for ${email}:`, error);
                // Graceful degradation - allow the operation
                return {
                    allowed: true,
                    remaining: 1,
                    resetTime: Date.now() + 60000,
                    isLocked: false
                };
            }
        });
    }
    setRateLimit(email, type, attempts, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const rateLimitData = {
                attempts,
                resetTime: Date.now() + ttlSeconds * 1000
            };
            yield HybridStorageService_1.hybridStorageService.set(`rate_limit:${type}:${email}`, rateLimitData, {
                ttl: ttlSeconds,
                priority: 'high',
                fallbackToMemory: true
            });
        });
    }
    // Optimized token caching
    cacheToken(tokenId, tokenData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!FeatureToggleService_1.featureToggleService.isFeatureEnabled('auth_caching')) {
                console.log('📵 Auth caching disabled, skipping token cache');
                return;
            }
            const ttl = Math.max(1, tokenData.exp - Math.floor(Date.now() / 1000));
            yield SmartCacheService_1.smartCacheService.set(`jwt:${tokenId}`, tokenData, {
                ttl,
                priority: 'critical',
                compress: false // Don't compress small token data
            });
            console.log(`📦 Token cached for ${tokenData.email} (TTL: ${ttl}s)`);
        });
    }
    getToken(tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!FeatureToggleService_1.featureToggleService.isFeatureEnabled('auth_caching')) {
                return null;
            }
            try {
                return yield SmartCacheService_1.smartCacheService.get(`jwt:${tokenId}`, {
                    priority: 'critical'
                });
            }
            catch (error) {
                console.error(`Error getting cached token ${tokenId}:`, error);
                return null;
            }
        });
    }
    invalidateToken(tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield SmartCacheService_1.smartCacheService.del(`jwt:${tokenId}`);
                console.log(`🗑️ Token invalidated: ${tokenId}`);
            }
            catch (error) {
                console.error(`Error invalidating token ${tokenId}:`, error);
            }
        });
    }
    // Batch operations for efficiency
    batchInvalidateUserTokens(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Use pattern-based invalidation
                console.log(`🗑️ Batch invalidating tokens for user: ${userId}`);
                // In a real implementation, you'd scan for keys matching the pattern
                // For now, just log the operation
            }
            catch (error) {
                console.error(`Error batch invalidating tokens for user ${userId}:`, error);
            }
        });
    }
    // Helper methods
    getMaxAttempts(type) {
        switch (type) {
            case 'otp_attempts': return 3;
            case 'login_attempts': return 5;
            case 'resend': return 3;
            default: return 3;
        }
    }
    getRateLimitWindow(type) {
        switch (type) {
            case 'otp_attempts': return 1800; // 30 minutes
            case 'login_attempts': return 900; // 15 minutes
            case 'resend': return 300; // 5 minutes
            default: return 900;
        }
    }
    getLockDuration(type) {
        switch (type) {
            case 'otp_attempts': return 1800; // 30 minutes
            case 'login_attempts': return 3600; // 1 hour
            case 'resend': return 300; // 5 minutes
            default: return 1800;
        }
    }
    // Cleanup expired data
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🧹 Cleaning up expired auth cache data...');
            // In a real implementation, you'd scan for expired keys
            // For now, just clear memory cache
            HybridStorageService_1.hybridStorageService.clearMemory();
        });
    }
    // Get auth cache statistics
    getStats() {
        return {
            features: {
                authCachingEnabled: FeatureToggleService_1.featureToggleService.isFeatureEnabled('auth_caching'),
                otpStorageEnabled: FeatureToggleService_1.featureToggleService.isFeatureEnabled('otp_storage'),
                sessionManagementEnabled: FeatureToggleService_1.featureToggleService.isFeatureEnabled('session_management')
            },
            storage: HybridStorageService_1.hybridStorageService.getStorageStats()
        };
    }
}
exports.OptimizedAuthCacheService = OptimizedAuthCacheService;
exports.optimizedAuthCacheService = new OptimizedAuthCacheService();
