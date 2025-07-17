const jwt = require('jsonwebtoken');
const axios = require('axios');

// Get JWT secrets from environment
require('dotenv').config();

async function testStoredTokens() {
  console.log('🧪 Testing Stored Tokens from Frontend...\n');
  
  // These are the tokens that should be stored in the frontend localStorage
  // We'll test with the token we generated earlier
  const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFobWVkcmlhemJlcGFyaUBnbWFpbC5jb20iLCJyb2xlIjoidGVhY2hlciIsIl9pZCI6IjY4NWMxYjY3M2E4NjI3MzBkZDBhM2IxZSIsInRva2VuSWQiOiJ0ZXN0LXRva2VuLWlkLTEyMyIsImZhbWlseSI6InRlc3QtZmFtaWx5LTQ1NiIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3NTA5NTgyNjcsImV4cCI6MTc1MDk2MTg2N30.-508kT5HH0KdHvC-LajWVUCNumWkwqy9I0WrOuTwxvw";
  
  console.log('🎫 Testing token:', testToken.substring(0, 50) + '...');
  
  // Check if token is expired
  try {
    const decoded = jwt.decode(testToken);
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = decoded.exp;
    const timeToExpiration = expirationTime - currentTime;
    
    console.log('⏰ Token expiration check:');
    console.log('Current time:', currentTime);
    console.log('Token expires at:', expirationTime);
    console.log('Time to expiration (seconds):', timeToExpiration);
    
    if (timeToExpiration <= 0) {
      console.log('❌ TOKEN IS EXPIRED!');
      console.log('Need to generate a new token...');
      
      // Generate a new token
      const newPayload = {
        email: 'ahmedriazbepari@gmail.com',
        role: 'teacher',
        _id: '685c1b673a862730dd0a3b1e',
        tokenId: 'test-token-id-' + Date.now(),
        family: 'test-family-' + Date.now(),
        type: 'access'
      };
      
      const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
      const newToken = jwt.sign(newPayload, JWT_ACCESS_SECRET, { expiresIn: '1h' });
      
      console.log('✅ NEW TOKEN GENERATED:', newToken);
      console.log('\n🔧 COPY THIS TOKEN TO FRONTEND localStorage:');
      console.log('localStorage.setItem("accessToken", "' + newToken + '");');
      
      // Test the new token
      await testTokenWithAPI(newToken);
    } else {
      console.log('✅ Token is still valid');
      await testTokenWithAPI(testToken);
    }
  } catch (error) {
    console.error('❌ Error checking token:', error.message);
  }
}

async function testTokenWithAPI(token) {
  console.log('\n🌐 Testing token with APIs...');
  
  try {
    // Test /users/me endpoint
    console.log('Testing /users/me...');
    const meResponse = await axios.get('http://localhost:5000/api/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ /users/me SUCCESS');
    console.log('Teacher ID:', meResponse.data.data._id);
    
    // Test courses endpoint
    const teacherId = meResponse.data.data._id;
    console.log('\nTesting /courses/creator/' + teacherId + '...');
    const coursesResponse = await axios.get(`http://localhost:5000/api/v1/courses/creator/${teacherId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ /courses/creator SUCCESS');
    console.log('Number of courses:', coursesResponse.data.data.length);
    
    if (coursesResponse.data.data.length > 0) {
      const courseId = coursesResponse.data.data[0]._id;
      console.log('\nTesting /lectures/' + courseId + '/get-lectures...');
      const lecturesResponse = await axios.get(`http://localhost:5000/api/v1/lectures/${courseId}/get-lectures`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ /lectures SUCCESS');
      console.log('Number of lectures:', lecturesResponse.data.data.length);
    }
    
  } catch (error) {
    console.log('❌ API Error:', error.response?.status, error.response?.data?.message || error.message);
  }
}

testStoredTokens().catch(console.error);
