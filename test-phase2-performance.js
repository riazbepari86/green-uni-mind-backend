const jwt = require('jsonwebtoken');
const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET =
  '04a08adaf2e1b46afcdb845e68392169b0dc44fe19e2b0bdc0ea18a42d6c4b7c';
const PERFORMANCE_TARGET = 500; // 500ms target

async function testPhase2Performance() {
  console.log('🚀 Phase 2: Performance Optimization - Analysis & Testing\n');
  console.log(`Target: All endpoints under ${PERFORMANCE_TARGET}ms\n`);

  const results = {
    fastEndpoints: [],
    slowEndpoints: [],
    memoryUsage: null,
    cachePerformance: [],
    optimizationNeeded: [],
  };

  try {
    // Generate JWT token for teacher
    const teacherPayload = {
      email: 'ahmedriazbepari@gmail.com',
      role: 'teacher',
      userId: '685c1b673a862730dd0a3b1e',
    };

    const token = jwt.sign(teacherPayload, JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ Generated JWT token for performance testing\n');

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const teacherId = teacherPayload.userId;

    // Define all endpoints to test for performance
    const endpoints = [
      // Analytics endpoints
      {
        name: 'Dashboard Summary',
        path: `/analytics/teachers/${teacherId}/dashboard`,
        critical: true,
      },
      {
        name: 'Analytics Overview',
        path: `/analytics/teachers/${teacherId}/overview`,
        critical: true,
      },

      // Stripe Connect endpoints (already optimized)
      {
        name: 'Account Status',
        path: '/stripe-connect/account-status',
        critical: true,
      },
      {
        name: 'Quick Status',
        path: '/stripe-connect/quick-status',
        critical: true,
      },

      // Payment endpoints (need testing)
      {
        name: 'Upcoming Payout',
        path: `/payments/upcoming-payout/${teacherId}`,
        critical: false,
      },
      {
        name: 'Teacher Earnings',
        path: `/payments/earnings/${teacherId}`,
        critical: false,
      },

      // System endpoints
      { name: 'System Health', path: '/monitoring/health', critical: false },
      {
        name: 'Performance Metrics',
        path: '/monitoring/performance',
        critical: false,
      },
    ];

    console.log('🔍 Performance Testing - Multiple Runs for Accuracy');
    console.log('===================================================');

    // Run multiple tests for each endpoint to get accurate averages
    const testRuns = 5;
    const endpointResults = {};

    for (const endpoint of endpoints) {
      console.log(`\n📊 Testing: ${endpoint.name}`);
      const times = [];
      let successCount = 0;
      let errors = [];

      for (let run = 1; run <= testRuns; run++) {
        const startTime = Date.now();
        try {
          const response = await axios({
            method: 'GET',
            url: `${API_BASE_URL}${endpoint.path}`,
            headers,
            timeout: 10000,
          });

          const responseTime = Date.now() - startTime;
          times.push(responseTime);
          successCount++;

          console.log(`  Run ${run}: ${response.status} (${responseTime}ms)`);

          // Check for cache indicators
          if (response.headers['x-cache'] === 'HIT' || responseTime < 250) {
            results.cachePerformance.push({
              endpoint: endpoint.name,
              run,
              responseTime,
              cacheHit: true,
            });
          }
        } catch (error) {
          const responseTime = Date.now() - startTime;
          times.push(responseTime);
          errors.push(error.response?.data?.message || error.message);
          console.log(
            `  Run ${run}: ERROR - ${error.response?.data?.message || error.message}`,
          );
        }
      }

      // Calculate statistics
      if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const sortedTimes = times.sort((a, b) => a - b);
        const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

        endpointResults[endpoint.name] = {
          ...endpoint,
          avgTime: Math.round(avgTime),
          minTime,
          maxTime,
          p95Time: Math.round(p95Time),
          successRate: (successCount / testRuns) * 100,
          errors,
        };

        // Categorize endpoint
        if (avgTime <= PERFORMANCE_TARGET && successCount === testRuns) {
          results.fastEndpoints.push(endpointResults[endpoint.name]);
          console.log(
            `  ✅ FAST: Avg ${Math.round(avgTime)}ms (Target: ${PERFORMANCE_TARGET}ms)`,
          );
        } else if (successCount === testRuns) {
          results.slowEndpoints.push(endpointResults[endpoint.name]);
          console.log(
            `  ⚠️  SLOW: Avg ${Math.round(avgTime)}ms (Exceeds ${PERFORMANCE_TARGET}ms target)`,
          );

          // Add to optimization needed list
          results.optimizationNeeded.push({
            name: endpoint.name,
            path: endpoint.path,
            currentTime: Math.round(avgTime),
            target: PERFORMANCE_TARGET,
            improvement: Math.round(avgTime - PERFORMANCE_TARGET),
            critical: endpoint.critical,
          });
        } else {
          console.log(`  ❌ FAILING: ${successCount}/${testRuns} success rate`);
        }
      }
    }

    // Memory Usage Analysis
    console.log('\n🧠 Memory Usage Analysis');
    console.log('========================');

    try {
      const healthResponse = await axios.get(
        `${API_BASE_URL}/monitoring/health`,
        { headers },
      );
      if (
        healthResponse.data &&
        healthResponse.data.system &&
        healthResponse.data.system.memory
      ) {
        const memory = healthResponse.data.system.memory;
        results.memoryUsage = {
          used: Math.round(memory.used / 1024 / 1024), // MB
          total: Math.round(memory.total / 1024 / 1024), // MB
          percentage: Math.round(memory.percentage),
        };

        console.log(
          `📊 Memory Usage: ${results.memoryUsage.used}MB / ${results.memoryUsage.total}MB (${results.memoryUsage.percentage}%)`,
        );

        if (results.memoryUsage.percentage < 80) {
          console.log('✅ Memory usage is within target (<80%)');
        } else {
          console.log(
            '⚠️  Memory usage exceeds 80% target - optimization needed',
          );
        }
      }
    } catch (error) {
      console.log('❌ Could not retrieve memory usage data');
    }

    // Performance Summary
    console.log('\n📊 Phase 2 Performance Summary');
    console.log('==============================');

    console.log(
      `🚀 Fast Endpoints (≤${PERFORMANCE_TARGET}ms): ${results.fastEndpoints.length}`,
    );
    results.fastEndpoints.forEach((ep) => {
      console.log(
        `  ✅ ${ep.name}: ${ep.avgTime}ms avg (${ep.minTime}-${ep.maxTime}ms range)`,
      );
    });

    console.log(
      `\n⚠️  Slow Endpoints (>${PERFORMANCE_TARGET}ms): ${results.slowEndpoints.length}`,
    );
    results.slowEndpoints.forEach((ep) => {
      console.log(
        `  🐌 ${ep.name}: ${ep.avgTime}ms avg (needs ${ep.avgTime - PERFORMANCE_TARGET}ms improvement)`,
      );
    });

    // Optimization Recommendations
    if (results.optimizationNeeded.length > 0) {
      console.log('\n🔧 Optimization Recommendations');
      console.log('===============================');

      results.optimizationNeeded.forEach((opt) => {
        console.log(
          `\n📍 ${opt.name} (${opt.critical ? 'CRITICAL' : 'NON-CRITICAL'})`,
        );
        console.log(`   Current: ${opt.currentTime}ms`);
        console.log(`   Target: ${opt.target}ms`);
        console.log(`   Improvement needed: ${opt.improvement}ms`);

        // Suggest optimization strategies
        if (opt.name.includes('Dashboard') || opt.name.includes('Analytics')) {
          console.log(
            `   💡 Suggestions: Add Redis caching, optimize database queries, implement data aggregation`,
          );
        } else if (opt.name.includes('Payment')) {
          console.log(
            `   💡 Suggestions: Cache Stripe API responses, optimize database lookups`,
          );
        } else {
          console.log(
            `   💡 Suggestions: Add caching layer, optimize data processing`,
          );
        }
      });
    }

    // Cache Performance Analysis
    if (results.cachePerformance.length > 0) {
      console.log('\n🔄 Cache Performance Analysis');
      console.log('=============================');

      const cacheHits = results.cachePerformance.length;
      const totalRequests = endpoints.length * testRuns;
      const cacheHitRate = (cacheHits / totalRequests) * 100;

      console.log(
        `📊 Cache Hit Rate: ${Math.round(cacheHitRate)}% (${cacheHits}/${totalRequests})`,
      );

      if (cacheHitRate > 50) {
        console.log('✅ Good cache performance detected');
      } else {
        console.log(
          '⚠️  Low cache hit rate - consider implementing more caching',
        );
      }
    }

    // Phase 2 Assessment
    const totalEndpoints =
      results.fastEndpoints.length + results.slowEndpoints.length;
    const performanceScore =
      totalEndpoints > 0
        ? (results.fastEndpoints.length / totalEndpoints) * 100
        : 0;

    console.log(
      `\n🎯 Phase 2 Performance Score: ${Math.round(performanceScore)}%`,
    );
    console.log(
      `   Fast endpoints: ${results.fastEndpoints.length}/${totalEndpoints}`,
    );

    const memoryOk = results.memoryUsage
      ? results.memoryUsage.percentage < 80
      : true;
    console.log(`   Memory usage: ${memoryOk ? '✅ OK' : '⚠️  HIGH'}`);

    if (performanceScore >= 90 && memoryOk) {
      console.log(
        '\n🏆 PHASE 2 STATUS: COMPLETE - Performance targets achieved!',
      );
      return { status: 'COMPLETE', performanceScore, results };
    } else if (performanceScore >= 75) {
      console.log(
        '\n✅ PHASE 2 STATUS: MOSTLY COMPLETE - Minor optimizations needed',
      );
      return { status: 'MOSTLY_COMPLETE', performanceScore, results };
    } else {
      console.log(
        '\n⚠️  PHASE 2 STATUS: INCOMPLETE - Significant optimizations needed',
      );
      return { status: 'INCOMPLETE', performanceScore, results };
    }
  } catch (error) {
    console.error('❌ Phase 2 performance test failed:', error);
    return { status: 'ERROR', error: error.message, results };
  }
}

testPhase2Performance()
  .then((summary) => {
    console.log('\n🎉 Phase 2 Performance Optimization Test Completed!');

    if (summary.status === 'COMPLETE') {
      console.log('✅ All performance targets achieved!');
      console.log(
        '🚀 Ready to proceed to Phase 3: API Reliability & Monitoring',
      );
    } else if (summary.status === 'MOSTLY_COMPLETE') {
      console.log(
        '⚠️  Most performance targets met, some optimizations recommended.',
      );
    } else {
      console.log('❌ Performance targets not met, optimization work needed.');

      if (summary.results.optimizationNeeded.length > 0) {
        console.log('\n🔧 Priority optimizations:');
        summary.results.optimizationNeeded
          .filter((opt) => opt.critical)
          .forEach((opt) => {
            console.log(
              `  • ${opt.name}: needs ${opt.improvement}ms improvement`,
            );
          });
      }
    }

    process.exit(summary.status === 'ERROR' ? 1 : 0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
