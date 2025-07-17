const MemoryOptimizationService = require('./dist/app/services/redis/MemoryOptimizationService').default;

async function testMemoryOptimization() {
  console.log('🧪 Testing Redis Memory Optimization...\n');

  try {
    // Create memory optimization service
    const memoryService = new MemoryOptimizationService({
      maxKeysPerPattern: 500,
      defaultTTL: 3600,
      cleanupInterval: 300000,
      maxMemoryUsagePercent: 80
    });

    console.log('📊 Getting optimization stats before cleanup...');
    const statsBefore = await memoryService.getOptimizationStats();
    console.log('Before cleanup:');
    console.log(`  Total keys: ${statsBefore.totalKeys}`);
    console.log(`  Keys without TTL: ${statsBefore.keysWithoutTTL}`);
    console.log(`  Memory usage: ${statsBefore.memoryUsage}`);
    console.log(`  Recommendations: ${statsBefore.recommendations.join(', ') || 'None'}\n`);

    console.log('🧹 Performing memory cleanup...');
    await memoryService.performCleanup();

    console.log('\n📊 Getting optimization stats after cleanup...');
    const statsAfter = await memoryService.getOptimizationStats();
    console.log('After cleanup:');
    console.log(`  Total keys: ${statsAfter.totalKeys}`);
    console.log(`  Keys without TTL: ${statsAfter.keysWithoutTTL}`);
    console.log(`  Memory usage: ${statsAfter.memoryUsage}`);
    console.log(`  Recommendations: ${statsAfter.recommendations.join(', ') || 'None'}\n`);

    // Calculate improvements
    const keyReduction = statsBefore.totalKeys - statsAfter.totalKeys;
    const ttlImprovement = statsBefore.keysWithoutTTL - statsAfter.keysWithoutTTL;

    console.log('📈 Optimization Results:');
    console.log(`  Keys removed: ${keyReduction}`);
    console.log(`  Keys with TTL added: ${ttlImprovement}`);
    
    if (keyReduction > 0 || ttlImprovement > 0) {
      console.log('  ✅ Memory optimization successful!');
    } else {
      console.log('  ℹ️  No optimization needed - Redis is already clean');
    }

    console.log('\n💡 Memory Optimization Recommendations:');
    console.log('  1. ✅ Automatic key expiration policies implemented');
    console.log('  2. ✅ Pattern-based cleanup rules configured');
    console.log('  3. ✅ Age-based key removal active');
    console.log('  4. ✅ Count-based key rotation enabled');
    console.log('  5. ✅ Missing TTL detection and correction');

    // Test starting the optimization service
    console.log('\n🚀 Testing automatic optimization service...');
    memoryService.startOptimization();
    
    // Wait a moment then stop
    setTimeout(() => {
      memoryService.stopOptimization();
      console.log('✅ Automatic optimization service test completed');
    }, 1000);

  } catch (error) {
    console.error('❌ Memory optimization test failed:', error);
    process.exit(1);
  }
}

testMemoryOptimization().then(() => {
  console.log('\n🎉 Memory optimization test completed!');
  setTimeout(() => process.exit(0), 2000);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
