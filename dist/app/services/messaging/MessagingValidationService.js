"use strict";
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
const mongoose_1 = require("mongoose");
const course_model_1 = require("../../modules/Course/course.model");
const student_model_1 = require("../../modules/Student/student.model");
const teacher_model_1 = require("../../modules/Teacher/teacher.model");
const logger_1 = require("../../config/logger");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
class MessagingValidationService {
    /**
     * Validate if a student is enrolled in a course and can message the teacher
     */
    validateStudentEnrollment(studentId, teacherId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate ObjectIds
                if (!mongoose_1.Types.ObjectId.isValid(studentId) || !mongoose_1.Types.ObjectId.isValid(teacherId) || !mongoose_1.Types.ObjectId.isValid(courseId)) {
                    return { isValid: false };
                }
                // Check if course exists and belongs to the teacher
                const course = yield course_model_1.Course.findOne({
                    _id: new mongoose_1.Types.ObjectId(courseId),
                    creator: new mongoose_1.Types.ObjectId(teacherId),
                    isPublished: true,
                }).populate('creator', 'name email');
                if (!course) {
                    logger_1.Logger.warn(`❌ Course not found or not owned by teacher: ${courseId} - ${teacherId}`);
                    return { isValid: false };
                }
                // Check if student exists and is enrolled in the course
                const student = yield student_model_1.Student.findOne({
                    _id: new mongoose_1.Types.ObjectId(studentId),
                    isDeleted: false,
                    'enrolledCourses.courseId': new mongoose_1.Types.ObjectId(courseId),
                }).populate('user', 'email');
                if (!student) {
                    logger_1.Logger.warn(`❌ Student not found or not enrolled: ${studentId} - ${courseId}`);
                    return { isValid: false };
                }
                // Get enrollment details
                const enrollment = student.enrolledCourses.find((enrollment) => enrollment.courseId.toString() === courseId);
                const teacher = yield teacher_model_1.Teacher.findById(teacherId).populate('user', 'email');
                logger_1.Logger.info(`✅ Enrollment validation successful: Student ${studentId} can message teacher ${teacherId} for course ${courseId}`);
                return {
                    isValid: true,
                    courseId,
                    courseName: course.title,
                    teacherId,
                    teacherName: `${teacher === null || teacher === void 0 ? void 0 : teacher.name.firstName} ${teacher === null || teacher === void 0 ? void 0 : teacher.name.lastName}`,
                    studentId,
                    studentName: `${student.name.firstName} ${student.name.lastName}`,
                    enrollmentDate: enrollment === null || enrollment === void 0 ? void 0 : enrollment.enrolledAt,
                };
            }
            catch (error) {
                logger_1.Logger.error('❌ Error validating student enrollment:', error);
                return { isValid: false };
            }
        });
    }
    /**
     * Check if a user has permission to send messages
     */
    checkMessagePermissions(userId, userType, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const basePermissions = {
                    canMessage: true,
                    restrictions: {
                        maxMessagesPerDay: userType === 'student' ? 50 : 200,
                        currentMessageCount: 0,
                        canSendFiles: true,
                        maxFileSize: 10 * 1024 * 1024, // 10MB
                    },
                };
                // Check if user exists and is active
                if (userType === 'student') {
                    const student = yield student_model_1.Student.findOne({
                        _id: new mongoose_1.Types.ObjectId(userId),
                        isDeleted: false,
                    });
                    if (!student) {
                        return {
                            canMessage: false,
                            reason: 'Student account not found or inactive',
                        };
                    }
                    // If courseId is provided, check enrollment
                    if (courseId) {
                        const isEnrolled = student.enrolledCourses.some((enrollment) => enrollment.courseId.toString() === courseId);
                        if (!isEnrolled) {
                            return {
                                canMessage: false,
                                reason: 'Student is not enrolled in this course',
                            };
                        }
                    }
                }
                else {
                    const teacher = yield teacher_model_1.Teacher.findOne({
                        _id: new mongoose_1.Types.ObjectId(userId),
                        isDeleted: false,
                    });
                    if (!teacher) {
                        return {
                            canMessage: false,
                            reason: 'Teacher account not found or inactive',
                        };
                    }
                    // Teachers have higher limits
                    basePermissions.restrictions.maxMessagesPerDay = 500;
                    basePermissions.restrictions.maxFileSize = 50 * 1024 * 1024; // 50MB
                }
                // TODO: Implement rate limiting check
                // This would check Redis for current message count in the last 24 hours
                return basePermissions;
            }
            catch (error) {
                logger_1.Logger.error('❌ Error checking message permissions:', error);
                return {
                    canMessage: false,
                    reason: 'Error validating permissions',
                };
            }
        });
    }
    /**
     * Validate conversation participants
     */
    validateConversationParticipants(teacherId, studentId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const validation = yield this.validateStudentEnrollment(studentId, teacherId, courseId);
                return validation.isValid;
            }
            catch (error) {
                logger_1.Logger.error('❌ Error validating conversation participants:', error);
                return false;
            }
        });
    }
    /**
     * Check if a file type is allowed for messaging
     */
    validateFileType(mimeType, userType) {
        const allowedTypes = {
            student: [
                // Images
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                // Documents
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
                // Archives
                'application/zip',
                'application/x-rar-compressed',
            ],
            teacher: [
                // All student types plus additional
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'image/svg+xml',
                // Documents
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'text/plain',
                'text/csv',
                // Archives
                'application/zip',
                'application/x-rar-compressed',
                'application/x-7z-compressed',
                // Audio/Video
                'audio/mpeg',
                'audio/wav',
                'video/mp4',
                'video/webm',
            ],
        };
        return allowedTypes[userType].includes(mimeType);
    }
    /**
     * Validate file size
     */
    validateFileSize(fileSize, userType) {
        const maxSizes = {
            student: 10 * 1024 * 1024, // 10MB
            teacher: 50 * 1024 * 1024, // 50MB
        };
        return fileSize <= maxSizes[userType];
    }
    /**
     * Sanitize message content
     */
    sanitizeMessageContent(content) {
        // Remove potentially harmful content
        let sanitized = content
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
            .replace(/javascript:/gi, '') // Remove javascript: protocols
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim();
        // Limit length
        if (sanitized.length > 5000) {
            sanitized = sanitized.substring(0, 5000) + '...';
        }
        return sanitized;
    }
    /**
     * Check rate limiting for messaging
     */
    checkRateLimit(userId, userType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // TODO: Implement Redis-based rate limiting
                // This would check the number of messages sent in the last hour/day
                const limits = {
                    student: {
                        perHour: 20,
                        perDay: 50,
                    },
                    teacher: {
                        perHour: 100,
                        perDay: 500,
                    },
                };
                // For now, return true (no rate limiting)
                // In production, implement actual rate limiting logic
                return true;
            }
            catch (error) {
                logger_1.Logger.error('❌ Error checking rate limit:', error);
                return false;
            }
        });
    }
    /**
     * Validate conversation creation
     */
    validateConversationCreation(teacherId, studentId, courseId) {
        return __awaiter(this, void 0, void 0, function* () {
            const validation = yield this.validateStudentEnrollment(studentId, teacherId, courseId);
            if (!validation.isValid) {
                throw new AppError_1.default(http_status_1.default.FORBIDDEN, 'Student is not enrolled in this course and cannot message the instructor');
            }
            const studentPermissions = yield this.checkMessagePermissions(studentId, 'student', courseId);
            if (!studentPermissions.canMessage) {
                throw new AppError_1.default(http_status_1.default.FORBIDDEN, studentPermissions.reason || 'Student does not have permission to send messages');
            }
            const teacherPermissions = yield this.checkMessagePermissions(teacherId, 'teacher', courseId);
            if (!teacherPermissions.canMessage) {
                throw new AppError_1.default(http_status_1.default.FORBIDDEN, teacherPermissions.reason || 'Teacher does not have permission to receive messages');
            }
        });
    }
    /**
     * Get all courses where a student can message the teacher
     */
    getMessagingEligibleCourses(studentId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const student = yield student_model_1.Student.findOne({
                    _id: new mongoose_1.Types.ObjectId(studentId),
                    isDeleted: false,
                }).populate({
                    path: 'enrolledCourses.courseId',
                    populate: {
                        path: 'creator',
                        select: 'name email',
                    },
                });
                if (!student) {
                    return [];
                }
                return student.enrolledCourses
                    .filter((enrollment) => enrollment.courseId) // Ensure course exists
                    .map((enrollment) => ({
                    courseId: enrollment.courseId._id,
                    courseName: enrollment.courseId.title,
                    teacherId: enrollment.courseId.creator._id,
                    teacherName: `${enrollment.courseId.creator.name.firstName} ${enrollment.courseId.creator.name.lastName}`,
                    enrolledAt: enrollment.enrolledAt,
                }));
            }
            catch (error) {
                logger_1.Logger.error('❌ Error getting messaging eligible courses:', error);
                return [];
            }
        });
    }
}
exports.default = MessagingValidationService;
