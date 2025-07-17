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

// Course schema (simplified)
const courseSchema = new mongoose.Schema({
  title: String,
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  isPublished: Boolean,
  status: String,
  lectures: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' }]
}, { collection: 'courses' });

const lectureSchema = new mongoose.Schema({
  lectureTitle: String,
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  instruction: String,
  duration: Number,
  order: Number
}, { collection: 'lectures' });

const teacherSchema = new mongoose.Schema({
  email: String,
  name: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { collection: 'teachers' });

const Course = mongoose.model('Course', courseSchema);
const Lecture = mongoose.model('Lecture', lectureSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);

async function debugCourses(teacherId) {
  console.log(`🔍 Searching for courses with teacher ID: ${teacherId}`);
  
  // Check if teacher exists
  const teacher = await Teacher.findById(teacherId);
  console.log('\n📊 Teacher Check:');
  if (teacher) {
    console.log('✅ Found teacher:', {
      _id: teacher._id,
      email: teacher.email,
      name: teacher.name
    });
  } else {
    console.log('❌ Teacher not found');
    return;
  }
  
  // Get all courses for this teacher
  const courses = await Course.find({ creator: teacherId }).populate('creator');
  console.log('\n📊 Courses for this teacher:');
  console.log(`Found ${courses.length} courses`);
  
  for (const course of courses) {
    console.log(`\n📚 Course: ${course.title}`);
    console.log(`   ID: ${course._id}`);
    console.log(`   Creator: ${course.creator?.name || 'Unknown'} (${course.creator?._id})`);
    console.log(`   Published: ${course.isPublished}`);
    console.log(`   Status: ${course.status}`);
    console.log(`   Lectures array length: ${course.lectures?.length || 0}`);
    
    // Get lectures for this course
    const lectures = await Lecture.find({ courseId: course._id });
    console.log(`   Actual lectures in DB: ${lectures.length}`);
    
    if (lectures.length > 0) {
      console.log('   📝 Lectures:');
      lectures.forEach((lecture, index) => {
        console.log(`      ${index + 1}. ${lecture.lectureTitle}`);
        console.log(`         ID: ${lecture._id}`);
        console.log(`         Course ID: ${lecture.courseId}`);
        console.log(`         Duration: ${lecture.duration} minutes`);
        console.log(`         Order: ${lecture.order}`);
      });
    }
  }
  
  // Get all courses in database
  console.log('\n📊 All courses in database:');
  const allCourses = await Course.find({}).populate('creator');
  console.log(`Total courses in DB: ${allCourses.length}`);
  
  allCourses.forEach((course, index) => {
    console.log(`${index + 1}. ${course.title} (ID: ${course._id})`);
    console.log(`   Creator: ${course.creator?.name || 'Unknown'} (${course.creator?._id})`);
  });
  
  // Get all lectures in database
  console.log('\n📊 All lectures in database:');
  const allLectures = await Lecture.find({});
  console.log(`Total lectures in DB: ${allLectures.length}`);
  
  allLectures.forEach((lecture, index) => {
    console.log(`${index + 1}. ${lecture.lectureTitle} (ID: ${lecture._id})`);
    console.log(`   Course ID: ${lecture.courseId}`);
  });
}

async function main() {
  const teacherId = process.argv[2] || '685c1b673a862730dd0a3b21'; // Default teacher ID
  
  console.log(`Using teacher ID: ${teacherId}`);
  
  await connectDB();
  await debugCourses(teacherId);
  await mongoose.disconnect();
  console.log('\n✅ Database connection closed');
}

main().catch(console.error);
