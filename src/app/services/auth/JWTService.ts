import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import config from '../../config';
import { redisOperations } from '../../config/redis';
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
  // Generate token ID from payload
  private generateTokenId(): string {
    return uuidv4();
  }

  // Generate token family ID
  private generateTokenFamily(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Create access token
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

    // Cache the token payload in Redis
    await redisOperations.setex(`jwt:${tokenId}`, ttl, JSON.stringify(jwtPayload));

    return { token, tokenId };
  }

  // Create refresh token
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

    // Store refresh token with family tracking in Redis
    await redisOperations.setex(`refresh:${tokenId}`, ttl, JSON.stringify({
      userId: payload._id || '',
      family: tokenFamily,
      createdAt: new Date().toISOString()
    }));
    
    // Add to family set
    await redisOperations.sadd(`family:${tokenFamily}`, tokenId);
    await redisOperations.expire(`family:${tokenFamily}`, ttl);

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
    const tokenId = this.extractTokenId(token);
    
    if (tokenId) {
      // Check if token is blacklisted
      const isBlacklisted = await redisOperations.exists(`blacklist:${tokenId}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Try to get from cache first
      const cachedPayload = await redisOperations.get(`jwt:${tokenId}`);
      if (cachedPayload) {
        return JSON.parse(cachedPayload);
      }
    }

    // Verify JWT if not in cache
    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    // Cache the verified payload if it has a tokenId
    if (decoded.tokenId) {
      const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
      if (ttl > 0) {
        await redisOperations.setex(`jwt:${decoded.tokenId}`, ttl, JSON.stringify(decoded));
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

    // Add debugging information
    console.log('Token refresh attempt - decoded token:', {
      type: decoded.type,
      tokenId: decoded.tokenId,
      family: decoded.family,
      email: decoded.email,
      role: decoded.role
    });

    // Check if token has the correct type
    if (!decoded.type) {
      console.warn('Token missing type field, assuming it is a refresh token');
      // For backward compatibility, assume it's a refresh token if type is missing
      decoded.type = 'refresh';
    }

    if (decoded.type !== 'refresh') {
      console.error('Invalid token type for refresh. Received:', decoded.type, 'Expected: refresh');
      throw new Error(`Invalid token type for refresh. Received: ${decoded.type}, Expected: refresh`);
    }

    if (!decoded.tokenId || !decoded.family) {
      throw new Error('Invalid refresh token structure');
    }

    // Get refresh token info from Redis
    let tokenInfo = null;
    const tokenData = await redisOperations.get(`refresh:${decoded.tokenId}`);
    if (tokenData) {
      try {
        tokenInfo = JSON.parse(tokenData);
      } catch (parseError) {
        console.warn('Failed to parse refresh token data:', parseError);
      }
    }

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
    await redisOperations.setex(`blacklist:${decoded.tokenId}`, 86400, '1'); // Blacklist for 24 hours
    await redisOperations.del(`refresh:${decoded.tokenId}`);

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

    await redisOperations.setex(`blacklist:${tokenId}`, Math.max(ttl, 0), '1');
    await redisOperations.del(`jwt:${tokenId}`);
  }

  // Batch blacklist multiple tokens
  async batchBlacklistTokens(tokens: string[]): Promise<void> {
    if (!tokens || tokens.length === 0) {
      return;
    }

    const pipeline = redisOperations.pipeline();
    
    for (const token of tokens) {
      const tokenId = this.extractTokenId(token);
      if (tokenId) {
        const decoded = jwt.decode(token) as JwtPayload;
        const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
        
        pipeline.setex(`blacklist:${tokenId}`, Math.max(ttl, 0), '1');
        pipeline.del(`jwt:${tokenId}`);
        pipeline.del(`refresh:${tokenId}`);
      }
    }
    
    await pipeline.exec();
  }

  // Invalidate token family (useful when refresh token is compromised)
  async invalidateTokenFamily(tokenFamily: string): Promise<void> {
    const tokenIds = await redisOperations.smembers(`family:${tokenFamily}`);
    if (tokenIds.length > 0) {
      const pipeline = redisOperations.pipeline();
      tokenIds.forEach(tokenId => {
        pipeline.setex(`blacklist:${tokenId}`, 86400, '1');
        pipeline.del(`refresh:${tokenId}`);
        pipeline.del(`jwt:${tokenId}`);
      });
      pipeline.del(`family:${tokenFamily}`);
      await pipeline.exec();
    }
  }

  // Check if token is blacklisted
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenId = this.extractTokenId(token);
    if (!tokenId) {
      return false;
    }

    const result = await redisOperations.exists(`blacklist:${tokenId}`);
    return result === 1;
  }

  // Get token info from cache
  async getTokenInfo(token: string): Promise<JWTPayload | null> {
    const tokenId = this.extractTokenId(token);
    if (!tokenId) {
      return null;
    }

    const cachedPayload = await redisOperations.get(`jwt:${tokenId}`);
    return cachedPayload ? JSON.parse(cachedPayload) : null;
  }

  // Cleanup expired tokens (maintenance function)
  async cleanupExpiredTokens(): Promise<void> {
    try {
      // Redis automatically removes expired keys, but we can do manual cleanup if needed
      console.log('Token cleanup completed (Redis handles expiration automatically)');
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
    }
  }
}

// Export singleton instance
export const jwtService = new JWTService();