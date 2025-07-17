const axios = require('axios');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5000/api/v1';

// Generate test tokens
function generateToken(payload) {
  return jwt.sign(
    payload,
    '04a08adaf2e1b46afcdb845e68392169b0dc44fe19e2b0bdc0ea18a42d6c4b7c',
    { expiresIn: '1h' },
  );
}

const teacherToken = generateToken({
  email: 'ahmedriazbepari@gmail.com',
  role: 'teacher',
  _id: '685c1b673a862730dd0a3b1e',
  iat: Math.floor(Date.now() / 1000),
});

const studentToken = generateToken({
  email: 'student@example.com',
  role: 'student',
  _id: '507f1f77bcf86cd799439011',
  iat: Math.floor(Date.now() / 1000),
});

async function testEndpoint(method, url, token, description) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };

    const response = await axios(config);
    console.log(
      `✅ ${description}: ${response.status} (${response.data?.message || 'OK'})`,
    );
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    const status = error.response?.status || 'TIMEOUT';
    const message = error.response?.data?.message || error.message;
    console.log(`❌ ${description}: ${status} - ${message}`);
    return { success: false, status, message, url };
  }
}

async function testProblematicEndpoints() {
  console.log('🔍 TESTING PROBLEMATIC API ENDPOINTS');
  console.log('=====================================\n');

  const tests = [
    // Analytics endpoint with undefined teacherId issue
    {
      method: 'GET',
      url: '/analytics/teachers/undefined/performance-detailed',
      token: teacherToken,
      description: 'Analytics Performance Detailed (undefined teacherId)',
    },
    {
      method: 'GET',
      url: '/analytics/teachers/685c1b673a862730dd0a3b1e/performance-detailed',
      token: teacherToken,
      description: 'Analytics Performance Detailed (with user ID)',
    },
    {
      method: 'GET',
      url: '/analytics/teachers/685c1b673a862730dd0a3b21/performance-detailed',
      token: teacherToken,
      description: 'Analytics Performance Detailed (with teacher ID)',
    },

    // Missing review endpoints
    {
      method: 'GET',
      url: '/reviews/teacher/685c1b673a862730dd0a3b21/stats',
      token: teacherToken,
      description: 'Teacher Review Stats (missing route)',
    },
    {
      method: 'GET',
      url: '/reviews/teacher/685c1b673a862730dd0a3b21/dashboard',
      token: teacherToken,
      description: 'Teacher Review Dashboard (missing route)',
    },

    // Existing review endpoints for comparison
    {
      method: 'GET',
      url: '/reviews/teacher/685c1b673a862730dd0a3b21',
      token: teacherToken,
      description: 'Teacher Reviews (existing route)',
    },
  ];

  const results = [];
  for (const test of tests) {
    const result = await testEndpoint(
      test.method,
      test.url,
      test.token,
      test.description,
    );
    results.push({ ...test, ...result });
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
  }

  console.log('\n📊 SUMMARY OF ISSUES');
  console.log('====================');

  const failedTests = results.filter((r) => !r.success);
  const successfulTests = results.filter((r) => r.success);

  console.log(`✅ Working endpoints: ${successfulTests.length}`);
  console.log(`❌ Failed endpoints: ${failedTests.length}`);

  if (failedTests.length > 0) {
    console.log('\n🔍 FAILED ENDPOINTS ANALYSIS:');
    failedTests.forEach((test) => {
      console.log(`   ${test.status} - ${test.url}`);
      console.log(`      Issue: ${test.message}`);
    });
  }

  return results;
}

async function checkRedisMemory() {
  console.log('\n🔍 CHECKING REDIS MEMORY USAGE');
  console.log('===============================');

  try {
    const response = await axios.get(`${BASE_URL}/monitoring/redis-usage`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      timeout: 5000,
    });

    const usage = response.data?.data;
    if (usage) {
      console.log(
        `📊 Memory Usage: ${usage.memoryUsage?.percentage?.toFixed(1)}%`,
      );
      console.log(`🔑 Total Keys: ${usage.totalKeys?.toLocaleString()}`);
      console.log(
        `🔗 Active Connections: ${usage.connectionStats?.activeConnections}`,
      );

      if (usage.memoryUsage?.percentage > 90) {
        console.log('🚨 CRITICAL: Memory usage above 90%');
      } else if (usage.memoryUsage?.percentage > 80) {
        console.log('⚠️  WARNING: Memory usage above 80%');
      }
    }
  } catch (error) {
    console.log(`❌ Failed to check Redis memory: ${error.message}`);
  }
}

// Run the tests
async function main() {
  console.log('🚀 STARTING API ISSUE DIAGNOSIS');
  console.log('================================\n');

  await testProblematicEndpoints();
  await checkRedisMemory();

  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Fix undefined teacherId in analytics endpoint');
  console.log('2. Implement missing review stats and dashboard routes');
  console.log('3. Optimize Redis memory usage if above 80%');
  console.log('4. Test fixes and verify all endpoints work');
}

main().catch(console.error);
