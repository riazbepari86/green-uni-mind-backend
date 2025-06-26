import { Logger } from '../../config/logger';
import { redisOperations } from '../../config/redis';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
  name: string;
}

export interface CircuitBreakerStats {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  totalCalls: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  nextAttemptTime: Date | null;
  errorRate: number;
}

export interface CircuitBreakerMetrics {
  name: string;
  stats: CircuitBreakerStats;
  recentErrors: string[];
  performanceMetrics: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
}

class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private totalCalls = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextAttemptTime: Date | null = null;
  private halfOpenCalls = 0;
  private recentErrors: string[] = [];
  private responseTimes: number[] = [];

  constructor(private config: CircuitBreakerConfig) {
    Logger.info(`🔧 Circuit breaker initialized: ${config.name}`);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.totalCalls++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
        Logger.info(`🔧 Circuit breaker ${this.config.name} transitioning to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker ${this.config.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      const responseTime = Date.now() - startTime;
      this.onSuccess(responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.onFailure(error as Error, responseTime);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(responseTime: number): void {
    this.successCount++;
    this.lastSuccessTime = new Date();
    this.recordResponseTime(responseTime);

    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error, responseTime: number): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.recordResponseTime(responseTime);
    this.recordError(error.message);

    if (this.state === 'HALF_OPEN') {
      this.open();
    } else if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
      this.open();
    }
  }

  /**
   * Open the circuit breaker
   */
  private open(): void {
    this.state = 'OPEN';
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    Logger.warn(`⚠️ Circuit breaker ${this.config.name} opened due to failures`);
    
    // Store state in Redis for persistence
    this.persistState();
  }

  /**
   * Reset the circuit breaker to closed state
   */
  private reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.halfOpenCalls = 0;
    this.nextAttemptTime = null;
    Logger.info(`✅ Circuit breaker ${this.config.name} reset to CLOSED`);
    
    // Store state in Redis
    this.persistState();
  }

  /**
   * Check if we should attempt to reset the circuit breaker
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime !== null && new Date() >= this.nextAttemptTime;
  }

  /**
   * Record response time for performance metrics
   */
  private recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    
    // Keep only recent response times (last 100)
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
  }

  /**
   * Record error for debugging
   */
  private recordError(errorMessage: string): void {
    this.recentErrors.push(`${new Date().toISOString()}: ${errorMessage}`);
    
    // Keep only recent errors (last 10)
    if (this.recentErrors.length > 10) {
      this.recentErrors.shift();
    }
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    const errorRate = this.totalCalls > 0 ? (this.failureCount / this.totalCalls) * 100 : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
      errorRate
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const stats = this.getStats();
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    
    const averageResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length 
      : 0;
    
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    
    return {
      name: this.config.name,
      stats,
      recentErrors: [...this.recentErrors],
      performanceMetrics: {
        averageResponseTime,
        p95ResponseTime: sortedTimes[p95Index] || 0,
        p99ResponseTime: sortedTimes[p99Index] || 0
      }
    };
  }

  /**
   * Persist circuit breaker state to Redis
   */
  private async persistState(): Promise<void> {
    try {
      const state = {
        state: this.state,
        failureCount: this.failureCount,
        successCount: this.successCount,
        totalCalls: this.totalCalls,
        lastFailureTime: this.lastFailureTime,
        lastSuccessTime: this.lastSuccessTime,
        nextAttemptTime: this.nextAttemptTime
      };

      await redisOperations.setex(
        `circuit_breaker:${this.config.name}`,
        3600, // 1 hour
        JSON.stringify(state)
      );
    } catch (error) {
      Logger.error(`Failed to persist circuit breaker state for ${this.config.name}:`, error);
    }
  }

  /**
   * Load circuit breaker state from Redis
   */
  async loadState(): Promise<void> {
    try {
      const stateData = await redisOperations.get(`circuit_breaker:${this.config.name}`);
      if (stateData) {
        const state = JSON.parse(stateData);
        this.state = state.state;
        this.failureCount = state.failureCount || 0;
        this.successCount = state.successCount || 0;
        this.totalCalls = state.totalCalls || 0;
        this.lastFailureTime = state.lastFailureTime ? new Date(state.lastFailureTime) : null;
        this.lastSuccessTime = state.lastSuccessTime ? new Date(state.lastSuccessTime) : null;
        this.nextAttemptTime = state.nextAttemptTime ? new Date(state.nextAttemptTime) : null;
        
        Logger.info(`🔧 Circuit breaker ${this.config.name} state loaded from Redis`);
      }
    } catch (error) {
      Logger.error(`Failed to load circuit breaker state for ${this.config.name}:`, error);
    }
  }

  /**
   * Force reset the circuit breaker
   */
  forceReset(): void {
    this.reset();
    Logger.info(`🔧 Circuit breaker ${this.config.name} force reset`);
  }

  /**
   * Force open the circuit breaker
   */
  forceOpen(): void {
    this.open();
    Logger.warn(`⚠️ Circuit breaker ${this.config.name} force opened`);
  }
}

/**
 * Circuit Breaker Service for managing multiple circuit breakers
 */
class CircuitBreakerService {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startMonitoring();
    Logger.info('🔧 Circuit Breaker Service initialized');
  }

  /**
   * Create or get a circuit breaker
   */
  getCircuitBreaker(config: CircuitBreakerConfig): CircuitBreaker {
    if (!this.circuitBreakers.has(config.name)) {
      const circuitBreaker = new CircuitBreaker(config);
      this.circuitBreakers.set(config.name, circuitBreaker);
      
      // Load persisted state
      circuitBreaker.loadState();
    }
    
    return this.circuitBreakers.get(config.name)!;
  }

  /**
   * Get all circuit breaker metrics
   */
  getAllMetrics(): CircuitBreakerMetrics[] {
    return Array.from(this.circuitBreakers.values()).map(cb => cb.getMetrics());
  }

  /**
   * Get specific circuit breaker metrics
   */
  getMetrics(name: string): CircuitBreakerMetrics | null {
    const circuitBreaker = this.circuitBreakers.get(name);
    return circuitBreaker ? circuitBreaker.getMetrics() : null;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.forceReset();
    }
    Logger.info('🔧 All circuit breakers reset');
  }

  /**
   * Reset specific circuit breaker
   */
  reset(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.forceReset();
      return true;
    }
    return false;
  }

  /**
   * Start monitoring circuit breakers
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.logMetrics();
    }, 60000); // Log metrics every minute
  }

  /**
   * Log circuit breaker metrics
   */
  private logMetrics(): void {
    const metrics = this.getAllMetrics();
    for (const metric of metrics) {
      if (metric.stats.state !== 'CLOSED' || metric.stats.errorRate > 10) {
        Logger.warn(`🔧 Circuit breaker ${metric.name} metrics:`, {
          state: metric.stats.state,
          errorRate: metric.stats.errorRate,
          totalCalls: metric.stats.totalCalls,
          averageResponseTime: metric.performanceMetrics.averageResponseTime
        });
      }
    }
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.circuitBreakers.clear();
    Logger.info('🔧 Circuit Breaker Service shutdown complete');
  }
}

// Create singleton instance
const circuitBreakerService = new CircuitBreakerService();

export { circuitBreakerService, CircuitBreaker, CircuitBreakerService };
export default circuitBreakerService;
