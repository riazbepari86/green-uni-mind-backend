"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugOnly = exports.specializedLog = exports.migrationConsole = exports.conditionalLog = exports.safeConsole = void 0;
const logger_1 = require("../config/logger");
const environment_1 = require("./environment");
/**
 * Production-safe console replacement utilities
 * These functions provide a bridge between existing console statements and Winston logger
 * while ensuring no sensitive data leaks in production
 */
/**
 * Safe console replacement that respects environment
 */
exports.safeConsole = {
    /**
     * Log general information - only in development
     */
    log: (...args) => {
        if (environment_1.Environment.isDevelopment()) {
            logger_1.Logger.info(formatConsoleArgs(args));
        }
    },
    /**
     * Log errors - always logged but sanitized in production
     */
    error: (...args) => {
        logger_1.Logger.error(formatConsoleArgs(args));
    },
    /**
     * Log warnings - always logged but sanitized in production
     */
    warn: (...args) => {
        logger_1.Logger.warn(formatConsoleArgs(args));
    },
    /**
     * Debug information - only in development
     */
    debug: (...args) => {
        if (environment_1.Environment.isDevelopment()) {
            logger_1.Logger.debug(formatConsoleArgs(args));
        }
    },
    /**
     * Info logging - respects environment
     */
    info: (...args) => {
        logger_1.Logger.info(formatConsoleArgs(args));
    },
};
/**
 * Conditional logging utilities
 */
exports.conditionalLog = {
    /**
     * Only log in development environment
     */
    dev: (...args) => {
        if (environment_1.Environment.isDevelopment()) {
            logger_1.Logger.debug(`[DEV] ${formatConsoleArgs(args)}`);
        }
    },
    /**
     * Only log in production environment
     */
    prod: (...args) => {
        if (environment_1.Environment.isProduction()) {
            logger_1.Logger.info(`[PROD] ${formatConsoleArgs(args)}`);
        }
    },
    /**
     * Log performance metrics
     */
    perf: (operation, startTime, meta) => {
        const duration = Date.now() - startTime;
        logger_1.Logger.performance(operation, duration, meta);
    },
    /**
     * Log security events
     */
    security: (event, details) => {
        logger_1.Logger.security(event, details);
    },
    /**
     * Log API requests/responses safely
     */
    api: (method, url, statusCode, duration) => {
        logger_1.Logger.api(method, url, statusCode, duration);
    },
    /**
     * Log database operations
     */
    db: (operation, meta) => {
        logger_1.Logger.database(operation, meta);
    },
};
/**
 * Format console arguments into a readable string
 */
function formatConsoleArgs(args) {
    return args
        .map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            }
            catch (error) {
                return '[Circular Object]';
            }
        }
        return String(arg);
    })
        .join(' ');
}
/**
 * Migration helper - gradually replace console statements
 * This allows for incremental migration of existing console statements
 */
exports.migrationConsole = {
    /**
     * Temporary bridge for console.log statements during migration
     * TODO: Replace with appropriate Logger calls
     */
    log: (...args) => {
        if (environment_1.Environment.isDevelopment()) {
            // In development, show migration warning
            logger_1.Logger.warn(`[MIGRATION] console.log usage detected: ${formatConsoleArgs(args)}`);
        }
        // Don't log in production to prevent information leakage
    },
    /**
     * Temporary bridge for console.error statements during migration
     */
    error: (...args) => {
        logger_1.Logger.error(`[MIGRATION] ${formatConsoleArgs(args)}`);
    },
    /**
     * Temporary bridge for console.warn statements during migration
     */
    warn: (...args) => {
        logger_1.Logger.warn(`[MIGRATION] ${formatConsoleArgs(args)}`);
    },
    /**
     * Temporary bridge for console.debug statements during migration
     */
    debug: (...args) => {
        if (environment_1.Environment.isDevelopment()) {
            logger_1.Logger.debug(`[MIGRATION] ${formatConsoleArgs(args)}`);
        }
    },
};
/**
 * Specialized logging for different application areas
 */
exports.specializedLog = {
    /**
     * Authentication and authorization logging
     */
    auth: {
        success: (userId, action) => {
            logger_1.Logger.info(`AUTH_SUCCESS: User ${userId} - ${action}`);
        },
        failure: (identifier, action, reason) => {
            logger_1.Logger.warn(`AUTH_FAILURE: ${identifier} - ${action} - ${reason}`);
        },
        security: (event, details) => {
            logger_1.Logger.security(`AUTH_${event}`, details);
        },
    },
    /**
     * Payment and financial logging
     */
    payment: {
        transaction: (transactionId, amount, status) => {
            logger_1.Logger.info(`PAYMENT: Transaction ${transactionId} - $${amount} - ${status}`);
        },
        error: (transactionId, error) => {
            logger_1.Logger.error(`PAYMENT_ERROR: Transaction ${transactionId} - ${error}`);
        },
    },
    /**
     * Course and content logging
     */
    course: {
        access: (userId, courseId, action) => {
            logger_1.Logger.info(`COURSE_ACCESS: User ${userId} - Course ${courseId} - ${action}`);
        },
        progress: (userId, courseId, progress) => {
            logger_1.Logger.info(`COURSE_PROGRESS: User ${userId} - Course ${courseId} - ${progress}%`);
        },
    },
    /**
     * System and infrastructure logging
     */
    system: {
        startup: (service, port) => {
            logger_1.Logger.info(`SYSTEM_STARTUP: ${service}${port ? ` on port ${port}` : ''}`);
        },
        shutdown: (service, reason) => {
            logger_1.Logger.info(`SYSTEM_SHUTDOWN: ${service}${reason ? ` - ${reason}` : ''}`);
        },
        health: (service, status, details) => {
            logger_1.Logger.info(`SYSTEM_HEALTH: ${service} - ${status}`, details);
        },
    },
};
/**
 * Debug utilities that are completely removed in production
 */
exports.debugOnly = {
    log: (...args) => {
        if (environment_1.Environment.isDevelopment()) {
            logger_1.Logger.debug(`[DEBUG] ${formatConsoleArgs(args)}`);
        }
    },
    trace: (label) => {
        if (environment_1.Environment.isDevelopment()) {
            logger_1.Logger.debug(`[TRACE] ${label} - ${new Error().stack}`);
        }
    },
    time: (label) => {
        if (environment_1.Environment.isDevelopment()) {
            console.time(label);
        }
    },
    timeEnd: (label) => {
        if (environment_1.Environment.isDevelopment()) {
            console.timeEnd(label);
        }
    },
};
// Export a default safe console for easy migration
exports.default = exports.safeConsole;
