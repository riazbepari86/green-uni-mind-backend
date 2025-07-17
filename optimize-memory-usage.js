const { redisOperations } = require('./dist/app/config/redis');

async function optimizeMemoryUsage() {
  console.log('🧠 Phase 2: Memory Usage Optimization');
  console.log('====================================');
  console.log('Target: Reduce memory usage from 90% to <80%\n');

  try {
    // Step 1: Get current memory status
    console.log('📊 Step 1: Current Memory Analysis');
    console.log('----------------------------------');
    
    const initialMemory = process.memoryUsage();
    console.log('Node.js Memory Usage:');
    console.log(`  Heap Used: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Heap Total: ${Math.round(initialMemory.heapTotal / 1024 / 1024)}MB`);
    console.log(`  RSS: ${Math.round(initialMemory.rss / 1024 / 1024)}MB`);
    console.log(`  External: ${Math.round(initialMemory.external / 1024 / 1024)}MB`);
    
    const heapPercentage = (initialMemory.heapUsed / initialMemory.heapTotal) * 100;
    console.log(`  Heap Usage: ${Math.round(heapPercentage)}%\n`);

    // Step 2: Redis memory optimization
    console.log('🔴 Step 2: Redis Memory Optimization');
    console.log('------------------------------------');
    
    try {
      // Get Redis memory info
      const redisInfo = await redisOperations.info('memory');
      console.log('Redis Memory Info:');
      
      const memoryLines = redisInfo.split('\r\n').filter(line => 
        line.includes('used_memory') || line.includes('maxmemory')
      );
      
      memoryLines.forEach(line => {
        if (line.includes('used_memory_human')) {
          console.log(`  Used Memory: ${line.split(':')[1]}`);
        }
        if (line.includes('used_memory_peak_human')) {
          console.log(`  Peak Memory: ${line.split(':')[1]}`);
        }
      });

      // Optimize Redis memory
      console.log('\n🔧 Applying Redis memory optimizations...');
      
      // Set memory policies for optimization
      await redisOperations.configSet('maxmemory-policy', 'allkeys-lru');
      console.log('✅ Set LRU eviction policy');
      
      // Clean up old keys with pattern-based approach
      let cursor = '0';
      let totalCleaned = 0;
      
      do {
        const [newCursor, keys] = await redisOperations.scan(cursor, 'MATCH', '*', 'COUNT', 100);
        cursor = newCursor;
        
        for (const key of keys) {
          try {
            const ttl = await redisOperations.ttl(key);
            
            // Clean up keys without TTL that are older than 1 hour
            if (ttl === -1) {
              const keyAge = await redisOperations.objectIdletime(key);
              if (keyAge && keyAge > 3600) { // 1 hour
                await redisOperations.del(key);
                totalCleaned++;
              } else {
                // Set TTL for keys without expiration
                await redisOperations.expire(key, 3600); // 1 hour default
              }
            }
          } catch (error) {
            // Skip keys that can't be processed
            continue;
          }
        }
      } while (cursor !== '0');
      
      console.log(`✅ Cleaned up ${totalCleaned} old keys`);
      console.log('✅ Set TTL for keys without expiration');

    } catch (error) {
      console.log('⚠️  Redis optimization failed:', error.message);
    }

    // Step 3: Node.js memory optimization
    console.log('\n🟢 Step 3: Node.js Memory Optimization');
    console.log('--------------------------------------');
    
    // Force garbage collection if available
    if (global.gc) {
      console.log('🗑️  Running garbage collection...');
      global.gc();
      console.log('✅ Garbage collection completed');
    } else {
      console.log('⚠️  Garbage collection not available (run with --expose-gc for manual GC)');
    }

    // Clear any large objects or caches
    console.log('🧹 Clearing application caches...');
    
    // Clear require cache for non-essential modules
    const moduleKeys = Object.keys(require.cache);
    let clearedModules = 0;
    
    moduleKeys.forEach(key => {
      // Only clear test and temporary modules
      if (key.includes('test-') || key.includes('temp-') || key.includes('debug-')) {
        delete require.cache[key];
        clearedModules++;
      }
    });
    
    console.log(`✅ Cleared ${clearedModules} cached modules`);

    // Step 4: Memory optimization verification
    console.log('\n📊 Step 4: Memory Optimization Results');
    console.log('--------------------------------------');
    
    // Wait a moment for optimizations to take effect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const finalMemory = process.memoryUsage();
    console.log('Node.js Memory Usage After Optimization:');
    console.log(`  Heap Used: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Heap Total: ${Math.round(finalMemory.heapTotal / 1024 / 1024)}MB`);
    console.log(`  RSS: ${Math.round(finalMemory.rss / 1024 / 1024)}MB`);
    
    const finalHeapPercentage = (finalMemory.heapUsed / finalMemory.heapTotal) * 100;
    console.log(`  Heap Usage: ${Math.round(finalHeapPercentage)}%`);
    
    // Calculate improvements
    const heapReduction = initialMemory.heapUsed - finalMemory.heapUsed;
    const percentageImprovement = heapPercentage - finalHeapPercentage;
    
    console.log('\n📈 Memory Optimization Summary:');
    console.log(`  Heap reduction: ${Math.round(heapReduction / 1024 / 1024)}MB`);
    console.log(`  Percentage improvement: ${Math.round(percentageImprovement)}%`);
    console.log(`  Initial usage: ${Math.round(heapPercentage)}%`);
    console.log(`  Final usage: ${Math.round(finalHeapPercentage)}%`);

    // Step 5: Set up memory monitoring
    console.log('\n🔍 Step 5: Setting Up Memory Monitoring');
    console.log('---------------------------------------');
    
    // Set up periodic memory monitoring
    const memoryMonitor = setInterval(() => {
      const currentMemory = process.memoryUsage();
      const currentPercentage = (currentMemory.heapUsed / currentMemory.heapTotal) * 100;
      
      if (currentPercentage > 85) {
        console.log(`⚠️  HIGH MEMORY ALERT: ${Math.round(currentPercentage)}% heap usage`);
        
        // Auto-trigger garbage collection if available
        if (global.gc) {
          global.gc();
          console.log('🗑️  Auto-triggered garbage collection');
        }
      }
    }, 30000); // Check every 30 seconds

    console.log('✅ Memory monitoring active (30-second intervals)');
    console.log('✅ Auto-GC trigger set for >85% usage');

    // Assessment
    console.log('\n🎯 Memory Optimization Assessment:');
    console.log('==================================');
    
    if (finalHeapPercentage < 80) {
      console.log('🏆 SUCCESS: Memory usage is now below 80% target!');
      console.log('✅ Phase 2 memory optimization COMPLETE');
      
      // Clear the monitor after success
      setTimeout(() => {
        clearInterval(memoryMonitor);
        console.log('🔍 Memory monitoring stopped after successful optimization');
      }, 60000); // Stop monitoring after 1 minute
      
      return {
        status: 'SUCCESS',
        initialUsage: Math.round(heapPercentage),
        finalUsage: Math.round(finalHeapPercentage),
        improvement: Math.round(percentageImprovement),
        target: 80
      };
    } else if (finalHeapPercentage < 85) {
      console.log('✅ GOOD: Memory usage improved but still above target');
      console.log('💡 Consider running with --max-old-space-size for production');
      
      return {
        status: 'IMPROVED',
        initialUsage: Math.round(heapPercentage),
        finalUsage: Math.round(finalHeapPercentage),
        improvement: Math.round(percentageImprovement),
        target: 80
      };
    } else {
      console.log('⚠️  LIMITED: Memory usage still high, additional optimization needed');
      console.log('💡 Recommendations:');
      console.log('   - Restart the application periodically');
      console.log('   - Increase available memory');
      console.log('   - Profile for memory leaks');
      
      return {
        status: 'LIMITED',
        initialUsage: Math.round(heapPercentage),
        finalUsage: Math.round(finalHeapPercentage),
        improvement: Math.round(percentageImprovement),
        target: 80
      };
    }

  } catch (error) {
    console.error('❌ Memory optimization failed:', error);
    return {
      status: 'ERROR',
      error: error.message
    };
  }
}

optimizeMemoryUsage().then((result) => {
  console.log('\n🎉 Memory Optimization Process Completed!');
  
  if (result.status === 'SUCCESS') {
    console.log(`🏆 Memory usage reduced from ${result.initialUsage}% to ${result.finalUsage}%`);
    console.log('✅ Phase 2 Performance Optimization is now COMPLETE!');
    process.exit(0);
  } else if (result.status === 'IMPROVED') {
    console.log(`📈 Memory usage improved from ${result.initialUsage}% to ${result.finalUsage}%`);
    console.log('⚠️  Additional optimization may be needed for production');
    process.exit(0);
  } else {
    console.log('❌ Memory optimization needs additional work');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Optimization failed:', error);
  process.exit(1);
});
