import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import config from './index';

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
winston.addColors(logColors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    // Sanitize sensitive data
    const sanitizedInfo = sanitizeLogData(info);
    
    if (config.NODE_ENV === 'development') {
      return `${sanitizedInfo.timestamp} [${sanitizedInfo.level.toUpperCase()}]: ${sanitizedInfo.message}${
        sanitizedInfo.stack ? `\n${sanitizedInfo.stack}` : ''
      }`;
    }
    
    return JSON.stringify(sanitizedInfo);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const sanitizedInfo = sanitizeLogData(info);
    return `${sanitizedInfo.timestamp} [${sanitizedInfo.level.toUpperCase()}]: ${sanitizedInfo.message}${
      sanitizedInfo.stack ? `\n${sanitizedInfo.stack}` : ''
    }`;
  })
);

// Sanitize sensitive data from logs
function sanitizeLogData(info: any): any {
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

  const sanitized = { ...info };

  // Recursively sanitize object properties
  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitizedObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Check if key contains sensitive information
      const isSensitive = sensitiveFields.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        sanitizedObj[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitizedObj[key] = sanitizeObject(value);
      } else {
        sanitizedObj[key] = value;
      }
    }
    return sanitizedObj;
  };

  // Sanitize the entire info object
  return sanitizeObject(sanitized);
}

// Create transports array
const transports: winston.transport[] = [];

// Console transport for development
if (config.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug',
    })
  );
} else {
  // Only error logs to console in production
  transports.push(
    new winston.transports.Console({
      format: logFormat,
      level: 'error',
    })
  );
}

// File transports for all environments
const logsDir = path.join(process.cwd(), 'logs');

// Error logs - always enabled
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
  })
);

// Combined logs - only in production or when explicitly enabled
if (config.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '7d',
      zippedArchive: true,
      level: config.NODE_ENV === 'production' ? 'warn' : 'info',
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: config.NODE_ENV === 'development' ? 'debug' : 'warn',
  levels: logLevels,
  format: logFormat,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Handle uncaught exceptions and unhandled rejections
if (config.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );

  logger.rejections.handle(
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
    })
  );
}

// Create a stream object for Morgan HTTP logging
export const loggerStream = {
  write: (message: string) => {
    // Remove trailing newline and log as http level
    logger.http(message.trim());
  },
};

// Export logger with additional utility methods
export const Logger = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  http: (message: string, meta?: any) => logger.http(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  
  // Security logging
  security: (event: string, details: any) => {
    logger.warn(`SECURITY_EVENT: ${event}`, {
      event,
      details: sanitizeLogData(details),
      timestamp: new Date().toISOString(),
    });
  },

  // Performance logging
  performance: (operation: string, duration: number, meta?: any) => {
    logger.info(`PERFORMANCE: ${operation} completed in ${duration}ms`, {
      operation,
      duration,
      meta: sanitizeLogData(meta),
    });
  },

  // Database logging
  database: (operation: string, meta?: any) => {
    logger.debug(`DATABASE: ${operation}`, sanitizeLogData(meta));
  },

  // API logging
  api: (method: string, url: string, statusCode: number, duration: number) => {
    const level = statusCode >= 400 ? 'warn' : 'info';
    logger[level](`API: ${method} ${url} - ${statusCode} (${duration}ms)`, {
      method,
      url,
      statusCode,
      duration,
    });
  },
};

export default logger;
