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
const AuthCacheService_1 = require("../redis/AuthCacheService");
const RedisServiceManager_1 = require("../redis/RedisServiceManager");
const config_1 = __importDefault(require("../../config"));
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
class JWTService {
    constructor() {
        this.authCache = new AuthCacheService_1.AuthCacheService(RedisServiceManager_1.redisServiceManager.authClient, RedisServiceManager_1.redisServiceManager.monitoring);
    }
    // Generate token ID from payload
    generateTokenId() {
        return (0, uuid_1.v4)();
    }
    // Generate token family ID
    generateTokenFamily() {
        return crypto_1.default.randomBytes(16).toString('hex');
    }
    // Create access token with caching
    createAccessToken(payload, secret, expiresIn, tokenFamily) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenId = this.generateTokenId();
            const jwtPayload = Object.assign(Object.assign({}, payload), { tokenId, family: tokenFamily, type: 'access' });
            const token = jsonwebtoken_1.default.sign(jwtPayload, secret, { expiresIn: expiresIn });
            // Calculate TTL in seconds
            const decoded = jsonwebtoken_1.default.decode(token);
            const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
            // Cache the token payload
            try {
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.cacheToken(tokenId, jwtPayload, ttl), 'auth');
            }
            catch (error) {
                console.warn('Failed to cache access token:', error);
                // Don't fail token creation if caching fails
            }
            return { token, tokenId };
        });
    }
    // Create refresh token with family tracking
    createRefreshToken(payload, secret, expiresIn, tokenFamily) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenId = this.generateTokenId();
            const jwtPayload = Object.assign(Object.assign({}, payload), { tokenId, family: tokenFamily, type: 'refresh' });
            const token = jsonwebtoken_1.default.sign(jwtPayload, secret, { expiresIn: expiresIn });
            // Calculate TTL in seconds
            const decoded = jsonwebtoken_1.default.decode(token);
            const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400 * 30; // 30 days default
            // Store refresh token with family tracking
            try {
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.storeRefreshToken(tokenFamily, tokenId, payload._id || '', ttl), 'auth');
            }
            catch (error) {
                console.warn('Failed to store refresh token:', error);
                // Don't fail token creation if storage fails
            }
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
            // Generate token ID for cache lookup
            const tokenId = this.extractTokenId(token);
            if (tokenId) {
                // Check if token is blacklisted
                const isBlacklisted = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.isTokenBlacklisted(tokenId), 'auth', () => Promise.resolve(false));
                if (isBlacklisted) {
                    throw new Error('Token has been revoked');
                }
                // Try to get from cache first
                const cachedPayload = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.getTokenPayload(tokenId), 'auth', () => Promise.resolve(null));
                if (cachedPayload) {
                    return cachedPayload;
                }
            }
            // Verify JWT if not in cache
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            // Cache the verified payload if it has a tokenId
            if (decoded.tokenId) {
                const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
                if (ttl > 0) {
                    try {
                        yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.cacheToken(decoded.tokenId, decoded, ttl), 'auth');
                    }
                    catch (error) {
                        console.warn('Failed to cache verified token:', error);
                    }
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
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type for refresh');
            }
            if (!decoded.tokenId || !decoded.family) {
                throw new Error('Invalid refresh token structure');
            }
            // Get refresh token info from cache
            const tokenInfo = yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.getRefreshTokenInfo(decoded.tokenId), 'auth', () => Promise.resolve(null));
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
            try {
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.blacklistToken(decoded.tokenId, 86400), 'auth');
            }
            catch (error) {
                console.warn('Failed to blacklist old refresh token:', error);
            }
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
            yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.blacklistToken(tokenId, Math.max(ttl, 0)), 'auth');
        });
    }
    // Invalidate token family (useful when refresh token is compromised)
    invalidateTokenFamily(tokenFamily) {
        return __awaiter(this, void 0, void 0, function* () {
            yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.invalidateTokenFamily(tokenFamily), 'auth');
        });
    }
    // Batch blacklist tokens (useful for logout from all devices)
    batchBlacklistTokens(tokens) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenIds = tokens
                .map(token => this.extractTokenId(token))
                .filter(id => id !== null);
            if (tokenIds.length === 0) {
                return;
            }
            yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.batchBlacklistTokens(tokenIds, 86400), 'auth');
        });
    }
    // Check if token is blacklisted
    isTokenBlacklisted(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenId = this.extractTokenId(token);
            if (!tokenId) {
                return false;
            }
            return yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.isTokenBlacklisted(tokenId), 'auth', () => Promise.resolve(false));
        });
    }
    // Get token info from cache
    getTokenInfo(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenId = this.extractTokenId(token);
            if (!tokenId) {
                return null;
            }
            return yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.getTokenPayload(tokenId), 'auth', () => Promise.resolve(null));
        });
    }
    // Cleanup expired tokens (maintenance function)
    cleanupExpiredTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield RedisServiceManager_1.redisServiceManager.executeWithCircuitBreaker(() => this.authCache.cleanupExpiredData(), 'auth');
            }
            catch (error) {
                console.error('Failed to cleanup expired tokens:', error);
            }
        });
    }
    // Get JWT statistics
    getJWTStats() {
        return __awaiter(this, void 0, void 0, function* () {
            // This would require additional Redis operations to count keys
            // Implementation depends on your specific monitoring needs
            return {
                activeSessions: 0,
                blacklistedTokens: 0,
                tokenFamilies: 0
            };
        });
    }
}
exports.JWTService = JWTService;
// Export singleton instance
exports.jwtService = new JWTService();
