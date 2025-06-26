const axios = require('axios');
const jwt = require('jsonwebtoken');

// JWT secret from .env file
const JWT_ACCESS_SECRET = '04a08adaf2e1b46afcdb845e68392169b0dc44fe19e2b0bdc0ea18a42d6c4b7c';

async function testAnalyticsEndpoints() {
  console.log('🧪 Testing Analytics Endpoints with Complete Solution...\n');

  // Create JWT token for the ACTUAL teacher user (ahmedriazbepari@gmail.com)
  const testPayload = {
    email: 'ahmedriazbepari@gmail.com',
    role: 'teacher',
    _id: '685c1b673a862730dd0a3b1e', // User ID that owns Teacher ID 685c1b673a862730dd0a3b21
    iat: Math.floor(Date.now() / 1000)
  };

  const token = jwt.sign(testPayload, JWT_ACCESS_SECRET, { expiresIn: '1h' });
  console.log('✅ Generated JWT token for teacher user');
  console.log('📋 User ID:', testPayload._id);
  console.log('👤 Role:', testPayload.role);

  const baseURL = 'http://localhost:5000/api/v1';
  const teacherId = '685c1b673a862730dd0a3b1e'; // Using User ID as teacherId parameter

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Test endpoints that we fixed
  const endpointsToTest = [
    {
      name: 'Dashboard Summary',
      url: `/analytics/teachers/${teacherId}/dashboard`,
      method: 'GET'
    },
    {
      name: 'Teacher Analytics',
      url: `/analytics/teachers/${teacherId}`,
      method: 'GET'
    },
    {
      name: 'Course Analytics',
      url: `/analytics/teachers/${teacherId}/courses`,
      method: 'GET'
    },
    {
      name: 'Revenue Analytics',
      url: `/analytics/teachers/${teacherId}/revenue`,
      method: 'GET'
    },
    {
      name: 'Performance Metrics',
      url: `/analytics/teachers/${teacherId}/performance`,
      method: 'GET'
    },
    {
      name: 'Student Engagement',
      url: `/analytics/teachers/${teacherId}/student-engagement`,
      method: 'GET'
    },
    {
      name: 'Activity Feed',
      url: `/analytics/teachers/${teacherId}/activities`,
      method: 'GET'
    },
    {
      name: 'Enrollment Statistics',
      url: `/analytics/teachers/${teacherId}/enrollment-statistics`,
      method: 'GET'
    }
  ];

  console.log('\n🔍 Testing Analytics Endpoints...\n');

  for (const endpoint of endpointsToTest) {
    console.log(`📊 Testing ${endpoint.name}:`);
    console.log(`   URL: ${endpoint.url}`);
    
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${baseURL}${endpoint.url}`,
        headers: headers,
        timeout: 10000
      });

      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   ✅ Success: ${response.data.success}`);
      
      if (response.data.data) {
        console.log(`   📈 Data received: ${typeof response.data.data === 'object' ? 'Object' : response.data.data}`);
      }
      
      if (response.data.message) {
        console.log(`   💬 Message: ${response.data.message}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Status: ${error.response?.status || 'Network Error'}`);
      console.log(`   ❌ Error: ${error.response?.data?.message || error.message}`);
      
      if (error.response?.status === 401) {
        console.log('   🔐 Authentication issue - check token');
      } else if (error.response?.status === 403) {
        console.log('   🚫 Authorization issue - check user permissions');
      } else if (error.response?.status === 400) {
        console.log('   ⚠️  Validation issue - check request format');
      }
    }
    
    console.log(''); // Empty line for readability
  }

  console.log('🏁 Analytics endpoints testing completed!');
}

testAnalyticsEndpoints().catch(console.error);
