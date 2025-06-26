const axios = require('axios');

async function testAuthFlow() {
  const baseURL = 'http://localhost:5000/api/v1';

  console.log('🧪 Testing Authentication Flow...\n');

  // Test 1: Try to access /users/me without token
  console.log('1️⃣ Testing /users/me without token:');
  try {
    const response = await axios.get(`${baseURL}/users/me`);
    console.log('✅ Response:', response.data);
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
  }

  console.log('\n2️⃣ Testing /users/me with invalid token:');
  try {
    const response = await axios.get(`${baseURL}/users/me`, {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });
    console.log('✅ Response:', response.data);
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
  }
  
  // Test 3: Generate a test JWT token for the user
  console.log('\n3️⃣ Generating test JWT token for user...');
  const jwt = require('jsonwebtoken');
  
  // Use the same secret as the backend (you might need to adjust this)
  const JWT_SECRET = 'your-jwt-secret-here'; // Replace with actual secret
  
  const testPayload = {
    email: 'hasanhridoymahabub9@gmail.com',
    role: 'student',
    _id: '685bcf296aeec36c71a77d89',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  };
  
  console.log('🎫 Test JWT Payload:', JSON.stringify(testPayload, null, 2));
  
  // Note: This will fail without the correct JWT secret
  // The purpose is to show the payload structure
  console.log('\n📝 To test with a real token:');
  console.log('1. Get a token from the OAuth flow');
  console.log('2. Use the debug-jwt.js script to decode it');
  console.log('3. Check if the email in the token matches the database');
}

testAuthFlow().catch(console.error);
