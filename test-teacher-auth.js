const axios = require('axios');
const jwt = require('jsonwebtoken');

// JWT secret from environment
const JWT_ACCESS_SECRET =
  '04a08adaf2e1b46afcdb845e68392169b0dc44fe19e2b0bdc0ea18a42d6c4b7c';

async function testTeacherAuthentication() {
  console.log('🧪 Testing Teacher Authentication and ID Extraction...\n');

  try {
    // Create JWT token for the actual teacher user
    const testPayload = {
      email: 'ahmedriazbepari@gmail.com',
      role: 'teacher',
      _id: '685c1b673a862730dd0a3b1e', // User ID that owns Teacher ID 685c1b673a862730dd0a3b21
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(testPayload, JWT_ACCESS_SECRET);
    console.log('✅ Generated JWT token for teacher:', {
      email: testPayload.email,
      role: testPayload.role,
      userId: testPayload._id,
    });

    // Test endpoints that should work with proper teacher ID extraction
    const baseURL = 'http://localhost:5000/api/v1';
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    console.log('\n🔍 Testing API endpoints with teacher authentication...\n');

    // Test 1: Dashboard Summary (should extract teacher ID properly)
    try {
      console.log('1. Testing Dashboard Summary endpoint...');
      const dashboardResponse = await axios.get(
        `${baseURL}/analytics/teachers/685c1b673a862730dd0a3b21/dashboard`,
        { headers, timeout: 10000 },
      );
      console.log('✅ Dashboard Summary:', {
        status: dashboardResponse.status,
        success: dashboardResponse.data.success,
        hasData: !!dashboardResponse.data.data,
      });
    } catch (error) {
      console.log('❌ Dashboard Summary failed:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
    }

    // Test 2: Account Status (slow endpoint that needs optimization)
    try {
      console.log('\n2. Testing Account Status endpoint...');
      const startTime = Date.now();
      const accountResponse = await axios.get(
        `${baseURL}/stripe-connect/account-status`,
        { headers, timeout: 15000 },
      );
      const responseTime = Date.now() - startTime;
      console.log('✅ Account Status:', {
        status: accountResponse.status,
        responseTime: `${responseTime}ms`,
        success: accountResponse.data.success,
        isConnected: accountResponse.data.data?.isConnected,
      });

      if (responseTime > 500) {
        console.log('⚠️  Response time exceeds 500ms target!');
      }
    } catch (error) {
      console.log('❌ Account Status failed:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
    }

    // Test 3: Teacher Analytics Overview
    try {
      console.log('\n3. Testing Teacher Analytics Overview...');
      const analyticsResponse = await axios.get(
        `${baseURL}/analytics/teachers/685c1b673a862730dd0a3b21/overview`,
        { headers, timeout: 10000 },
      );
      console.log('✅ Analytics Overview:', {
        status: analyticsResponse.status,
        success: analyticsResponse.data.success,
        hasData: !!analyticsResponse.data.data,
      });
    } catch (error) {
      console.log('❌ Analytics Overview failed:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
    }

    // Test 4: Upcoming Payout (slow endpoint)
    try {
      console.log('\n4. Testing Upcoming Payout endpoint...');
      const startTime = Date.now();
      const payoutResponse = await axios.get(
        `${baseURL}/payments/upcoming-payout/685c1b673a862730dd0a3b21`,
        { headers, timeout: 15000 },
      );
      const responseTime = Date.now() - startTime;
      console.log('✅ Upcoming Payout:', {
        status: payoutResponse.status,
        responseTime: `${responseTime}ms`,
        success: payoutResponse.data.success,
        hasData: !!payoutResponse.data.data,
      });

      if (responseTime > 500) {
        console.log('⚠️  Response time exceeds 500ms target!');
      }
    } catch (error) {
      console.log('❌ Upcoming Payout failed:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
    }
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

testTeacherAuthentication()
  .then(() => {
    console.log('\n🎉 Teacher authentication tests completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
