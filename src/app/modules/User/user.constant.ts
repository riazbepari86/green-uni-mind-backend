export const USER_ROLE = {
  user: 'user',
  student: 'student',
  teacher: 'teacher',
  admin: 'admin',
} as const;

export const UserRole = ['teacher', 'student', 'user', 'admin'];

export const UserStatus = ['in-progress', 'blocked'];

export const AdminSearchableFields = [
  'name',
  'email',
  'role',
  'status',
  'isDeleted',
  'isVerified',
];
