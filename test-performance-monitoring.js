const jwt = require('jsonwebtoken');
const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET = '04a08adaf2e1b46afcdb845e68392169b0dc44fe19e2b0bdc0ea18a42d6c4b7c';

async function testPerformanceMonitoring() {
  console.log('🧪 Testing Performance Monitoring System...\n');

  try {
    // Generate JWT token for teacher
    const teacherPayload = {
      email: 'ahmedriazbepari@gmail.com',
      role: 'teacher',
      userId: '685c1b673a862730dd0a3b1e'
    };

    const token = jwt.sign(teacherPayload, JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ Generated JWT token for monitoring tests\n');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const teacherId = teacherPayload.userId;

    console.log('🔍 Testing monitoring endpoints...\n');

    // Test monitoring endpoints
    const monitoringEndpoints = [
      { method: 'GET', path: '/monitoring/health', name: 'System Health' },
      { method: 'GET', path: '/monitoring/performance', name: 'Performance Metrics' },
      { method: 'GET', path: '/monitoring/redis', name: 'Redis Monitoring' },
      { method: 'GET', path: '/monitoring/stats', name: 'System Stats' },
    ];

    const monitoringResults = [];

    for (const endpoint of monitoringEndpoints) {
      const startTime = Date.now();
      
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${API_BASE_URL}${endpoint.path}`,
          headers,
          timeout: 5000
        });

        const responseTime = Date.now() - startTime;
        monitoringResults.push({
          name: endpoint.name,
          status: response.status,
          responseTime,
          success: true,
          data: response.data
        });

        console.log(`✅ ${endpoint.name}: ${response.status} (${responseTime}ms)`);
        
        // Log key metrics if available
        if (response.data) {
          if (response.data.systemHealth) {
            console.log(`   📊 System Health: ${JSON.stringify(response.data.systemHealth, null, 2)}`);
          }
          if (response.data.performance) {
            console.log(`   ⚡ Performance: ${JSON.stringify(response.data.performance, null, 2)}`);
          }
          if (response.data.redis) {
            console.log(`   🔴 Redis: ${JSON.stringify(response.data.redis, null, 2)}`);
          }
        }
        
      } catch (error) {
        const responseTime = Date.now() - startTime;
        monitoringResults.push({
          name: endpoint.name,
          status: error.response?.status || 'ERROR',
          responseTime,
          success: false,
          error: error.response?.data?.message || error.message
        });

        console.log(`❌ ${endpoint.name}: ${error.response?.status || 'ERROR'} - ${error.response?.data?.message || error.message}`);
      }
    }

    console.log('\n🚀 Generating load to test monitoring...\n');

    // Generate some load to test monitoring
    const loadTestEndpoints = [
      `/analytics/teachers/${teacherId}/dashboard`,
      `/analytics/teachers/${teacherId}/overview`,
      '/stripe-connect/account-status',
      '/stripe-connect/quick-status'
    ];

    const loadTestResults = [];

    for (let i = 0; i < 10; i++) {
      for (const endpoint of loadTestEndpoints) {
        const startTime = Date.now();
        
        try {
          const response = await axios({
            method: 'GET',
            url: `${API_BASE_URL}${endpoint}`,
            headers,
            timeout: 5000
          });

          const responseTime = Date.now() - startTime;
          loadTestResults.push({
            endpoint,
            responseTime,
            status: response.status,
            success: true
          });

          console.log(`📈 Load test ${i+1}/10 - ${endpoint}: ${response.status} (${responseTime}ms)`);
          
        } catch (error) {
          const responseTime = Date.now() - startTime;
          loadTestResults.push({
            endpoint,
            responseTime,
            status: error.response?.status || 'ERROR',
            success: false
          });
        }
      }
    }

    console.log('\n📊 Load Test Results Analysis:');
    
    // Analyze load test results
    const endpointStats = {};
    loadTestResults.forEach(result => {
      if (!endpointStats[result.endpoint]) {
        endpointStats[result.endpoint] = {
          requests: 0,
          totalTime: 0,
          successes: 0,
          errors: 0,
          times: []
        };
      }
      
      const stats = endpointStats[result.endpoint];
      stats.requests++;
      stats.totalTime += result.responseTime;
      stats.times.push(result.responseTime);
      
      if (result.success) {
        stats.successes++;
      } else {
        stats.errors++;
      }
    });

    Object.entries(endpointStats).forEach(([endpoint, stats]) => {
      const avgTime = stats.totalTime / stats.requests;
      const sortedTimes = stats.times.sort((a, b) => a - b);
      const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const successRate = (stats.successes / stats.requests) * 100;
      
      console.log(`  📍 ${endpoint}:`);
      console.log(`     Requests: ${stats.requests}`);
      console.log(`     Avg Response Time: ${Math.round(avgTime)}ms`);
      console.log(`     P95 Response Time: ${Math.round(p95)}ms`);
      console.log(`     Success Rate: ${Math.round(successRate)}%`);
      
      if (avgTime > 500) {
        console.log(`     ⚠️  SLOW: Average response time exceeds 500ms target`);
      } else {
        console.log(`     ✅ FAST: Within 500ms performance target`);
      }
    });

    console.log('\n🎯 Performance Monitoring Assessment:');
    
    const workingMonitoring = monitoringResults.filter(r => r.success).length;
    const totalMonitoring = monitoringResults.length;
    
    console.log(`  📊 Monitoring Endpoints: ${workingMonitoring}/${totalMonitoring} working`);
    
    const fastEndpoints = Object.values(endpointStats).filter(stats => 
      (stats.totalTime / stats.requests) < 500
    ).length;
    const totalEndpoints = Object.keys(endpointStats).length;
    
    console.log(`  ⚡ Performance: ${fastEndpoints}/${totalEndpoints} endpoints under 500ms`);
    
    const highSuccessRate = Object.values(endpointStats).filter(stats => 
      (stats.successes / stats.requests) >= 0.95
    ).length;
    
    console.log(`  ✅ Reliability: ${highSuccessRate}/${totalEndpoints} endpoints >95% success rate`);

    // Final monitoring check
    console.log('\n🔍 Final monitoring system check...');
    
    try {
      const healthResponse = await axios({
        method: 'GET',
        url: `${API_BASE_URL}/monitoring/health`,
        headers,
        timeout: 5000
      });
      
      console.log('✅ Monitoring system is operational');
      if (healthResponse.data) {
        console.log('📊 Current system status:', JSON.stringify(healthResponse.data, null, 2));
      }
      
    } catch (error) {
      console.log('⚠️  Monitoring system may need attention');
    }

    return {
      monitoringEndpoints: {
        working: workingMonitoring,
        total: totalMonitoring
      },
      performance: {
        fastEndpoints,
        totalEndpoints,
        averageResponseTime: Object.values(endpointStats).reduce((sum, stats) => 
          sum + (stats.totalTime / stats.requests), 0) / totalEndpoints
      },
      reliability: {
        highSuccessRate,
        totalEndpoints
      }
    };

  } catch (error) {
    console.error('❌ Performance monitoring test failed:', error);
    throw error;
  }
}

testPerformanceMonitoring().then((results) => {
  console.log('\n🎉 Performance monitoring test completed!');
  
  const monitoringScore = (results.monitoringEndpoints.working / results.monitoringEndpoints.total) * 100;
  const performanceScore = (results.performance.fastEndpoints / results.performance.totalEndpoints) * 100;
  const reliabilityScore = (results.reliability.highSuccessRate / results.reliability.totalEndpoints) * 100;
  
  console.log(`\n📊 Final Scores:`);
  console.log(`  🔍 Monitoring: ${Math.round(monitoringScore)}%`);
  console.log(`  ⚡ Performance: ${Math.round(performanceScore)}%`);
  console.log(`  ✅ Reliability: ${Math.round(reliabilityScore)}%`);
  
  const overallScore = (monitoringScore + performanceScore + reliabilityScore) / 3;
  console.log(`  🏆 Overall: ${Math.round(overallScore)}%`);
  
  if (overallScore >= 90) {
    console.log('\n🏆 EXCELLENT: Performance monitoring system is working perfectly!');
    process.exit(0);
  } else if (overallScore >= 75) {
    console.log('\n✅ GOOD: Performance monitoring system is working well with minor issues.');
    process.exit(0);
  } else {
    console.log('\n⚠️  NEEDS IMPROVEMENT: Performance monitoring system needs attention.');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
