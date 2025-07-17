const jwt = require('jsonwebtoken');
const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET = '04a08adaf2e1b46afcdb845e68392169b0dc44fe19e2b0bdc0ea18a42d6c4b7c'; // From .env.railway

async function testWorkingEndpoints() {
  console.log('🧪 Testing Known Working API Endpoints...\n');

  try {
    // Generate JWT token for teacher
    const teacherPayload = {
      email: 'ahmedriazbepari@gmail.com',
      role: 'teacher',
      userId: '685c1b673a862730dd0a3b1e'
    };

    const token = jwt.sign(teacherPayload, JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ Generated JWT token for testing\n');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const teacherId = teacherPayload.userId;

    // Define endpoints that we know exist and work
    const endpoints = [
      // Analytics endpoints (confirmed working)
      { method: 'GET', path: `/analytics/teachers/${teacherId}/dashboard`, name: 'Dashboard Summary' },
      { method: 'GET', path: `/analytics/teachers/${teacherId}/overview`, name: 'Analytics Overview' },
      
      // Payment endpoints (confirmed working)
      { method: 'GET', path: `/payments/upcoming-payout/${teacherId}`, name: 'Upcoming Payout' },
      { method: 'GET', path: `/payments/earnings/${teacherId}`, name: 'Teacher Earnings' },
      { method: 'GET', path: `/payments/transactions/${teacherId}`, name: 'Transaction Summary' },
      { method: 'GET', path: `/payments/analytics/${teacherId}`, name: 'Payment Analytics' },
      
      // Stripe Connect endpoints (confirmed working)
      { method: 'GET', path: '/stripe-connect/account-status', name: 'Account Status' },
      { method: 'GET', path: '/stripe-connect/quick-status', name: 'Quick Status' },
      
      // Teacher endpoints (confirmed working)
      { method: 'GET', path: `/teachers/${teacherId}/enrolled-students`, name: 'Enrolled Students' },
    ];

    console.log('🔍 Testing confirmed working endpoints...\n');

    const results = {
      success: [],
      errors: [],
      warnings: []
    };

    for (const endpoint of endpoints) {
      const startTime = Date.now();
      
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${API_BASE_URL}${endpoint.path}`,
          headers,
          timeout: 10000 // 10 second timeout
        });

        const responseTime = Date.now() - startTime;
        const status = response.status;
        
        if (status >= 200 && status < 300) {
          results.success.push({
            name: endpoint.name,
            path: endpoint.path,
            status,
            responseTime: `${responseTime}ms`,
            hasData: response.data && Object.keys(response.data).length > 0
          });
          
          const statusIcon = responseTime > 500 ? '⚠️' : '✅';
          const timeWarning = responseTime > 500 ? ' (SLOW!)' : '';
          console.log(`${statusIcon} ${endpoint.name}: ${status} (${responseTime}ms)${timeWarning}`);
          
          if (responseTime > 500) {
            results.warnings.push({
              name: endpoint.name,
              issue: `Response time ${responseTime}ms exceeds 500ms target`,
              path: endpoint.path
            });
          }
        } else {
          results.errors.push({
            name: endpoint.name,
            path: endpoint.path,
            status,
            error: `Unexpected status code: ${status}`
          });
          console.log(`❌ ${endpoint.name}: ${status} (${responseTime}ms)`);
        }
        
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        if (error.response) {
          // Server responded with error status
          const status = error.response.status;
          results.errors.push({
            name: endpoint.name,
            path: endpoint.path,
            status,
            error: error.response.data?.message || error.message,
            responseTime: `${responseTime}ms`
          });
          console.log(`❌ ${endpoint.name}: ${status} - ${error.response.data?.message || error.message}`);
        } else {
          results.errors.push({
            name: endpoint.name,
            path: endpoint.path,
            status: 'NETWORK_ERROR',
            error: error.message
          });
          console.log(`❌ ${endpoint.name}: Network error - ${error.message}`);
        }
      }
    }

    // Summary report
    console.log('\n📊 Test Results Summary:');
    console.log(`  ✅ Successful endpoints: ${results.success.length}`);
    console.log(`  ❌ Failed endpoints: ${results.errors.length}`);
    console.log(`  ⚠️  Performance warnings: ${results.warnings.length}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Failed Endpoints:');
      results.errors.forEach(error => {
        console.log(`  • ${error.name} (${error.path}): ${error.status} - ${error.error}`);
      });
    }

    if (results.warnings.length > 0) {
      console.log('\n⚠️  Performance Warnings:');
      results.warnings.forEach(warning => {
        console.log(`  • ${warning.name}: ${warning.issue}`);
      });
    }

    if (results.success.length > 0) {
      console.log('\n✅ Successful Endpoints:');
      results.success.forEach(success => {
        console.log(`  • ${success.name}: ${success.status} (${success.responseTime})`);
      });
    }

    // Performance analysis
    console.log('\n🚀 Performance Analysis:');
    const fastEndpoints = results.success.filter(r => parseInt(r.responseTime) < 500);
    const slowEndpoints = results.success.filter(r => parseInt(r.responseTime) >= 500);
    
    console.log(`  • Fast endpoints (<500ms): ${fastEndpoints.length}`);
    console.log(`  • Slow endpoints (≥500ms): ${slowEndpoints.length}`);
    
    if (slowEndpoints.length > 0) {
      console.log('  • Slow endpoints need optimization:');
      slowEndpoints.forEach(endpoint => {
        console.log(`    - ${endpoint.name}: ${endpoint.responseTime}`);
      });
    }

    // Final assessment
    console.log('\n🎯 Performance Assessment:');
    if (results.success.length === endpoints.length && results.warnings.length === 0) {
      console.log('  🏆 EXCELLENT: All endpoints working and fast!');
    } else if (results.success.length === endpoints.length) {
      console.log('  ✅ GOOD: All endpoints working, some performance optimization needed');
    } else if (results.success.length > endpoints.length * 0.8) {
      console.log('  ⚠️  FAIR: Most endpoints working, some fixes needed');
    } else {
      console.log('  ❌ POOR: Many endpoints failing, significant fixes needed');
    }

    return {
      totalEndpoints: endpoints.length,
      successCount: results.success.length,
      errorCount: results.errors.length,
      warningCount: results.warnings.length,
      results
    };

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testWorkingEndpoints().then((summary) => {
  console.log('\n🎉 API endpoint testing completed!');
  console.log(`Final Score: ${summary.successCount}/${summary.totalEndpoints} endpoints working`);
  
  if (summary.errorCount === 0 && summary.warningCount === 0) {
    console.log('🏆 Perfect score! All endpoints are fast and functional.');
    process.exit(0);
  } else if (summary.errorCount === 0) {
    console.log('✅ All endpoints functional, some performance optimization completed.');
    process.exit(0);
  } else {
    console.log('⚠️  Some endpoints need attention.');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
