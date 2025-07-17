const jwt = require('jsonwebtoken');
const axios = require('axios');

// Get JWT secrets from environment
require('dotenv').config();

async function testJWTGeneration() {
  console.log('🧪 Testing JWT Generation and Verification...\n');
  
  // Test payload matching the teacher user in database
  const testPayload = {
    email: 'ahmedriazbepari@gmail.com',
    role: 'teacher',
    _id: '685c1b673a862730dd0a3b1e',
    tokenId: 'test-token-id-123',
    family: 'test-family-456',
    type: 'access'
  };
  
  console.log('🎫 Creating JWT with payload:', JSON.stringify(testPayload, null, 2));
  
  // Get JWT secret from environment
  const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
  
  if (!JWT_ACCESS_SECRET) {
    console.error('❌ JWT_ACCESS_SECRET not found in environment variables');
    return;
  }
  
  console.log('🔑 Using JWT secret (first 10 chars):', JWT_ACCESS_SECRET.substring(0, 10) + '...');
  
  // Create JWT token
  const token = jwt.sign(testPayload, JWT_ACCESS_SECRET, { expiresIn: '1h' });
  
  console.log('✅ Generated JWT token:', token.substring(0, 50) + '...');
  console.log('🎫 FULL TOKEN FOR TESTING:', token);
  
  // Decode the token to verify
  const decoded = jwt.decode(token);
  console.log('🔍 Decoded token payload:', JSON.stringify(decoded, null, 2));
  
  // Test the token with the API
  console.log('\n🌐 Testing token with /users/me endpoint...');
  
  try {
    const response = await axios.get('http://localhost:5000/api/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ API Response:', response.data);
  } catch (error) {
    console.log('❌ API Error:', error.response?.status, error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.log('📋 Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testJWTGeneration().catch(console.error);
