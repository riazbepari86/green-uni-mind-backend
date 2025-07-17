"use strict";
/**
 * Database Event Listener for Real-time Cache Invalidation
 * Monitors database changes and triggers cache invalidation automatically
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseEventListener = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const EnterpriseCache_1 = __importDefault(require("./EnterpriseCache"));
class DatabaseEventListener {
    constructor() {
        this.changeStreams = new Map();
        this.isListening = false;
        this.enterpriseCache = new EnterpriseCache_1.default();
    }
    /**
     * Start listening to database changes
     */
    startListening() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isListening) {
                console.log('📡 Database event listener already running');
                return;
            }
            try {
                // Listen to lecture collection changes
                yield this.setupLectureChangeStream();
                // Listen to course collection changes
                yield this.setupCourseChangeStream();
                // Listen to user collection changes (for creator data)
                yield this.setupUserChangeStream();
                this.isListening = true;
                console.log('📡 Database event listener started successfully');
            }
            catch (error) {
                console.error('❌ Failed to start database event listener:', error);
                throw error;
            }
        });
    }
    /**
     * Setup change stream for lecture collection
     * CRITICAL: This handles the core issue you're experiencing
     */
    setupLectureChangeStream() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const Lecture = mongoose_1.default.model('Lecture');
                const lectureChangeStream = Lecture.watch([], {
                    fullDocument: 'updateLookup',
                    fullDocumentBeforeChange: 'whenAvailable'
                });
                lectureChangeStream.on('change', (change) => __awaiter(this, void 0, void 0, function* () {
                    yield this.handleLectureChange(change);
                }));
                lectureChangeStream.on('error', (error) => {
                    console.error('❌ Lecture change stream error:', error);
                });
                this.changeStreams.set('lecture', lectureChangeStream);
                console.log('📡 Lecture change stream established');
            }
            catch (error) {
                console.error('❌ Failed to setup lecture change stream:', error);
            }
        });
    }
    /**
     * Setup change stream for course collection
     */
    setupCourseChangeStream() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const Course = mongoose_1.default.model('Course');
                const courseChangeStream = Course.watch([], {
                    fullDocument: 'updateLookup'
                });
                courseChangeStream.on('change', (change) => __awaiter(this, void 0, void 0, function* () {
                    yield this.handleCourseChange(change);
                }));
                this.changeStreams.set('course', courseChangeStream);
                console.log('📡 Course change stream established');
            }
            catch (error) {
                console.error('❌ Failed to setup course change stream:', error);
            }
        });
    }
    /**
     * Setup change stream for user collection (creator data)
     */
    setupUserChangeStream() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const User = mongoose_1.default.model('User');
                const userChangeStream = User.watch([
                    { $match: { 'fullDocument.role': 'teacher' } }
                ], {
                    fullDocument: 'updateLookup'
                });
                userChangeStream.on('change', (change) => __awaiter(this, void 0, void 0, function* () {
                    yield this.handleUserChange(change);
                }));
                this.changeStreams.set('user', userChangeStream);
                console.log('📡 User change stream established');
            }
            catch (error) {
                console.error('❌ Failed to setup user change stream:', error);
            }
        });
    }
    /**
     * Handle lecture changes - CRITICAL for your issue
     */
    handleLectureChange(change) {
        return __awaiter(this, void 0, void 0, function* () {
            const { operationType, documentKey, fullDocument, updateDescription } = change;
            const lectureId = documentKey._id.toString();
            console.log('🎓 Lecture change detected:', {
                operation: operationType,
                lectureId,
                updatedFields: (updateDescription === null || updateDescription === void 0 ? void 0 : updateDescription.updatedFields) ? Object.keys(updateDescription.updatedFields) : []
            });
            try {
                switch (operationType) {
                    case 'update':
                        yield this.handleLectureUpdate(lectureId, fullDocument, updateDescription);
                        break;
                    case 'insert':
                        yield this.handleLectureInsert(lectureId, fullDocument);
                        break;
                    case 'delete':
                        yield this.handleLectureDelete(lectureId);
                        break;
                    case 'replace':
                        yield this.handleLectureReplace(lectureId, fullDocument);
                        break;
                }
            }
            catch (error) {
                console.error('❌ Failed to handle lecture change:', error);
            }
        });
    }
    /**
     * Handle lecture update - The core solution for your issue
     */
    handleLectureUpdate(lectureId, fullDocument, updateDescription) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Processing lecture update:', { lectureId });
            if (!fullDocument || !fullDocument.course) {
                console.warn('⚠️ Lecture document missing course reference');
                return;
            }
            const courseId = fullDocument.course.toString();
            const updatedFields = (updateDescription === null || updateDescription === void 0 ? void 0 : updateDescription.updatedFields) ? Object.keys(updateDescription.updatedFields) : [];
            // CRITICAL: Trigger enterprise cache invalidation
            yield this.enterpriseCache.invalidateLectureUpdate(lectureId, courseId, updatedFields);
            // Additional real-time notifications could be sent here
            yield this.notifyRealTimeClients(lectureId, courseId, 'lecture:updated');
            console.log('✅ Lecture update cache invalidation completed');
        });
    }
    /**
     * Handle lecture insert
     */
    handleLectureInsert(lectureId, fullDocument) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('➕ Processing lecture insert:', { lectureId });
            if (fullDocument && fullDocument.course) {
                const courseId = fullDocument.course.toString();
                yield this.enterpriseCache.invalidateLectureUpdate(lectureId, courseId, ['created']);
                yield this.notifyRealTimeClients(lectureId, courseId, 'lecture:created');
            }
        });
    }
    /**
     * Handle lecture delete
     */
    handleLectureDelete(lectureId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🗑️ Processing lecture delete:', { lectureId });
            // For deletes, we need to invalidate all course caches since we don't know which course it belonged to
            yield this.enterpriseCache.emergencyCacheClear();
            yield this.notifyRealTimeClients(lectureId, null, 'lecture:deleted');
        });
    }
    /**
     * Handle lecture replace
     */
    handleLectureReplace(lectureId, fullDocument) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Processing lecture replace:', { lectureId });
            if (fullDocument && fullDocument.course) {
                const courseId = fullDocument.course.toString();
                yield this.enterpriseCache.invalidateLectureUpdate(lectureId, courseId, ['replaced']);
                yield this.notifyRealTimeClients(lectureId, courseId, 'lecture:replaced');
            }
        });
    }
    /**
     * Handle course changes
     */
    handleCourseChange(change) {
        return __awaiter(this, void 0, void 0, function* () {
            const { operationType, documentKey, fullDocument } = change;
            const courseId = documentKey._id.toString();
            console.log('📚 Course change detected:', { operation: operationType, courseId });
            // Invalidate course-related caches
            // Use the public method for cache invalidation
            yield this.enterpriseCache.invalidateLectureUpdate('', courseId, ['course_updated']);
        });
    }
    /**
     * Handle user changes (teacher/creator data)
     */
    handleUserChange(change) {
        return __awaiter(this, void 0, void 0, function* () {
            const { operationType, documentKey } = change;
            const userId = documentKey._id.toString();
            console.log('👤 User change detected:', { operation: operationType, userId });
            // Invalidate user-related caches
            // This could affect creator course listings
        });
    }
    /**
     * Notify real-time clients (WebSocket, SSE, etc.)
     */
    notifyRealTimeClients(lectureId, courseId, event) {
        return __awaiter(this, void 0, void 0, function* () {
            // In a real implementation, you would send WebSocket notifications here
            console.log('📡 Real-time notification:', { event, lectureId, courseId });
            // Example: Send to WebSocket clients
            // this.websocketService.broadcast({
            //   type: event,
            //   data: { lectureId, courseId },
            //   timestamp: new Date()
            // });
        });
    }
    /**
     * Stop listening to database changes
     */
    stopListening() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🛑 Stopping database event listener...');
            for (const [collection, stream] of this.changeStreams) {
                try {
                    yield stream.close();
                    console.log(`📡 ${collection} change stream closed`);
                }
                catch (error) {
                    console.error(`❌ Failed to close ${collection} change stream:`, error);
                }
            }
            this.changeStreams.clear();
            this.isListening = false;
            console.log('🛑 Database event listener stopped');
        });
    }
    /**
     * Get listener status
     */
    getStatus() {
        return {
            isListening: this.isListening,
            activeStreams: Array.from(this.changeStreams.keys())
        };
    }
}
exports.DatabaseEventListener = DatabaseEventListener;
exports.default = DatabaseEventListener;
