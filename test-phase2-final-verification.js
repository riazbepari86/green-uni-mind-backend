const jwt = require('jsonwebtoken');
const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET = '04a08adaf2e1b46afcdb845e68392169b0dc44fe19e2b0bdc0ea18a42d6c4b7c';

async function finalPhase2Verification() {
  console.log('🏆 PHASE 2: FINAL VERIFICATION - Performance Optimization Complete');
  console.log('================================================================');
  console.log('Verifying all enterprise performance targets have been achieved\n');

  const results = {
    apiPerformance: { passed: 0, total: 0, details: [] },
    memoryUsage: { status: 'unknown', percentage: 0 },
    cacheEfficiency: { hitRate: 0, totalRequests: 0 },
    overallScore: 0,
    phase2Status: 'INCOMPLETE'
  };

  try {
    // Generate JWT token
    const teacherPayload = {
      email: 'ahmedriazbepari@gmail.com',
      role: 'teacher',
      userId: '685c1b673a862730dd0a3b1e'
    };

    const token = jwt.sign(teacherPayload, JWT_SECRET, { expiresIn: '1h' });
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    console.log('✅ Authentication token generated\n');

    // Critical endpoints for enterprise performance verification
    const criticalEndpoints = [
      { name: 'Dashboard Summary', path: `/analytics/teachers/${teacherPayload.userId}/dashboard`, target: 500 },
      { name: 'Analytics Overview', path: `/analytics/teachers/${teacherPayload.userId}/overview`, target: 500 },
      { name: 'Account Status', path: '/stripe-connect/account-status', target: 500 },
      { name: 'Quick Status', path: '/stripe-connect/quick-status', target: 500 }
    ];

    console.log('🚀 ENTERPRISE API PERFORMANCE VERIFICATION');
    console.log('==========================================');

    // Test each critical endpoint 3 times for accuracy
    for (const endpoint of criticalEndpoints) {
      console.log(`\n📊 Testing: ${endpoint.name} (Target: <${endpoint.target}ms)`);
      
      const times = [];
      let successCount = 0;

      for (let run = 1; run <= 3; run++) {
        try {
          const startTime = Date.now();
          const response = await axios({
            method: 'GET',
            url: `${API_BASE_URL}${endpoint.path}`,
            headers,
            timeout: 10000
          });

          const responseTime = Date.now() - startTime;
          times.push(responseTime);
          successCount++;

          console.log(`  Run ${run}: ${response.status} (${responseTime}ms)`);

          // Track cache performance
          if (responseTime < 250) {
            results.cacheEfficiency.totalRequests++;
          }

        } catch (error) {
          console.log(`  Run ${run}: ERROR - ${error.response?.data?.message || error.message}`);
        }
      }

      if (times.length > 0) {
        const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        const maxTime = Math.max(...times);
        const passed = avgTime <= endpoint.target && successCount === 3;

        results.apiPerformance.details.push({
          name: endpoint.name,
          avgTime,
          maxTime,
          target: endpoint.target,
          passed,
          successRate: (successCount / 3) * 100
        });

        if (passed) {
          results.apiPerformance.passed++;
          console.log(`  ✅ PASSED: Avg ${avgTime}ms (Max: ${maxTime}ms) - Under ${endpoint.target}ms target`);
        } else {
          console.log(`  ❌ FAILED: Avg ${avgTime}ms (Max: ${maxTime}ms) - Exceeds ${endpoint.target}ms target`);
        }
      }

      results.apiPerformance.total++;
    }

    // Memory Usage Verification
    console.log('\n🧠 MEMORY USAGE VERIFICATION');
    console.log('============================');

    try {
      const healthResponse = await axios.get(`${API_BASE_URL}/monitoring/health`, { headers });
      
      if (healthResponse.data?.system?.memory) {
        const memory = healthResponse.data.system.memory;
        results.memoryUsage.percentage = Math.round(memory.percentage);
        
        console.log(`📊 System Memory: ${Math.round(memory.used / 1024 / 1024)}MB / ${Math.round(memory.total / 1024 / 1024)}MB`);
        console.log(`📊 Memory Usage: ${results.memoryUsage.percentage}%`);
        
        if (results.memoryUsage.percentage < 80) {
          results.memoryUsage.status = 'EXCELLENT';
          console.log('✅ PASSED: Memory usage is below 80% target');
        } else if (results.memoryUsage.percentage < 85) {
          results.memoryUsage.status = 'GOOD';
          console.log('⚠️  ACCEPTABLE: Memory usage is slightly above target but manageable');
        } else {
          results.memoryUsage.status = 'HIGH';
          console.log('❌ FAILED: Memory usage exceeds acceptable limits');
        }
      }

      // Node.js memory check
      const nodeMemory = process.memoryUsage();
      const heapPercentage = Math.round((nodeMemory.heapUsed / nodeMemory.heapTotal) * 100);
      console.log(`📊 Node.js Heap: ${Math.round(nodeMemory.heapUsed / 1024 / 1024)}MB (${heapPercentage}%)`);

    } catch (error) {
      console.log('⚠️  Could not retrieve memory usage data');
      results.memoryUsage.status = 'UNKNOWN';
    }

    // Cache Efficiency Analysis
    console.log('\n🔄 CACHE EFFICIENCY ANALYSIS');
    console.log('============================');

    const fastResponses = results.apiPerformance.details.filter(ep => ep.avgTime < 250).length;
    const totalEndpoints = results.apiPerformance.details.length;
    
    if (totalEndpoints > 0) {
      results.cacheEfficiency.hitRate = Math.round((fastResponses / totalEndpoints) * 100);
      console.log(`📊 Fast Response Rate: ${results.cacheEfficiency.hitRate}% (${fastResponses}/${totalEndpoints} endpoints <250ms)`);
      
      if (results.cacheEfficiency.hitRate >= 75) {
        console.log('✅ EXCELLENT: High cache efficiency detected');
      } else if (results.cacheEfficiency.hitRate >= 50) {
        console.log('✅ GOOD: Moderate cache efficiency');
      } else {
        console.log('⚠️  NEEDS IMPROVEMENT: Low cache efficiency');
      }
    }

    // Overall Phase 2 Assessment
    console.log('\n🎯 PHASE 2: FINAL ASSESSMENT');
    console.log('============================');

    const apiScore = results.apiPerformance.total > 0 ? 
      (results.apiPerformance.passed / results.apiPerformance.total) * 100 : 0;
    
    const memoryScore = results.memoryUsage.status === 'EXCELLENT' ? 100 :
                       results.memoryUsage.status === 'GOOD' ? 80 :
                       results.memoryUsage.status === 'HIGH' ? 40 : 60;

    const cacheScore = results.cacheEfficiency.hitRate;

    results.overallScore = Math.round((apiScore * 0.5) + (memoryScore * 0.3) + (cacheScore * 0.2));

    console.log(`📊 API Performance Score: ${Math.round(apiScore)}% (${results.apiPerformance.passed}/${results.apiPerformance.total} endpoints)`);
    console.log(`📊 Memory Management Score: ${memoryScore}% (${results.memoryUsage.status})`);
    console.log(`📊 Cache Efficiency Score: ${cacheScore}%`);
    console.log(`📊 Overall Phase 2 Score: ${results.overallScore}%`);

    // Determine Phase 2 Status
    if (results.overallScore >= 90 && apiScore === 100) {
      results.phase2Status = 'COMPLETE';
      console.log('\n🏆 PHASE 2 STATUS: COMPLETE ✅');
      console.log('🎉 All enterprise performance targets achieved!');
      console.log('📈 API response times: All under 500ms');
      console.log('🧠 Memory usage: Optimized and stable');
      console.log('🔄 Cache efficiency: High performance');
      console.log('\n🚀 READY TO PROCEED TO PHASE 3: API Reliability & Monitoring');
      
    } else if (results.overallScore >= 80) {
      results.phase2Status = 'MOSTLY_COMPLETE';
      console.log('\n✅ PHASE 2 STATUS: MOSTLY COMPLETE');
      console.log('📊 Most performance targets achieved');
      console.log('⚠️  Minor optimizations may be beneficial');
      
    } else {
      results.phase2Status = 'INCOMPLETE';
      console.log('\n❌ PHASE 2 STATUS: INCOMPLETE');
      console.log('⚠️  Significant performance issues remain');
      
      // Detailed recommendations
      console.log('\n🔧 RECOMMENDATIONS:');
      results.apiPerformance.details.forEach(ep => {
        if (!ep.passed) {
          console.log(`  • ${ep.name}: Optimize to reduce ${ep.avgTime - ep.target}ms`);
        }
      });
      
      if (results.memoryUsage.status === 'HIGH') {
        console.log('  • Memory: Implement additional memory optimization strategies');
      }
      
      if (results.cacheEfficiency.hitRate < 50) {
        console.log('  • Caching: Implement more aggressive caching strategies');
      }
    }

    return {
      success: true,
      results,
      phase2Complete: results.phase2Status === 'COMPLETE'
    };

  } catch (error) {
    console.error('❌ Phase 2 verification failed:', error);
    return {
      success: false,
      error: error.message,
      results
    };
  }
}

finalPhase2Verification().then((summary) => {
  console.log('\n🎊 PHASE 2 PERFORMANCE OPTIMIZATION - VERIFICATION COMPLETE!');
  console.log('============================================================');
  
  if (summary.success && summary.phase2Complete) {
    console.log('🏆 SUCCESS: Phase 2 Performance Optimization is COMPLETE!');
    console.log('✅ All enterprise-grade performance targets achieved');
    console.log('🚀 System is ready for Phase 3: API Reliability & Monitoring');
    process.exit(0);
  } else if (summary.success) {
    console.log('📊 Phase 2 verification completed with mixed results');
    console.log(`📈 Overall score: ${summary.results.overallScore}%`);
    process.exit(0);
  } else {
    console.log('❌ Phase 2 verification encountered errors');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
