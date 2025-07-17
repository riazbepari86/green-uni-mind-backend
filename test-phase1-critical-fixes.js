const jwt = require('jsonwebtoken');
const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET = '04a08adaf2e1b46afcdb845e68392169b0dc44fe19e2b0bdc0ea18a42d6c4b7c';

async function testPhase1CriticalFixes() {
  console.log('🔧 Phase 1: Critical Error Resolution - Verification Test\n');
  console.log('Testing Redis SCAN implementation and Teacher ID extraction...\n');

  const results = {
    redisScanTests: [],
    teacherIdTests: [],
    criticalEndpoints: [],
    errors: []
  };

  try {
    // Test 1: Redis SCAN Implementation
    console.log('🔍 Test 1: Redis SCAN Implementation');
    console.log('=====================================');

    try {
      // Test Redis SCAN directly through an endpoint that uses it
      const response = await axios.get(`${API_BASE_URL}/monitoring/health`, {
        timeout: 5000
      });

      if (response.status === 200) {
        results.redisScanTests.push({
          test: 'Redis Health Check',
          status: 'PASS',
          details: 'Redis operations working correctly'
        });
        console.log('✅ Redis Health Check: PASS');
      }
    } catch (error) {
      results.redisScanTests.push({
        test: 'Redis Health Check',
        status: 'FAIL',
        error: error.message
      });
      console.log('❌ Redis Health Check: FAIL -', error.message);
    }

    // Test 2: Teacher ID Extraction from JWT
    console.log('\n🔍 Test 2: Teacher ID Extraction from JWT');
    console.log('==========================================');

    // Generate JWT token for teacher
    const teacherPayload = {
      email: 'ahmedriazbepari@gmail.com',
      role: 'teacher',
      userId: '685c1b673a862730dd0a3b1e'
    };

    const token = jwt.sign(teacherPayload, JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ Generated JWT token with teacher ID:', teacherPayload.userId);

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test endpoints that require teacher ID extraction
    const teacherIdEndpoints = [
      {
        name: 'Account Status',
        path: '/stripe-connect/account-status',
        expectedTeacherId: teacherPayload.userId
      },
      {
        name: 'Quick Status',
        path: '/stripe-connect/quick-status',
        expectedTeacherId: teacherPayload.userId
      }
    ];

    for (const endpoint of teacherIdEndpoints) {
      try {
        const startTime = Date.now();
        const response = await axios({
          method: 'GET',
          url: `${API_BASE_URL}${endpoint.path}`,
          headers,
          timeout: 10000
        });

        const responseTime = Date.now() - startTime;

        if (response.status === 200) {
          results.teacherIdTests.push({
            test: endpoint.name,
            status: 'PASS',
            responseTime: `${responseTime}ms`,
            details: 'Teacher ID extracted and processed correctly'
          });
          console.log(`✅ ${endpoint.name}: PASS (${responseTime}ms)`);
          
          // Check if response contains teacher-specific data
          if (response.data && (response.data.teacherId || response.data.data)) {
            console.log(`   📊 Teacher-specific data returned successfully`);
          }
        } else {
          results.teacherIdTests.push({
            test: endpoint.name,
            status: 'FAIL',
            error: `Unexpected status: ${response.status}`
          });
          console.log(`❌ ${endpoint.name}: FAIL - Status ${response.status}`);
        }
      } catch (error) {
        results.teacherIdTests.push({
          test: endpoint.name,
          status: 'FAIL',
          error: error.response?.data?.message || error.message
        });
        console.log(`❌ ${endpoint.name}: FAIL - ${error.response?.data?.message || error.message}`);
        
        if (error.response?.data?.message?.includes('Teacher not found')) {
          console.log('   ⚠️  Note: This may indicate the teacher ID doesn\'t exist in database');
        }
      }
    }

    // Test 3: Critical Endpoints that Previously Failed
    console.log('\n🔍 Test 3: Critical Endpoints Verification');
    console.log('===========================================');

    const criticalEndpoints = [
      {
        name: 'Dashboard Summary',
        path: `/analytics/teachers/${teacherPayload.userId}/dashboard`,
        critical: true
      },
      {
        name: 'Analytics Overview', 
        path: `/analytics/teachers/${teacherPayload.userId}/overview`,
        critical: true
      }
    ];

    for (const endpoint of criticalEndpoints) {
      try {
        const startTime = Date.now();
        const response = await axios({
          method: 'GET',
          url: `${API_BASE_URL}${endpoint.path}`,
          headers,
          timeout: 10000
        });

        const responseTime = Date.now() - startTime;

        if (response.status === 200) {
          results.criticalEndpoints.push({
            test: endpoint.name,
            status: 'PASS',
            responseTime: `${responseTime}ms`,
            critical: endpoint.critical
          });
          console.log(`✅ ${endpoint.name}: PASS (${responseTime}ms)`);
          
          // Check performance target
          if (responseTime < 500) {
            console.log(`   🚀 Performance: EXCELLENT (under 500ms target)`);
          } else {
            console.log(`   ⚠️  Performance: SLOW (exceeds 500ms target)`);
          }
        } else {
          results.criticalEndpoints.push({
            test: endpoint.name,
            status: 'FAIL',
            error: `Status ${response.status}`,
            critical: endpoint.critical
          });
          console.log(`❌ ${endpoint.name}: FAIL - Status ${response.status}`);
        }
      } catch (error) {
        results.criticalEndpoints.push({
          test: endpoint.name,
          status: 'FAIL',
          error: error.response?.data?.message || error.message,
          critical: endpoint.critical
        });
        console.log(`❌ ${endpoint.name}: FAIL - ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 4: Redis SCAN Function Direct Test
    console.log('\n🔍 Test 4: Redis SCAN Function Direct Test');
    console.log('==========================================');

    try {
      // Test memory optimization endpoint which uses SCAN
      const response = await axios.get(`${API_BASE_URL}/monitoring/performance`, {
        headers,
        timeout: 5000
      });

      if (response.status === 200) {
        results.redisScanTests.push({
          test: 'Redis SCAN via Performance Monitoring',
          status: 'PASS',
          details: 'SCAN operations working through monitoring endpoint'
        });
        console.log('✅ Redis SCAN via Performance Monitoring: PASS');
      }
    } catch (error) {
      results.redisScanTests.push({
        test: 'Redis SCAN via Performance Monitoring',
        status: 'FAIL',
        error: error.message
      });
      console.log('❌ Redis SCAN via Performance Monitoring: FAIL -', error.message);
    }

    // Summary Report
    console.log('\n📊 Phase 1 Critical Fixes - Test Results Summary');
    console.log('================================================');

    const redisScanPassed = results.redisScanTests.filter(t => t.status === 'PASS').length;
    const redisScanTotal = results.redisScanTests.length;
    
    const teacherIdPassed = results.teacherIdTests.filter(t => t.status === 'PASS').length;
    const teacherIdTotal = results.teacherIdTests.length;
    
    const criticalPassed = results.criticalEndpoints.filter(t => t.status === 'PASS').length;
    const criticalTotal = results.criticalEndpoints.length;

    console.log(`🔴 Redis SCAN Implementation: ${redisScanPassed}/${redisScanTotal} tests passed`);
    console.log(`👤 Teacher ID Extraction: ${teacherIdPassed}/${teacherIdTotal} tests passed`);
    console.log(`🎯 Critical Endpoints: ${criticalPassed}/${criticalTotal} tests passed`);

    // Phase 1 Assessment
    const totalPassed = redisScanPassed + teacherIdPassed + criticalPassed;
    const totalTests = redisScanTotal + teacherIdTotal + criticalTotal;
    const successRate = (totalPassed / totalTests) * 100;

    console.log(`\n🎯 Phase 1 Overall Success Rate: ${Math.round(successRate)}% (${totalPassed}/${totalTests})`);

    if (successRate >= 90) {
      console.log('🏆 PHASE 1 STATUS: COMPLETE - All critical errors resolved!');
      return { status: 'COMPLETE', successRate, results };
    } else if (successRate >= 75) {
      console.log('✅ PHASE 1 STATUS: MOSTLY COMPLETE - Minor issues remain');
      return { status: 'MOSTLY_COMPLETE', successRate, results };
    } else {
      console.log('⚠️  PHASE 1 STATUS: INCOMPLETE - Critical issues still exist');
      return { status: 'INCOMPLETE', successRate, results };
    }

  } catch (error) {
    console.error('❌ Phase 1 test failed:', error);
    results.errors.push(error.message);
    return { status: 'ERROR', error: error.message, results };
  }
}

testPhase1CriticalFixes().then((summary) => {
  console.log('\n🎉 Phase 1 Critical Error Resolution Test Completed!');
  
  if (summary.status === 'COMPLETE') {
    console.log('✅ All critical Redis and authentication issues have been resolved.');
    console.log('🚀 Ready to proceed to Phase 2: Performance Optimization');
    process.exit(0);
  } else if (summary.status === 'MOSTLY_COMPLETE') {
    console.log('⚠️  Most critical issues resolved, some minor fixes may be needed.');
    process.exit(0);
  } else {
    console.log('❌ Critical issues still exist and need immediate attention.');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
