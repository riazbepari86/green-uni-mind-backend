const jwt = require('jsonwebtoken');
const axios = require('axios');

// Get JWT secrets from environment
require('dotenv').config();

async function testFrontendAPI() {
  console.log('🧪 Testing Frontend API Configuration...\n');
  
  // Test payload matching the user in database
  const testPayload = {
    email: 'hasanhridoymahabub9@gmail.com',
    role: 'student',
    _id: '685bcf296aeec36c71a77d89',
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
  
  // Create JWT token
  const token = jwt.sign(testPayload, JWT_ACCESS_SECRET, { expiresIn: '1h' });
  
  console.log('✅ Generated JWT token');
  
  // Test the token with the CORRECT API endpoint that frontend should use
  console.log('\n🌐 Testing token with CORRECT /api/v1/users/me endpoint...');
  
  try {
    const response = await axios.get('http://localhost:5000/api/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ CORRECT API Response Status:', response.status);
    console.log('✅ CORRECT API Response Success:', response.data.success);
    console.log('✅ User found:', response.data.data.user.email);
  } catch (error) {
    console.log('❌ CORRECT API Error:', error.response?.status, error.response?.data?.message || error.message);
  }
  
  // Test the WRONG endpoint that was causing 404s
  console.log('\n🌐 Testing token with WRONG /api/users/me endpoint (should fail)...');
  
  try {
    const response = await axios.get('http://localhost:5000/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('❌ WRONG API Response (should not succeed):', response.status);
  } catch (error) {
    console.log('✅ WRONG API Error (expected):', error.response?.status, error.response?.data?.message || error.message);
  }
}

testFrontendAPI().catch(console.error);
