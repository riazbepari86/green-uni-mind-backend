// MongoDB initialization script for Docker
// This script runs when the MongoDB container starts for the first time

// Switch to the application database
db = db.getSiblingDB('green-uni-mind');

// Create application user with read/write permissions
db.createUser({
  user: 'app_user',
  pwd: 'app_password',
  roles: [
    {
      role: 'readWrite',
      db: 'green-uni-mind'
    }
  ]
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ id: 1 }, { unique: true });
db.users.createIndex({ createdAt: 1 });

db.students.createIndex({ id: 1 }, { unique: true });
db.students.createIndex({ email: 1 }, { unique: true });
db.students.createIndex({ user: 1 });

db.teachers.createIndex({ id: 1 }, { unique: true });
db.teachers.createIndex({ email: 1 }, { unique: true });
db.teachers.createIndex({ user: 1 });

db.admins.createIndex({ id: 1 }, { unique: true });
db.admins.createIndex({ email: 1 }, { unique: true });
db.admins.createIndex({ user: 1 });

db.courses.createIndex({ title: 1 });
db.courses.createIndex({ category: 1 });
db.courses.createIndex({ createdAt: 1 });

db.enrollments.createIndex({ student: 1, course: 1 }, { unique: true });
db.enrollments.createIndex({ student: 1 });
db.enrollments.createIndex({ course: 1 });

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'role'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        },
        role: {
          bsonType: 'string',
          enum: ['student', 'teacher', 'admin']
        }
      }
    }
  }
});

print('MongoDB initialization completed successfully');
print('Database: green-uni-mind');
print('User: app_user created with readWrite permissions');
print('Indexes created for optimal performance');
print('Collections created with validation rules');
