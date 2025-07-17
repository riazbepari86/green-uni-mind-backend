const { redis } = require('./dist/app/config/redis');

async function optimizeRedisMemory() {
  console.log('🚀 STARTING EMERGENCY REDIS MEMORY OPTIMIZATION');
  console.log('===============================================\n');

  try {
    // Get memory usage before optimization
    const memoryBefore = await getMemoryUsage();
    console.log(`📊 Memory usage before: ${memoryBefore.toFixed(1)}%`);

    let totalKeysDeleted = 0;
    let totalTtlsSet = 0;

    // 1. Delete old metrics keys (older than 1 hour)
    console.log('🧹 Cleaning old metrics keys...');
    const oldMetricsDeleted = await deleteOldMetrics();
    totalKeysDeleted += oldMetricsDeleted;
    console.log(`   Deleted ${oldMetricsDeleted} old metrics keys`);

    // 2. Set TTL on keys without expiration
    console.log('⏰ Setting TTL on keys without expiration...');
    const ttlsSet = await setTtlOnKeys();
    totalTtlsSet += ttlsSet;
    console.log(`   Set TTL on ${ttlsSet} keys`);

    // 3. Clean up orphaned cache keys
    console.log('🗑️ Cleaning orphaned cache keys...');
    const orphanedDeleted = await cleanupOrphanedCacheKeys();
    totalKeysDeleted += orphanedDeleted;
    console.log(`   Deleted ${orphanedDeleted} orphaned cache keys`);

    // 4. Clean up expired sessions
    console.log('🔐 Cleaning expired sessions...');
    const sessionsDeleted = await cleanupExpiredSessions();
    totalKeysDeleted += sessionsDeleted;
    console.log(`   Deleted ${sessionsDeleted} expired sessions`);

    // Get memory usage after optimization
    const memoryAfter = await getMemoryUsage();
    console.log(`\n📊 Memory usage after: ${memoryAfter.toFixed(1)}%`);

    const memoryReduction = memoryBefore - memoryAfter;
    console.log(`\n✅ OPTIMIZATION COMPLETE:`);
    console.log(`   Memory reduced by: ${memoryReduction.toFixed(1)}%`);
    console.log(`   Keys deleted: ${totalKeysDeleted}`);
    console.log(`   TTLs set: ${totalTtlsSet}`);

    if (memoryAfter < 80) {
      console.log('🎉 Memory usage is now below 80% threshold!');
    } else {
      console.log('⚠️ Memory usage still above 80%, consider additional cleanup');
    }

  } catch (error) {
    console.error('❌ Redis optimization failed:', error);
    throw error;
  }
}

async function getMemoryUsage() {
  try {
    const info = await redis.info('memory');
    const usedMemoryMatch = info.match(/used_memory:(\d+)/);
    const maxMemoryMatch = info.match(/maxmemory:(\d+)/);
    
    if (usedMemoryMatch && maxMemoryMatch) {
      const usedMemory = parseInt(usedMemoryMatch[1]);
      const maxMemory = parseInt(maxMemoryMatch[1]);
      return (usedMemory / maxMemory) * 100;
    }
    
    // Fallback: estimate based on used memory
    const usedMemory = parseInt(usedMemoryMatch[1]) || 0;
    const estimatedMax = 50 * 1024 * 1024; // 50MB estimate for free tier
    return (usedMemory / estimatedMax) * 100;
  } catch (error) {
    console.error('Failed to get memory usage:', error);
    return 0;
  }
}

async function deleteOldMetrics() {
  const patterns = [
    'metrics:*',
    'performance:*',
    'monitoring:*',
    'cache:stats:*',
  ];

  let totalDeleted = 0;
  const oneHourAgo = Date.now() - (60 * 60 * 1000);

  for (const pattern of patterns) {
    const keys = await scanKeysWithPattern(pattern, 1000);
    
    for (const key of keys) {
      try {
        // Check if key has timestamp in name or get its creation time
        const keyInfo = await redis.object('idletime', key);
        if (keyInfo && keyInfo > 3600) { // Idle for more than 1 hour
          await redis.del(key);
          totalDeleted++;
        }
      } catch (error) {
        // If we can't determine age, delete keys matching old patterns
        if (key.includes('old') || key.includes('temp') || key.includes('cache:temp')) {
          await redis.del(key);
          totalDeleted++;
        }
      }
    }
  }

  return totalDeleted;
}

async function setTtlOnKeys() {
  const patterns = [
    'metrics:*',
    'performance:*',
    'monitoring:*',
    'cache:*',
    'session:*',
  ];

  let totalTtlsSet = 0;
  const ttlSeconds = 3600; // 1 hour

  for (const pattern of patterns) {
    const keys = await scanKeysWithPattern(pattern, 1000);

    for (const key of keys) {
      try {
        const ttl = await redis.ttl(key);
        if (ttl === -1) { // No expiration set
          await redis.expire(key, ttlSeconds);
          totalTtlsSet++;
        }
      } catch (error) {
        // Skip problematic keys
      }
    }
  }

  return totalTtlsSet;
}

async function cleanupOrphanedCacheKeys() {
  const patterns = [
    'cache:temp:*',
    'temp:*',
    'old:*',
    'expired:*',
  ];

  let totalDeleted = 0;

  for (const pattern of patterns) {
    const keys = await scanKeysWithPattern(pattern, 1000);
    
    if (keys.length > 0) {
      await redis.del(...keys);
      totalDeleted += keys.length;
    }
  }

  return totalDeleted;
}

async function cleanupExpiredSessions() {
  const sessionKeys = await scanKeysWithPattern('session:*', 1000);
  let totalDeleted = 0;

  for (const key of sessionKeys) {
    try {
      const ttl = await redis.ttl(key);
      if (ttl === -2) { // Key expired but not cleaned up
        await redis.del(key);
        totalDeleted++;
      }
    } catch (error) {
      // Skip problematic keys
    }
  }

  return totalDeleted;
}

async function scanKeysWithPattern(pattern, count = 100) {
  const keys = [];
  let cursor = '0';

  do {
    const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', count);
    cursor = result[0];
    keys.push(...result[1]);
  } while (cursor !== '0' && keys.length < 10000); // Limit to prevent infinite loops

  return keys;
}

// Run the optimization
optimizeRedisMemory()
  .then(() => {
    console.log('\n🎯 Redis memory optimization completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Redis memory optimization failed:', error);
    process.exit(1);
  });
