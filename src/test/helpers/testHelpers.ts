import { Types } from 'mongoose';
import { User } from '../../app/modules/User/user.model';
import { Teacher } from '../../app/modules/Teacher/teacher.model';
import { Student } from '../../app/modules/Student/student.model';
import { Course } from '../../app/modules/Course/course.model';
import { Category } from '../../app/modules/Category/category.model';
import { SubCategory } from '../../app/modules/SubCategory/subCategory.model';
import { Activity } from '../../app/modules/Analytics/analytics.model';
import { Conversation, Message } from '../../app/modules/Messaging/messaging.model';
import { USER_ROLE } from '../../app/modules/User/user.constant';
import bcrypt from 'bcrypt';

/**
 * Create a test user with specified role
 */
export const createTestUser = async (role: 'student' | 'teacher' | 'admin' = 'student') => {
  const userData = {
    email: `test-${role}-${Date.now()}@example.com`,
    password: await bcrypt.hash('password123', 12),
    role: role as any,
    isEmailVerified: true,
    isDeleted: false,
  };

  const user = new User(userData);
  return await user.save();
};

/**
 * Create a test teacher
 */
export const createTestTeacher = async () => {
  const user = await createTestUser('teacher');
  
  const teacherData = {
    user: user._id,
    name: {
      firstName: 'John',
      lastName: 'Doe',
    },
    email: user.email,
    phone: '+1234567890',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'male',
    profilePicture: 'https://example.com/profile.jpg',
    bio: 'Experienced teacher with 5+ years in education',
    expertise: ['JavaScript', 'React', 'Node.js'],
    education: [{
      degree: 'Bachelor of Computer Science',
      institution: 'University of Technology',
      year: 2015,
    }],
    experience: [{
      title: 'Senior Developer',
      company: 'Tech Corp',
      duration: '2018-2023',
      description: 'Led development team',
    }],
    socialLinks: {
      linkedin: 'https://linkedin.com/in/johndoe',
      twitter: 'https://twitter.com/johndoe',
    },
    stripeAccountId: `acct_test_${Date.now()}`,
    stripeVerified: true,
    totalEarnings: 0,
    averageRating: 0,
    totalReviews: 0,
    isDeleted: false,
  };

  const teacher = new Teacher(teacherData);
  return await teacher.save();
};

/**
 * Create a test student
 */
export const createTestStudent = async () => {
  const user = await createTestUser('student');
  
  const studentData = {
    user: user._id,
    name: {
      firstName: 'Jane',
      lastName: 'Smith',
    },
    email: user.email,
    phone: '+1234567891',
    dateOfBirth: new Date('1995-01-01'),
    gender: 'female',
    profilePicture: 'https://example.com/student-profile.jpg',
    enrolledCourses: [],
    completedCourses: [],
    wishlist: [],
    isDeleted: false,
  };

  const student = new Student(studentData);
  return await student.save();
};

/**
 * Create a test category
 */
export const createTestCategory = async () => {
  const categoryData = {
    name: `Test Category ${Date.now()}`,
    description: 'A test category for testing purposes',
    icon: 'test-icon',
    isDeleted: false,
  };

  const category = new Category(categoryData);
  return await category.save();
};

/**
 * Create a test subcategory
 */
export const createTestSubCategory = async (categoryId?: Types.ObjectId) => {
  const category = categoryId ? { _id: categoryId } : await createTestCategory();
  
  const subCategoryData = {
    name: `Test SubCategory ${Date.now()}`,
    description: 'A test subcategory for testing purposes',
    categoryId: category._id,
    isDeleted: false,
  };

  const subCategory = new SubCategory(subCategoryData);
  return await subCategory.save();
};

/**
 * Create a test course
 */
export const createTestCourse = async (teacherId?: Types.ObjectId) => {
  const teacher = teacherId ? { _id: teacherId } : await createTestTeacher();
  const category = await createTestCategory();
  const subCategory = await createTestSubCategory(category._id);
  
  const courseData = {
    title: `Test Course ${Date.now()}`,
    subtitle: 'A comprehensive test course',
    description: 'This is a detailed description of the test course for learning purposes.',
    categoryId: category._id,
    subcategoryId: subCategory._id,
    creator: teacher._id,
    price: 99.99,
    discountPrice: 79.99,
    currency: 'USD',
    language: 'English',
    level: 'Beginner',
    duration: 120, // minutes
    thumbnail: 'https://example.com/course-thumbnail.jpg',
    previewVideo: 'https://example.com/preview-video.mp4',
    learningObjectives: [
      'Understand the basics',
      'Apply concepts in practice',
      'Build real projects',
    ],
    requirements: [
      'Basic computer knowledge',
      'Internet connection',
    ],
    targetAudience: [
      'Beginners',
      'Students',
      'Professionals',
    ],
    curriculum: [{
      sectionTitle: 'Introduction',
      lectures: [{
        title: 'Welcome to the Course',
        duration: 10,
        videoUrl: 'https://example.com/lecture1.mp4',
        resources: [],
      }],
    }],
    tags: ['test', 'course', 'education'],
    isPublished: true,
    status: 'approved',
    totalEnrollment: 0,
    averageRating: 0,
    totalReviews: 0,
    isDeleted: false,
  };

  const course = new Course(courseData);
  return await course.save();
};

/**
 * Create a test activity
 */
export const createTestActivity = async (teacherId: Types.ObjectId, courseId?: Types.ObjectId) => {
  const activityData = {
    teacherId,
    courseId,
    type: 'enrollment',
    priority: 'medium',
    title: 'New Student Enrollment',
    description: 'A new student has enrolled in your course',
    metadata: {
      enrollmentDate: new Date(),
    },
    isRead: false,
    actionRequired: false,
    relatedEntity: {
      entityType: 'course',
      entityId: courseId || new Types.ObjectId(),
    },
  };

  const activity = new Activity(activityData);
  return await activity.save();
};

/**
 * Create a test conversation
 */
export const createTestConversation = async (
  teacherId: Types.ObjectId,
  studentId: Types.ObjectId,
  courseId: Types.ObjectId
) => {
  const conversationData = {
    courseId,
    teacherId,
    studentId,
    title: 'Test Conversation',
    participants: [
      {
        userId: teacherId,
        userType: 'teacher',
        joinedAt: new Date(),
        role: 'admin',
      },
      {
        userId: studentId,
        userType: 'student',
        joinedAt: new Date(),
        role: 'member',
      },
    ],
    unreadCount: {
      teacher: 0,
      student: 0,
    },
    isActive: true,
    isArchived: false,
    metadata: {
      totalMessages: 0,
      totalFiles: 0,
      createdBy: studentId,
    },
  };

  const conversation = new Conversation(conversationData);
  return await conversation.save();
};

/**
 * Create a test message
 */
export const createTestMessage = async (
  conversationId: Types.ObjectId,
  senderId: Types.ObjectId,
  senderType: 'student' | 'teacher',
  receiverId: Types.ObjectId,
  courseId: Types.ObjectId
) => {
  const messageData = {
    conversationId,
    senderId,
    senderType,
    receiverId,
    receiverType: senderType === 'student' ? 'teacher' : 'student',
    courseId,
    messageType: 'text',
    content: 'This is a test message',
    attachments: [],
    status: 'sent',
    isEdited: false,
    metadata: {
      deviceInfo: 'test-device',
      ipAddress: '127.0.0.1',
    },
  };

  const message = new Message(messageData);
  return await message.save();
};

/**
 * Enroll student in course
 */
export const enrollStudentInCourse = async (studentId: Types.ObjectId, courseId: Types.ObjectId) => {
  await Student.findByIdAndUpdate(studentId, {
    $push: {
      enrolledCourses: {
        courseId,
        enrolledAt: new Date(),
        progress: 0,
        completedLectures: [],
        lastAccessedAt: new Date(),
      },
    },
  });

  await Course.findByIdAndUpdate(courseId, {
    $inc: { totalEnrollment: 1 },
  });
};

/**
 * Create test data for analytics
 */
export const createAnalyticsTestData = async (teacherId: Types.ObjectId) => {
  // Create multiple courses
  const courses = await Promise.all([
    createTestCourse(teacherId),
    createTestCourse(teacherId),
    createTestCourse(teacherId),
  ]);

  // Create multiple students
  const students = await Promise.all([
    createTestStudent(),
    createTestStudent(),
    createTestStudent(),
  ]);

  // Enroll students in courses
  for (const course of courses) {
    for (const student of students) {
      await enrollStudentInCourse(student._id, course._id);
    }
  }

  // Create activities
  for (const course of courses) {
    await createTestActivity(teacherId, course._id);
  }

  return { courses, students };
};

/**
 * Clean up test data
 */
export const cleanupTestData = async () => {
  await Promise.all([
    User.deleteMany({ email: { $regex: /test-.*@example\.com/ } }),
    Teacher.deleteMany({ email: { $regex: /test-.*@example\.com/ } }),
    Student.deleteMany({ email: { $regex: /test-.*@example\.com/ } }),
    Course.deleteMany({ title: { $regex: /^Test Course/ } }),
    Category.deleteMany({ name: { $regex: /^Test Category/ } }),
    SubCategory.deleteMany({ name: { $regex: /^Test SubCategory/ } }),
    Activity.deleteMany({ title: { $regex: /test/i } }),
    Conversation.deleteMany({ title: { $regex: /^Test Conversation/ } }),
    Message.deleteMany({ content: { $regex: /test/i } }),
  ]);
};

/**
 * Wait for a specified amount of time
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generate random test data
 */
export const generateRandomString = (length: number = 10): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateRandomEmail = (): string => {
  return `test-${generateRandomString(8)}@example.com`;
};

export const generateRandomNumber = (min: number = 0, max: number = 100): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Mock external services for testing
 */
export const mockStripeService = {
  createAccount: jest.fn().mockResolvedValue({ id: 'acct_test_123' }),
  createPaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_test_123' }),
  confirmPayment: jest.fn().mockResolvedValue({ status: 'succeeded' }),
};

export const mockCloudinaryService = {
  upload: jest.fn().mockResolvedValue({
    public_id: 'test_upload_123',
    secure_url: 'https://res.cloudinary.com/test/image/upload/test_upload_123.jpg',
  }),
  destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
};

export const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue(true),
  sendOTP: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
};
