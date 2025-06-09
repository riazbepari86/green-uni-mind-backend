import { JwtPayload } from 'jsonwebtoken';

export interface JwtUserPayload extends JwtPayload {
  email: string;
  role: 'user' | 'teacher' | 'student';
  _id?: string;
  iat?: number;
  exp?: number;
}

export interface OAuthUserPayload {
  userId: string;
  provider: 'google' | 'facebook' | 'apple';
  providerId: string;
  email?: string;
}

export interface TwoFactorSetupPayload {
  secret: string;
  otpAuthUrl: string;
  qrCodeUrl: string;
}

export interface TwoFactorVerifyPayload {
  token: string;
  userId: string;
}

export interface TwoFactorDisablePayload {
  token: string;
  userId: string;
  password: string;
}
