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
exports.mockEmailService = exports.mockCloudinaryService = exports.mockStripeService = exports.generateRandomNumber = exports.generateRandomEmail = exports.generateRandomString = exports.wait = exports.cleanupTestData = exports.createAnalyticsTestData = exports.enrollStudentInCourse = exports.createTestMessage = exports.createTestConversation = exports.createTestActivity = exports.createTestCourse = exports.createTestSubCategory = exports.createTestCategory = exports.createTestStudent = exports.createTestTeacher = exports.createTestUser = void 0;
const mongoose_1 = require("mongoose");
const user_model_1 = require("../../app/modules/User/user.model");
const teacher_model_1 = require("../../app/modules/Teacher/teacher.model");
const student_model_1 = require("../../app/modules/Student/student.model");
const course_model_1 = require("../../app/modules/Course/course.model");
const category_model_1 = require("../../app/modules/Category/category.model");
const subCategory_model_1 = require("../../app/modules/SubCategory/subCategory.model");
const analytics_model_1 = require("../../app/modules/Analytics/analytics.model");
const messaging_model_1 = require("../../app/modules/Messaging/messaging.model");
const bcrypt_1 = __importDefault(require("bcrypt"));
/**
 * Create a test user with specified role
 */
const createTestUser = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (role = 'student') {
    const userData = {
        email: `test-${role}-${Date.now()}@example.com`,
        password: yield bcrypt_1.default.hash('password123', 12),
        role: role,
        isEmailVerified: true,
        isDeleted: false,
    };
    const user = new user_model_1.User(userData);
    return yield user.save();
});
exports.createTestUser = createTestUser;
/**
 * Create a test teacher
 */
const createTestTeacher = () => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield (0, exports.createTestUser)('teacher');
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
    const teacher = new teacher_model_1.Teacher(teacherData);
    return yield teacher.save();
});
exports.createTestTeacher = createTestTeacher;
/**
 * Create a test student
 */
const createTestStudent = () => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield (0, exports.createTestUser)('student');
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
    const student = new student_model_1.Student(studentData);
    return yield student.save();
});
exports.createTestStudent = createTestStudent;
/**
 * Create a test category
 */
const createTestCategory = () => __awaiter(void 0, void 0, void 0, function* () {
    const categoryData = {
        name: `Test Category ${Date.now()}`,
        description: 'A test category for testing purposes',
        icon: 'test-icon',
        isDeleted: false,
    };
    const category = new category_model_1.Category(categoryData);
    return yield category.save();
});
exports.createTestCategory = createTestCategory;
/**
 * Create a test subcategory
 */
const createTestSubCategory = (categoryId) => __awaiter(void 0, void 0, void 0, function* () {
    const category = categoryId ? { _id: categoryId } : yield (0, exports.createTestCategory)();
    const subCategoryData = {
        name: `Test SubCategory ${Date.now()}`,
        description: 'A test subcategory for testing purposes',
        categoryId: category._id,
        isDeleted: false,
    };
    const subCategory = new subCategory_model_1.SubCategory(subCategoryData);
    return yield subCategory.save();
});
exports.createTestSubCategory = createTestSubCategory;
/**
 * Create a test course
 */
const createTestCourse = (teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    const teacher = teacherId ? { _id: teacherId } : yield (0, exports.createTestTeacher)();
    const category = yield (0, exports.createTestCategory)();
    const subCategory = yield (0, exports.createTestSubCategory)(category._id);
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
    const course = new course_model_1.Course(courseData);
    return yield course.save();
});
exports.createTestCourse = createTestCourse;
/**
 * Create a test activity
 */
const createTestActivity = (teacherId, courseId) => __awaiter(void 0, void 0, void 0, function* () {
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
            entityId: courseId || new mongoose_1.Types.ObjectId(),
        },
    };
    const activity = new analytics_model_1.Activity(activityData);
    return yield activity.save();
});
exports.createTestActivity = createTestActivity;
/**
 * Create a test conversation
 */
const createTestConversation = (teacherId, studentId, courseId) => __awaiter(void 0, void 0, void 0, function* () {
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
    const conversation = new messaging_model_1.Conversation(conversationData);
    return yield conversation.save();
});
exports.createTestConversation = createTestConversation;
/**
 * Create a test message
 */
const createTestMessage = (conversationId, senderId, senderType, receiverId, courseId) => __awaiter(void 0, void 0, void 0, function* () {
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
    const message = new messaging_model_1.Message(messageData);
    return yield message.save();
});
exports.createTestMessage = createTestMessage;
/**
 * Enroll student in course
 */
const enrollStudentInCourse = (studentId, courseId) => __awaiter(void 0, void 0, void 0, function* () {
    yield student_model_1.Student.findByIdAndUpdate(studentId, {
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
    yield course_model_1.Course.findByIdAndUpdate(courseId, {
        $inc: { totalEnrollment: 1 },
    });
});
exports.enrollStudentInCourse = enrollStudentInCourse;
/**
 * Create test data for analytics
 */
const createAnalyticsTestData = (teacherId) => __awaiter(void 0, void 0, void 0, function* () {
    // Create multiple courses
    const courses = yield Promise.all([
        (0, exports.createTestCourse)(teacherId),
        (0, exports.createTestCourse)(teacherId),
        (0, exports.createTestCourse)(teacherId),
    ]);
    // Create multiple students
    const students = yield Promise.all([
        (0, exports.createTestStudent)(),
        (0, exports.createTestStudent)(),
        (0, exports.createTestStudent)(),
    ]);
    // Enroll students in courses
    for (const course of courses) {
        for (const student of students) {
            yield (0, exports.enrollStudentInCourse)(student._id, course._id);
        }
    }
    // Create activities
    for (const course of courses) {
        yield (0, exports.createTestActivity)(teacherId, course._id);
    }
    return { courses, students };
});
exports.createAnalyticsTestData = createAnalyticsTestData;
/**
 * Clean up test data
 */
const cleanupTestData = () => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all([
        user_model_1.User.deleteMany({ email: { $regex: /test-.*@example\.com/ } }),
        teacher_model_1.Teacher.deleteMany({ email: { $regex: /test-.*@example\.com/ } }),
        student_model_1.Student.deleteMany({ email: { $regex: /test-.*@example\.com/ } }),
        course_model_1.Course.deleteMany({ title: { $regex: /^Test Course/ } }),
        category_model_1.Category.deleteMany({ name: { $regex: /^Test Category/ } }),
        subCategory_model_1.SubCategory.deleteMany({ name: { $regex: /^Test SubCategory/ } }),
        analytics_model_1.Activity.deleteMany({ title: { $regex: /test/i } }),
        messaging_model_1.Conversation.deleteMany({ title: { $regex: /^Test Conversation/ } }),
        messaging_model_1.Message.deleteMany({ content: { $regex: /test/i } }),
    ]);
});
exports.cleanupTestData = cleanupTestData;
/**
 * Wait for a specified amount of time
 */
const wait = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.wait = wait;
/**
 * Generate random test data
 */
const generateRandomString = (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
exports.generateRandomString = generateRandomString;
const generateRandomEmail = () => {
    return `test-${(0, exports.generateRandomString)(8)}@example.com`;
};
exports.generateRandomEmail = generateRandomEmail;
const generateRandomNumber = (min = 0, max = 100) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};
exports.generateRandomNumber = generateRandomNumber;
/**
 * Mock external services for testing
 */
exports.mockStripeService = {
    createAccount: jest.fn().mockResolvedValue({ id: 'acct_test_123' }),
    createPaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_test_123' }),
    confirmPayment: jest.fn().mockResolvedValue({ status: 'succeeded' }),
};
exports.mockCloudinaryService = {
    upload: jest.fn().mockResolvedValue({
        public_id: 'test_upload_123',
        secure_url: 'https://res.cloudinary.com/test/image/upload/test_upload_123.jpg',
    }),
    destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
};
exports.mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(true),
    sendOTP: jest.fn().mockResolvedValue(true),
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
};
