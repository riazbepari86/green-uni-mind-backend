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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtService = exports.JWTService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../../config"));
const redis_1 = require("../../config/redis");
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
class JWTService {
    // Generate token ID from payload
    generateTokenId() {
        return (0, uuid_1.v4)();
    }
    // Generate token family ID
    generateTokenFamily() {
        return crypto_1.default.randomBytes(16).toString('hex');
    }
    // Create access token
    createAccessToken(payload, secret, expiresIn, tokenFamily) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenId = this.generateTokenId();
            const jwtPayload = Object.assign(Object.assign({}, payload), { tokenId, family: tokenFamily, type: 'access' });
            const token = jsonwebtoken_1.default.sign(jwtPayload, secret, { expiresIn: expiresIn });
            // Calculate TTL in seconds
            const decoded = jsonwebtoken_1.default.decode(token);
            const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
            // Cache the token payload in Redis
            yield redis_1.redisOperations.setex(`jwt:${tokenId}`, ttl, JSON.stringify(jwtPayload));
            return { token, tokenId };
        });
    }
    // Create refresh token
    createRefreshToken(payload, secret, expiresIn, tokenFamily) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenId = this.generateTokenId();
            const jwtPayload = Object.assign(Object.assign({}, payload), { tokenId, family: tokenFamily, type: 'refresh' });
            const token = jsonwebtoken_1.default.sign(jwtPayload, secret, { expiresIn: expiresIn });
            // Calculate TTL in seconds
            const decoded = jsonwebtoken_1.default.decode(token);
            const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400 * 30; // 30 days default
            // Store refresh token with family tracking in Redis
            yield redis_1.redisOperations.setex(`refresh:${tokenId}`, ttl, JSON.stringify({
                userId: payload._id || '',
                family: tokenFamily,
                createdAt: new Date().toISOString()
            }));
            // Add to family set
            yield redis_1.redisOperations.sadd(`family:${tokenFamily}`, tokenId);
            yield redis_1.redisOperations.expire(`family:${tokenFamily}`, ttl);
            return { token, tokenId };
        });
    }
    // Create token pair (access + refresh)
    createTokenPair(payload, existingFamily) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenFamily = existingFamily || this.generateTokenFamily();
            // Create access token
            const { token: accessToken } = yield this.createAccessToken(payload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in, tokenFamily);
            // Create refresh token
            const { token: refreshToken } = yield this.createRefreshToken(payload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in, tokenFamily);
            // Parse expiration times
            const accessDecoded = jsonwebtoken_1.default.decode(accessToken);
            const refreshDecoded = jsonwebtoken_1.default.decode(refreshToken);
            const expiresIn = accessDecoded.exp ? accessDecoded.exp - Math.floor(Date.now() / 1000) : 3600;
            const refreshExpiresIn = refreshDecoded.exp ? refreshDecoded.exp - Math.floor(Date.now() / 1000) : 86400 * 30;
            return {
                accessToken,
                refreshToken,
                tokenFamily,
                expiresIn,
                refreshExpiresIn
            };
        });
    }
    // Verify token with cache check
    verifyToken(token, secret) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenId = this.extractTokenId(token);
            if (tokenId) {
                // Check if token is blacklisted
                const isBlacklisted = yield redis_1.redisOperations.exists(`blacklist:${tokenId}`);
                if (isBlacklisted) {
                    throw new Error('Token has been revoked');
                }
                // Try to get from cache first
                const cachedPayload = yield redis_1.redisOperations.get(`jwt:${tokenId}`);
                if (cachedPayload) {
                    return JSON.parse(cachedPayload);
                }
            }
            // Verify JWT if not in cache
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            // Cache the verified payload if it has a tokenId
            if (decoded.tokenId) {
                const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
                if (ttl > 0) {
                    yield redis_1.redisOperations.setex(`jwt:${decoded.tokenId}`, ttl, JSON.stringify(decoded));
                }
            }
            return decoded;
        });
    }
    // Extract token ID from JWT payload
    extractTokenId(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            return (decoded === null || decoded === void 0 ? void 0 : decoded.tokenId) || null;
        }
        catch (_a) {
            return null;
        }
    }
    // Refresh token with rotation
    refreshTokens(refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify refresh token
            const decoded = yield this.verifyToken(refreshToken, config_1.default.jwt_refresh_secret);
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
            const tokenData = yield redis_1.redisOperations.get(`refresh:${decoded.tokenId}`);
            if (tokenData) {
                try {
                    tokenInfo = JSON.parse(tokenData);
                }
                catch (parseError) {
                    console.warn('Failed to parse refresh token data:', parseError);
                }
            }
            if (!tokenInfo) {
                // Token family might be compromised - invalidate all tokens in family
                if (decoded.family) {
                    yield this.invalidateTokenFamily(decoded.family);
                }
                throw new Error('Refresh token not found or expired');
            }
            // Create new token pair with the same family
            const newTokenPair = yield this.createTokenPair({
                email: decoded.email,
                role: decoded.role,
                _id: decoded._id
            }, decoded.family);
            // Invalidate the old refresh token
            yield redis_1.redisOperations.setex(`blacklist:${decoded.tokenId}`, 86400, '1'); // Blacklist for 24 hours
            yield redis_1.redisOperations.del(`refresh:${decoded.tokenId}`);
            return newTokenPair;
        });
    }
    // Blacklist token
    blacklistToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenId = this.extractTokenId(token);
            if (!tokenId) {
                throw new Error('Cannot blacklist token without ID');
            }
            const decoded = jsonwebtoken_1.default.decode(token);
            const ttl = (decoded === null || decoded === void 0 ? void 0 : decoded.exp) ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
            yield redis_1.redisOperations.setex(`blacklist:${tokenId}`, Math.max(ttl, 0), '1');
            yield redis_1.redisOperations.del(`jwt:${tokenId}`);
        });
    }
    // Batch blacklist multiple tokens
    batchBlacklistTokens(tokens) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!tokens || tokens.length === 0) {
                return;
            }
            const pipeline = redis_1.redisOperations.pipeline();
            for (const token of tokens) {
                const tokenId = this.extractTokenId(token);
                if (tokenId) {
                    const decoded = jsonwebtoken_1.default.decode(token);
                    const ttl = (decoded === null || decoded === void 0 ? void 0 : decoded.exp) ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
                    pipeline.setex(`blacklist:${tokenId}`, Math.max(ttl, 0), '1');
                    pipeline.del(`jwt:${tokenId}`);
                    pipeline.del(`refresh:${tokenId}`);
                }
            }
            yield pipeline.exec();
        });
    }
    // Invalidate token family (useful when refresh token is compromised)
    invalidateTokenFamily(tokenFamily) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenIds = yield redis_1.redisOperations.smembers(`family:${tokenFamily}`);
            if (tokenIds.length > 0) {
                const pipeline = redis_1.redisOperations.pipeline();
                tokenIds.forEach(tokenId => {
                    pipeline.setex(`blacklist:${tokenId}`, 86400, '1');
                    pipeline.del(`refresh:${tokenId}`);
                    pipeline.del(`jwt:${tokenId}`);
                });
                pipeline.del(`family:${tokenFamily}`);
                yield pipeline.exec();
            }
        });
    }
    // Check if token is blacklisted
    isTokenBlacklisted(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenId = this.extractTokenId(token);
            if (!tokenId) {
                return false;
            }
            const result = yield redis_1.redisOperations.exists(`blacklist:${tokenId}`);
            return result === 1;
        });
    }
    // Get token info from cache
    getTokenInfo(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenId = this.extractTokenId(token);
            if (!tokenId) {
                return null;
            }
            const cachedPayload = yield redis_1.redisOperations.get(`jwt:${tokenId}`);
            return cachedPayload ? JSON.parse(cachedPayload) : null;
        });
    }
    // Cleanup expired tokens (maintenance function)
    cleanupExpiredTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Redis automatically removes expired keys, but we can do manual cleanup if needed
                console.log('Token cleanup completed (Redis handles expiration automatically)');
            }
            catch (error) {
                console.error('Failed to cleanup expired tokens:', error);
            }
        });
    }
}
exports.JWTService = JWTService;
// Export singleton instance
exports.jwtService = new JWTService();
