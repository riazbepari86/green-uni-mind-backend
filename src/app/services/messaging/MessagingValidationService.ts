import { Types } from 'mongoose';
import { Course } from '../../modules/Course/course.model';
import { Student } from '../../modules/Student/student.model';
import { Teacher } from '../../modules/Teacher/teacher.model';
import { Logger } from '../../config/logger';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

interface EnrollmentValidationResult {
  isValid: boolean;
  courseId?: string;
  courseName?: string;
  teacherId?: string;
  teacherName?: string;
  studentId?: string;
  studentName?: string;
  enrollmentDate?: Date;
}

interface MessagePermissionResult {
  canMessage: boolean;
  reason?: string;
  restrictions?: {
    maxMessagesPerDay?: number;
    currentMessageCount?: number;
    canSendFiles?: boolean;
    maxFileSize?: number;
  };
}

class MessagingValidationService {
  /**
   * Validate if a student is enrolled in a course and can message the teacher
   */
  public async validateStudentEnrollment(
    studentId: string,
    teacherId: string,
    courseId: string
  ): Promise<EnrollmentValidationResult> {
    try {
      // Validate ObjectIds
      if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(teacherId) || !Types.ObjectId.isValid(courseId)) {
        return { isValid: false };
      }

      // Check if course exists and belongs to the teacher
      const course = await Course.findOne({
        _id: new Types.ObjectId(courseId),
        creator: new Types.ObjectId(teacherId),
        isPublished: true,
      }).populate('creator', 'name email');

      if (!course) {
        Logger.warn(`❌ Course not found or not owned by teacher: ${courseId} - ${teacherId}`);
        return { isValid: false };
      }

      // Check if student exists and is enrolled in the course
      const student = await Student.findOne({
        _id: new Types.ObjectId(studentId),
        isDeleted: false,
        'enrolledCourses.courseId': new Types.ObjectId(courseId),
      }).populate('user', 'email');

      if (!student) {
        Logger.warn(`❌ Student not found or not enrolled: ${studentId} - ${courseId}`);
        return { isValid: false };
      }

      // Get enrollment details
      const enrollment = student.enrolledCourses.find(
        (enrollment) => enrollment.courseId.toString() === courseId
      );

      const teacher = await Teacher.findById(teacherId).populate('user', 'email');

      Logger.info(`✅ Enrollment validation successful: Student ${studentId} can message teacher ${teacherId} for course ${courseId}`);

      return {
        isValid: true,
        courseId,
        courseName: course.title,
        teacherId,
        teacherName: `${teacher?.name.firstName} ${teacher?.name.lastName}`,
        studentId,
        studentName: `${student.name.firstName} ${student.name.lastName}`,
        enrollmentDate: enrollment?.enrolledAt,
      };
    } catch (error) {
      Logger.error('❌ Error validating student enrollment:', error);
      return { isValid: false };
    }
  }

  /**
   * Check if a user has permission to send messages
   */
  public async checkMessagePermissions(
    userId: string,
    userType: 'student' | 'teacher',
    courseId?: string
  ): Promise<MessagePermissionResult> {
    try {
      const basePermissions: MessagePermissionResult = {
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
        const student = await Student.findOne({
          _id: new Types.ObjectId(userId),
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
          const isEnrolled = student.enrolledCourses.some(
            (enrollment) => enrollment.courseId.toString() === courseId
          );

          if (!isEnrolled) {
            return {
              canMessage: false,
              reason: 'Student is not enrolled in this course',
            };
          }
        }
      } else {
        const teacher = await Teacher.findOne({
          _id: new Types.ObjectId(userId),
          isDeleted: false,
        });

        if (!teacher) {
          return {
            canMessage: false,
            reason: 'Teacher account not found or inactive',
          };
        }

        // Teachers have higher limits
        basePermissions.restrictions!.maxMessagesPerDay = 500;
        basePermissions.restrictions!.maxFileSize = 50 * 1024 * 1024; // 50MB
      }

      // TODO: Implement rate limiting check
      // This would check Redis for current message count in the last 24 hours

      return basePermissions;
    } catch (error) {
      Logger.error('❌ Error checking message permissions:', error);
      return {
        canMessage: false,
        reason: 'Error validating permissions',
      };
    }
  }

  /**
   * Validate conversation participants
   */
  public async validateConversationParticipants(
    teacherId: string,
    studentId: string,
    courseId: string
  ): Promise<boolean> {
    try {
      const validation = await this.validateStudentEnrollment(studentId, teacherId, courseId);
      return validation.isValid;
    } catch (error) {
      Logger.error('❌ Error validating conversation participants:', error);
      return false;
    }
  }

  /**
   * Check if a file type is allowed for messaging
   */
  public validateFileType(mimeType: string, userType: 'student' | 'teacher'): boolean {
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
  public validateFileSize(fileSize: number, userType: 'student' | 'teacher'): boolean {
    const maxSizes = {
      student: 10 * 1024 * 1024, // 10MB
      teacher: 50 * 1024 * 1024, // 50MB
    };

    return fileSize <= maxSizes[userType];
  }

  /**
   * Sanitize message content
   */
  public sanitizeMessageContent(content: string): string {
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
  public async checkRateLimit(userId: string, userType: 'student' | 'teacher'): Promise<boolean> {
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
    } catch (error) {
      Logger.error('❌ Error checking rate limit:', error);
      return false;
    }
  }

  /**
   * Validate conversation creation
   */
  public async validateConversationCreation(
    teacherId: string,
    studentId: string,
    courseId: string
  ): Promise<void> {
    const validation = await this.validateStudentEnrollment(studentId, teacherId, courseId);
    
    if (!validation.isValid) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Student is not enrolled in this course and cannot message the instructor'
      );
    }

    const studentPermissions = await this.checkMessagePermissions(studentId, 'student', courseId);
    if (!studentPermissions.canMessage) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        studentPermissions.reason || 'Student does not have permission to send messages'
      );
    }

    const teacherPermissions = await this.checkMessagePermissions(teacherId, 'teacher', courseId);
    if (!teacherPermissions.canMessage) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        teacherPermissions.reason || 'Teacher does not have permission to receive messages'
      );
    }
  }

  /**
   * Get all courses where a student can message the teacher
   */
  public async getMessagingEligibleCourses(studentId: string): Promise<any[]> {
    try {
      const student = await Student.findOne({
        _id: new Types.ObjectId(studentId),
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
          courseName: (enrollment.courseId as any).title,
          teacherId: (enrollment.courseId as any).creator._id,
          teacherName: `${(enrollment.courseId as any).creator.name.firstName} ${(enrollment.courseId as any).creator.name.lastName}`,
          enrolledAt: enrollment.enrolledAt,
        }));
    } catch (error) {
      Logger.error('❌ Error getting messaging eligible courses:', error);
      return [];
    }
  }
}

export default MessagingValidationService;
