import { Logger } from '../config/logger';
import { Environment } from './environment';

/**
 * Production-safe console replacement utilities
 * These functions provide a bridge between existing console statements and Winston logger
 * while ensuring no sensitive data leaks in production
 */

/**
 * Safe console replacement that respects environment
 */
export const safeConsole = {
  /**
   * Log general information - only in development
   */
  log: (...args: any[]) => {
    if (Environment.isDevelopment()) {
      Logger.info(formatConsoleArgs(args));
    }
  },

  /**
   * Log errors - always logged but sanitized in production
   */
  error: (...args: any[]) => {
    Logger.error(formatConsoleArgs(args));
  },

  /**
   * Log warnings - always logged but sanitized in production
   */
  warn: (...args: any[]) => {
    Logger.warn(formatConsoleArgs(args));
  },

  /**
   * Debug information - only in development
   */
  debug: (...args: any[]) => {
    if (Environment.isDevelopment()) {
      Logger.debug(formatConsoleArgs(args));
    }
  },

  /**
   * Info logging - respects environment
   */
  info: (...args: any[]) => {
    Logger.info(formatConsoleArgs(args));
  },
};

/**
 * Conditional logging utilities
 */
export const conditionalLog = {
  /**
   * Only log in development environment
   */
  dev: (...args: any[]) => {
    if (Environment.isDevelopment()) {
      Logger.debug(`[DEV] ${formatConsoleArgs(args)}`);
    }
  },

  /**
   * Only log in production environment
   */
  prod: (...args: any[]) => {
    if (Environment.isProduction()) {
      Logger.info(`[PROD] ${formatConsoleArgs(args)}`);
    }
  },

  /**
   * Log performance metrics
   */
  perf: (operation: string, startTime: number, meta?: any) => {
    const duration = Date.now() - startTime;
    Logger.performance(operation, duration, meta);
  },

  /**
   * Log security events
   */
  security: (event: string, details: any) => {
    Logger.security(event, details);
  },

  /**
   * Log API requests/responses safely
   */
  api: (method: string, url: string, statusCode: number, duration: number) => {
    Logger.api(method, url, statusCode, duration);
  },

  /**
   * Log database operations
   */
  db: (operation: string, meta?: any) => {
    Logger.database(operation, meta);
  },
};

/**
 * Format console arguments into a readable string
 */
function formatConsoleArgs(args: any[]): string {
  return args
    .map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (error) {
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
export const migrationConsole = {
  /**
   * Temporary bridge for console.log statements during migration
   * TODO: Replace with appropriate Logger calls
   */
  log: (...args: any[]) => {
    if (Environment.isDevelopment()) {
      // In development, show migration warning
      Logger.warn(`[MIGRATION] console.log usage detected: ${formatConsoleArgs(args)}`);
    }
    // Don't log in production to prevent information leakage
  },

  /**
   * Temporary bridge for console.error statements during migration
   */
  error: (...args: any[]) => {
    Logger.error(`[MIGRATION] ${formatConsoleArgs(args)}`);
  },

  /**
   * Temporary bridge for console.warn statements during migration
   */
  warn: (...args: any[]) => {
    Logger.warn(`[MIGRATION] ${formatConsoleArgs(args)}`);
  },

  /**
   * Temporary bridge for console.debug statements during migration
   */
  debug: (...args: any[]) => {
    if (Environment.isDevelopment()) {
      Logger.debug(`[MIGRATION] ${formatConsoleArgs(args)}`);
    }
  },
};

/**
 * Specialized logging for different application areas
 */
export const specializedLog = {
  /**
   * Authentication and authorization logging
   */
  auth: {
    success: (userId: string, action: string) => {
      Logger.info(`AUTH_SUCCESS: User ${userId} - ${action}`);
    },
    failure: (identifier: string, action: string, reason: string) => {
      Logger.warn(`AUTH_FAILURE: ${identifier} - ${action} - ${reason}`);
    },
    security: (event: string, details: any) => {
      Logger.security(`AUTH_${event}`, details);
    },
  },

  /**
   * Payment and financial logging
   */
  payment: {
    transaction: (transactionId: string, amount: number, status: string) => {
      Logger.info(`PAYMENT: Transaction ${transactionId} - $${amount} - ${status}`);
    },
    error: (transactionId: string, error: string) => {
      Logger.error(`PAYMENT_ERROR: Transaction ${transactionId} - ${error}`);
    },
  },

  /**
   * Course and content logging
   */
  course: {
    access: (userId: string, courseId: string, action: string) => {
      Logger.info(`COURSE_ACCESS: User ${userId} - Course ${courseId} - ${action}`);
    },
    progress: (userId: string, courseId: string, progress: number) => {
      Logger.info(`COURSE_PROGRESS: User ${userId} - Course ${courseId} - ${progress}%`);
    },
  },

  /**
   * System and infrastructure logging
   */
  system: {
    startup: (service: string, port?: number) => {
      Logger.info(`SYSTEM_STARTUP: ${service}${port ? ` on port ${port}` : ''}`);
    },
    shutdown: (service: string, reason?: string) => {
      Logger.info(`SYSTEM_SHUTDOWN: ${service}${reason ? ` - ${reason}` : ''}`);
    },
    health: (service: string, status: string, details?: any) => {
      Logger.info(`SYSTEM_HEALTH: ${service} - ${status}`, details);
    },
  },
};

/**
 * Debug utilities that are completely removed in production
 */
export const debugOnly = {
  log: (...args: any[]) => {
    if (Environment.isDevelopment()) {
      Logger.debug(`[DEBUG] ${formatConsoleArgs(args)}`);
    }
  },

  trace: (label: string) => {
    if (Environment.isDevelopment()) {
      Logger.debug(`[TRACE] ${label} - ${new Error().stack}`);
    }
  },

  time: (label: string) => {
    if (Environment.isDevelopment()) {
      console.time(label);
    }
  },

  timeEnd: (label: string) => {
    if (Environment.isDevelopment()) {
      console.timeEnd(label);
    }
  },
};

// Export a default safe console for easy migration
export default safeConsole;
