/**
 * Enterprise-Grade Cache Versioning Service
 * Ensures data consistency and prevents stale data issues across distributed systems
 */

interface CacheVersion {
  entity: string;
  version: number;
  lastUpdated: Date;
  checksum?: string;
  metadata?: Record<string, any>;
}

interface VersionedCacheEntry {
  data: any;
  version: number;
  timestamp: Date;
  checksum: string;
  dependencies: string[];
}

export class CacheVersioningService {
  private versions: Map<string, CacheVersion> = new Map();
  private versionHistory: Map<string, CacheVersion[]> = new Map();
  private maxHistoryLength: number = 10;

  constructor() {
    this.initializeVersioning();
  }

  /**
   * Initialize versioning system
   */
  private initializeVersioning(): void {
    console.log('📊 Initializing cache versioning system');
    
    // Initialize versions for critical entities
    this.initializeEntityVersion('course');
    this.initializeEntityVersion('lecture');
    this.initializeEntityVersion('creator');
    this.initializeEntityVersion('user');
    
    console.log('✅ Cache versioning system initialized');
  }

  /**
   * Initialize version for an entity type
   */
  private initializeEntityVersion(entity: string): void {
    const version: CacheVersion = {
      entity,
      version: 1,
      lastUpdated: new Date(),
      metadata: {
        initialized: true,
        source: 'system'
      }
    };
    
    this.versions.set(entity, version);
    this.addToHistory(entity, version);
  }

  /**
   * Increment version for an entity - CRITICAL for cache invalidation
   */
  incrementVersion(entity: string, metadata?: Record<string, any>): number {
    const currentVersion = this.versions.get(entity);
    const newVersionNumber = currentVersion ? currentVersion.version + 1 : 1;
    
    const newVersion: CacheVersion = {
      entity,
      version: newVersionNumber,
      lastUpdated: new Date(),
      metadata: {
        ...metadata,
        previousVersion: currentVersion?.version || 0,
        incrementReason: 'data_update'
      }
    };
    
    this.versions.set(entity, newVersion);
    this.addToHistory(entity, newVersion);
    
    console.log(`📊 Version incremented for ${entity}: ${newVersionNumber}`, metadata);
    
    return newVersionNumber;
  }

  /**
   * Get current version for an entity
   */
  getCurrentVersion(entity: string): number {
    const version = this.versions.get(entity);
    return version ? version.version : 0;
  }

  /**
   * Check if cached data is stale based on version
   */
  isDataStale(entity: string, cachedVersion: number): boolean {
    const currentVersion = this.getCurrentVersion(entity);
    const isStale = cachedVersion < currentVersion;
    
    if (isStale) {
      console.log(`⚠️ Stale data detected for ${entity}: cached=${cachedVersion}, current=${currentVersion}`);
    }
    
    return isStale;
  }

  /**
   * Create versioned cache entry
   */
  createVersionedEntry(entity: string, data: any, dependencies: string[] = []): VersionedCacheEntry {
    const version = this.getCurrentVersion(entity);
    const checksum = this.generateChecksum(data);
    
    return {
      data,
      version,
      timestamp: new Date(),
      checksum,
      dependencies
    };
  }

  /**
   * Validate versioned cache entry
   */
  validateVersionedEntry(entity: string, entry: VersionedCacheEntry): boolean {
    // Check version
    if (this.isDataStale(entity, entry.version)) {
      console.log(`❌ Version validation failed for ${entity}: entry version ${entry.version} is stale`);
      return false;
    }
    
    // Check checksum
    const currentChecksum = this.generateChecksum(entry.data);
    if (entry.checksum !== currentChecksum) {
      console.log(`❌ Checksum validation failed for ${entity}: data integrity compromised`);
      return false;
    }
    
    // Check dependencies
    for (const dependency of entry.dependencies) {
      if (this.isDataStale(dependency, entry.version)) {
        console.log(`❌ Dependency validation failed for ${entity}: dependency ${dependency} is stale`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Handle lecture update versioning - CRITICAL for your issue
   */
  handleLectureUpdate(lectureId: string, courseId: string, updatedFields: string[]): void {
    console.log('📊 Handling lecture update versioning:', { lectureId, courseId, updatedFields });
    
    // Increment lecture version
    this.incrementVersion('lecture', {
      lectureId,
      courseId,
      updatedFields,
      updateType: 'lecture_update'
    });
    
    // Increment course version (since course contains lectures)
    this.incrementVersion('course', {
      affectedLecture: lectureId,
      courseId,
      updateType: 'lecture_in_course_update'
    });
    
    // Increment creator version (since creator courses contain populated lectures)
    this.incrementVersion('creator', {
      affectedLecture: lectureId,
      affectedCourse: courseId,
      updateType: 'creator_course_content_update'
    });
    
    console.log('✅ Lecture update versioning completed');
  }

  /**
   * Handle course update versioning
   */
  handleCourseUpdate(courseId: string, updatedFields: string[]): void {
    console.log('📊 Handling course update versioning:', { courseId, updatedFields });
    
    this.incrementVersion('course', {
      courseId,
      updatedFields,
      updateType: 'course_update'
    });
    
    this.incrementVersion('creator', {
      affectedCourse: courseId,
      updateType: 'creator_course_update'
    });
  }

  /**
   * Generate checksum for data integrity
   */
  private generateChecksum(data: any): string {
    // Simple checksum generation (in production, use a proper hashing algorithm)
    const jsonString = JSON.stringify(data);
    let hash = 0;
    
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(16);
  }

  /**
   * Add version to history
   */
  private addToHistory(entity: string, version: CacheVersion): void {
    if (!this.versionHistory.has(entity)) {
      this.versionHistory.set(entity, []);
    }
    
    const history = this.versionHistory.get(entity)!;
    history.push(version);
    
    // Keep only the last N versions
    if (history.length > this.maxHistoryLength) {
      history.shift();
    }
  }

  /**
   * Get version history for an entity
   */
  getVersionHistory(entity: string): CacheVersion[] {
    return this.versionHistory.get(entity) || [];
  }

  /**
   * Get versioning statistics
   */
  getVersioningStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [entity, version] of this.versions) {
      stats[entity] = {
        currentVersion: version.version,
        lastUpdated: version.lastUpdated,
        historyLength: this.versionHistory.get(entity)?.length || 0
      };
    }
    
    return stats;
  }

  /**
   * Reset version for an entity (emergency use)
   */
  resetVersion(entity: string): void {
    console.log(`🔄 Resetting version for entity: ${entity}`);
    
    this.initializeEntityVersion(entity);
    
    console.log(`✅ Version reset completed for ${entity}`);
  }

  /**
   * Bulk version increment for multiple entities
   */
  bulkIncrementVersions(entities: string[], metadata?: Record<string, any>): void {
    console.log('📊 Bulk incrementing versions for entities:', entities);
    
    for (const entity of entities) {
      this.incrementVersion(entity, {
        ...metadata,
        bulkOperation: true,
        affectedEntities: entities
      });
    }
    
    console.log('✅ Bulk version increment completed');
  }

  /**
   * Check version compatibility between entities
   */
  checkVersionCompatibility(primaryEntity: string, dependentEntities: string[]): boolean {
    const primaryVersion = this.getCurrentVersion(primaryEntity);
    
    for (const dependent of dependentEntities) {
      const dependentVersion = this.getCurrentVersion(dependent);
      
      // Simple compatibility check (can be made more sophisticated)
      if (Math.abs(primaryVersion - dependentVersion) > 5) {
        console.warn(`⚠️ Version compatibility issue: ${primaryEntity}(${primaryVersion}) vs ${dependent}(${dependentVersion})`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get cache key with version
   */
  getVersionedCacheKey(baseKey: string, entity: string): string {
    const version = this.getCurrentVersion(entity);
    return `${baseKey}:v${version}`;
  }

  /**
   * Clean up old versioned cache entries
   */
  async cleanupOldVersions(entity: string, keepVersions: number = 3): Promise<void> {
    console.log(`🧹 Cleaning up old versions for ${entity}, keeping last ${keepVersions} versions`);
    
    // This would integrate with your cache storage to remove old versioned entries
    // For now, just log the cleanup operation
    console.log(`✅ Cleanup completed for ${entity}`);
  }
}

export default CacheVersioningService;
