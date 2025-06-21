"use strict";
/**
 * Optimized Redis Configuration
 * Implements lazy loading, connection pooling, and startup optimization
 */
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
exports.isRedisHealthy = exports.getPrimaryRedis = exports.getRedisConnection = exports.optimizedRedisConfig = exports.OptimizedRedisConfig = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const index_1 = __importDefault(require("./index"));
/**
 * Optimized Redis Configuration Manager
 */
class OptimizedRedisConfig {
    constructor() {
        this.isInitialized = false;
        this.initializationPromise = null;
        this.connectionPool = {
            primary: null,
            cache: null,
            sessions: null,
            jobs: null,
        };
        this.metrics = {
            connections: 0,
            operations: 0,
            errors: 0,
            lastActivity: Date.now(),
        };
    }
    static getInstance() {
        if (!OptimizedRedisConfig.instance) {
            OptimizedRedisConfig.instance = new OptimizedRedisConfig();
        }
        return OptimizedRedisConfig.instance;
    }
    /**
     * Initialize Redis connections lazily
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isInitialized) {
                return;
            }
            if (this.initializationPromise) {
                return this.initializationPromise;
            }
            this.initializationPromise = this.performInitialization();
            return this.initializationPromise;
        });
    }
    /**
     * Perform actual Redis initialization
     */
    performInitialization() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('🔧 Initializing optimized Redis configuration...');
                // Create base Redis configuration
                const baseConfig = this.createBaseConfig();
                // Initialize primary connection first (most important)
                this.connectionPool.primary = yield this.createConnection('primary', baseConfig);
                // Initialize other connections only if needed
                if (process.env.ENABLE_REDIS_CACHE !== 'false') {
                    this.connectionPool.cache = yield this.createConnection('cache', Object.assign(Object.assign({}, baseConfig), { keyPrefix: 'cache:' }));
                }
                if (process.env.ENABLE_REDIS_SESSIONS !== 'false') {
                    this.connectionPool.sessions = yield this.createConnection('sessions', Object.assign(Object.assign({}, baseConfig), { keyPrefix: 'sessions:' }));
                }
                // Jobs connection only in production or when explicitly enabled
                if (process.env.NODE_ENV === 'production' || process.env.ENABLE_REDIS_JOBS === 'true') {
                    this.connectionPool.jobs = yield this.createConnection('jobs', Object.assign(Object.assign({}, baseConfig), { maxRetriesPerRequest: null, keyPrefix: undefined }));
                }
                this.isInitialized = true;
                console.log(`✅ Redis initialized with ${this.getActiveConnectionCount()} connections`);
            }
            catch (error) {
                console.error('❌ Redis initialization failed:', error);
                throw error;
            }
        });
    }
    /**
     * Create base Redis configuration
     */
    createBaseConfig() {
        return {
            host: index_1.default.redis.host || 'localhost',
            port: index_1.default.redis.port || 6379,
            password: index_1.default.redis.password || '',
            family: 4,
            connectTimeout: 5000, // Reduced from 10000
            commandTimeout: 3000, // Reduced from 5000
            retryDelayOnFailover: 100,
            enableOfflineQueue: true, // Enable offline queue to prevent errors
            maxRetriesPerRequest: 2, // Reduced from 3
            lazyConnect: true,
            keepAlive: 30000,
            tls: index_1.default.redis.host && index_1.default.redis.host.includes('upstash.io') ? {} : undefined,
        };
    }
    /**
     * Create a Redis connection with error handling
     */
    createConnection(name, connectionConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            const redis = new ioredis_1.default(connectionConfig);
            // Set up event handlers
            redis.on('connect', () => {
                this.metrics.connections++;
                console.log(`✅ Redis ${name} connection established`);
            });
            redis.on('error', (error) => {
                this.metrics.errors++;
                console.error(`❌ Redis ${name} connection error:`, error);
            });
            redis.on('close', () => {
                this.metrics.connections--;
                console.log(`⚠️ Redis ${name} connection closed`);
            });
            // Test connection with timeout
            try {
                yield Promise.race([
                    redis.ping(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 3000))
                ]);
                console.log(`✅ Redis ${name} connection tested successfully`);
                return redis;
            }
            catch (error) {
                console.error(`❌ Redis ${name} connection test failed:`, error);
                redis.disconnect();
                throw error;
            }
        });
    }
    /**
     * Get Redis connection by type
     */
    getConnection(type) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isInitialized) {
                yield this.initialize();
            }
            const connection = this.connectionPool[type];
            if (connection) {
                this.metrics.operations++;
                this.metrics.lastActivity = Date.now();
            }
            return connection;
        });
    }
    /**
     * Get primary Redis connection (most commonly used)
     */
    getPrimaryConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getConnection('primary');
        });
    }
    /**
     * Check if Redis is healthy
     */
    isHealthy() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const primary = yield this.getPrimaryConnection();
                if (!primary)
                    return false;
                yield Promise.race([
                    primary.ping(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 1000))
                ]);
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
    /**
     * Get connection metrics
     */
    getMetrics() {
        return Object.assign({}, this.metrics);
    }
    /**
     * Get active connection count
     */
    getActiveConnectionCount() {
        return Object.values(this.connectionPool).filter(conn => conn !== null).length;
    }
    /**
     * Cleanup connections
     */
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🧹 Cleaning up Redis connections...');
            const connections = Object.values(this.connectionPool).filter(conn => conn !== null);
            yield Promise.allSettled(connections.map(conn => conn === null || conn === void 0 ? void 0 : conn.disconnect()));
            this.connectionPool = {
                primary: null,
                cache: null,
                sessions: null,
                jobs: null,
            };
            this.isInitialized = false;
            this.initializationPromise = null;
            console.log('✅ Redis connections cleaned up');
        });
    }
    /**
     * Get connection status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            connections: {
                primary: this.connectionPool.primary !== null,
                cache: this.connectionPool.cache !== null,
                sessions: this.connectionPool.sessions !== null,
                jobs: this.connectionPool.jobs !== null,
            },
            metrics: this.getMetrics(),
        };
    }
}
exports.OptimizedRedisConfig = OptimizedRedisConfig;
// Export singleton instance
exports.optimizedRedisConfig = OptimizedRedisConfig.getInstance();
// Convenience functions
const getRedisConnection = (type) => exports.optimizedRedisConfig.getConnection(type);
exports.getRedisConnection = getRedisConnection;
const getPrimaryRedis = () => exports.optimizedRedisConfig.getPrimaryConnection();
exports.getPrimaryRedis = getPrimaryRedis;
const isRedisHealthy = () => exports.optimizedRedisConfig.isHealthy();
exports.isRedisHealthy = isRedisHealthy;
