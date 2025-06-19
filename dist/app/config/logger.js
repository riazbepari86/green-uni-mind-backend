"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.loggerStream = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const index_1 = __importDefault(require("./index"));
// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Define colors for each log level
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};
// Tell winston that you want to link the colors
winston_1.default.addColors(logColors);
// Define log format
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf((info) => {
    // Sanitize sensitive data
    const sanitizedInfo = sanitizeLogData(info);
    if (index_1.default.NODE_ENV === 'development') {
        return `${sanitizedInfo.timestamp} [${sanitizedInfo.level.toUpperCase()}]: ${sanitizedInfo.message}${sanitizedInfo.stack ? `\n${sanitizedInfo.stack}` : ''}`;
    }
    return JSON.stringify(sanitizedInfo);
}));
// Console format for development
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize({ all: true }), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf((info) => {
    const sanitizedInfo = sanitizeLogData(info);
    return `${sanitizedInfo.timestamp} [${sanitizedInfo.level.toUpperCase()}]: ${sanitizedInfo.message}${sanitizedInfo.stack ? `\n${sanitizedInfo.stack}` : ''}`;
}));
// Sanitize sensitive data from logs
function sanitizeLogData(info) {
    const sensitiveFields = [
        'password',
        'token',
        'accessToken',
        'refreshToken',
        'authorization',
        'cookie',
        'secret',
        'key',
        'apiKey',
        'privateKey',
        'clientSecret',
        'otp',
        'pin',
        'ssn',
        'creditCard',
        'cardNumber',
        'cvv',
        'bankAccount'
    ];
    const sanitized = Object.assign({}, info);
    // Recursively sanitize object properties
    const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }
        const sanitizedObj = {};
        for (const [key, value] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            // Check if key contains sensitive information
            const isSensitive = sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));
            if (isSensitive) {
                sanitizedObj[key] = '[REDACTED]';
            }
            else if (typeof value === 'object' && value !== null) {
                sanitizedObj[key] = sanitizeObject(value);
            }
            else {
                sanitizedObj[key] = value;
            }
        }
        return sanitizedObj;
    };
    // Sanitize the entire info object
    return sanitizeObject(sanitized);
}
// Create transports array
const transports = [];
// Console transport for development
if (index_1.default.NODE_ENV === 'development') {
    transports.push(new winston_1.default.transports.Console({
        format: consoleFormat,
        level: 'debug',
    }));
}
else {
    // Only error logs to console in production
    transports.push(new winston_1.default.transports.Console({
        format: logFormat,
        level: 'error',
    }));
}
// File transports for all environments
const logsDir = path_1.default.join(process.cwd(), 'logs');
// Error logs - always enabled
transports.push(new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
}));
// Combined logs - only in production or when explicitly enabled
if (index_1.default.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
    transports.push(new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logsDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        format: logFormat,
        maxSize: '20m',
        maxFiles: '7d',
        zippedArchive: true,
        level: index_1.default.NODE_ENV === 'production' ? 'warn' : 'info',
    }));
}
// Create the logger
const logger = winston_1.default.createLogger({
    level: index_1.default.NODE_ENV === 'development' ? 'debug' : 'warn',
    levels: logLevels,
    format: logFormat,
    transports,
    // Don't exit on handled exceptions
    exitOnError: false,
});
// Handle uncaught exceptions and unhandled rejections
if (index_1.default.NODE_ENV === 'production') {
    logger.exceptions.handle(new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logsDir, 'exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
    }));
    logger.rejections.handle(new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logsDir, 'rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
    }));
}
// Create a stream object for Morgan HTTP logging
exports.loggerStream = {
    write: (message) => {
        // Remove trailing newline and log as http level
        logger.http(message.trim());
    },
};
// Export logger with additional utility methods
exports.Logger = {
    error: (message, meta) => logger.error(message, meta),
    warn: (message, meta) => logger.warn(message, meta),
    info: (message, meta) => logger.info(message, meta),
    http: (message, meta) => logger.http(message, meta),
    debug: (message, meta) => logger.debug(message, meta),
    // Security logging
    security: (event, details) => {
        logger.warn(`SECURITY_EVENT: ${event}`, {
            event,
            details: sanitizeLogData(details),
            timestamp: new Date().toISOString(),
        });
    },
    // Performance logging
    performance: (operation, duration, meta) => {
        logger.info(`PERFORMANCE: ${operation} completed in ${duration}ms`, {
            operation,
            duration,
            meta: sanitizeLogData(meta),
        });
    },
    // Database logging
    database: (operation, meta) => {
        logger.debug(`DATABASE: ${operation}`, sanitizeLogData(meta));
    },
    // API logging
    api: (method, url, statusCode, duration) => {
        const level = statusCode >= 400 ? 'warn' : 'info';
        logger[level](`API: ${method} ${url} - ${statusCode} (${duration}ms)`, {
            method,
            url,
            statusCode,
            duration,
        });
    },
};
exports.default = logger;
