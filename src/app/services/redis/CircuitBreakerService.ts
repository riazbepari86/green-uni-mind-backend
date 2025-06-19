import { ICircuitBreakerService, CircuitBreakerOpenError } from './interfaces';

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrorRate: number;
}

interface CircuitBreakerMetrics {
  failures: number;
  successes: number;
  timeouts: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
}

type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreakerService implements ICircuitBreakerService {
  private state: CircuitBreakerState = 'CLOSED';
  private metrics: CircuitBreakerMetrics = {
    failures: 0,
    successes: 0,
    timeouts: 0
  };
  private nextAttempt: Date = new Date();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod || 300000, // 5 minutes
      expectedErrorRate: config.expectedErrorRate || 0.5 // 50%
    };
  }

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt.getTime()) {
        if (fallback) {
          console.log('Circuit breaker OPEN - executing fallback');
          return await fallback();
        }
        throw new CircuitBreakerOpenError('Circuit breaker is open');
      } else {
        this.state = 'HALF_OPEN';
        console.log('Circuit breaker transitioning to HALF_OPEN');
      }
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback) {
        console.log('Circuit breaker OPEN after failure - executing fallback');
        return await fallback();
      }
      
      throw error;
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = 10000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.metrics.timeouts++;
        reject(new Error('Operation timeout'));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.metrics.successes++;
    this.metrics.lastSuccessTime = new Date();

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.resetMetrics();
      console.log('Circuit breaker transitioning to CLOSED after successful operation');
    }
  }

  private onFailure(): void {
    this.metrics.failures++;
    this.metrics.lastFailureTime = new Date();

    if (this.shouldOpenCircuit()) {
      this.state = 'OPEN';
      this.nextAttempt = new Date(Date.now() + this.config.recoveryTimeout);
      console.log(`Circuit breaker OPEN - next attempt at ${this.nextAttempt.toISOString()}`);
    }
  }

  private shouldOpenCircuit(): boolean {
    const totalRequests = this.metrics.failures + this.metrics.successes;
    
    if (totalRequests < this.config.failureThreshold) {
      return false;
    }

    const errorRate = this.metrics.failures / totalRequests;
    return errorRate >= this.config.expectedErrorRate;
  }

  private resetMetrics(): void {
    this.metrics = {
      failures: 0,
      successes: 0,
      timeouts: 0
    };
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  // Manual control methods
  forceOpen(): void {
    this.state = 'OPEN';
    this.nextAttempt = new Date(Date.now() + this.config.recoveryTimeout);
    console.log('Circuit breaker manually forced OPEN');
  }

  forceClose(): void {
    this.state = 'CLOSED';
    this.resetMetrics();
    console.log('Circuit breaker manually forced CLOSED');
  }

  // Health check method
  isHealthy(): boolean {
    return this.state === 'CLOSED';
  }

  // Get configuration
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  // Update configuration
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Circuit breaker configuration updated:', this.config);
  }
}

// Factory for creating circuit breakers with different configurations
export class CircuitBreakerFactory {
  private static instances = new Map<string, CircuitBreakerService>();

  static getCircuitBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreakerService {
    if (!this.instances.has(name)) {
      this.instances.set(name, new CircuitBreakerService(config));
    }
    return this.instances.get(name)!;
  }

  static removeCircuitBreaker(name: string): boolean {
    return this.instances.delete(name);
  }

  static getAllCircuitBreakers(): Map<string, CircuitBreakerService> {
    return new Map(this.instances);
  }

  static getHealthStatus(): Record<string, {
    state: CircuitBreakerState;
    metrics: CircuitBreakerMetrics;
    isHealthy: boolean;
  }> {
    const status: Record<string, any> = {};
    
    this.instances.forEach((breaker, name) => {
      status[name] = {
        state: breaker.getState(),
        metrics: breaker.getMetrics(),
        isHealthy: breaker.isHealthy()
      };
    });
    
    return status;
  }
}

// Decorator for automatic circuit breaker integration
export function withCircuitBreaker(
  circuitBreakerName: string,
  config?: Partial<CircuitBreakerConfig>
) {
  return function (
    _target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const circuitBreaker = CircuitBreakerFactory.getCircuitBreaker(
        circuitBreakerName,
        config
      );
      
      return circuitBreaker.execute(
        () => method.apply(this, args),
        // Optional: provide a fallback method if it exists
        typeof (this as any)[`${propertyName}Fallback`] === 'function' ?
          () => (this as any)[`${propertyName}Fallback`](...args) :
          undefined
      );
    };
    
    return descriptor;
  };
}

// Redis-specific circuit breaker with predefined configuration
export class RedisCircuitBreaker extends CircuitBreakerService {
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    const redisConfig = {
      failureThreshold: 3,
      recoveryTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000, // 1 minute
      expectedErrorRate: 0.3, // 30%
      ...config
    };
    
    super(redisConfig);
  }
}

// Utility function to create a Redis operation with circuit breaker
export function createResilientRedisOperation<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>,
  circuitBreakerName: string = 'redis-default'
): () => Promise<T> {
  const circuitBreaker = CircuitBreakerFactory.getCircuitBreaker(
    circuitBreakerName,
    {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000,
      expectedErrorRate: 0.3
    }
  );

  return () => circuitBreaker.execute(operation, fallback);
}
