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
exports.authAuditService = exports.AuthAuditService = void 0;
const logger_1 = require("../../config/logger");
const redis_1 = require("../../config/redis");
class AuthAuditService {
    constructor() {
        this.AUDIT_KEY_PREFIX = 'audit:auth:';
        this.METRICS_KEY = 'metrics:auth';
        this.RETENTION_DAYS = 30;
        this.MAX_EVENTS_PER_DAY = 10000;
    }
    /**
     * Log authentication event with comprehensive details
     */
    logAuthEvent(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const auditEvent = Object.assign(Object.assign({}, event), { eventId: this.generateEventId(), timestamp: new Date() });
            try {
                // Store event in Redis with TTL
                const eventKey = `${this.AUDIT_KEY_PREFIX}${this.getDateKey()}:${auditEvent.eventId}`;
                const ttl = this.RETENTION_DAYS * 24 * 60 * 60; // seconds
                yield redis_1.redisOperations.setex(eventKey, ttl, JSON.stringify(auditEvent));
                // Update metrics
                yield this.updateMetrics(auditEvent);
                // Log to application logger for immediate visibility
                this.logToAppLogger(auditEvent);
                // Check for suspicious patterns
                yield this.checkSuspiciousActivity(auditEvent);
            }
            catch (error) {
                logger_1.Logger.error('Failed to log auth audit event:', error);
                // Fallback to application logger only
                this.logToAppLogger(auditEvent);
            }
        });
    }
    /**
     * Log successful authentication
     */
    logAuthSuccess(userId, email, method, clientInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logAuthEvent({
                eventType: 'auth_success',
                userId,
                email,
                clientId: this.generateClientId(clientInfo.ip, clientInfo.userAgent),
                ipAddress: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                details: {
                    method,
                    endpoint: clientInfo.endpoint
                }
            });
        });
    }
    /**
     * Log authentication failure
     */
    logAuthFailure(email, method, errorType, errorMessage, clientInfo, retryAttempt) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logAuthEvent({
                eventType: 'auth_failure',
                email,
                clientId: this.generateClientId(clientInfo.ip, clientInfo.userAgent),
                ipAddress: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                details: {
                    method,
                    endpoint: clientInfo.endpoint,
                    errorType,
                    errorMessage,
                    retryAttempt
                }
            });
        });
    }
    /**
     * Log token refresh event
     */
    logTokenRefresh(userId, email, method, clientInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logAuthEvent({
                eventType: 'token_refresh',
                userId,
                email,
                clientId: this.generateClientId(clientInfo.ip, clientInfo.userAgent),
                ipAddress: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                details: {
                    method,
                    endpoint: clientInfo.endpoint,
                    tokenRefreshed: true
                }
            });
        });
    }
    /**
     * Log rate limit violation
     */
    logRateLimit(clientInfo, method) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.logAuthEvent({
                eventType: 'rate_limit',
                clientId: this.generateClientId(clientInfo.ip, clientInfo.userAgent),
                ipAddress: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                details: {
                    method,
                    endpoint: clientInfo.endpoint,
                    rateLimitExceeded: true
                }
            });
        });
    }
    /**
     * Get authentication metrics for a specific date range
     */
    getMetrics() {
        return __awaiter(this, arguments, void 0, function* (days = 7) {
            try {
                const metricsKey = `${this.METRICS_KEY}:${this.getDateKey()}`;
                const metricsData = yield redis_1.redisOperations.get(metricsKey);
                if (metricsData) {
                    return JSON.parse(metricsData);
                }
                // Return default metrics if none found
                return {
                    totalAuthAttempts: 0,
                    successfulAuths: 0,
                    failedAuths: 0,
                    tokenRefreshes: 0,
                    rateLimitViolations: 0,
                    suspiciousActivities: 0,
                    uniqueIPs: 0,
                    uniqueUsers: 0
                };
            }
            catch (error) {
                logger_1.Logger.error('Failed to get auth metrics:', error);
                throw error;
            }
        });
    }
    /**
     * Get recent authentication events
     */
    getRecentEvents() {
        return __awaiter(this, arguments, void 0, function* (limit = 100) {
            try {
                const pattern = `${this.AUDIT_KEY_PREFIX}${this.getDateKey()}:*`;
                const keys = yield redis_1.redisOperations.keys(pattern);
                // Get the most recent events
                const recentKeys = keys.slice(-limit);
                const events = [];
                for (const key of recentKeys) {
                    const eventData = yield redis_1.redisOperations.get(key);
                    if (eventData) {
                        events.push(JSON.parse(eventData));
                    }
                }
                return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            }
            catch (error) {
                logger_1.Logger.error('Failed to get recent auth events:', error);
                return [];
            }
        });
    }
    /**
     * Generate unique event ID
     */
    generateEventId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Generate client ID from IP and user agent
     */
    generateClientId(ip, userAgent) {
        const ipPart = (ip === null || ip === void 0 ? void 0 : ip.replace(/\./g, '_')) || 'unknown';
        const uaPart = (userAgent === null || userAgent === void 0 ? void 0 : userAgent.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')) || 'unknown';
        return `${ipPart}_${uaPart}`;
    }
    /**
     * Get date key for organizing events
     */
    getDateKey() {
        return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    }
    /**
     * Update authentication metrics
     */
    updateMetrics(event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const metricsKey = `${this.METRICS_KEY}:${this.getDateKey()}`;
                const currentMetrics = yield this.getMetrics();
                const updatedMetrics = Object.assign(Object.assign({}, currentMetrics), { totalAuthAttempts: currentMetrics.totalAuthAttempts + 1 });
                switch (event.eventType) {
                    case 'auth_success':
                        updatedMetrics.successfulAuths++;
                        break;
                    case 'auth_failure':
                        updatedMetrics.failedAuths++;
                        break;
                    case 'token_refresh':
                        updatedMetrics.tokenRefreshes++;
                        break;
                    case 'rate_limit':
                        updatedMetrics.rateLimitViolations++;
                        break;
                    case 'suspicious_activity':
                        updatedMetrics.suspiciousActivities++;
                        break;
                }
                const ttl = this.RETENTION_DAYS * 24 * 60 * 60;
                yield redis_1.redisOperations.setex(metricsKey, ttl, JSON.stringify(updatedMetrics));
            }
            catch (error) {
                logger_1.Logger.error('Failed to update auth metrics:', error);
            }
        });
    }
    /**
     * Log to application logger for immediate visibility
     */
    logToAppLogger(event) {
        const logData = {
            eventId: event.eventId,
            eventType: event.eventType,
            userId: event.userId,
            email: event.email,
            ip: event.ipAddress,
            method: event.details.method,
            endpoint: event.details.endpoint
        };
        switch (event.eventType) {
            case 'auth_success':
                logger_1.Logger.info('🔐 Authentication successful', logData);
                break;
            case 'auth_failure':
                logger_1.Logger.warn('🚫 Authentication failed', Object.assign(Object.assign({}, logData), { error: event.details.errorMessage }));
                break;
            case 'token_refresh':
                logger_1.Logger.info('🔄 Token refreshed', logData);
                break;
            case 'rate_limit':
                logger_1.Logger.warn('⚠️ Rate limit exceeded', logData);
                break;
            case 'suspicious_activity':
                logger_1.Logger.error('🚨 Suspicious activity detected', Object.assign(Object.assign({}, logData), { reason: event.details.suspiciousReason }));
                break;
            default:
                logger_1.Logger.info('🔍 Auth event', logData);
        }
    }
    /**
     * Check for suspicious activity patterns
     */
    checkSuspiciousActivity(event) {
        return __awaiter(this, void 0, void 0, function* () {
            // This is a placeholder for more sophisticated suspicious activity detection
            // In a real implementation, you might check for:
            // - Multiple failed attempts from same IP
            // - Unusual geographic patterns
            // - Rapid succession of requests
            // - Known malicious user agents
            if (event.eventType === 'auth_failure' && event.details.retryAttempt && event.details.retryAttempt > 5) {
                yield this.logAuthEvent({
                    eventType: 'suspicious_activity',
                    clientId: event.clientId,
                    ipAddress: event.ipAddress,
                    userAgent: event.userAgent,
                    details: {
                        method: event.details.method,
                        suspiciousReason: 'Multiple consecutive authentication failures',
                        retryAttempt: event.details.retryAttempt
                    }
                });
            }
        });
    }
}
exports.AuthAuditService = AuthAuditService;
// Export singleton instance
exports.authAuditService = new AuthAuditService();
