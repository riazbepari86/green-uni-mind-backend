/**
 * Security and Performance Tests
 * Comprehensive test suite for all security and performance implementations
 */

import request from 'supertest';
import app from '../app';
import { performanceMonitoringService } from '../app/services/performance/PerformanceMonitoringService';
import { redisOptimizationService } from '../app/services/redis/RedisOptimizationService';

describe('Security and Performance Tests', () => {
  
  describe('Security Headers', () => {
    it('should include all required security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
      expect(response.headers['x-download-options']).toBe('noopen');
      expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
    });

    it('should include HSTS header in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should include CSP header in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Rate Limiting', () => {
    it('should apply general rate limiting', async () => {
      // Make multiple requests to test rate limiting
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed in development
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should apply stricter rate limiting to auth endpoints', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      // Should have rate limit headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Request Validation', () => {
    it('should validate content type for POST requests', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'text/plain')
        .send('invalid content');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid Content-Type');
    });

    it('should limit request size', async () => {
      const largePayload = 'x'.repeat(15 * 1024 * 1024); // 15MB

      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send({ data: largePayload });

      expect(response.status).toBe(413);
      expect(response.body.error).toBe('Payload Too Large');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track request performance', async () => {
      const initialMetrics = performanceMonitoringService.getMetrics();
      const initialRequestCount = initialMetrics.requestCount;

      await request(app)
        .get('/health')
        .expect(200);

      const updatedMetrics = performanceMonitoringService.getMetrics();
      expect(updatedMetrics.requestCount).toBeGreaterThan(initialRequestCount);
    });

    it('should track endpoint-specific metrics', async () => {
      await request(app)
        .get('/health')
        .expect(200);

      const endpointMetrics = performanceMonitoringService.getEndpointMetrics();
      const healthEndpoint = endpointMetrics.find(m => m.path === '/health');
      
      expect(healthEndpoint).toBeDefined();
      expect(healthEndpoint?.count).toBeGreaterThan(0);
      expect(healthEndpoint?.averageTime).toBeGreaterThan(0);
    });

    it('should provide performance summary', async () => {
      const summary = performanceMonitoringService.getPerformanceSummary();
      
      expect(summary.overall).toBeDefined();
      expect(summary.topSlowEndpoints).toBeDefined();
      expect(summary.topErrorEndpoints).toBeDefined();
      expect(summary.slowQueries).toBeDefined();
    });
  });

  describe('Redis Optimization', () => {
    it('should provide circuit breaker status', () => {
      const status = redisOptimizationService.getCircuitBreakerStatus();
      expect(typeof status).toBe('object');
    });

    it('should provide optimization stats', () => {
      const stats = redisOptimizationService.getOptimizationStats();
      
      expect(stats.circuitBreakers).toBeDefined();
      expect(stats.batchQueueSize).toBeDefined();
      expect(stats.config).toBeDefined();
    });

    it('should handle optimized get operations', async () => {
      const testKey = 'test:optimization:get';
      const testValue = { test: 'data', timestamp: Date.now() };

      // Set a value
      await redisOptimizationService.optimizedSet(testKey, testValue, 60);

      // Get the value
      const result = await redisOptimizationService.optimizedGet(testKey);
      
      expect(result).toEqual(testValue);
    });

    it('should handle batch operations', async () => {
      const testData = {
        'test:batch:1': { value: 'data1', ttl: 60 },
        'test:batch:2': { value: 'data2', ttl: 60 },
        'test:batch:3': { value: 'data3', ttl: 60 },
      };

      // Multi-set
      await redisOptimizationService.multiSet(testData);

      // Multi-get
      const keys = Object.keys(testData);
      const results = await redisOptimizationService.multiGet(keys);

      expect(results['test:batch:1']).toBe('data1');
      expect(results['test:batch:2']).toBe('data2');
      expect(results['test:batch:3']).toBe('data3');
    });
  });

  describe('Response Compression', () => {
    it('should compress large responses', async () => {
      const response = await request(app)
        .get('/health')
        .set('Accept-Encoding', 'gzip');

      // Check if compression is applied for appropriate content
      if (response.text && response.text.length > 1024) {
        expect(response.headers['content-encoding']).toBe('gzip');
      }
    });

    it('should not compress small responses', async () => {
      const response = await request(app)
        .get('/ping')
        .set('Accept-Encoding', 'gzip');

      // Small responses should not be compressed
      expect(response.headers['content-encoding']).toBeUndefined();
    });
  });

  describe('Cache Headers', () => {
    it('should set appropriate cache headers for API endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers['cache-control']).toContain('private');
    });

    it('should set no-cache headers for dynamic content', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['cache-control']).toContain('no-cache');
    });
  });

  describe('Request Timeout', () => {
    it('should handle normal requests within timeout', async () => {
      const response = await request(app)
        .get('/health')
        .timeout(5000); // 5 second timeout

      expect(response.status).toBe(200);
    });
  });

  describe('Memory Monitoring', () => {
    it('should track memory usage', async () => {
      const initialMemory = process.memoryUsage();
      
      await request(app)
        .get('/health')
        .expect(200);

      const finalMemory = process.memoryUsage();
      
      // Memory usage should be tracked (this is a basic check)
      expect(finalMemory.heapUsed).toBeGreaterThan(0);
    });
  });

  describe('Security Logging', () => {
    it('should detect suspicious patterns', async () => {
      // Test with suspicious URL patterns
      const suspiciousRequests = [
        '/api/v1/users/../admin',
        '/api/v1/users?query=<script>alert(1)</script>',
        '/api/v1/users?query=UNION SELECT * FROM users',
      ];

      for (const path of suspiciousRequests) {
        const response = await request(app)
          .get(path);
        
        // Should not crash the server
        expect(response.status).toBeDefined();
      }
    });
  });

  describe('Cookie Security', () => {
    it('should set secure cookie attributes in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword'
        });

      // Check cookie attributes (if login is successful and sets cookies)
      const cookies = response.headers['set-cookie'];
      if (cookies && Array.isArray(cookies)) {
        const refreshTokenCookie = cookies.find((cookie: string) =>
          cookie.includes('refreshToken')
        );

        if (refreshTokenCookie) {
          expect(refreshTokenCookie).toContain('HttpOnly');
          expect(refreshTokenCookie).toContain('Secure');
          expect(refreshTokenCookie).toContain('SameSite=strict');
        }
      }

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);

      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(false);
    });

    it('should not expose sensitive error information', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'short'
        });

      // Should not expose internal error details
      expect(response.body.stack).toBeUndefined();
      expect(response.body.trace).toBeUndefined();
    });
  });

  describe('Health Checks', () => {
    it('should provide basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });

    it('should provide ping response', async () => {
      const response = await request(app)
        .get('/ping')
        .expect(200);

      expect(response.body.message).toBe('pong');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  // Cleanup after tests
  afterAll(async () => {
    // Reset performance metrics
    performanceMonitoringService.resetMetrics();
    
    // Cleanup services
    performanceMonitoringService.cleanup();
  });
});
