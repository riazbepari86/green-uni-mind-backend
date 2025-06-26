import { Logger } from '../../config/logger';
import { circuitBreakerService } from './CircuitBreakerService';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: string[];
  circuitBreakerName?: string;
}

export interface RetryAttempt {
  attemptNumber: number;
  delay: number;
  error?: Error;
  timestamp: Date;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: RetryAttempt[];
  totalTime: number;
  finalAttempt: number;
}

export interface RetryStats {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  averageAttempts: number;
  averageSuccessTime: number;
  mostCommonErrors: Record<string, number>;
}

class RetryService {
  private stats: RetryStats = {
    totalRetries: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageAttempts: 0,
    averageSuccessTime: 0,
    mostCommonErrors: {}
  };

  private readonly DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT']
  };

  constructor() {
    Logger.info('🔄 Retry Service initialized');
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];
    
    this.stats.totalRetries++;

    // Use circuit breaker if specified
    const circuitBreaker = finalConfig.circuitBreakerName 
      ? circuitBreakerService.getCircuitBreaker({
          name: finalConfig.circuitBreakerName,
          failureThreshold: 5,
          recoveryTimeout: 60000,
          monitoringPeriod: 30000,
          halfOpenMaxCalls: 3
        })
      : null;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      const attemptStart = Date.now();
      
      try {
        let result: T;
        
        if (circuitBreaker) {
          result = await circuitBreaker.execute(fn);
        } else {
          result = await fn();
        }

        // Success
        const attemptTime = Date.now() - attemptStart;
        attempts.push({
          attemptNumber: attempt,
          delay: 0,
          timestamp: new Date()
        });

        this.updateSuccessStats(attempts.length, Date.now() - startTime);

        return {
          success: true,
          result,
          attempts,
          totalTime: Date.now() - startTime,
          finalAttempt: attempt
        };

      } catch (error) {
        const attemptTime = Date.now() - attemptStart;
        const err = error as Error;
        
        attempts.push({
          attemptNumber: attempt,
          delay: 0,
          error: err,
          timestamp: new Date()
        });

        // Check if error is retryable
        if (!this.isRetryableError(err, finalConfig.retryableErrors)) {
          this.updateFailureStats(err.message);
          return {
            success: false,
            error: err,
            attempts,
            totalTime: Date.now() - startTime,
            finalAttempt: attempt
          };
        }

        // If this was the last attempt, fail
        if (attempt === finalConfig.maxAttempts) {
          this.updateFailureStats(err.message);
          return {
            success: false,
            error: err,
            attempts,
            totalTime: Date.now() - startTime,
            finalAttempt: attempt
          };
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, finalConfig);
        attempts[attempts.length - 1].delay = delay;

        Logger.warn(`🔄 Retry attempt ${attempt}/${finalConfig.maxAttempts} failed, retrying in ${delay}ms:`, {
          error: err.message,
          attempt,
          delay
        });

        // Wait before next attempt
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    const lastError = attempts[attempts.length - 1]?.error || new Error('Unknown error');
    this.updateFailureStats(lastError.message);
    
    return {
      success: false,
      error: lastError,
      attempts,
      totalTime: Date.now() - startTime,
      finalAttempt: finalConfig.maxAttempts
    };
  }

  /**
   * Execute with simple retry (convenience method)
   */
  async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    const result = await this.executeWithRetry(fn, { maxAttempts, baseDelay });
    
    if (result.success) {
      return result.result!;
    } else {
      throw result.error;
    }
  }

  /**
   * Execute with exponential backoff
   */
  async retryWithExponentialBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 5,
    baseDelay: number = 1000,
    maxDelay: number = 30000
  ): Promise<T> {
    const result = await this.executeWithRetry(fn, {
      maxAttempts,
      baseDelay,
      maxDelay,
      backoffMultiplier: 2,
      jitter: true
    });
    
    if (result.success) {
      return result.result!;
    } else {
      throw result.error;
    }
  }

  /**
   * Execute with circuit breaker protection
   */
  async retryWithCircuitBreaker<T>(
    fn: () => Promise<T>,
    circuitBreakerName: string,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const result = await this.executeWithRetry(fn, {
      ...config,
      circuitBreakerName
    });
    
    if (result.success) {
      return result.result!;
    } else {
      throw result.error;
    }
  }

  /**
   * Batch retry operations
   */
  async retryBatch<T>(
    operations: Array<() => Promise<T>>,
    config: Partial<RetryConfig> = {}
  ): Promise<Array<RetryResult<T>>> {
    const results = await Promise.allSettled(
      operations.map(op => this.executeWithRetry(op, config))
    );

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: result.reason,
        attempts: [],
        totalTime: 0,
        finalAttempt: 0
      }
    );
  }

  /**
   * Get retry statistics
   */
  getStats(): RetryStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageAttempts: 0,
      averageSuccessTime: 0,
      mostCommonErrors: {}
    };
    Logger.info('🔄 Retry statistics reset');
  }

  /**
   * Private helper methods
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelay);
    
    // Apply jitter to prevent thundering herd
    if (config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.max(delay, 0);
  }

  private isRetryableError(error: Error, retryableErrors?: string[]): boolean {
    if (!retryableErrors || retryableErrors.length === 0) {
      return true; // Retry all errors if no specific errors specified
    }

    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code;

    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase()) ||
      errorCode === retryableError
    );
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateSuccessStats(attempts: number, totalTime: number): void {
    this.stats.successfulRetries++;
    this.stats.averageAttempts = (
      (this.stats.averageAttempts * (this.stats.successfulRetries - 1) + attempts) /
      this.stats.successfulRetries
    );
    this.stats.averageSuccessTime = (
      (this.stats.averageSuccessTime * (this.stats.successfulRetries - 1) + totalTime) /
      this.stats.successfulRetries
    );
  }

  private updateFailureStats(errorMessage: string): void {
    this.stats.failedRetries++;
    
    // Track common errors
    const errorKey = errorMessage.substring(0, 50); // Truncate for grouping
    this.stats.mostCommonErrors[errorKey] = (this.stats.mostCommonErrors[errorKey] || 0) + 1;
  }

  /**
   * Create a retryable function wrapper
   */
  createRetryableFunction<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    config: Partial<RetryConfig> = {}
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      return this.retry(() => fn(...args), config.maxAttempts, config.baseDelay);
    };
  }

  /**
   * Decorator for retryable methods
   */
  retryable(config: Partial<RetryConfig> = {}) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const retryService = new RetryService();
        return retryService.retry(() => originalMethod.apply(this, args), config.maxAttempts, config.baseDelay);
      };

      return descriptor;
    };
  }
}

// Create singleton instance
const retryService = new RetryService();

export { retryService };
export default RetryService;
