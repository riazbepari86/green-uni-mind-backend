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
exports.BaseRedisService = void 0;
const interfaces_1 = require("./interfaces");
class BaseRedisService {
    constructor(client, monitoring) {
        this.client = client;
        this.monitoring = monitoring;
        this.setupErrorHandling();
    }
    setupErrorHandling() {
        this.client.on('error', (error) => {
            var _a;
            console.error(`Redis error in ${this.constructor.name}:`, error);
            (_a = this.monitoring) === null || _a === void 0 ? void 0 : _a.recordOperation('connection_error', 0, false);
        });
    }
    isHealthy() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const start = Date.now();
                yield this.client.ping();
                const duration = Date.now() - start;
                (_a = this.monitoring) === null || _a === void 0 ? void 0 : _a.recordOperation('health_check', duration, true);
                return true;
            }
            catch (error) {
                (_b = this.monitoring) === null || _b === void 0 ? void 0 : _b.recordOperation('health_check', 0, false);
                return false;
            }
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.client.disconnect();
            }
            catch (error) {
                console.error(`Error disconnecting Redis client in ${this.constructor.name}:`, error);
            }
        });
    }
    executeWithMonitoring(operation, fn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const start = Date.now();
            try {
                const result = yield fn();
                const duration = Date.now() - start;
                (_a = this.monitoring) === null || _a === void 0 ? void 0 : _a.recordOperation(operation, duration, true);
                return result;
            }
            catch (error) {
                const duration = Date.now() - start;
                (_b = this.monitoring) === null || _b === void 0 ? void 0 : _b.recordOperation(operation, duration, false);
                throw new interfaces_1.RedisServiceError(`Redis operation '${operation}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`, operation, error instanceof Error ? error : undefined);
            }
        });
    }
    safeExecute(operation, fallback, errorMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield operation();
            }
            catch (error) {
                console.error(errorMessage || 'Redis operation failed:', error);
                return fallback;
            }
        });
    }
    serializeValue(value) {
        if (typeof value === 'string') {
            return value;
        }
        return JSON.stringify(value);
    }
    deserializeValue(value) {
        if (value === null) {
            return null;
        }
        try {
            return JSON.parse(value);
        }
        catch (_a) {
            // If parsing fails, return as string (for backward compatibility)
            return value;
        }
    }
    generateKey(prefix, ...parts) {
        return [prefix, ...parts].join(':');
    }
    getMultipleKeys(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keys.length === 0) {
                return [];
            }
            return this.executeWithMonitoring('mget', () => __awaiter(this, void 0, void 0, function* () {
                const values = yield this.client.mget(...keys);
                return values.map(value => this.deserializeValue(value));
            }));
        });
    }
    setMultipleKeys(keyValuePairs, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = Object.keys(keyValuePairs);
            if (keys.length === 0) {
                return;
            }
            return this.executeWithMonitoring('mset', () => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.client.pipeline();
                for (const [key, value] of Object.entries(keyValuePairs)) {
                    const serializedValue = this.serializeValue(value);
                    if (ttlSeconds) {
                        pipeline.setex(key, ttlSeconds, serializedValue);
                    }
                    else {
                        pipeline.set(key, serializedValue);
                    }
                }
                yield pipeline.exec();
            }));
        });
    }
    deletePattern(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('delete_pattern', () => __awaiter(this, void 0, void 0, function* () {
                const keys = yield this.client.keys(pattern);
                if (keys.length === 0) {
                    return 0;
                }
                return yield this.client.del(...keys);
            }));
        });
    }
    existsMultiple(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (keys.length === 0) {
                return [];
            }
            return this.executeWithMonitoring('exists_multiple', () => __awaiter(this, void 0, void 0, function* () {
                const pipeline = this.client.pipeline();
                keys.forEach(key => pipeline.exists(key));
                const results = yield pipeline.exec();
                return (results === null || results === void 0 ? void 0 : results.map(result => result[1] === 1)) || [];
            }));
        });
    }
    incrementCounter(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, increment = 1) {
            return this.executeWithMonitoring('increment', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.incrby(key, increment);
            }));
        });
    }
    decrementCounter(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, decrement = 1) {
            return this.executeWithMonitoring('decrement', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.decrby(key, decrement);
            }));
        });
    }
    addToSet(key, ...members) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('sadd', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.sadd(key, ...members);
            }));
        });
    }
    removeFromSet(key, ...members) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('srem', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.srem(key, ...members);
            }));
        });
    }
    getSetMembers(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('smembers', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.smembers(key);
            }));
        });
    }
    isSetMember(key, member) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('sismember', () => __awaiter(this, void 0, void 0, function* () {
                const result = yield this.client.sismember(key, member);
                return result === 1;
            }));
        });
    }
    addToSortedSet(key, score, member) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('zadd', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.zadd(key, score, member);
            }));
        });
    }
    getSortedSetRange(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, start = 0, stop = -1, withScores = false) {
            return this.executeWithMonitoring('zrange', () => __awaiter(this, void 0, void 0, function* () {
                if (withScores) {
                    return yield this.client.zrange(key, start, stop, 'WITHSCORES');
                }
                return yield this.client.zrange(key, start, stop);
            }));
        });
    }
    removeFromSortedSet(key, ...members) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('zrem', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.zrem(key, ...members);
            }));
        });
    }
    pushToList(key, ...values) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('lpush', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.lpush(key, ...values);
            }));
        });
    }
    popFromList(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('lpop', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.lpop(key);
            }));
        });
    }
    getListRange(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, start = 0, stop = -1) {
            return this.executeWithMonitoring('lrange', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.lrange(key, start, stop);
            }));
        });
    }
    trimList(key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('ltrim', () => __awaiter(this, void 0, void 0, function* () {
                yield this.client.ltrim(key, start, stop);
            }));
        });
    }
    setHashField(key, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('hset', () => __awaiter(this, void 0, void 0, function* () {
                yield this.client.hset(key, field, value);
            }));
        });
    }
    getHashField(key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('hget', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.hget(key, field);
            }));
        });
    }
    getAllHashFields(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('hgetall', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.hgetall(key);
            }));
        });
    }
    deleteHashField(key, ...fields) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('hdel', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.hdel(key, ...fields);
            }));
        });
    }
    setExpiration(key, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('expire', () => __awaiter(this, void 0, void 0, function* () {
                const result = yield this.client.expire(key, ttlSeconds);
                return result === 1;
            }));
        });
    }
    getTTL(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeWithMonitoring('ttl', () => __awaiter(this, void 0, void 0, function* () {
                return yield this.client.ttl(key);
            }));
        });
    }
}
exports.BaseRedisService = BaseRedisService;
