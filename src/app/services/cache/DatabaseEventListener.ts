/**
 * Database Event Listener for Real-time Cache Invalidation
 * Monitors database changes and triggers cache invalidation automatically
 */

import mongoose from 'mongoose';
import EnterpriseCacheService from './EnterpriseCache';

interface DatabaseEvent {
  collection: string;
  operation: 'insert' | 'update' | 'delete' | 'replace';
  documentId: string;
  fullDocument?: any;
  updateDescription?: {
    updatedFields: Record<string, any>;
    removedFields: string[];
  };
  timestamp: Date;
}

export class DatabaseEventListener {
  private enterpriseCache: EnterpriseCacheService;
  private changeStreams: Map<string, any> = new Map();
  private isListening: boolean = false;

  constructor() {
    this.enterpriseCache = new EnterpriseCacheService();
  }

  /**
   * Start listening to database changes
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      console.log('📡 Database event listener already running');
      return;
    }

    try {
      // Listen to lecture collection changes
      await this.setupLectureChangeStream();
      
      // Listen to course collection changes
      await this.setupCourseChangeStream();
      
      // Listen to user collection changes (for creator data)
      await this.setupUserChangeStream();

      this.isListening = true;
      console.log('📡 Database event listener started successfully');

    } catch (error) {
      console.error('❌ Failed to start database event listener:', error);
      throw error;
    }
  }

  /**
   * Setup change stream for lecture collection
   * CRITICAL: This handles the core issue you're experiencing
   */
  private async setupLectureChangeStream(): Promise<void> {
    try {
      const Lecture = mongoose.model('Lecture');
      
      const lectureChangeStream = Lecture.watch([], {
        fullDocument: 'updateLookup',
        fullDocumentBeforeChange: 'whenAvailable'
      });

      lectureChangeStream.on('change', async (change: any) => {
        await this.handleLectureChange(change);
      });

      lectureChangeStream.on('error', (error) => {
        console.error('❌ Lecture change stream error:', error);
      });

      this.changeStreams.set('lecture', lectureChangeStream);
      console.log('📡 Lecture change stream established');

    } catch (error) {
      console.error('❌ Failed to setup lecture change stream:', error);
    }
  }

  /**
   * Setup change stream for course collection
   */
  private async setupCourseChangeStream(): Promise<void> {
    try {
      const Course = mongoose.model('Course');
      
      const courseChangeStream = Course.watch([], {
        fullDocument: 'updateLookup'
      });

      courseChangeStream.on('change', async (change: any) => {
        await this.handleCourseChange(change);
      });

      this.changeStreams.set('course', courseChangeStream);
      console.log('📡 Course change stream established');

    } catch (error) {
      console.error('❌ Failed to setup course change stream:', error);
    }
  }

  /**
   * Setup change stream for user collection (creator data)
   */
  private async setupUserChangeStream(): Promise<void> {
    try {
      const User = mongoose.model('User');
      
      const userChangeStream = User.watch([
        { $match: { 'fullDocument.role': 'teacher' } }
      ], {
        fullDocument: 'updateLookup'
      });

      userChangeStream.on('change', async (change: any) => {
        await this.handleUserChange(change);
      });

      this.changeStreams.set('user', userChangeStream);
      console.log('📡 User change stream established');

    } catch (error) {
      console.error('❌ Failed to setup user change stream:', error);
    }
  }

  /**
   * Handle lecture changes - CRITICAL for your issue
   */
  private async handleLectureChange(change: any): Promise<void> {
    const { operationType, documentKey, fullDocument, updateDescription } = change;
    const lectureId = documentKey._id.toString();

    console.log('🎓 Lecture change detected:', {
      operation: operationType,
      lectureId,
      updatedFields: updateDescription?.updatedFields ? Object.keys(updateDescription.updatedFields) : []
    });

    try {
      switch (operationType) {
        case 'update':
          await this.handleLectureUpdate(lectureId, fullDocument, updateDescription);
          break;
        case 'insert':
          await this.handleLectureInsert(lectureId, fullDocument);
          break;
        case 'delete':
          await this.handleLectureDelete(lectureId);
          break;
        case 'replace':
          await this.handleLectureReplace(lectureId, fullDocument);
          break;
      }
    } catch (error) {
      console.error('❌ Failed to handle lecture change:', error);
    }
  }

  /**
   * Handle lecture update - The core solution for your issue
   */
  private async handleLectureUpdate(lectureId: string, fullDocument: any, updateDescription: any): Promise<void> {
    console.log('🔄 Processing lecture update:', { lectureId });

    if (!fullDocument || !fullDocument.course) {
      console.warn('⚠️ Lecture document missing course reference');
      return;
    }

    const courseId = fullDocument.course.toString();
    const updatedFields = updateDescription?.updatedFields ? Object.keys(updateDescription.updatedFields) : [];

    // CRITICAL: Trigger enterprise cache invalidation
    await this.enterpriseCache.invalidateLectureUpdate(lectureId, courseId, updatedFields);

    // Additional real-time notifications could be sent here
    await this.notifyRealTimeClients(lectureId, courseId, 'lecture:updated');

    console.log('✅ Lecture update cache invalidation completed');
  }

  /**
   * Handle lecture insert
   */
  private async handleLectureInsert(lectureId: string, fullDocument: any): Promise<void> {
    console.log('➕ Processing lecture insert:', { lectureId });

    if (fullDocument && fullDocument.course) {
      const courseId = fullDocument.course.toString();
      await this.enterpriseCache.invalidateLectureUpdate(lectureId, courseId, ['created']);
      await this.notifyRealTimeClients(lectureId, courseId, 'lecture:created');
    }
  }

  /**
   * Handle lecture delete
   */
  private async handleLectureDelete(lectureId: string): Promise<void> {
    console.log('🗑️ Processing lecture delete:', { lectureId });

    // For deletes, we need to invalidate all course caches since we don't know which course it belonged to
    await this.enterpriseCache.emergencyCacheClear();
    await this.notifyRealTimeClients(lectureId, null, 'lecture:deleted');
  }

  /**
   * Handle lecture replace
   */
  private async handleLectureReplace(lectureId: string, fullDocument: any): Promise<void> {
    console.log('🔄 Processing lecture replace:', { lectureId });

    if (fullDocument && fullDocument.course) {
      const courseId = fullDocument.course.toString();
      await this.enterpriseCache.invalidateLectureUpdate(lectureId, courseId, ['replaced']);
      await this.notifyRealTimeClients(lectureId, courseId, 'lecture:replaced');
    }
  }

  /**
   * Handle course changes
   */
  private async handleCourseChange(change: any): Promise<void> {
    const { operationType, documentKey, fullDocument } = change;
    const courseId = documentKey._id.toString();

    console.log('📚 Course change detected:', { operation: operationType, courseId });

    // Invalidate course-related caches
    // Use the public method for cache invalidation
    await this.enterpriseCache.invalidateLectureUpdate('', courseId, ['course_updated']);
  }

  /**
   * Handle user changes (teacher/creator data)
   */
  private async handleUserChange(change: any): Promise<void> {
    const { operationType, documentKey } = change;
    const userId = documentKey._id.toString();

    console.log('👤 User change detected:', { operation: operationType, userId });

    // Invalidate user-related caches
    // This could affect creator course listings
  }

  /**
   * Notify real-time clients (WebSocket, SSE, etc.)
   */
  private async notifyRealTimeClients(lectureId: string, courseId: string | null, event: string): Promise<void> {
    // In a real implementation, you would send WebSocket notifications here
    console.log('📡 Real-time notification:', { event, lectureId, courseId });
    
    // Example: Send to WebSocket clients
    // this.websocketService.broadcast({
    //   type: event,
    //   data: { lectureId, courseId },
    //   timestamp: new Date()
    // });
  }

  /**
   * Stop listening to database changes
   */
  async stopListening(): Promise<void> {
    console.log('🛑 Stopping database event listener...');

    for (const [collection, stream] of this.changeStreams) {
      try {
        await stream.close();
        console.log(`📡 ${collection} change stream closed`);
      } catch (error) {
        console.error(`❌ Failed to close ${collection} change stream:`, error);
      }
    }

    this.changeStreams.clear();
    this.isListening = false;
    console.log('🛑 Database event listener stopped');
  }

  /**
   * Get listener status
   */
  getStatus(): { isListening: boolean; activeStreams: string[] } {
    return {
      isListening: this.isListening,
      activeStreams: Array.from(this.changeStreams.keys())
    };
  }
}

export default DatabaseEventListener;
