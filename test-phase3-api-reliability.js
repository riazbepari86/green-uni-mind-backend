const jwt = require('jsonwebtoken');
const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET =
  '04a08adaf2e1b46afcdb845e68392169b0dc44fe19e2b0bdc0ea18a42d6c4b7c';

async function testPhase3ApiReliability() {
  console.log(
    '🔍 PHASE 3: API RELIABILITY & MONITORING - Comprehensive Analysis',
  );
  console.log(
    '================================================================',
  );
  console.log(
    'Identifying and resolving 404/400 API errors for enterprise reliability\n',
  );

  const results = {
    workingEndpoints: [],
    errorEndpoints: [],
    routeRegistration: [],
    authenticationIssues: [],
    totalTested: 0,
    successRate: 0,
    criticalIssues: [],
  };

  try {
    // Generate JWT tokens for different user types
    const teacherPayload = {
      email: 'ahmedriazbepari@gmail.com',
      role: 'teacher',
      userId: '685c1b673a862730dd0a3b1e',
    };

    const studentPayload = {
      email: 'student@example.com',
      role: 'student',
      userId: '507f1f77bcf86cd799439011',
    };

    const teacherToken = jwt.sign(teacherPayload, JWT_SECRET, {
      expiresIn: '1h',
    });
    const studentToken = jwt.sign(studentPayload, JWT_SECRET, {
      expiresIn: '1h',
    });

    console.log('✅ Generated authentication tokens for testing\n');

    // Comprehensive endpoint testing matrix
    const endpointTests = [
      // Analytics endpoints (teacher-specific)
      {
        category: 'Analytics',
        name: 'Dashboard Summary',
        method: 'GET',
        path: `/analytics/teachers/${teacherPayload.userId}/dashboard`,
        token: teacherToken,
        expectedStatus: 200,
        critical: true,
      },
      {
        category: 'Analytics',
        name: 'Analytics Overview',
        method: 'GET',
        path: `/analytics/teachers/${teacherPayload.userId}/overview`,
        token: teacherToken,
        expectedStatus: 200,
        critical: true,
      },
      {
        category: 'Analytics',
        name: 'Student Analytics',
        method: 'GET',
        path: `/analytics/students/${studentPayload.userId}/dashboard`,
        token: studentToken,
        expectedStatus: [200, 404], // May not exist yet
        critical: false,
      },

      // Stripe Connect endpoints
      {
        category: 'Stripe Connect',
        name: 'Account Status',
        method: 'GET',
        path: '/stripe-connect/account-status',
        token: teacherToken,
        expectedStatus: 200,
        critical: true,
      },
      {
        category: 'Stripe Connect',
        name: 'Quick Status',
        method: 'GET',
        path: '/stripe-connect/quick-status',
        token: teacherToken,
        expectedStatus: 200,
        critical: true,
      },
      {
        category: 'Stripe Connect',
        name: 'Connect Account',
        method: 'POST',
        path: '/stripe-connect/connect',
        token: teacherToken,
        expectedStatus: [200, 400], // May fail if already connected
        critical: false,
        body: {
          type: 'account_onboarding',
          returnUrl: 'http://localhost:3000/dashboard',
        },
      },

      // Payment endpoints
      {
        category: 'Payments',
        name: 'Upcoming Payout',
        method: 'GET',
        path: `/payments/upcoming-payout/${teacherPayload.userId}`,
        token: teacherToken,
        expectedStatus: [200, 404], // May not have payouts
        critical: false,
      },
      {
        category: 'Payments',
        name: 'Teacher Earnings',
        method: 'GET',
        path: `/payments/earnings/${teacherPayload.userId}`,
        token: teacherToken,
        expectedStatus: [200, 404], // May not have earnings
        critical: false,
      },
      {
        category: 'Payments',
        name: 'Payment History',
        method: 'GET',
        path: `/payments/history/${teacherPayload.userId}`,
        token: teacherToken,
        expectedStatus: [200, 404],
        critical: false,
      },

      // User Management endpoints
      {
        category: 'Users',
        name: 'Teacher Profile',
        method: 'GET',
        path: `/users/teachers/${teacherPayload.userId}`,
        token: teacherToken,
        expectedStatus: [200, 404],
        critical: false,
      },
      {
        category: 'Users',
        name: 'Student Profile',
        method: 'GET',
        path: `/users/students/${studentPayload.userId}`,
        token: studentToken,
        expectedStatus: [200, 404],
        critical: false,
      },

      // Course Management endpoints
      {
        category: 'Courses',
        name: 'Teacher Courses',
        method: 'GET',
        path: `/courses/teacher/${teacherPayload.userId}`,
        token: teacherToken,
        expectedStatus: [200, 404],
        critical: false,
      },
      {
        category: 'Courses',
        name: 'Course List',
        method: 'GET',
        path: '/courses',
        token: teacherToken,
        expectedStatus: [200, 404],
        critical: false,
      },

      // System endpoints
      {
        category: 'System',
        name: 'Health Check',
        method: 'GET',
        path: '/monitoring/health',
        token: teacherToken,
        expectedStatus: 200,
        critical: true,
      },
      {
        category: 'System',
        name: 'Performance Metrics',
        method: 'GET',
        path: '/monitoring/performance',
        token: teacherToken,
        expectedStatus: 200,
        critical: true,
      },

      // Authentication endpoints
      {
        category: 'Auth',
        name: 'Token Validation',
        method: 'GET',
        path: '/api-validation/validate',
        token: teacherToken,
        expectedStatus: [200, 404],
        critical: false,
      },

      // Dashboard endpoints
      {
        category: 'Dashboard',
        name: 'Teacher Dashboard',
        method: 'GET',
        path: `/dashboard/teacher/${teacherPayload.userId}`,
        token: teacherToken,
        expectedStatus: [200, 404],
        critical: false,
      },
    ];

    console.log('🧪 COMPREHENSIVE API ENDPOINT TESTING');
    console.log('=====================================');

    // Group tests by category for organized output
    const categories = [...new Set(endpointTests.map((test) => test.category))];

    for (const category of categories) {
      console.log(`\n📂 ${category} Endpoints:`);
      console.log('─'.repeat(40));

      const categoryTests = endpointTests.filter(
        (test) => test.category === category,
      );

      for (const test of categoryTests) {
        results.totalTested++;
        const startTime = Date.now();

        try {
          const headers = {
            Authorization: `Bearer ${test.token}`,
            'Content-Type': 'application/json',
          };

          const config = {
            method: test.method,
            url: `${API_BASE_URL}${test.path}`,
            headers,
            timeout: 10000,
          };

          if (test.body) {
            config.data = test.body;
          }

          const response = await axios(config);
          const responseTime = Date.now() - startTime;

          const expectedStatuses = Array.isArray(test.expectedStatus)
            ? test.expectedStatus
            : [test.expectedStatus];
          const isExpectedStatus = expectedStatuses.includes(response.status);

          if (isExpectedStatus) {
            results.workingEndpoints.push({
              ...test,
              status: response.status,
              responseTime,
              dataReceived: !!response.data,
            });
            console.log(
              `  ✅ ${test.name}: ${response.status} (${responseTime}ms)`,
            );
          } else {
            results.errorEndpoints.push({
              ...test,
              status: response.status,
              responseTime,
              error: `Unexpected status: ${response.status}`,
              expected: expectedStatuses,
            });
            console.log(
              `  ⚠️  ${test.name}: ${response.status} (Expected: ${expectedStatuses.join('|')})`,
            );
          }
        } catch (error) {
          const responseTime = Date.now() - startTime;
          const status = error.response?.status || 'NETWORK_ERROR';
          const errorMessage = error.response?.data?.message || error.message;

          // Categorize the error
          if (status === 404) {
            results.routeRegistration.push({
              ...test,
              status: 404,
              error: 'Route not found - needs registration',
              path: test.path,
              method: test.method,
            });
            console.log(`  ❌ ${test.name}: 404 - Route not registered`);
          } else if (status === 400) {
            results.errorEndpoints.push({
              ...test,
              status: 400,
              error: errorMessage,
              responseTime,
            });
            console.log(`  ❌ ${test.name}: 400 - ${errorMessage}`);
          } else if (status === 401 || status === 403) {
            results.authenticationIssues.push({
              ...test,
              status,
              error: 'Authentication/Authorization issue',
              responseTime,
            });
            console.log(`  🔒 ${test.name}: ${status} - Auth issue`);
          } else {
            results.errorEndpoints.push({
              ...test,
              status,
              error: errorMessage,
              responseTime,
            });
            console.log(`  ❌ ${test.name}: ${status} - ${errorMessage}`);
          }

          // Mark critical issues
          if (test.critical && (status === 404 || status === 500)) {
            results.criticalIssues.push({
              ...test,
              status,
              error: errorMessage,
              impact: 'HIGH - Critical endpoint failure',
            });
          }
        }
      }
    }

    // Calculate success rate
    results.successRate =
      results.totalTested > 0
        ? Math.round(
            (results.workingEndpoints.length / results.totalTested) * 100,
          )
        : 0;

    // Analysis and Reporting
    console.log('\n📊 API RELIABILITY ANALYSIS');
    console.log('===========================');

    console.log(
      `📈 Overall Success Rate: ${results.successRate}% (${results.workingEndpoints.length}/${results.totalTested})`,
    );
    console.log(`✅ Working Endpoints: ${results.workingEndpoints.length}`);
    console.log(`❌ Error Endpoints: ${results.errorEndpoints.length}`);
    console.log(`🔍 Missing Routes: ${results.routeRegistration.length}`);
    console.log(`🔒 Auth Issues: ${results.authenticationIssues.length}`);
    console.log(`🚨 Critical Issues: ${results.criticalIssues.length}`);

    // Critical Issues Report
    if (results.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION');
      console.log('================================================');
      results.criticalIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.name} (${issue.category})`);
        console.log(`   Path: ${issue.method} ${issue.path}`);
        console.log(`   Status: ${issue.status}`);
        console.log(`   Error: ${issue.error}`);
        console.log(`   Impact: ${issue.impact}\n`);
      });
    }

    // Missing Routes Report
    if (results.routeRegistration.length > 0) {
      console.log('\n🔍 MISSING ROUTES REQUIRING REGISTRATION');
      console.log('========================================');
      results.routeRegistration.forEach((route, index) => {
        console.log(`${index + 1}. ${route.method} ${route.path}`);
        console.log(`   Endpoint: ${route.name} (${route.category})`);
        console.log(`   Critical: ${route.critical ? 'YES' : 'NO'}\n`);
      });
    }

    // Authentication Issues Report
    if (results.authenticationIssues.length > 0) {
      console.log('\n🔒 AUTHENTICATION/AUTHORIZATION ISSUES');
      console.log('======================================');
      results.authenticationIssues.forEach((auth, index) => {
        console.log(`${index + 1}. ${auth.name} (${auth.category})`);
        console.log(`   Path: ${auth.method} ${auth.path}`);
        console.log(`   Status: ${auth.status}`);
        console.log(`   Issue: ${auth.error}\n`);
      });
    }

    // Recommendations
    console.log('\n💡 PHASE 3 RECOMMENDATIONS');
    console.log('==========================');

    if (results.criticalIssues.length > 0) {
      console.log('🚨 HIGH PRIORITY:');
      console.log('  • Fix critical endpoint failures immediately');
      console.log(
        '  • Ensure all core analytics and monitoring endpoints work',
      );
    }

    if (results.routeRegistration.length > 0) {
      console.log('🔍 MEDIUM PRIORITY:');
      console.log('  • Register missing API routes');
      console.log(
        '  • Implement proper error handling for unregistered routes',
      );
    }

    if (results.authenticationIssues.length > 0) {
      console.log('🔒 SECURITY PRIORITY:');
      console.log('  • Review authentication middleware');
      console.log('  • Ensure proper role-based access control');
    }

    console.log('📊 MONITORING PRIORITY:');
    console.log('  • Implement comprehensive API monitoring');
    console.log('  • Set up alerting for endpoint failures');
    console.log('  • Create API reliability dashboard');

    return {
      success: true,
      results,
      needsWork: results.criticalIssues.length > 0 || results.successRate < 80,
    };
  } catch (error) {
    console.error('❌ Phase 3 API reliability test failed:', error);
    return {
      success: false,
      error: error.message,
      results,
    };
  }
}

testPhase3ApiReliability()
  .then((summary) => {
    console.log('\n🎯 PHASE 3: API RELIABILITY ASSESSMENT COMPLETE');
    console.log('===============================================');

    if (summary.success) {
      if (summary.needsWork) {
        console.log(
          '⚠️  API reliability issues identified - remediation needed',
        );
        console.log(`📊 Success rate: ${summary.results.successRate}%`);
        console.log(
          `🚨 Critical issues: ${summary.results.criticalIssues.length}`,
        );
        console.log(
          `🔍 Missing routes: ${summary.results.routeRegistration.length}`,
        );
      } else {
        console.log('✅ API reliability is excellent - minimal issues found');
        console.log('🚀 Ready to implement comprehensive monitoring');
      }
      process.exit(0);
    } else {
      console.log('❌ API reliability assessment failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Assessment failed:', error);
    process.exit(1);
  });
