import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import { AuthCacheService } from '../redis/AuthCacheService';
import { redisServiceManager } from '../redis/RedisServiceManager';
import config from '../../config';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenFamily: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface JWTPayload extends JwtPayload {
  email: string;
  role: string;
  _id?: string;
  tokenId?: string;
  family?: string;
  type?: 'access' | 'refresh';
}

export class JWTService {
  private authCache: AuthCacheService;

  constructor() {
    this.authCache = new AuthCacheService(
      redisServiceManager.authClient,
      redisServiceManager.monitoring
    );
  }

  // Generate token ID from payload
  private generateTokenId(): string {
    return uuidv4();
  }

  // Generate token family ID
  private generateTokenFamily(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Create access token with caching
  async createAccessToken(
    payload: { email: string; role: string; _id?: string },
    secret: Secret,
    expiresIn: string | number,
    tokenFamily?: string
  ): Promise<{ token: string; tokenId: string }> {
    const tokenId = this.generateTokenId();
    
    const jwtPayload: JWTPayload = {
      ...payload,
      tokenId,
      family: tokenFamily,
      type: 'access'
    };

    const token = jwt.sign(jwtPayload, secret, { expiresIn: expiresIn as SignOptions['expiresIn'] });
    
    // Calculate TTL in seconds
    const decoded = jwt.decode(token) as JwtPayload;
    const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;

    // Cache the token payload
    try {
      await redisServiceManager.executeWithCircuitBreaker(
        () => this.authCache.cacheToken(tokenId, jwtPayload, ttl),
        'auth'
      );
    } catch (error) {
      console.warn('Failed to cache access token:', error);
      // Don't fail token creation if caching fails
    }

    return { token, tokenId };
  }

  // Create refresh token with family tracking
  async createRefreshToken(
    payload: { email: string; role: string; _id?: string },
    secret: Secret,
    expiresIn: string | number,
    tokenFamily: string
  ): Promise<{ token: string; tokenId: string }> {
    const tokenId = this.generateTokenId();
    
    const jwtPayload: JWTPayload = {
      ...payload,
      tokenId,
      family: tokenFamily,
      type: 'refresh'
    };

    const token = jwt.sign(jwtPayload, secret, { expiresIn: expiresIn as SignOptions['expiresIn'] });
    
    // Calculate TTL in seconds
    const decoded = jwt.decode(token) as JwtPayload;
    const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400 * 30; // 30 days default

    // Store refresh token with family tracking
    try {
      await redisServiceManager.executeWithCircuitBreaker(
        () => this.authCache.storeRefreshToken(tokenFamily, tokenId, payload._id || '', ttl),
        'auth'
      );
    } catch (error) {
      console.warn('Failed to store refresh token:', error);
      // Don't fail token creation if storage fails
    }

    return { token, tokenId };
  }

  // Create token pair (access + refresh)
  async createTokenPair(
    payload: { email: string; role: string; _id?: string },
    existingFamily?: string
  ): Promise<TokenPair> {
    const tokenFamily = existingFamily || this.generateTokenFamily();
    
    // Create access token
    const { token: accessToken } = await this.createAccessToken(
      payload,
      config.jwt_access_secret,
      config.jwt_access_expires_in,
      tokenFamily
    );

    // Create refresh token
    const { token: refreshToken } = await this.createRefreshToken(
      payload,
      config.jwt_refresh_secret,
      config.jwt_refresh_expires_in,
      tokenFamily
    );

    // Parse expiration times
    const accessDecoded = jwt.decode(accessToken) as JwtPayload;
    const refreshDecoded = jwt.decode(refreshToken) as JwtPayload;
    
    const expiresIn = accessDecoded.exp ? accessDecoded.exp - Math.floor(Date.now() / 1000) : 3600;
    const refreshExpiresIn = refreshDecoded.exp ? refreshDecoded.exp - Math.floor(Date.now() / 1000) : 86400 * 30;

    return {
      accessToken,
      refreshToken,
      tokenFamily,
      expiresIn,
      refreshExpiresIn
    };
  }

  // Verify token with cache check
  async verifyToken(token: string, secret: Secret): Promise<JWTPayload> {
    // Generate token ID for cache lookup
    const tokenId = this.extractTokenId(token);
    
    if (tokenId) {
      // Check if token is blacklisted
      const isBlacklisted = await redisServiceManager.executeWithCircuitBreaker(
        () => this.authCache.isTokenBlacklisted(tokenId),
        'auth',
        () => Promise.resolve(false)
      );

      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Try to get from cache first
      const cachedPayload = await redisServiceManager.executeWithCircuitBreaker(
        () => this.authCache.getTokenPayload(tokenId),
        'auth',
        () => Promise.resolve(null)
      );

      if (cachedPayload) {
        return cachedPayload;
      }
    }

    // Verify JWT if not in cache
    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    // Cache the verified payload if it has a tokenId
    if (decoded.tokenId) {
      const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
      if (ttl > 0) {
        try {
          await redisServiceManager.executeWithCircuitBreaker(
            () => this.authCache.cacheToken(decoded.tokenId!, decoded, ttl),
            'auth'
          );
        } catch (error) {
          console.warn('Failed to cache verified token:', error);
        }
      }
    }

    return decoded;
  }

  // Extract token ID from JWT payload
  private extractTokenId(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      return decoded?.tokenId || null;
    } catch {
      return null;
    }
  }

  // Refresh token with rotation
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    // Verify refresh token
    const decoded = await this.verifyToken(refreshToken, config.jwt_refresh_secret);
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type for refresh');
    }

    if (!decoded.tokenId || !decoded.family) {
      throw new Error('Invalid refresh token structure');
    }

    // Get refresh token info from cache
    const tokenInfo = await redisServiceManager.executeWithCircuitBreaker(
      () => this.authCache.getRefreshTokenInfo(decoded.tokenId!),
      'auth',
      () => Promise.resolve(null)
    );

    if (!tokenInfo) {
      // Token family might be compromised - invalidate all tokens in family
      if (decoded.family) {
        await this.invalidateTokenFamily(decoded.family);
      }
      throw new Error('Refresh token not found or expired');
    }

    // Create new token pair with the same family
    const newTokenPair = await this.createTokenPair(
      {
        email: decoded.email,
        role: decoded.role,
        _id: decoded._id
      },
      decoded.family
    );

    // Invalidate the old refresh token
    try {
      await redisServiceManager.executeWithCircuitBreaker(
        () => this.authCache.blacklistToken(decoded.tokenId!, 86400),
        'auth'
      );
    } catch (error) {
      console.warn('Failed to blacklist old refresh token:', error);
    }

    return newTokenPair;
  }

  // Blacklist token
  async blacklistToken(token: string): Promise<void> {
    const tokenId = this.extractTokenId(token);
    if (!tokenId) {
      throw new Error('Cannot blacklist token without ID');
    }

    const decoded = jwt.decode(token) as JwtPayload;
    const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;

    await redisServiceManager.executeWithCircuitBreaker(
      () => this.authCache.blacklistToken(tokenId, Math.max(ttl, 0)),
      'auth'
    );
  }

  // Invalidate token family (useful when refresh token is compromised)
  async invalidateTokenFamily(tokenFamily: string): Promise<void> {
    await redisServiceManager.executeWithCircuitBreaker(
      () => this.authCache.invalidateTokenFamily(tokenFamily),
      'auth'
    );
  }

  // Batch blacklist tokens (useful for logout from all devices)
  async batchBlacklistTokens(tokens: string[]): Promise<void> {
    const tokenIds = tokens
      .map(token => this.extractTokenId(token))
      .filter(id => id !== null) as string[];

    if (tokenIds.length === 0) {
      return;
    }

    await redisServiceManager.executeWithCircuitBreaker(
      () => this.authCache.batchBlacklistTokens(tokenIds, 86400),
      'auth'
    );
  }

  // Check if token is blacklisted
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenId = this.extractTokenId(token);
    if (!tokenId) {
      return false;
    }

    return await redisServiceManager.executeWithCircuitBreaker(
      () => this.authCache.isTokenBlacklisted(tokenId),
      'auth',
      () => Promise.resolve(false)
    );
  }

  // Get token info from cache
  async getTokenInfo(token: string): Promise<JWTPayload | null> {
    const tokenId = this.extractTokenId(token);
    if (!tokenId) {
      return null;
    }

    return await redisServiceManager.executeWithCircuitBreaker(
      () => this.authCache.getTokenPayload(tokenId),
      'auth',
      () => Promise.resolve(null)
    );
  }

  // Cleanup expired tokens (maintenance function)
  async cleanupExpiredTokens(): Promise<void> {
    try {
      await redisServiceManager.executeWithCircuitBreaker(
        () => this.authCache.cleanupExpiredData(),
        'auth'
      );
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
    }
  }

  // Get JWT statistics
  async getJWTStats(): Promise<{
    activeSessions: number;
    blacklistedTokens: number;
    tokenFamilies: number;
  }> {
    // This would require additional Redis operations to count keys
    // Implementation depends on your specific monitoring needs
    return {
      activeSessions: 0,
      blacklistedTokens: 0,
      tokenFamilies: 0
    };
  }
}

// Export singleton instance
export const jwtService = new JWTService();
