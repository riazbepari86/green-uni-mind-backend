const mongoose = require('mongoose');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect('mongodb+srv://green-uni-mind:J9qQFljSzNMb5Zip@cluster0.vpkexdv.mongodb.net/green-uni-mind?retryWrites=true&w=majority&appName=Cluster0');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// User schema (simplified)
const userSchema = new mongoose.Schema({
  email: String,
  role: String,
  isOAuthUser: Boolean,
  googleId: String,
  isVerified: Boolean,
  status: String
}, { collection: 'users' });

const studentSchema = new mongoose.Schema({
  email: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { collection: 'students' });

const teacherSchema = new mongoose.Schema({
  email: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { collection: 'teachers' });

const User = mongoose.model('User', userSchema);
const Student = mongoose.model('Student', studentSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);

async function debugUser(email) {
  console.log(`🔍 Searching for user with email: ${email}`);
  
  // Check User collection
  const user = await User.findOne({ email });
  console.log('\n📊 User Collection Result:');
  if (user) {
    console.log('✅ Found in User collection:', {
      _id: user._id,
      email: user.email,
      role: user.role,
      isOAuthUser: user.isOAuthUser,
      googleId: user.googleId,
      isVerified: user.isVerified,
      status: user.status
    });
  } else {
    console.log('❌ Not found in User collection');
    
    // Check for case-insensitive match
    const caseInsensitiveUser = await User.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    });
    if (caseInsensitiveUser) {
      console.log('⚠️ Found case-insensitive match:', caseInsensitiveUser.email);
    }
  }
  
  // Check Student collection
  const student = await Student.findOne({ email }).populate('user');
  console.log('\n📊 Student Collection Result:');
  if (student) {
    console.log('✅ Found in Student collection:', {
      _id: student._id,
      email: student.email,
      user: student.user ? {
        _id: student.user._id,
        email: student.user.email,
        role: student.user.role
      } : null
    });
  } else {
    console.log('❌ Not found in Student collection');
  }
  
  // Check Teacher collection
  const teacher = await Teacher.findOne({ email }).populate('user');
  console.log('\n📊 Teacher Collection Result:');
  if (teacher) {
    console.log('✅ Found in Teacher collection:', {
      _id: teacher._id,
      email: teacher.email,
      user: teacher.user ? {
        _id: teacher.user._id,
        email: teacher.user.email,
        role: teacher.user.role
      } : null
    });
  } else {
    console.log('❌ Not found in Teacher collection');
  }
}

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.log('Usage: node debug-user.js <email>');
    console.log('Example: node debug-user.js hasanhridoymahabub9@gmail.com');
    process.exit(1);
  }
  
  await connectDB();
  await debugUser(email);
  await mongoose.disconnect();
  console.log('\n✅ Database connection closed');
}

main().catch(console.error);
