import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { User } from '../User/user.model';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import crypto from 'crypto';

/**
 * Generate a new TOTP secret for a user
 * @returns Object containing secret and otpauth URL
 */
export const generateTOTPSecret = async (email: string, issuer: string = 'GreenUniMind') => {
  // Generate a new secret
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `${issuer}:${email}`,
    issuer,
  });

  // Generate QR code
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrCodeUrl,
  };
};

/**
 * Verify a TOTP token against a secret
 * @param token The token to verify
 * @param secret The secret to verify against
 * @returns Boolean indicating if the token is valid
 */
export const verifyTOTP = (token: string, secret: string): boolean => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 1 step before and after current time (30 seconds each)
  });
};

/**
 * Generate recovery codes for a user
 * @param count Number of recovery codes to generate
 * @returns Array of recovery codes
 */
export const generateRecoveryCodes = (count: number = 10): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate a random code in format: XXXX-XXXX-XXXX
    const code = `${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    codes.push(code);
  }
  return codes;
};

/**
 * Setup 2FA for a user
 * @param userId User ID
 * @param enable Whether to enable or disable 2FA
 * @returns Object containing 2FA setup information
 */
export const setupTwoFactor = async (userId: string, enable: boolean) => {
  const user = await User.findById(userId).select('+twoFactorSecret +twoFactorRecoveryCodes');
  
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (enable) {
    // Generate new secret and recovery codes if enabling 2FA
    const { secret, otpauthUrl, qrCodeUrl } = await generateTOTPSecret(user.email);
    const recoveryCodes = generateRecoveryCodes();

    // Save the secret and recovery codes but don't enable 2FA yet
    // It will be enabled after verification
    user.twoFactorSecret = secret;
    user.twoFactorRecoveryCodes = recoveryCodes;
    await user.save();

    return {
      secret,
      otpauthUrl,
      qrCodeUrl,
      recoveryCodes,
      enabled: false,
    };
  } else {
    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorRecoveryCodes = [];
    await user.save();

    return {
      enabled: false,
    };
  }
};

/**
 * Verify a user's 2FA token during setup
 * @param userId User ID
 * @param token TOTP token to verify
 * @returns Object indicating success
 */
export const verifyTwoFactorSetup = async (userId: string, token: string) => {
  const user = await User.findById(userId).select('+twoFactorSecret');
  
  if (!user || !user.twoFactorSecret) {
    throw new AppError(httpStatus.NOT_FOUND, '2FA setup not found');
  }

  const isValid = verifyTOTP(token, user.twoFactorSecret);
  
  if (!isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid verification code');
  }

  // Enable 2FA after successful verification
  user.twoFactorEnabled = true;
  await user.save();

  return {
    success: true,
    enabled: true,
  };
};

/**
 * Verify a user's 2FA token during login
 * @param email User email
 * @param token TOTP token to verify
 * @returns Boolean indicating if the token is valid
 */
export const verifyTwoFactorLogin = async (email: string, token: string) => {
  const user = await User.findOne({ email }).select('+twoFactorSecret +twoFactorRecoveryCodes');
  
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Two-factor authentication is not enabled');
  }

  // Check if the token is a recovery code
  if (user.twoFactorRecoveryCodes?.includes(token)) {
    // Remove the used recovery code
    user.twoFactorRecoveryCodes = user.twoFactorRecoveryCodes.filter(code => code !== token);
    await user.save();
    return true;
  }

  // Verify TOTP token
  return verifyTOTP(token, user.twoFactorSecret);
};
