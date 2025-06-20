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
exports.cacheService = exports.redisMonitoring = exports.redisSessions = exports.redisJobs = exports.redisCache = exports.redisAuth = exports.redis = exports.redisServiceManager = exports.RedisServiceManager = void 0;
const ioredis_1 = require("ioredis");
const CacheService_1 = require("./CacheService");
const MonitoringService_1 = require("./MonitoringService");
const CircuitBreakerService_1 = require("./CircuitBreakerService");
const config_1 = __importDefault(require("../../config"));
class RedisServiceManager {
    constructor() {
        // Redis connection configuration
        const redisConfig = {
            host: config_1.default.redis.host,
            port: config_1.default.redis.port,
            password: config_1.default.redis.password,
            family: 4,
            keepAlive: 30000, // Keep alive timeout in milliseconds
            connectTimeout: 10000,
            commandTimeout: 5000,
            retryDelayOnFailover: 100,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 3,
            tls: config_1.default.redis.host.includes('upstash.io') ? {} : undefined,
        };
        // Upstash-optimized Redis configuration with graceful degradation
        const upstashConfig = Object.assign(Object.assign({}, redisConfig), { db: 0, enableOfflineQueue: false, maxRetriesPerRequest: 3, retryDelayOnFailover: 1000, commandTimeout: 5000, lazyConnect: true, maxListeners: 20, 
            // Add connection retry configuration
            retryDelayOnClusterDown: 1000, enableReadyCheck: true, 
            // Limit connection attempts
            connectTimeout: 5000, 
            // Add reconnection settings with limits
            reconnectOnError: (err) => {
                // Only reconnect for specific errors, not DNS/network issues
                const reconnectableErrors = ['READONLY', 'LOADING', 'MASTERDOWN'];
                return reconnectableErrors.some(error => err.message.includes(error));
            } });
        // Initialize Redis clients (all using db: 0 for Upstash compatibility)
        // We'll use key prefixes to separate different data types
        this.primaryClient = new ioredis_1.Redis(upstashConfig);
        this.authClient = new ioredis_1.Redis(Object.assign(Object.assign({}, upstashConfig), { keyPrefix: 'auth:' }));
        this.cacheClient = new ioredis_1.Redis(Object.assign(Object.assign({}, upstashConfig), { keyPrefix: 'cache:' }));
        // BullMQ configuration for Upstash
        this.jobsClient = new ioredis_1.Redis(Object.assign(Object.assign({}, upstashConfig), { maxRetriesPerRequest: null, keyPrefix: undefined // BullMQ handles its own prefixing
         }));
        this.sessionsClient = new ioredis_1.Redis(Object.assign(Object.assign({}, upstashConfig), { keyPrefix: 'sessions:' }));
        // Set max listeners to prevent memory leak warnings
        [this.primaryClient, this.authClient, this.cacheClient, this.jobsClient, this.sessionsClient]
            .forEach(client => client.setMaxListeners(20));
        // Setup event handlers
        this.setupEventHandlers();
        // Initialize monitoring
        this.monitoring = new MonitoringService_1.RedisMonitoringService(this.primaryClient);
        // Initialize cache service
        this.cache = new CacheService_1.CacheService(this.cacheClient, this.monitoring);
        // Initialize circuit breakers
        this.authCircuitBreaker = CircuitBreakerService_1.CircuitBreakerFactory.getCircuitBreaker('redis-auth', {
            failureThreshold: 3,
            recoveryTimeout: 30000,
            expectedErrorRate: 0.3
        });
        this.cacheCircuitBreaker = CircuitBreakerService_1.CircuitBreakerFactory.getCircuitBreaker('redis-cache', {
            failureThreshold: 5,
            recoveryTimeout: 60000,
            expectedErrorRate: 0.2
        });
        this.jobsCircuitBreaker = CircuitBreakerService_1.CircuitBreakerFactory.getCircuitBreaker('redis-jobs', {
            failureThreshold: 3,
            recoveryTimeout: 45000,
            expectedErrorRate: 0.1
        });
        this.sessionsCircuitBreaker = CircuitBreakerService_1.CircuitBreakerFactory.getCircuitBreaker('redis-sessions', {
            failureThreshold: 4,
            recoveryTimeout: 30000,
            expectedErrorRate: 0.25
        });
    }
    static getInstance() {
        if (!RedisServiceManager.instance) {
            RedisServiceManager.instance = new RedisServiceManager();
        }
        return RedisServiceManager.instance;
    }
    setupEventHandlers() {
        const clients = [
            { client: this.primaryClient, name: 'primary' },
            { client: this.authClient, name: 'auth' },
            { client: this.cacheClient, name: 'cache' },
            { client: this.jobsClient, name: 'jobs' },
            { client: this.sessionsClient, name: 'sessions' }
        ];
        clients.forEach(({ client, name }) => {
            client.on('connect', () => {
                console.log(`✅ Redis ${name} client connected successfully`);
            });
            client.on('ready', () => {
                console.log(`✅ Redis ${name} client is ready to accept commands`);
            });
            client.on('error', (error) => {
                var _a;
                console.error(`❌ Redis ${name} client error:`, error);
                // Handle specific timeout errors
                if (error.message.includes('Command timed out')) {
                    console.log(`⏸️ Redis ${name} client experiencing timeouts - implementing backoff`);
                    // The client will automatically retry with exponential backoff
                }
                // Record the error for monitoring
                (_a = this.monitoring) === null || _a === void 0 ? void 0 : _a.recordOperation('connection_error', 0, false);
            });
            client.on('close', () => {
                console.log(`⚠️ Redis ${name} client connection closed`);
            });
            client.on('reconnecting', () => {
                console.log(`🔄 Redis ${name} client reconnecting...`);
            });
        });
    }
    // Health check for all Redis clients
    healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            const clients = {
                primary: yield this.isClientHealthy(this.primaryClient),
                auth: yield this.isClientHealthy(this.authClient),
                cache: yield this.isClientHealthy(this.cacheClient),
                jobs: yield this.isClientHealthy(this.jobsClient),
                sessions: yield this.isClientHealthy(this.sessionsClient)
            };
            const healthyCount = Object.values(clients).filter(Boolean).length;
            const totalCount = Object.keys(clients).length;
            let overall;
            if (healthyCount === totalCount) {
                overall = 'healthy';
            }
            else if (healthyCount >= totalCount * 0.6) {
                overall = 'degraded';
            }
            else {
                overall = 'unhealthy';
            }
            const monitoringHealth = yield this.monitoring.healthCheck();
            const circuitBreakerStatus = CircuitBreakerService_1.CircuitBreakerFactory.getHealthStatus();
            return {
                overall,
                clients,
                monitoring: monitoringHealth,
                circuitBreakers: circuitBreakerStatus
            };
        });
    }
    isClientHealthy(client) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client.ping();
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    // Graceful shutdown
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Shutting down Redis service manager...');
            const clients = [
                this.primaryClient,
                this.authClient,
                this.cacheClient,
                this.jobsClient,
                this.sessionsClient
            ];
            yield Promise.all(clients.map((client) => __awaiter(this, void 0, void 0, function* () {
                try {
                    client.disconnect();
                }
                catch (error) {
                    console.error('Error disconnecting Redis client:', error);
                }
            })));
            console.log('✅ Redis service manager shutdown complete');
        });
    }
    // Get performance metrics
    getPerformanceMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.monitoring.getPerformanceReport();
        });
    }
    // Execute operation with circuit breaker protection
    executeWithCircuitBreaker(operation, circuitBreakerName, fallback) {
        return __awaiter(this, void 0, void 0, function* () {
            const circuitBreaker = this.getCircuitBreaker(circuitBreakerName);
            return circuitBreaker.execute(operation, fallback);
        });
    }
    getCircuitBreaker(name) {
        switch (name) {
            case 'auth':
                return this.authCircuitBreaker;
            case 'cache':
                return this.cacheCircuitBreaker;
            case 'jobs':
                return this.jobsCircuitBreaker;
            case 'sessions':
                return this.sessionsCircuitBreaker;
            default:
                throw new Error(`Unknown circuit breaker: ${name}`);
        }
    }
    // Test Redis connection
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            try {
                yield this.primaryClient.ping();
                return {
                    success: true,
                    latency: Date.now() - start
                };
            }
            catch (error) {
                return {
                    success: false,
                    latency: Date.now() - start,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    // Get Redis info
    getRedisInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [serverInfo, memoryInfo, statsInfo, clientsInfo] = yield Promise.all([
                    this.primaryClient.info('server'),
                    this.primaryClient.info('memory'),
                    this.primaryClient.info('stats'),
                    this.primaryClient.info('clients')
                ]);
                return {
                    version: this.parseInfoValue(serverInfo, 'redis_version'),
                    memory: this.parseMemoryInfo(memoryInfo),
                    stats: this.parseStatsInfo(statsInfo),
                    clients: this.parseClientsInfo(clientsInfo)
                };
            }
            catch (error) {
                console.error('Error getting Redis info:', error);
                throw error;
            }
        });
    }
    parseInfoValue(info, key) {
        const lines = info.split('\r\n');
        const line = lines.find(l => l.startsWith(`${key}:`));
        return line ? line.split(':')[1] : 'unknown';
    }
    parseMemoryInfo(info) {
        const lines = info.split('\r\n');
        const memory = {};
        lines.forEach(line => {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                if (key.startsWith('used_memory') || key.startsWith('maxmemory')) {
                    memory[key] = parseInt(value) || 0;
                }
            }
        });
        return memory;
    }
    parseStatsInfo(info) {
        const lines = info.split('\r\n');
        const stats = {};
        lines.forEach(line => {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                if (key.includes('keyspace') || key.includes('commands') || key.includes('connections')) {
                    stats[key] = parseInt(value) || 0;
                }
            }
        });
        return stats;
    }
    parseClientsInfo(info) {
        const lines = info.split('\r\n');
        const clients = {};
        lines.forEach(line => {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                if (key.includes('connected') || key.includes('blocked')) {
                    clients[key] = parseInt(value) || 0;
                }
            }
        });
        return clients;
    }
    // Initialize method for compatibility
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            // This method is for compatibility with existing code
            // The actual initialization happens in the constructor
            console.log('✅ RedisServiceManager initialized');
        });
    }
    // Optimize connections method
    optimizeConnections() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Reconnect clients if needed
                const clients = [
                    this.primaryClient,
                    this.authClient,
                    this.cacheClient,
                    this.jobsClient,
                    this.sessionsClient
                ];
                for (const client of clients) {
                    if (client.status !== 'ready') {
                        yield client.connect();
                    }
                }
                console.log('🔧 Redis connections optimized');
            }
            catch (error) {
                console.error('❌ Error optimizing Redis connections:', error);
            }
        });
    }
}
exports.RedisServiceManager = RedisServiceManager;
// Export singleton instance
exports.redisServiceManager = RedisServiceManager.getInstance();
// Export individual services for convenience
exports.redis = exports.redisServiceManager.primaryClient, exports.redisAuth = exports.redisServiceManager.authClient, exports.redisCache = exports.redisServiceManager.cacheClient, exports.redisJobs = exports.redisServiceManager.jobsClient, exports.redisSessions = exports.redisServiceManager.sessionsClient, exports.redisMonitoring = exports.redisServiceManager.monitoring, exports.cacheService = exports.redisServiceManager.cache;
