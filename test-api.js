const axios = require('axios');

async function testAPI() {
  try {
    const teacherId = '685c1b673a862730dd0a3b21';
    const url = `http://localhost:5000/api/v1/courses/creator/${teacherId}`;
    
    console.log(`Testing API: ${url}`);
    
    const response = await axios.get(url);
    
    console.log('\n📊 API Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data?.data) {
      console.log('\n📚 Courses found:', response.data.data.length);
      response.data.data.forEach((course, index) => {
        console.log(`\n${index + 1}. ${course.title}`);
        console.log(`   ID: ${course._id}`);
        console.log(`   Lectures: ${course.lectures?.length || 0} (${typeof course.lectures})`);
        if (course.lectures && course.lectures.length > 0) {
          console.log(`   First lecture type: ${typeof course.lectures[0]}`);
          if (typeof course.lectures[0] === 'object') {
            console.log(`   First lecture: ${course.lectures[0].lectureTitle || course.lectures[0].title}`);
          }
        }
      });
    }
    
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
  }
}

testAPI();
