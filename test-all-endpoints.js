const jwt = require('jsonwebtoken');
const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET =
  '04a08adaf2e1b46afcdb845e68392169b0dc44fe19e2b0bdc0ea18a42d6c4b7c'; // From .env.railway

async function testAllEndpoints() {
  console.log('🧪 Comprehensive API Endpoint Testing...\n');

  try {
    // Generate JWT token for teacher
    const teacherPayload = {
      email: 'ahmedriazbepari@gmail.com',
      role: 'teacher',
      userId: '685c1b673a862730dd0a3b1e',
    };

    const token = jwt.sign(teacherPayload, JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ Generated JWT token for comprehensive testing\n');

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Define all endpoints to test
    const endpoints = [
      // Dashboard endpoints
      {
        method: 'GET',
        path: '/teacher/dashboard/summary',
        name: 'Dashboard Summary',
      },
      {
        method: 'GET',
        path: '/teacher/analytics/overview',
        name: 'Analytics Overview',
      },

      // Payment endpoints
      {
        method: 'GET',
        path: '/payments/upcoming-payout',
        name: 'Upcoming Payout',
      },
      { method: 'GET', path: '/payments/history', name: 'Payment History' },
      {
        method: 'GET',
        path: '/payments/earnings-summary',
        name: 'Earnings Summary',
      },

      // Stripe Connect endpoints
      {
        method: 'GET',
        path: '/stripe-connect/account-status',
        name: 'Account Status',
      },
      {
        method: 'GET',
        path: '/stripe-connect/onboarding-url',
        name: 'Onboarding URL',
      },

      // Course endpoints
      { method: 'GET', path: '/teacher/courses', name: 'Teacher Courses' },
      {
        method: 'GET',
        path: '/teacher/courses/analytics',
        name: 'Course Analytics',
      },

      // Student endpoints
      { method: 'GET', path: '/teacher/students', name: 'Teacher Students' },
      {
        method: 'GET',
        path: '/teacher/students/analytics',
        name: 'Student Analytics',
      },

      // Notification endpoints
      { method: 'GET', path: '/notifications', name: 'Notifications' },
      {
        method: 'GET',
        path: '/notifications/unread-count',
        name: 'Unread Count',
      },

      // Profile endpoints
      { method: 'GET', path: '/teacher/profile', name: 'Teacher Profile' },

      // Analytics endpoints
      { method: 'GET', path: '/analytics/revenue', name: 'Revenue Analytics' },
      {
        method: 'GET',
        path: '/analytics/performance',
        name: 'Performance Analytics',
      },
      {
        method: 'GET',
        path: '/analytics/engagement',
        name: 'Engagement Analytics',
      },
    ];

    console.log('🔍 Testing API endpoints...\n');

    const results = {
      success: [],
      errors: [],
      warnings: [],
    };

    for (const endpoint of endpoints) {
      const startTime = Date.now();

      try {
        const response = await axios({
          method: endpoint.method,
          url: `${API_BASE_URL}${endpoint.path}`,
          headers,
          timeout: 10000, // 10 second timeout
        });

        const responseTime = Date.now() - startTime;
        const status = response.status;

        if (status >= 200 && status < 300) {
          results.success.push({
            name: endpoint.name,
            path: endpoint.path,
            status,
            responseTime: `${responseTime}ms`,
            hasData: response.data && Object.keys(response.data).length > 0,
          });

          const statusIcon = responseTime > 500 ? '⚠️' : '✅';
          const timeWarning = responseTime > 500 ? ' (SLOW!)' : '';
          console.log(
            `${statusIcon} ${endpoint.name}: ${status} (${responseTime}ms)${timeWarning}`,
          );

          if (responseTime > 500) {
            results.warnings.push({
              name: endpoint.name,
              issue: `Response time ${responseTime}ms exceeds 500ms target`,
              path: endpoint.path,
            });
          }
        } else {
          results.errors.push({
            name: endpoint.name,
            path: endpoint.path,
            status,
            error: `Unexpected status code: ${status}`,
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
            responseTime: `${responseTime}ms`,
          });
          console.log(
            `❌ ${endpoint.name}: ${status} - ${error.response.data?.message || error.message}`,
          );
        } else if (error.code === 'ECONNREFUSED') {
          results.errors.push({
            name: endpoint.name,
            path: endpoint.path,
            status: 'CONNECTION_REFUSED',
            error: 'Server not running or not accessible',
          });
          console.log(
            `❌ ${endpoint.name}: Connection refused - Server not running?`,
          );
        } else {
          results.errors.push({
            name: endpoint.name,
            path: endpoint.path,
            status: 'NETWORK_ERROR',
            error: error.message,
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
      results.errors.forEach((error) => {
        console.log(
          `  • ${error.name} (${error.path}): ${error.status} - ${error.error}`,
        );
      });
    }

    if (results.warnings.length > 0) {
      console.log('\n⚠️  Performance Warnings:');
      results.warnings.forEach((warning) => {
        console.log(`  • ${warning.name}: ${warning.issue}`);
      });
    }

    if (results.success.length > 0) {
      console.log('\n✅ Successful Endpoints:');
      results.success.forEach((success) => {
        console.log(
          `  • ${success.name}: ${success.status} (${success.responseTime})`,
        );
      });
    }

    // Performance analysis
    console.log('\n🚀 Performance Analysis:');
    const fastEndpoints = results.success.filter(
      (r) => parseInt(r.responseTime) < 500,
    );
    const slowEndpoints = results.success.filter(
      (r) => parseInt(r.responseTime) >= 500,
    );

    console.log(`  • Fast endpoints (<500ms): ${fastEndpoints.length}`);
    console.log(`  • Slow endpoints (≥500ms): ${slowEndpoints.length}`);

    if (slowEndpoints.length > 0) {
      console.log('  • Slow endpoints need optimization:');
      slowEndpoints.forEach((endpoint) => {
        console.log(`    - ${endpoint.name}: ${endpoint.responseTime}`);
      });
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (results.errors.length > 0) {
      console.log(
        '  1. Fix failed endpoints by checking route registration and authentication',
      );
      console.log(
        '  2. Verify database connections and external API integrations',
      );
      console.log('  3. Check server logs for detailed error information');
    }

    if (results.warnings.length > 0) {
      console.log(
        '  4. Optimize slow endpoints with caching and database query optimization',
      );
      console.log(
        '  5. Consider implementing response compression for large payloads',
      );
    }

    if (results.success.length === endpoints.length) {
      console.log('  🎉 All endpoints are working correctly!');
    }

    return {
      totalEndpoints: endpoints.length,
      successCount: results.success.length,
      errorCount: results.errors.length,
      warningCount: results.warnings.length,
      results,
    };
  } catch (error) {
    console.error('❌ Comprehensive test failed:', error);
    throw error;
  }
}

testAllEndpoints()
  .then((summary) => {
    console.log('\n🎉 Comprehensive API testing completed!');
    console.log(
      `Final Score: ${summary.successCount}/${summary.totalEndpoints} endpoints working`,
    );

    if (summary.errorCount === 0 && summary.warningCount === 0) {
      console.log('🏆 Perfect score! All endpoints are fast and functional.');
      process.exit(0);
    } else if (summary.errorCount === 0) {
      console.log(
        '✅ All endpoints functional, some performance optimization needed.',
      );
      process.exit(0);
    } else {
      console.log('⚠️  Some endpoints need attention.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
