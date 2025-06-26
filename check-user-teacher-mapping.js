const mongoose = require('mongoose');

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://green-uni-mind:J9qQFljSzNMb5Zip@cluster0.vpkexdv.mongodb.net/green-uni-mind?retryWrites=true&w=majority&appName=Cluster0');

// Define schemas
const userSchema = new mongoose.Schema({
  email: String,
  role: String,
  // other fields...
}, { collection: 'users' });

const teacherSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // other fields...
}, { collection: 'teachers' });

const User = mongoose.model('User', userSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);

async function checkUserTeacherMapping() {
  try {
    console.log('🔍 Checking User-Teacher mapping for hasanhridoymahabub9@gmail.com\n');
    
    // Find the user by email
    const user = await User.findOne({ email: 'hasanhridoymahabub9@gmail.com' });
    
    if (user) {
      console.log('👤 Found User:');
      console.log('   User ID:', user._id.toString());
      console.log('   Email:', user.email);
      console.log('   Role:', user.role);
      
      // Check if this user has a teacher document
      const teacher = await Teacher.findOne({ user: user._id });
      
      if (teacher) {
        console.log('\n📚 Found Teacher Document:');
        console.log('   Teacher ID:', teacher._id.toString());
        console.log('   User Reference:', teacher.user.toString());
        console.log('   ✅ User-Teacher mapping is correct!');
        
        console.log('\n🎯 SOLUTION:');
        console.log('   Use User ID in JWT token:', user._id.toString());
        console.log('   Use User ID as teacherId parameter:', user._id.toString());
        console.log('   Helper function will resolve to Teacher ID:', teacher._id.toString());
      } else {
        console.log('\n❌ No Teacher document found for this user');
        
        // Check if there are any teacher documents with different user IDs
        console.log('\n🔍 Checking all teacher documents:');
        const allTeachers = await Teacher.find({}).limit(5);
        allTeachers.forEach((t, index) => {
          console.log(`   ${index + 1}. Teacher ID: ${t._id}, User ID: ${t.user}`);
        });
      }
    } else {
      console.log('❌ No user found with email: hasanhridoymahabub9@gmail.com');
    }
    
    // Also check the specific IDs we've been working with
    console.log('\n🔍 Checking specific IDs from our testing:');
    
    const userById1 = await User.findById('685c1b673a862730dd0a3b1e');
    console.log('User 685c1b673a862730dd0a3b1e:', userById1 ? `Found (${userById1.email}, ${userById1.role})` : 'Not found');
    
    const userById2 = await User.findById('685bcf296aeec36c71a77d89');
    console.log('User 685bcf296aeec36c71a77d89:', userById2 ? `Found (${userById2.email}, ${userById2.role})` : 'Not found');
    
    const teacherById = await Teacher.findById('685c1b673a862730dd0a3b21');
    console.log('Teacher 685c1b673a862730dd0a3b21:', teacherById ? `Found (User: ${teacherById.user})` : 'Not found');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    mongoose.connection.close();
  }
}

checkUserTeacherMapping();
