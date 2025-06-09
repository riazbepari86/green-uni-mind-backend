import mongoose, { startSession } from 'mongoose';
import {
  deleteFileFromCloudinary,
  extractPublicIdFromUrl,
  sendFileToCloudinary,
} from '../../utils/sendImageToCloudinary';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { createToken } from '../Auth/auth.utils';
import config from '../../config';
import { StringValue } from '../Auth/auth.constant';
import { USER_ROLE } from '../User/user.constant';
import { IUser } from '../User/user.interface';
import { User } from '../User/user.model';

type CreateUserAndProfileParams<T> = {
  file: any;
  password: string;
  payload: T;
  role: keyof typeof USER_ROLE;
  Model: mongoose.Model<T>;
};

type UpdateUserProfileParams<T> = {
  id: string;
  payload: Partial<T>;
  file?: any;
  Model: mongoose.Model<T>;
};

export function generateSafeImageName(name: any): string {
  if (typeof name === 'string') return name.replace(/\s+/g, '_');
  if (typeof name === 'object' && name !== null)
    return Object.values(name).join('_').replace(/\s+/g, '_');
  return 'profile';
}

export const createUserAndProfileIntoDB = async <
  T extends {
    email: string;
    name: any;
    profileImg?: string;
    user?: mongoose.Types.ObjectId;
  },
>(
  params: CreateUserAndProfileParams<T>,
) => {
  const { file, password, payload, role, Model } = params;

  const userData: Partial<IUser> = {
    role,
    password,
    email: payload.email,
  };

  const session = await startSession();
  session.startTransaction();

  try {
    if (file?.path) {
      const rawName = (payload as any)?.name || 'profile';
      const imageName = `${generateSafeImageName(rawName)}_${Date.now()}`;

      // Handle Cloudinary upload with rejection handling
      const { secure_url } = await sendFileToCloudinary(imageName, file.path).catch((err) => {
        console.error('Error uploading image to Cloudinary:', err);
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to upload image');
      });

      payload.profileImg = secure_url;
    }

    const [newUser] = await User.create([userData], { session });
    if (!newUser) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Failed to create user');
    }

    payload.user = new mongoose.Types.ObjectId(newUser._id);

    const [newProfile] = await Model.create([payload], { session });
    if (!newProfile) {
      throw new AppError(httpStatus.BAD_REQUEST, `Failed to create ${role}`);
    }

    await session.commitTransaction();
    session.endSession();

    const jwtPayload = { email: payload.email, role: userData.role as string };

    const accessToken = createToken(
      jwtPayload,
      config.jwt_access_secret as string,
      config.jwt_access_expires_in as StringValue,
    );
    const refreshToken = createToken(
      jwtPayload,
      config.jwt_refresh_secret as string,
      config.jwt_refresh_expires_in as StringValue,
    );

    return { newProfile, accessToken, refreshToken };
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error creating user and profile:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create ${role}`,
    );
  }
};

export const updateProfileIntoDB = async <
  T extends { profileImg?: string; user?: mongoose.Types.ObjectId },
>(
  params: UpdateUserProfileParams<T>,
) => {
  const { id, payload, file, Model } = params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const profile = await Model.findById(id).session(session).populate('user');
    if (!profile) {
      throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
    }

    if (file?.path) {
      const publicId = extractPublicIdFromUrl(profile.profileImg || '');
      const deleteOldImage = publicId
        ? deleteFileFromCloudinary(publicId).catch((err) => {
            console.error('Error deleting image from Cloudinary:', err);
            return null; // Or return a default response
          })
        : Promise.resolve();

      const nameForImage =
        (payload as any)?.firstName || (profile as any)?.name || 'profile';
      const imageName = `${generateSafeImageName(nameForImage)}_${Date.now()}`;

      const uploadNewImage = sendFileToCloudinary(imageName, file.path).catch((err) => {
        console.error('Error uploading image to Cloudinary:', err);
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to upload image');
      });

      const [, { secure_url }] = await Promise.all([
        deleteOldImage,
        uploadNewImage,
      ]);
      profile.profileImg = secure_url;
    }

    // Update name if provided (optional based on your structure)
    if ((payload as any).name) {
      (profile as any).name = {
        ...((profile as any).name || {}),
        ...(payload as any).name,
      };
    }

    // Update rest of the fields
    Object.assign(profile, payload);

    const updatedProfile = await profile.save({ session });

    // Update user photoUrl
    if (profile.user) {
      await User.findByIdAndUpdate(
        profile.user,
        { photoUrl: profile.profileImg },
        { new: true, runValidators: true, session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    return updatedProfile;
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error updating profile:', error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to update profile: ${error.message || error}`,
    );
  }
};
