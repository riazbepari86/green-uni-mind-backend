"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSearchableFields = exports.UserStatus = exports.UserRole = exports.USER_ROLE = void 0;
exports.USER_ROLE = {
    user: 'user',
    student: 'student',
    teacher: 'teacher',
    admin: 'admin',
};
exports.UserRole = ['teacher', 'student', 'user', 'admin'];
exports.UserStatus = ['in-progress', 'blocked'];
exports.AdminSearchableFields = [
    'name',
    'email',
    'role',
    'status',
    'isDeleted',
    'isVerified',
];
