import { Model } from 'mongoose';
import { USER_ROLE } from './user.constant';

export interface IUser {
  _id?: string;
  email: string;
  password: string;
  passwordChangedAt?: Date;
  role: 'user' | 'teacher' | 'student';
  photoUrl?: string;
  status: 'in-progress' | 'blocked';
  isDeleted: boolean;
  isVerified?: boolean;
  refreshToken?: string;
  accessToken?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  // Email verification fields
  emailVerificationCode?: string;
  emailVerificationExpiry?: Date;
  // OAuth provider fields
  googleId?: string;
  facebookId?: string;
  appleId?: string;
  isOAuthUser?: boolean;
  // OAuth connection status
  connectedAccounts?: {
    google?: boolean;
    facebook?: boolean;
    apple?: boolean;
  };
  // Two-factor authentication fields
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: string[];
  twoFactorRecoveryCodes?: string[];
}

export interface UserModel extends Model<IUser> {
  //instance methods for checking if the user exist
  isUserExists(email: string): Promise<IUser>;
  //instance methods for checking if passwords are matched

  isPasswordMatched(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean>;
  isJWTIssuedBeforePasswordChanged(
    passwordChangedTimestamp: Date,
    jwtIssuedTimestamp: number,
  ): boolean;
}

export type IUserRole = keyof typeof USER_ROLE;
