const mongoose = require('mongoose');
const crypto = require('crypto');

// MongoDB connection
const MONGODB_URI =
  'mongodb+srv://green-uni-mind:J9qQFljSzNMb5Zip@cluster0.vpkexdv.mongodb.net/green-uni-mind?retryWrites=true&w=majority&appName=Cluster0';

// User schema (simplified)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student',
  },
  status: {
    type: String,
    enum: ['in-progress', 'blocked'],
    default: 'in-progress',
  },
  isVerified: { type: Boolean, default: true },
  isOAuthUser: { type: Boolean, default: false },
  profileImg: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

async function createTestStudent() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if student already exists
    const existingStudent = await User.findOne({
      email: 'student@example.com',
    });
    if (existingStudent) {
      console.log('✅ Student user already exists:', existingStudent._id);
      return existingStudent;
    }

    // Hash password (simple hash for testing)
    const hashedPassword = crypto
      .createHash('sha256')
      .update('password123')
      .digest('hex');

    // Create test student user
    const studentData = {
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      name: 'Test Student',
      email: 'student@example.com',
      password: hashedPassword,
      role: 'student',
      status: 'in-progress',
      isVerified: true,
      isOAuthUser: false,
      profileImg: 'https://via.placeholder.com/150',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const student = new User(studentData);
    await student.save();

    console.log('✅ Test student created successfully:');
    console.log('   ID:', student._id);
    console.log('   Email:', student.email);
    console.log('   Role:', student.role);

    return student;
  } catch (error) {
    console.error('❌ Error creating test student:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createTestStudent()
  .then(() => {
    console.log('🎉 Test student creation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed to create test student:', error);
    process.exit(1);
  });
