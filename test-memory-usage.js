const { redisOperations } = require('./dist/app/config/redis');

async function analyzeMemoryUsage() {
  console.log('🧪 Analyzing System Memory Usage...\n');

  try {
    // Get system memory info
    const memoryUsage = process.memoryUsage();
    console.log('📊 Node.js Memory Usage:');
    console.log(
      `  RSS (Resident Set Size): ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(
      `  Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(
      `  Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(
      `  External: ${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(
      `  Array Buffers: ${(memoryUsage.arrayBuffers / 1024 / 1024).toFixed(2)} MB\n`,
    );

    // Get Redis memory info
    console.log('🔍 Redis Memory Analysis:');

    try {
      const redisInfo = await redisOperations.info('memory');
      const memoryLines = redisInfo
        .split('\r\n')
        .filter((line) => line.includes('memory'));

      memoryLines.forEach((line) => {
        if (
          line.includes('used_memory_human') ||
          line.includes('used_memory_peak_human') ||
          line.includes('used_memory_rss_human') ||
          line.includes('maxmemory_human') ||
          line.includes('used_memory_dataset_perc') ||
          line.includes('used_memory_overhead')
        ) {
          console.log(`  ${line}`);
        }
      });

      console.log('\n🔑 Redis Key Analysis:');

      // Analyze key patterns and their memory usage
      const keyPatterns = [
        'performance:*',
        'payout:*',
        'stripe:*',
        'cache:*',
        'session:*',
        'activities:*',
        'alert:*',
        'metrics:*',
      ];

      for (const pattern of keyPatterns) {
        try {
          const keys = await redisOperations.scan(
            0,
            'MATCH',
            pattern,
            'COUNT',
            100,
          );
          const keyCount = keys[1].length;

          if (keyCount > 0) {
            // Sample a few keys to estimate memory usage
            const sampleKeys = keys[1].slice(0, Math.min(5, keyCount));
            let totalSampleSize = 0;

            for (const key of sampleKeys) {
              try {
                const keySize = await redisOperations.memory('usage', key);
                totalSampleSize += keySize || 0;
              } catch (error) {
                // Key might not exist anymore, skip
              }
            }

            const avgKeySize =
              sampleKeys.length > 0 ? totalSampleSize / sampleKeys.length : 0;
            const estimatedTotalSize = (
              (avgKeySize * keyCount) /
              1024 /
              1024
            ).toFixed(2);

            console.log(
              `  ${pattern}: ${keyCount} keys, ~${estimatedTotalSize} MB`,
            );
          }
        } catch (error) {
          console.log(`  ${pattern}: Error analyzing - ${error.message}`);
        }
      }

      console.log('\n🧹 Memory Optimization Recommendations:');

      // Check for keys without expiration
      const allKeys = await redisOperations.scan(0, 'COUNT', 1000);
      let keysWithoutTTL = 0;
      let totalKeys = allKeys[1].length;

      for (const key of allKeys[1].slice(0, 100)) {
        // Sample first 100 keys
        try {
          const ttl = await redisOperations.getTtl(key);
          if (ttl === -1) {
            // No expiration set
            keysWithoutTTL++;
          }
        } catch (error) {
          // Key might not exist anymore
        }
      }

      const percentWithoutTTL = (
        (keysWithoutTTL / Math.min(100, totalKeys)) *
        100
      ).toFixed(1);

      console.log(`  • Total Redis keys: ~${totalKeys}`);
      console.log(
        `  • Keys without expiration: ~${percentWithoutTTL}% (sampled)`,
      );

      if (percentWithoutTTL > 20) {
        console.log(
          `  ⚠️  High percentage of keys without TTL - consider adding expiration`,
        );
      }

      // Check for large keys
      console.log('\n🔍 Large Key Analysis:');
      const largeKeys = [];

      for (const key of allKeys[1].slice(0, 50)) {
        // Sample first 50 keys
        try {
          const keySize = await redisOperations.memory('usage', key);
          if (keySize && keySize > 1024 * 100) {
            // Keys larger than 100KB
            largeKeys.push({ key, size: keySize });
          }
        } catch (error) {
          // Key might not exist anymore
        }
      }

      if (largeKeys.length > 0) {
        console.log('  Large keys found (>100KB):');
        largeKeys
          .sort((a, b) => b.size - a.size)
          .slice(0, 10)
          .forEach((item) => {
            console.log(`    ${item.key}: ${(item.size / 1024).toFixed(2)} KB`);
          });
      } else {
        console.log('  ✅ No unusually large keys found in sample');
      }
    } catch (redisError) {
      console.error('❌ Redis analysis failed:', redisError.message);
    }

    // System memory recommendations
    console.log('\n💡 Memory Optimization Strategies:');
    console.log('  1. Implement Redis key expiration policies');
    console.log('  2. Use Redis memory-efficient data structures');
    console.log('  3. Enable Redis key eviction policies');
    console.log('  4. Optimize Node.js garbage collection');
    console.log('  5. Monitor and clean up unused cache entries');
  } catch (error) {
    console.error('❌ Memory analysis failed:', error);
    process.exit(1);
  }
}

analyzeMemoryUsage()
  .then(() => {
    console.log('\n🎉 Memory analysis completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
