const jwt = require('jsonwebtoken');

// Test JWT token decoding
function decodeJWT(token) {
  try {
    // Decode without verification to see the payload
    const decoded = jwt.decode(token);
    console.log('🔍 JWT Token Payload:');
    console.log(JSON.stringify(decoded, null, 2));
    return decoded;
  } catch (error) {
    console.error('❌ Error decoding JWT:', error.message);
    return null;
  }
}

// Test with a sample token (you can replace this with an actual token)
const sampleToken = process.argv[2];

if (sampleToken) {
  console.log('🎫 Decoding JWT Token...');
  decodeJWT(sampleToken);
} else {
  console.log('Usage: node debug-jwt.js <jwt-token>');
  console.log('Example: node debug-jwt.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
}
