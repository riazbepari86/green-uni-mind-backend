import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserServices } from './user.service';
import httpStatus from 'http-status';

const createStudent = catchAsync(async (req, res) => {
  const { password, student: studentData } = req.body;

  const result = await UserServices.createStudentIntoDB(
    req.file,
    password,
    studentData,
  );

  // Don't set cookies since user is not verified yet
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: {
      newStudent: result.newStudent,
      isVerified: result.isVerified,
      email: studentData.email,
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
    },
  });
});

const createTeacher = catchAsync(async (req, res) => {
  const { password, teacher: teacherData } = req.body;

  const result = await UserServices.createTeacherIntoDB(
    req.file,
    password,
    teacherData,
  );

  // Don't set cookies since user is not verified yet
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: {
      newTeacher: result.newTeacher,
      isVerified: result.isVerified,
      email: teacherData.email,
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
    },
  });
});

const getAllUsers = catchAsync(async (req, res) => {
  const result = await UserServices.getAllUserFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Users are retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

const getSingleUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { _id, role } = req.user!;

  // Allow teachers to access any user, but students and regular users can only access their own data
  if (role !== 'teacher' && _id !== id) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message: 'You can only access your own user data',
      data: null,
    });
  }

  const result = await UserServices.getSingleUserFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User retrieved successfully!',
    data: result,
  });
});

const changeStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const result = await UserServices.changeStatus(id, status);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Status is updated successfully',
    data: result,
  });
});

const getMe = catchAsync(async (req, res) => {
  const { email, role } = req.user!;

  const result = await UserServices.getMe(email, role);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User is retrieved successfully',
    data: result,
  });
});

const updateUserProfile = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { role } = req.user!;

  const result = await UserServices.updateUserProfile(
    id,
    req.body,
    role,
    req.file,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User is updated successfully',
    data: result,
  });
});

export const UserControllers = {
  // registerUser,
  createStudent,
  createTeacher,
  getAllUsers,
  getSingleUser,
  getMe,
  changeStatus,
  updateUserProfile,
};
