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
exports.optimizedRedisService = exports.OptimizedRedisService = void 0;
const ioredis_1 = require("ioredis");
const config_1 = __importDefault(require("../../config"));
const RedisOptimizationService_1 = require("./RedisOptimizationService");
const SmartCacheService_1 = require("../cache/SmartCacheService");
const FeatureToggleService_1 = require("./FeatureToggleService");
class OptimizedRedisService {
    constructor() {
        this.connectionCount = 0;
        this.maxConnections = 2; // Limit to 2 connections total (primary + jobs)
        console.log('🔧 Initializing Optimized Redis Service...');
        // Single optimized Redis configuration
        const redisConfig = {
            host: config_1.default.redis.host,
            port: config_1.default.redis.port,
            password: config_1.default.redis.password,
            family: 4,
            keepAlive: 60000, // 60 seconds keep alive
            connectTimeout: 15000,
            commandTimeout: 10000,
            retryDelayOnFailover: 500,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 2, // Reduced retries
            lazyConnect: true,
            tls: config_1.default.redis.host.includes('upstash.io') ? {} : undefined,
            // Connection pooling
            enableReadyCheck: true,
            maxLoadingTimeout: 5000,
        };
        // Primary client (connection 1)
        this.primaryClient = new ioredis_1.Redis(redisConfig);
        this.connectionCount++;
        // Jobs client (connection 2) - Required for BullMQ
        this.jobsClient = new ioredis_1.Redis(Object.assign(Object.assign({}, redisConfig), { maxRetriesPerRequest: null, keyPrefix: 'jobs:' }));
        this.connectionCount++;
        // Create prefixed clients using the same primary connection
        this.authClient = this.createPrefixedClient('auth:');
        this.cacheClient = this.createPrefixedClient('cache:');
        this.sessionsClient = this.createPrefixedClient('sessions:');
        this.setupEventHandlers();
        this.setupOptimizations();
        console.log(`✅ Optimized Redis Service initialized with ${this.connectionCount} connections`);
    }
    static getInstance() {
        if (!OptimizedRedisService.instance) {
            OptimizedRedisService.instance = new OptimizedRedisService();
        }
        return OptimizedRedisService.instance;
    }
    createPrefixedClient(prefix) {
        const client = this.primaryClient;
        return {
            get(key) {
                return __awaiter(this, void 0, void 0, function* () {
                    return RedisOptimizationService_1.redisOptimizationService.optimizedGet(prefix + key);
                });
            },
            set(key, value) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield RedisOptimizationService_1.redisOptimizationService.optimizedSet(prefix + key, value);
                    return 'OK';
                });
            },
            setex(key, seconds, value) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield RedisOptimizationService_1.redisOptimizationService.optimizedSet(prefix + key, value, seconds);
                    return 'OK';
                });
            },
            del(key) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.del(prefix + key);
                });
            },
            exists(key) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.exists(prefix + key);
                });
            },
            expire(key, seconds) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.expire(prefix + key, seconds);
                });
            },
            ttl(key) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.ttl(prefix + key);
                });
            },
            incr(key) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.incr(prefix + key);
                });
            },
            decr(key) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.decr(prefix + key);
                });
            },
            incrby(key, increment) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.incrby(prefix + key, increment);
                });
            },
            decrby(key, decrement) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.decrby(prefix + key, decrement);
                });
            },
            sadd(key, ...members) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.sadd(prefix + key, ...members);
                });
            },
            srem(key, ...members) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.srem(prefix + key, ...members);
                });
            },
            smembers(key) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.smembers(prefix + key);
                });
            },
            lpush(key, ...values) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.lpush(prefix + key, ...values);
                });
            },
            rpush(key, ...values) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.rpush(prefix + key, ...values);
                });
            },
            lpop(key) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.lpop(prefix + key);
                });
            },
            rpop(key) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.rpop(prefix + key);
                });
            },
            llen(key) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.llen(prefix + key);
                });
            },
            ltrim(key, start, stop) {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.ltrim(prefix + key, start, stop);
                });
            },
            pipeline() {
                // For now, return the basic pipeline without proxy
                // The prefix will need to be added manually when using pipeline
                return client.pipeline();
            },
            ping() {
                return __awaiter(this, void 0, void 0, function* () {
                    return client.ping();
                });
            }
        };
    }
    setupEventHandlers() {
        this.primaryClient.on('connect', () => {
            console.log('✅ Primary Redis client connected');
        });
        this.primaryClient.on('ready', () => {
            console.log('✅ Primary Redis client ready');
        });
        this.primaryClient.on('error', (error) => {
            console.error('❌ Primary Redis client error:', error);
            // Auto-optimize on connection errors
            if (error.message.includes('timeout') || error.message.includes('connection')) {
                this.handleConnectionError();
            }
        });
        this.jobsClient.on('connect', () => {
            console.log('✅ Jobs Redis client connected');
        });
        this.jobsClient.on('error', (error) => {
            console.error('❌ Jobs Redis client error:', error);
        });
    }
    setupOptimizations() {
        // DISABLED: Excessive Redis monitoring causing 121K+ ops/min
        // Only enable basic health check with very long intervals
        console.log('📵 Redis auto-optimization disabled to reduce Redis operations');
        // Optional: Basic health check every 10 minutes (instead of every minute)
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                // Just a simple ping to check connectivity - no memory info calls
                yield this.primaryClient.ping();
                console.log('✅ Redis basic connectivity check passed');
            }
            catch (error) {
                console.error('❌ Redis connectivity check failed:', error);
            }
        }), 600000); // Check every 10 minutes instead of 1 minute
    }
    handleConnectionError() {
        console.log('🔧 Handling Redis connection error with optimization');
        // Enable conservative mode
        FeatureToggleService_1.featureToggleService.setOptimizationMode('conservative');
        // Clear non-critical caches
        SmartCacheService_1.smartCacheService.clearL1();
    }
    enableAggressiveOptimization() {
        return __awaiter(this, void 0, void 0, function* () {
            // Enable aggressive mode
            FeatureToggleService_1.featureToggleService.setOptimizationMode('aggressive');
            // Clear L1 cache to free memory
            SmartCacheService_1.smartCacheService.clearL1();
            // Update optimization config for more aggressive settings
            RedisOptimizationService_1.redisOptimizationService.updateConfig({
                batchSize: 100, // Larger batches
                batchTimeout: 50, // Faster batching
                enableCompression: true,
                compressionThreshold: 512 // Compress smaller values
            });
        });
    }
    // Health check
    healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [primaryPing, jobsPing] = yield Promise.allSettled([
                    this.primaryClient.ping(),
                    this.jobsClient.ping()
                ]);
                const primaryHealthy = primaryPing.status === 'fulfilled';
                const jobsHealthy = jobsPing.status === 'fulfilled';
                let status;
                if (primaryHealthy && jobsHealthy) {
                    status = 'healthy';
                }
                else if (primaryHealthy) {
                    status = 'degraded'; // Primary is healthy, jobs might be down
                }
                else {
                    status = 'unhealthy';
                }
                return {
                    status,
                    connections: this.connectionCount,
                    maxConnections: this.maxConnections,
                    primaryClient: primaryHealthy,
                    jobsClient: jobsHealthy
                };
            }
            catch (error) {
                return {
                    status: 'unhealthy',
                    connections: this.connectionCount,
                    maxConnections: this.maxConnections,
                    primaryClient: false,
                    jobsClient: false
                };
            }
        });
    }
    // Get the primary client for direct access when needed
    getPrimaryClient() {
        return this.primaryClient;
    }
    // Graceful shutdown
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Shutting down Optimized Redis Service...');
            try {
                yield Promise.all([
                    this.primaryClient.disconnect(),
                    this.jobsClient.disconnect()
                ]);
                console.log('✅ Optimized Redis Service shutdown complete');
            }
            catch (error) {
                console.error('❌ Error during Redis shutdown:', error);
            }
        });
    }
}
exports.OptimizedRedisService = OptimizedRedisService;
exports.optimizedRedisService = OptimizedRedisService.getInstance();
