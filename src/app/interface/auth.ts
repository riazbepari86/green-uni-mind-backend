import { JwtPayload } from 'jsonwebtoken';

export interface JwtUserPayload extends JwtPayload {
  _id: string;
  id?: string; 
  email: string;
  role: 'user' | 'teacher' | 'student';
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
