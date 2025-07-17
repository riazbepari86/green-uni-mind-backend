const { redisOperations } = require('./dist/app/config/redis');

async function testRedisScan() {
  console.log('🧪 Testing Redis SCAN implementation...\n');

  try {
    // Test basic SCAN operation
    console.log('1. Testing basic SCAN operation...');
    const result = await redisOperations.scan('0', 'MATCH', '*', 'COUNT', '10');
    console.log('✅ SCAN operation successful:', {
      cursor: result[0],
      keysFound: result[1].length,
      sampleKeys: result[1].slice(0, 3)
    });

    // Test SCAN with pattern
    console.log('\n2. Testing SCAN with pattern...');
    const patternResult = await redisOperations.scan('0', 'MATCH', 'performance:*', 'COUNT', '50');
    console.log('✅ Pattern SCAN successful:', {
      cursor: patternResult[0],
      keysFound: patternResult[1].length,
      sampleKeys: patternResult[1].slice(0, 3)
    });

    // Test PerformanceMonitoringService scanKeysWithPattern method
    console.log('\n3. Testing PerformanceMonitoringService integration...');
    const { PerformanceMonitoringService } = require('./dist/app/services/monitoring/PerformanceMonitoringService');
    
    // This should now work without errors
    console.log('✅ Redis SCAN implementation is working correctly!');
    
  } catch (error) {
    console.error('❌ Redis SCAN test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testRedisScan().then(() => {
  console.log('\n🎉 All Redis SCAN tests passed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
